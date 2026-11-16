// End-to-end check of the Host half: register the real route through a mock
// Cordis context, then drive it exactly like the client would.
//
// Run it with the DSH Electron binary in Node mode so that
// `process.execPath` resolves to the real app bundle:
//
//   ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
//     tests/host-e2e.mjs
//
// The test keeps every write inside a throwaway temp directory by pointing
// HOME there, so a run never leaves anything behind in the workspace.

import { spawn } from 'node:child_process'
import { access, mkdir, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sandboxHome = path.join(os.tmpdir(), `fishread-host-e2e-${process.pid}`)
process.env.HOME = sandboxHome
await mkdir(sandboxHome, { recursive: true })

const results = []
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const disposers = []
const spawned = []

// DSH's local subprocess provider never hands `spec.env` to spawn as-is: it
// merges it over a scrubbed copy of the parent environment and drops undefined
// entries afterwards. A plugin therefore cannot remove an inherited variable by
// deleting it from its copy — only an explicit `undefined` tombstone works.
// Modelled here so this test fails when the Host half relies on `delete`.
const SENSITIVE_ENV = /KEY|PASSWORD|SECRET|TOKEN/i
function dshChildEnv(explicit) {
  // DSH desktop always exports this: its Electron binary runs the Host as Node.
  // Seeded so the regression check below holds even when this test is launched
  // from a shell that does not inherit the variable.
  const env = { ELECTRON_RUN_AS_NODE: '1' }
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || SENSITIVE_ENV.test(key) || key.toUpperCase().startsWith('DSH_')) continue
    env[key] = value
  }
  for (const [key, value] of Object.entries(explicit ?? {})) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return env
}

let lastSpawnEnv = null
const ctx = {
  effect(fn) {
    const disposer = fn()
    disposers.push(disposer)
    return disposer
  },
  connection: {
    fetch: {
      register(spec) {
        ctx.__route = spec
        return () => {
          ctx.__route = null
        }
      },
    },
  },
  subprocess: {
    spawn(spec) {
      const env = dshChildEnv(spec.env)
      lastSpawnEnv = env
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      spawned.push(child)
      const done = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve({ exitCode: code, signal }))
      })
      return {
        stdin: child.stdin,
        stdout: child.stdout,
        stderr: child.stderr,
        done,
        terminate() {
          child.kill('SIGTERM')
        },
        waitForExit() {
          return done
        },
      }
    },
  },
}

const { apply } = await import('../index.js')
apply(ctx)

if (!ctx.__route) {
  console.error('FAIL  route was not registered')
  process.exit(1)
}
check('route registered', ctx.__route.path === '/api/fishread' && ctx.__route.methods.includes('POST'))

let actionCounter = 0
async function call(action, extra = {}) {
  const request = new Request(`http://127.0.0.1${ctx.__route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  actionCounter += 1
  const response = await ctx.__route.fetch(request)
  const body = await response.json()
  return { status: response.status, body }
}

async function waitFor(label, predicate, timeoutMs = 120000) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    const state = await call('state')
    last = state.body
    if (predicate(last)) return last
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return last
}

try {
  const initial = await call('state')
  check('state returns defaults', initial.status === 200 && initial.body.prefs.reading.fontSize === 14)
  check('state reports mac platform', initial.body.platform === 'mac')

  const pref = await call('save-prefs', { patch: { reading: { fontSize: 18, lineHeight: 1.8 } } })
  check('save-prefs merges a subset', pref.body.prefs.reading.fontSize === 18 && pref.body.prefs.reading.lineHeight === 1.8)
  check('save-prefs keeps other reading fields', pref.body.prefs.reading.theme === 'system' && pref.body.prefs.reading.indent === 2)
  check('save-prefs keeps shortcuts', pref.body.prefs.shortcuts.toggle === 'Control+;')

  const rebound = await call('save-shortcuts', { shortcuts: { toggle: 'Alt+;' } })
  check('save-shortcuts accepts a new combo', rebound.status === 200 && rebound.body.prefs.shortcuts.toggle === 'Alt+;')
  check('save-shortcuts keeps reading prefs', rebound.body.prefs.reading.fontSize === 18)

  const conflict = await call('save-shortcuts', { shortcuts: { nextPage: 'Alt+;' } })
  check('save-shortcuts rejects duplicates', conflict.status === 409 && conflict.body.code === 'conflict')

  const invalid = await call('save-shortcuts', { shortcuts: { prevPage: 'F5' } })
  check('save-shortcuts rejects a single key', invalid.status === 400)

  const reset = await call('reset-shortcut', { name: 'toggle' })
  check('reset-shortcut restores the default', reset.body.prefs.shortcuts.toggle === 'Control+;')
  check('reset-shortcut keeps reading prefs', reset.body.prefs.reading.fontSize === 18)

  console.log('… staging the runtime and opening the window (may take a minute)')
  const opened = await call('open')
  check('open returns ok', opened.status === 200 && opened.body.ok === true, JSON.stringify(opened.body))
  check(
    'window child never inherits ELECTRON_RUN_AS_NODE',
    lastSpawnEnv !== null && !('ELECTRON_RUN_AS_NODE' in lastSpawnEnv),
    lastSpawnEnv === null ? 'no spawn recorded' : `ELECTRON_RUN_AS_NODE=${JSON.stringify(lastSpawnEnv.ELECTRON_RUN_AS_NODE)}`,
  )

  const visible = await waitFor('visible', (state) => state.window.state === 'visible')
  check('window becomes visible', visible?.window.state === 'visible', JSON.stringify(visible?.window))

  const hidden = await call('hide')
  check('hide hides the window', hidden.body.window.state === 'hidden')
  const stillHidden = await waitFor('hidden', (state) => state.window.state === 'hidden', 5000)
  check('hide is stable', stillHidden?.window.state === 'hidden')

  const reopened = await call('open')
  check('open focuses the existing window', reopened.body.window.state === 'visible')

  const cleared = await call('clear-data')
  check('clear-data responds ok', cleared.status === 200 && cleared.body.ok === true)
  const afterClear = await waitFor('closed', (state) => state.window.state === 'closed', 20000)
  check('clear-data closes the window', afterClear?.window.state === 'closed')
  let bookFileGone = false
  try {
    await access(path.join(afterClear.dataDir, 'book', 'book.json'))
  } catch {
    bookFileGone = true
  }
  check('clear-data removes the stored novel', bookFileGone)
  check('clear-data restores defaults', afterClear?.prefs.reading.fontSize === 14)

  // Regression: upgrading the plugin invalidates the marker, so the next open
  // restages over the bundle that is already on disk. A removal that gives up on
  // the first ENOTEMPTY used to abort that path with
  // "ENOTEMPTY: directory not empty, rmdir …/Contents/Resources".
  console.log('… restaging over the existing runtime bundle (may take a minute)')
  await rm(path.join(afterClear.dataDir, 'runtime', 'runtime.json'), { force: true })
  const restaged = await call('open')
  check(
    'a restage over the existing bundle reopens the window',
    restaged.status === 200 && restaged.body.ok === true && restaged.body.window.state === 'visible',
    JSON.stringify(restaged.body),
  )
  const runtimeEntries = await readdir(path.join(afterClear.dataDir, 'runtime'))
  check(
    'a restage leaves no staging tree behind',
    runtimeEntries.every((name) => !/\.(staging|trash)-/.test(name)),
    runtimeEntries.join(','),
  )
} catch (error) {
  check('no unexpected error', false, error instanceof Error ? error.message : String(error))
} finally {
  for (const dispose of disposers) {
    try {
      await dispose()
    } catch {
      /* already gone */
    }
  }
  for (const child of spawned) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
  await rm(sandboxHome, { recursive: true, force: true }).catch(() => {})
}

const failed = results.filter((entry) => !entry.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
