/**
 * Window smoke test: stages the reader bundle from the installed DeepSeek
 * Harness Electron runtime, spawns it and drives the stdio protocol exactly the
 * way the Host does. Run with `node tests/window-smoke.mjs`. Pass
 * `FISHREAD_KEEP=1` to keep the staged app for debugging.
 */
import { execFile, spawn } from 'node:child_process'
import { chmod, copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const PLUGIN = path.dirname(ROOT)
const SOURCE_APP = '/Applications/DeepSeek Harness.app'
const WORK = '/tmp/fishread-smoke'
const APP = path.join(WORK, 'FishRead.app')

const CHAPTERS = [
  {
    title: '科学边界',
    body: '第一段正文，用来验证分章渲染。\n\n第二段正文，稍微长一点，看看滚动是否连续。\n\n第三段正文。',
  },
  {
    title: '射手与农场主',
    body: '第二章第一段。\n\n第二章第二段。',
  },
]

function log(...args) {
  console.log('[smoke]', ...args)
}

async function stage() {
  await rm(WORK, { recursive: true, force: true })
  const contents = path.join(APP, 'Contents')
  await mkdir(path.join(contents, 'MacOS'), { recursive: true })
  const source = path.join(SOURCE_APP, 'Contents')
  await copyFile(path.join(source, 'MacOS', 'DeepSeek Harness'), path.join(contents, 'MacOS', 'DeepSeek Harness'))
  await chmod(path.join(contents, 'MacOS', 'DeepSeek Harness'), 0o755)
  await execFileAsync('cp', ['-Rc', path.join(source, 'Frameworks'), path.join(contents, 'Frameworks')])
  await copyFile(path.join(source, 'Info.plist'), path.join(contents, 'Info.plist'))
  await copyFile(path.join(source, 'PkgInfo'), path.join(contents, 'PkgInfo'))
  const resources = path.join(contents, 'Resources')
  await mkdir(resources, { recursive: true })
  for (const item of await readdir(path.join(source, 'Resources'))) {
    if (item === 'app.asar') continue
    const from = path.join(source, 'Resources', item)
    const to = path.join(resources, item)
    if ((await stat(from)).isDirectory()) await execFileAsync('cp', ['-Rc', from, to])
    else await copyFile(from, to)
  }
  const app = path.join(resources, 'app')
  await mkdir(path.join(app, 'renderer'), { recursive: true })
  await mkdir(path.join(app, 'shared'), { recursive: true })
  await copyFile(path.join(PLUGIN, 'runtime', 'package.json'), path.join(app, 'package.json'))
  await copyFile(path.join(PLUGIN, 'runtime', 'main.js'), path.join(app, 'main.js'))
  await copyFile(path.join(PLUGIN, 'runtime', 'preload.cjs'), path.join(app, 'preload.cjs'))
  for (const name of ['index.html', 'reader.js', 'reader.css']) {
    await copyFile(path.join(PLUGIN, 'runtime', 'renderer', name), path.join(app, 'renderer', name))
  }
  for (const name of ['parse.js', 'i18n.js', 'prefs.js']) {
    await copyFile(path.join(PLUGIN, 'shared', name), path.join(app, 'shared', name))
  }
  await execFileAsync('codesign', ['--force', '--sign', '-', '--timestamp=none', APP], { timeout: 60_000 })
  log('staged', APP)
}

const chaptersMeta = []
let chars = 0
for (const [index, chapter] of CHAPTERS.entries()) {
  chaptersMeta.push({ index, title: chapter.title, charsBefore: chars })
  chars += chapter.body.replace(/\s/gu, '').length
}

const book = { version: 1, title: '三体', charCount: chars, chapters: CHAPTERS.map((c) => ({ title: c.title, body: c.body })) }

async function main() {
  await stage()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_INSPECT
  delete env.NODE_OPTIONS
  env.FISHREAD_DEBUG = '1'
  const child = spawn(path.join(APP, 'Contents', 'MacOS', 'DeepSeek Harness'), ['--no-sandbox', `--user-data-dir=${path.join(WORK, 'userdata')}`], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buffer = ''
  const seen = { ready: false, visible: false, chapter: false, saved: false, status: null }
  const pending = new Map()
  let id = 1
  const send = (method, params) => {
    const myId = id++
    child.stdin.write(`${JSON.stringify({ id: myId, method, params })}\n`)
    return new Promise((resolve, reject) => {
      pending.set(myId, { resolve, reject })
      setTimeout(() => reject(new Error(`timeout ${method}`)), 20_000)
    })
  }

  const handle = (line) => {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (message.event !== undefined) {
      log('event', message.event, JSON.stringify(message.data ?? null).slice(0, 200))
      if (message.event === 'ready') {
        seen.ready = true
        void send('init', {
          prefs: {
            window: { alwaysOnTop: false, restoreLastPosition: true, bounds: null },
            reading: { fontFamily: 'serif', fontSize: 16, lineHeight: 1.8, theme: 'sepia', indent: 2, showProgress: 'both' },
            shortcuts: { toggle: 'Control+;', prevPage: 'Control+,', nextPage: 'Control+.' },
          },
          locale: 'zh',
          book,
          chaptersMeta,
          progress: { chapterIndex: 0, charOffset: 0, percent: 0 },
        }).catch((error) => log('init failed', error.message))
        setTimeout(() => {
          void send('open').then((result) => log('open result', JSON.stringify(result)))
        }, 800)
      }
      if (message.event === 'window:state' && message.data?.state === 'visible') seen.visible = true
      if (message.event === 'shortcuts:status') seen.status = message.data
      return
    }
    if (message.method === 'chapter:get') {
      const index = message.params?.index ?? 0
      seen.chapter = true
      const chapter = CHAPTERS[index]
      child.stdin.write(
        `${JSON.stringify({
          id: message.id,
          result: {
            ok: chapter !== undefined,
            chapter: chapter === undefined ? null : { index, title: chapter.title, body: chapter.body, charsBefore: chaptersMeta[index].charsBefore },
          },
        })}\n`,
      )
      return
    }
    if (message.method === 'progress:save') {
      seen.saved = true
      child.stdin.write(`${JSON.stringify({ id: message.id, result: { ok: true } })}\n`)
      return
    }
    if (message.method !== undefined) {
      child.stdin.write(`${JSON.stringify({ id: message.id, result: { ok: true } })}\n`)
      return
    }
    if (message.id !== undefined) {
      pending.get(message.id)?.resolve(message.result)
      pending.delete(message.id)
    }
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line !== '') handle(line)
      index = buffer.indexOf('\n')
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => process.stderr.write(`[child] ${chunk}`))
  const closed = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })))

  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (seen.ready && seen.visible && seen.chapter && seen.saved) break
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  await new Promise((resolve) => setTimeout(resolve, 1_500))
  log('closing', JSON.stringify(seen))
  try {
    await send('close')
  } catch (error) {
    log('close call failed', error.message)
  }
  const exited = await Promise.race([closed, new Promise((resolve) => setTimeout(() => resolve(null), 8_000))])
  if (exited === null) {
    log('FAIL child did not exit')
    child.kill('SIGKILL')
    process.exitCode = 1
    return
  }
  log('exit', JSON.stringify(exited))
  const failures = []
  if (!seen.ready) failures.push('no ready event')
  if (!seen.visible) failures.push('window never became visible')
  if (!seen.chapter) failures.push('renderer never fetched a chapter')
  if (!seen.saved) failures.push('no progress save')
  if (exited.code !== 0) failures.push(`exit code ${exited.code}`)
  if (failures.length > 0) {
    log('FAIL', failures.join('; '))
    process.exitCode = 1
  } else {
    log('PASS')
  }
}

await main().finally(async () => {
  if (process.env.FISHREAD_KEEP === '1') {
    log('keeping', WORK)
    return
  }
  await rm(WORK, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
})
