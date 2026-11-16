/**
 * FishRead — Host half.
 *
 * The DSH profile never renders the novel: this file only owns storage, the
 * preferences and the lifecycle of the independent reader window. The window
 * itself is Electron's own runtime (already shipped inside DeepSeek Harness),
 * staged once into the plugin's private data directory and spawned as a child
 * process; Host and window speak newline-delimited JSON over stdio.
 *
 * @module dsh-fishread
 */
import { execFile } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import { access, chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { dictFor, normalizeLocale } from './shared/i18n.js'
import { countChars } from './shared/parse.js'
import { DEFAULT_PREFERENCES, MIN_BOUNDS, normalizePreferences, withShortcut } from './shared/prefs.js'

const execFileAsync = promisify(execFile)

const SETTINGS_PATH = '/api/fishread'
const RUNTIME_MARKER = 'runtime.json'
const WINDOW_READY_TIMEOUT = 20_000

function hasCookieValue(cookie) {
  return typeof cookie === 'string' && cookie.length > 0
}

const PLUGIN_VERSION = '0.1.3'

/* ------------------------------------------------------------------ paths */

/** @param {string} platform */
function dataRoot(platform) {
  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'dsh-fishread')
  }
  if (platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support', 'dsh-fishread')
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'dsh-fishread')
}

const PLATFORM = process.platform
const DATA_DIR = dataRoot(PLATFORM)
const BOOK_DIR = path.join(DATA_DIR, 'book')
const BOOK_PATH = path.join(BOOK_DIR, 'book.json')
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json')
const PROGRESS_PATH = path.join(DATA_DIR, 'progress.json')
const PREFERENCES_PATH = path.join(DATA_DIR, 'preferences.json')
const RUNTIME_DIR = path.join(DATA_DIR, 'runtime')
const RUNTIME_APP = path.join(RUNTIME_DIR, PLATFORM === 'darwin' ? 'FishRead.app' : 'FishRead')
const RUNTIME_USER_DATA = path.join(RUNTIME_DIR, 'userdata')

const WINDOW_EXECUTABLE =
  PLATFORM === 'darwin'
    ? path.join(RUNTIME_APP, 'Contents', 'MacOS', 'DeepSeek Harness')
    : path.join(RUNTIME_APP, PLATFORM === 'win32' ? 'DeepSeek Harness.exe' : 'fishread')

/* -------------------------------------------------------------- utilities */

/** @param {string} name @param {unknown} fallback */
async function readJson(name, fallback) {
  try {
    const text = await readFile(name, 'utf8')
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

/** Write JSON through a sibling temp file so a crash never truncates state. */
async function writeJson(name, value) {
  await mkdir(path.dirname(name), { recursive: true })
  const temp = `${name}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, name)
}

async function exists(target) {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ state */

const store = {
  prefs: normalizePreferences(DEFAULT_PREFERENCES),
  progress: { chapterIndex: 0, charOffset: 0, percent: 0 },
  metadata: null,
  book: null,
  bookLoaded: false,
  locale: normalizeLocale(null),
  dict: dictFor(normalizeLocale(null)),
  windowState: 'closed',
  shortcutsStatus: {},
  shortcutsError: null,
}

let bridge = null
let spawning = null
let noSandbox = false
let progressTimer = null
let boundsTimer = null
let disposed = false
/** @type {Promise<void> | null} */
let ready = null

/* ------------------------------------------------------------------ store */

async function loadBook() {
  if (store.bookLoaded) return store.book
  store.bookLoaded = true
  const book = await readJson(BOOK_PATH, null)
  store.book = book !== null && Array.isArray(book.chapters) ? book : null
  return store.book
}

async function loadAll() {
  await mkdir(DATA_DIR, { recursive: true })
  store.prefs = normalizePreferences(await readJson(PREFERENCES_PATH, DEFAULT_PREFERENCES))
  store.progress = await readJson(PROGRESS_PATH, { chapterIndex: 0, charOffset: 0, percent: 0 })
  store.metadata = await readJson(METADATA_PATH, null)
  const runtime = await readJson(path.join(RUNTIME_DIR, RUNTIME_MARKER), null)
  noSandbox = runtime?.noSandbox === true
  await loadBook()
  clampProgress()
}

/**
 * Delete the files that carry reading state. The staged runtime stays: it is
 * cheap to reuse (the copy shares blocks with the DSH bundle) and is rebuilt
 * automatically when it is missing.
 */
async function clearUserData() {
  const targets = [BOOK_DIR, METADATA_PATH, PROGRESS_PATH, PREFERENCES_PATH]
  for (const target of targets) {
    try {
      await rm(target, { recursive: true, force: true })
    } catch (error) {
      console.warn('[fishread] could not remove', target, error)
    }
  }
}

/** Merge one settings patch without dropping sibling keys. */
function mergePrefs(base, patch) {
  const input = typeof patch === 'object' && patch !== null ? patch : {}
  return normalizePreferences({
    window: { ...base.window, ...(typeof input.window === 'object' && input.window !== null ? input.window : {}) },
    reading: { ...base.reading, ...(typeof input.reading === 'object' && input.reading !== null ? input.reading : {}) },
    shortcuts: { ...base.shortcuts, ...(typeof input.shortcuts === 'object' && input.shortcuts !== null ? input.shortcuts : {}) },
  })
}

function clampProgress() {
  const book = store.book
  if (book === null) {
    store.progress = { chapterIndex: 0, charOffset: 0, percent: 0 }
    return
  }
  const last = Math.max(0, book.chapters.length - 1)
  const progress = store.progress ?? {}
  store.progress = {
    chapterIndex: Math.max(0, Math.min(last, Math.trunc(Number(progress.chapterIndex) || 0))),
    charOffset: Math.max(0, Math.trunc(Number(progress.charOffset) || 0)),
    percent: Math.min(100, Math.max(0, Number(progress.percent) || 0)),
  }
}

async function saveProgress(progress) {
  const value = {
    chapterIndex: Math.max(0, Math.trunc(Number(progress?.chapterIndex) || 0)),
    charOffset: Math.max(0, Math.trunc(Number(progress?.charOffset) || 0)),
    percent: Math.min(100, Math.max(0, Number(progress?.percent) || 0)),
  }
  store.progress = value
  await writeJson(PROGRESS_PATH, value)
}

function scheduleProgressSave(progress) {
  store.progress = {
    chapterIndex: Math.max(0, Math.trunc(Number(progress?.chapterIndex) || 0)),
    charOffset: Math.max(0, Math.trunc(Number(progress?.charOffset) || 0)),
    percent: Math.min(100, Math.max(0, Number(progress?.percent) || 0)),
  }
  if (progressTimer !== null) return
  progressTimer = setTimeout(() => {
    progressTimer = null
    void saveProgress(store.progress)
  }, 400)
}

async function savePrefs() {
  await writeJson(PREFERENCES_PATH, store.prefs)
}

function scheduleBoundsSave(bounds) {
  if (bounds === null || typeof bounds !== 'object') return
  const clean = {
    x: Math.round(Number(bounds.x) || 0),
    y: Math.round(Number(bounds.y) || 0),
    width: Math.max(MIN_BOUNDS.width, Math.round(Number(bounds.width) || MIN_BOUNDS.width)),
    height: Math.max(MIN_BOUNDS.height, Math.round(Number(bounds.height) || MIN_BOUNDS.height)),
  }
  store.prefs = normalizePreferences({ ...store.prefs, window: { ...store.prefs.window, bounds: clean } })
  if (boundsTimer !== null) return
  boundsTimer = setTimeout(() => {
    boundsTimer = null
    void savePrefs()
  }, 600)
}

/* -------------------------------------------------------------- the bridge */

const CHILD_HANDLERS = ['chapter:get', 'progress:save', 'prefs:update', 'window:bounds', 'book:import']

class Bridge {
  /** @param {import('node:stream').Readable} stdout */
  constructor(stdout, write) {
    this.pending = new Map()
    this.listeners = new Map()
    this.buffer = ''
    this.nextId = 1
    this.write = write
    stdout.setEncoding('utf8')
    stdout.on('data', (chunk) => this.consume(String(chunk)))
  }

  consume(chunk) {
    this.buffer += chunk
    let newline = this.buffer.indexOf('\n')
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      newline = this.buffer.indexOf('\n')
      if (line === '') continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      this.route(message)
    }
  }

  route(message) {
    if (typeof message?.id === 'number' && ('result' in message || 'error' in message)) {
      const pending = this.pending.get(message.id)
      if (pending === undefined) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if ('error' in message) pending.reject(new Error(message.error?.message ?? 'window error'))
      else pending.resolve(message.result)
      return
    }
    if (typeof message?.id === 'number' && typeof message?.method === 'string') {
      void this.answer(message)
      return
    }
    if (typeof message?.event === 'string') {
      this.emit(message.event, message.data)
    }
  }

  async answer(message) {
    try {
      const result = await handleChildRequest(message.method, message.params ?? {})
      this.write({ id: message.id, result: result ?? null })
    } catch (error) {
      this.write({ id: message.id, error: { message: error instanceof Error ? error.message : String(error) } })
    }
  }

  /** @param {string} method @param {unknown} [params] */
  request(method, params, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`window did not answer ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ id, method, params })
    })
  }

  /** @param {string} event @param {unknown} [data] */
  emit(event, data) {
    for (const listener of this.listeners.get(event) ?? []) listener(data)
  }

  on(event, listener) {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
  }

  waitFor(event, timeoutMs) {
    return new Promise((resolve, reject) => {
      const list = this.listeners.get(event) ?? []
      const timer = setTimeout(() => {
        const index = list.indexOf(wrapped)
        if (index >= 0) list.splice(index, 1)
        reject(new Error(`window never reported ${event}`))
      }, timeoutMs)
      const wrapped = (data) => {
        clearTimeout(timer)
        const index = list.indexOf(wrapped)
        if (index >= 0) list.splice(index, 1)
        resolve(data)
      }
      list.push(wrapped)
      this.listeners.set(event, list)
    })
  }

  rejectAll(error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}

/* ---------------------------------------------------------- child requests */

/** @param {string} method @param {any} params */
async function handleChildRequest(method, params) {
  switch (method) {
    case 'chapter:get': {
      const book = await loadBook()
      const index = Math.trunc(Number(params?.index))
      if (book === null || !Number.isFinite(index) || index < 0 || index >= book.chapters.length) {
        throw new Error('chapter unavailable')
      }
      const chapter = book.chapters[index]
      return {
        ok: true,
        chapter: {
          index,
          title: chapter.title,
          body: chapter.body,
          charsBefore: chapter.charsBefore ?? 0,
        },
      }
    }
    case 'progress:save': {
      scheduleProgressSave(params?.progress)
      return { ok: true }
    }
    case 'prefs:update': {
      store.prefs = normalizePreferences(params?.prefs ?? store.prefs)
      void savePrefs()
      return { ok: true }
    }
    case 'window:bounds': {
      scheduleBoundsSave(params?.bounds)
      return { ok: true }
    }
    case 'book:import': {
      const incoming = params?.book
      if (incoming === null || typeof incoming !== 'object' || !Array.isArray(incoming.chapters)) {
        return { ok: false, message: 'invalid book payload' }
      }
      await importBook(incoming, params?.encoding)
      return { ok: true, metadata: store.metadata, chaptersMeta: chaptersMetaOf(store.book), progress: store.progress }
    }
    default:
      throw new Error(`unsupported request: ${method}`)
  }
}

/** @param {{ title: string, chapters: Array<{ title: string, body: string }>, charCount: number }} incoming @param {string} [encoding] */
async function importBook(incoming, encoding) {
  let charsBefore = 0
  const chapters = incoming.chapters.map((chapter) => {
    const body = String(chapter.body ?? '').replace(/\r\n/gu, '\n')
    const title = String(chapter.title ?? '')
    const entry = {
      title,
      body,
      charsBefore,
      chars: countChars(body),
      ...(chapter.intro === true ? { intro: true } : {}),
    }
    charsBefore += entry.chars
    return entry
  })
  const book = {
    version: 1,
    title: String(incoming.title ?? ''),
    chapters,
    charCount: charsBefore,
  }
  await writeJson(BOOK_PATH, book)
  store.book = book
  store.bookLoaded = true
  store.progress = { chapterIndex: 0, charOffset: 0, percent: 0 }
  await writeJson(PROGRESS_PATH, store.progress)
  store.metadata = {
    version: 1,
    importedAt: new Date().toISOString(),
    title: book.title,
    chapterCount: chapters.filter((chapter) => chapter.intro !== true).length,
    charCount: book.charCount,
    encoding: encoding === 'gb18030' ? 'gb18030' : 'utf-8',
  }
  await writeJson(METADATA_PATH, store.metadata)
  return store.metadata
}

function chaptersMetaOf(book) {
  if (book === null) return []
  return book.chapters.map((chapter, index) => ({
    index,
    title: chapter.title,
    charsBefore: chapter.charsBefore ?? 0,
    ...(chapter.intro === true ? { intro: true } : {}),
  }))
}

/* ----------------------------------------------------------------- staging */

/** Locate the running DeepSeek Harness application (or install directory). */
function locateHarness() {
  const execPath = process.execPath
  if (PLATFORM === 'darwin') {
    let cursor = execPath
    while (cursor !== path.dirname(cursor)) {
      if (cursor.endsWith('.app')) return cursor
      cursor = path.dirname(cursor)
    }
    return null
  }
  return path.dirname(execPath)
}

async function copyRuntimeApp(destination) {
  const runtimeRoot = path.dirname(fileURLToPath(import.meta.url))
  const appDir = path.join(destination)
  await mkdir(path.join(appDir, 'renderer'), { recursive: true })
  await mkdir(path.join(appDir, 'shared'), { recursive: true })
  await copyFile(path.join(runtimeRoot, 'runtime', 'package.json'), path.join(appDir, 'package.json'))
  await copyFile(path.join(runtimeRoot, 'runtime', 'main.js'), path.join(appDir, 'main.js'))
  await copyFile(path.join(runtimeRoot, 'runtime', 'preload.cjs'), path.join(appDir, 'preload.cjs'))
  for (const name of ['index.html', 'reader.js', 'reader.css']) {
    await copyFile(
      path.join(runtimeRoot, 'runtime', 'renderer', name),
      path.join(appDir, 'renderer', name),
    )
  }
  for (const name of ['parse.js', 'i18n.js', 'prefs.js']) {
    await copyFile(path.join(runtimeRoot, 'shared', name), path.join(appDir, 'shared', name))
  }
}

/**
 * Copy one file or directory with the system `cp`.
 *
 * Node's `fs.copyFile` stalls indefinitely on the provenance-tagged files inside
 * the DSH bundle (`default_app.asar`), while `cp -c` clones them in milliseconds.
 * Electron also refuses to start from a bundle whose helper apps live behind a
 * symlink, so everything is copied for real, under a timeout.
 *
 * @param {string} from
 * @param {string} to
 */
async function copyEntry(from, to) {
  try {
    await execFileAsync('cp', ['-Rc', from, to], { timeout: 180_000 })
  } catch (error) {
    console.warn('[fishread] clone copy failed, falling back to a plain copy', from, error?.message)
    await removeTree(to)
    await execFileAsync('cp', ['-R', from, to], { timeout: 300_000 })
  }
}

/**
 * Remove a tree without tripping over ENOTEMPTY or a wedged `fs.rm`.
 *
 * Node's `fs.rm` reports ENOTEMPTY on — and sometimes blocks forever deleting —
 * the provenance-tagged files in the DSH bundle; `/bin/rm -rf` clears the same
 * trees immediately. Renaming the tree aside first frees the live path at once,
 * so a failed cleanup can never block or abort the caller; staging trees are
 * swept later.
 *
 * @param {string} target
 */
async function removeTree(target) {
  const trash = `${target}.trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await rename(target, trash)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  try {
    await execFileAsync('rm', ['-rf', '--', trash], { timeout: 120_000 })
  } catch (error) {
    console.warn('[fishread] could not remove leftover tree', trash, error)
  }
}

/** @param {string} sourceApp @param {string} target */
async function stageMac(sourceApp, target) {
  const contents = path.join(sourceApp, 'Contents')
  const targetContents = path.join(target, 'Contents')
  await mkdir(path.join(targetContents, 'MacOS'), { recursive: true })
  const executable = 'DeepSeek Harness'
  await copyEntry(path.join(contents, 'MacOS', executable), path.join(targetContents, 'MacOS', executable))
  await chmod(path.join(targetContents, 'MacOS', executable), 0o755)
  await mkdir(targetContents, { recursive: true })
  await copyEntry(path.join(contents, 'Frameworks'), path.join(targetContents, 'Frameworks'))
  await copyEntry(path.join(contents, 'Info.plist'), path.join(targetContents, 'Info.plist'))
  if (await exists(path.join(contents, 'PkgInfo'))) {
    await copyEntry(path.join(contents, 'PkgInfo'), path.join(targetContents, 'PkgInfo'))
  }
  const resources = path.join(targetContents, 'Resources')
  await mkdir(resources, { recursive: true })
  for (const item of await readdir(path.join(contents, 'Resources'))) {
    if (item === 'app.asar') continue
    await copyEntry(path.join(contents, 'Resources', item), path.join(resources, item))
  }
  await copyRuntimeApp(path.join(resources, 'app'))
  await execFileAsync('codesign', ['--force', '--sign', '-', '--timestamp=none', target], {
    timeout: 60_000,
  })
}

/** @param {string} sourceDir @param {string} target */
async function stageWindows(sourceDir, target) {
  await mkdir(target, { recursive: true })
  const items = await readdir(sourceDir, { withFileTypes: true })
  for (const item of items) {
    if (item.name === 'resources') continue
    await copyEntry(path.join(sourceDir, item.name), path.join(target, item.name))
  }
  await copyRuntimeApp(path.join(target, 'resources', 'app'))
}

/**
 * Drop staging trees left behind by a Host that died mid-copy (a killed Host
 * leaves its `cp` child running, and the tree it was filling never lands).
 *
 * @param {number} [ageMs] only sweep trees older than this
 */
async function sweepStagingLeftovers(ageMs = 10 * 60_000) {
  let entries = []
  try {
    entries = await readdir(RUNTIME_DIR)
  } catch {
    return
  }
  const cutoff = Date.now() - ageMs
  for (const name of entries) {
    if (!/^FishRead\.app\.(staging|trash)-/.test(name)) continue
    const target = path.join(RUNTIME_DIR, name)
    const info = await stat(target).catch(() => null)
    if (info === null || info.mtimeMs > cutoff) continue
    await removeTree(target)
  }
}

/** @type {Promise<void> | null} */
let stagingRuntime = null

/**
 * Stage the reader runtime, one restage at a time.
 *
 * Overlapping callers used to walk the same target directory (a second `rm`
 * racing the first `mkdir`/copy), which surfaced as
 * `ENOTEMPTY: directory not empty, rmdir …/Contents/Resources`.
 *
 * @param {boolean} [force]
 */
function ensureRuntime(force = false) {
  if (stagingRuntime !== null) return stagingRuntime
  stagingRuntime = stageRuntime(force).finally(() => {
    stagingRuntime = null
  })
  return stagingRuntime
}

/** @param {boolean} [force] */
async function stageRuntime(force = false) {
  const harness = locateHarness()
  if (harness === null) throw new Error('DeepSeek Harness installation could not be located')
  if (PLATFORM !== 'darwin' && PLATFORM !== 'win32') {
    throw new Error('FishRead only supports the desktop builds of DeepSeek Harness')
  }
  const sourceMtime = PLATFORM === 'darwin'
    ? (await stat(path.join(harness, 'Contents', 'MacOS', 'DeepSeek Harness'))).mtimeMs
    : (await stat(harness)).mtimeMs
  await mkdir(RUNTIME_DIR, { recursive: true })
  const markerPath = path.join(RUNTIME_DIR, RUNTIME_MARKER)
  const marker = await readJson(markerPath, null)
  const fresh =
    !force &&
    marker !== null &&
    marker.version === PLUGIN_VERSION &&
    marker.source === harness &&
    marker.mtime === sourceMtime &&
    (await exists(WINDOW_EXECUTABLE))
  if (fresh) {
    noSandbox = marker.noSandbox === true
    return
  }
  // Build beside the target, then swap: the live bundle is only ever replaced
  // by a complete, signed one, so a failed stage cannot leave the reader dead.
  await sweepStagingLeftovers()
  const staged = `${RUNTIME_APP}.staging-${process.pid}-${Date.now().toString(36)}`
  try {
    if (PLATFORM === 'darwin') await stageMac(harness, staged)
    else await stageWindows(harness, staged)
    await removeTree(RUNTIME_APP)
    await rename(staged, RUNTIME_APP)
  } catch (error) {
    await removeTree(staged)
    throw error
  }
  await writeJson(markerPath, {
    version: PLUGIN_VERSION,
    source: harness,
    mtime: sourceMtime,
    noSandbox: false,
    stagedAt: new Date().toISOString(),
  })
  noSandbox = false
}

/* ---------------------------------------------------------------- spawning */

/**
 * Environment for the reader window.
 *
 * `ctx.subprocess` merges this object over its own scrubbed copy of the parent
 * environment (`{ ...parent, ...spec.env }`), so `delete` on a copy removes
 * nothing: the ambient value is merged back in. Only an explicit `undefined`
 * tombstone removes a name — DSH drops undefined entries before spawning.
 *
 * `ELECTRON_RUN_AS_NODE` is the one that matters: DSH desktop runs its Electron
 * binary in Node mode, so a window that inherited it would execute the staged
 * app as plain Node, reject `--user-data-dir`, and exit before `ready`.
 */
function childEnvironment() {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined,
    ELECTRON_INSPECT: undefined,
    NODE_OPTIONS: undefined,
  }
}

function buildInitPayload() {
  return {
    prefs: store.prefs,
    locale: store.locale,
    dict: store.dict,
    book: store.book === null ? null : {
      title: store.book.title,
      chapterCount: store.book.chapters.filter((chapter) => chapter.intro !== true).length,
      charCount: store.book.charCount,
    },
    chaptersMeta: chaptersMetaOf(store.book),
    progress: store.progress,
    platform: PLATFORM === 'darwin' ? 'mac' : 'win',
    shortcuts: store.prefs.shortcuts,
  }
}

/* --------------------------------------------------------------- lifecycle */

/** @param {{ spawn: Function, subprocess: any }} ctx */
function spawnAttempt(ctx, args) {
  const handle = ctx.subprocess.spawn({
    argv: [WINDOW_EXECUTABLE, ...args],
    cwd: RUNTIME_DIR,
    graceMs: 2000,
    env: childEnvironment(),
    stdio: {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: { maxBytes: 64 * 1024 },
    },
  })
  const write = (message) => {
    try {
      handle.stdin?.write(`${JSON.stringify(message)}\n`)
    } catch {
      /* the child is gone; stdin close will surface it */
    }
  }
  const child = new Bridge(handle.stdout, write)
  child.handle = handle
  child.stderr = ''
  handle.stderr?.setEncoding('utf8')
  handle.stderr?.on('data', (chunk) => {
    child.stderr = `${child.stderr}${chunk}`.slice(-32 * 1024)
  })
  return child
}

/** @param {any} ctx */
async function startWindow(ctx) {
  await ensureRuntime()
  const args = [`--user-data-dir=${RUNTIME_USER_DATA}`]
  if (noSandbox) args.push('--no-sandbox')

  const attempt = async (extraArgs) => {
    const child = spawnAttempt(ctx, [...args, ...extraArgs])
    const exitPromise = child.handle.done.then((result) => {
      const how = result.exitCode !== null ? `exit ${result.exitCode}` : `signal ${result.signal ?? 'unknown'}`
      const reason = child.stderr.trim().split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 400)
      const error = Object.assign(new Error(reason === '' ? `window exited (${how})` : `window exited (${how}): ${reason}`), {
        exit: result,
        stderr: child.stderr,
      })
      child.rejectAll(error)
      throw error
    })
    exitPromise.catch(() => {})
    const ready = child.waitFor('ready', WINDOW_READY_TIMEOUT)
    await Promise.race([ready, exitPromise])
    return child
  }

  let child
  try {
    child = await attempt([])
  } catch (error) {
    const message = `${error?.stderr ?? ''}${error?.message ?? ''}`
    if (noSandbox || !/sandbox initialization failed|could not|FATAL|GPU process/i.test(message)) throw error
    noSandbox = true
    const markerPath = path.join(RUNTIME_DIR, RUNTIME_MARKER)
    const marker = await readJson(markerPath, {})
    await writeJson(markerPath, { ...marker, noSandbox: true })
    child = await attempt(['--no-sandbox'])
  }

  bridge = child
  store.windowState = 'starting'
  child.on('window:state', (data) => {
    if (data?.state === 'visible') store.windowState = 'visible'
    else if (data?.state === 'hidden') store.windowState = 'hidden'
    else if (data?.state === 'closed') store.windowState = 'closed'
  })
  child.on('shortcuts:status', (data) => {
    store.shortcutsStatus = data ?? {}
    store.shortcutsError = null
  })
  child.handle.done.then(() => {
    if (bridge === child) {
      bridge = null
      store.windowState = 'closed'
      store.shortcutsStatus = {}
    }
  })

  const init = buildInitPayload()
  await child.request('init', init)
  return child
}

async function ensureWindow(ctx) {
  if (bridge !== null) return bridge
  if (spawning !== null) return spawning
  spawning = startWindow(ctx)
    .catch((error) => {
      bridge = null
      store.windowState = 'closed'
      throw error
    })
    .finally(() => {
      spawning = null
    })
  return spawning
}

async function openWindow(ctx, options) {
  const child = await ensureWindow(ctx)
  await child.request('open', { import: options?.import === true })
  // The window reports `visible` asynchronously, so trust the acknowledged
  // request: otherwise this first response can still carry the previous state.
  store.windowState = 'visible'
  return { ok: true, state: store.windowState }
}

async function hideWindowState() {
  if (bridge === null) return { ok: true, state: store.windowState }
  await bridge.request('hide')
  store.windowState = 'hidden'
  return { ok: true, state: store.windowState }
}

async function shutdownWindow() {
  if (bridge === null) return
  store.windowState = 'shutting_down'
  const child = bridge
  try {
    await child.request('close', {}, 1500)
  } catch {
    /* window did not acknowledge; fall through to terminate */
  }
  const exited = await Promise.race([
    child.handle.done.then(() => true).catch(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
  ])
  if (!exited) child.handle.terminate()
  bridge = null
  store.windowState = 'closed'
  store.shortcutsStatus = {}
}

/* ------------------------------------------------------------ DSH surface */

function settingsState() {
  return {
    ok: true,
    plugin: 'dsh-fishread',
    version: PLUGIN_VERSION,
    platform: PLATFORM === 'darwin' ? 'mac' : 'win',
    window: { state: store.windowState },
    prefs: store.prefs,
    shortcutsStatus: store.shortcutsStatus,
    metadata: store.metadata,
    hasBook: store.book !== null,
    progress: store.progress,
    dataDir: DATA_DIR,
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function readPayload(request) {
  try {
    const text = await request.text()
    return text === '' ? {} : JSON.parse(text)
  } catch {
    return null
  }
}

/** @param {any} ctx */
function registerRoutes(ctx) {
  return ctx.connection.fetch.register({
    path: SETTINGS_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (/** @type {Request} */ request) => {
      if (ready !== null) await ready
      const payload = await readPayload(request)
      if (payload === null) return json({ ok: false, message: 'invalid payload' }, 400)
      const action = typeof payload.action === 'string' ? payload.action : ''
      try {
        switch (action) {
          case 'state':
            return json(settingsState())
          case 'open':
            await openWindow(ctx, { import: payload.import === true })
            return json(settingsState())
          case 'hide':
            await hideWindowState()
            return json(settingsState())
          case 'save-prefs': {
            store.prefs = mergePrefs(store.prefs, payload.patch)
            await savePrefs()
            if (bridge !== null) {
              bridge.request('prefs', { prefs: store.prefs }).catch(() => {})
            }
            return json(settingsState())
          }
          case 'save-shortcuts': {
            let next = { ...store.prefs.shortcuts }
            const incoming = payload.shortcuts ?? {}
            for (const actionName of ['toggle', 'prevPage', 'nextPage']) {
              if (typeof incoming[actionName] !== 'string') continue
              const result = withShortcut(next, actionName, incoming[actionName])
              if (!result.ok) {
                return json(
                  {
                    ok: false,
                    code: result.code,
                    message: result.code === 'conflict' ? 'shortcut conflict' : 'invalid shortcut',
                    shortcuts: store.prefs.shortcuts,
                  },
                  result.code === 'conflict' ? 409 : 400,
                )
              }
              next = result.shortcuts
            }
            store.prefs = normalizePreferences({ ...store.prefs, shortcuts: next })
            await savePrefs()
            if (bridge !== null) {
              const result = await bridge.request('shortcuts', { shortcuts: store.prefs.shortcuts })
              return json({ ...settingsState(), shortcutsStatus: result?.status ?? store.shortcutsStatus })
            }
            return json(settingsState())
          }
          case 'recording': {
            const active = payload.active === true
            if (bridge !== null) {
              try {
                await bridge.request('recording', { active })
              } catch {
                /* the window may be closing; the bindings stay as they are */
              }
            }
            return json({ ok: true, active })
          }
          case 'reset-shortcut': {
            const actionName = payload.name
            if (!['toggle', 'prevPage', 'nextPage'].includes(actionName)) {
              return json({ ok: false, message: 'unknown shortcut' }, 400)
            }
            store.prefs = normalizePreferences({
              ...store.prefs,
              shortcuts: { ...store.prefs.shortcuts, [actionName]: DEFAULT_PREFERENCES.shortcuts[actionName] },
            })
            await savePrefs()
            if (bridge !== null) bridge.request('shortcuts', { shortcuts: store.prefs.shortcuts }).catch(() => {})
            return json(settingsState())
          }
          case 'locale': {
            const locale = normalizeLocale(payload.locale)
            store.locale = locale
            store.dict = dictFor(locale)
            if (bridge !== null) {
              bridge.request('locale', { locale, dict: store.dict }).catch(() => {})
            }
            return json({ ok: true, locale })
          }
          case 'clear-data': {
            await shutdownWindow()
            await clearUserData()
            store.book = null
            store.bookLoaded = false
            store.metadata = null
            store.progress = { chapterIndex: 0, charOffset: 0, percent: 0 }
            store.prefs = normalizePreferences(DEFAULT_PREFERENCES)
            return json({ ok: true })
          }
          default:
            return json({ ok: false, message: `unknown action: ${action}` }, 400)
        }
      } catch (error) {
        return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500)
      }
    },
  })
}

/* ------------------------------------------------------------------- entry */

export const inject = ['connection', 'subprocess']

/**
 * Exported for tools and tests: rebuild the staged reader bundle exactly the way
 * `apply` does. `force` ignores a marker that would otherwise reuse it.
 */
export { stageRuntime }

/** @param {any} ctx */
export function apply(ctx) {
  ready = loadAll().catch((error) => {
    console.error('[fishread] failed to load stored state', error)
  })

  ctx.effect(() => {
    const registration = registerRoutes(ctx)
    return async () => {
      disposed = true
      if (progressTimer !== null) {
        clearTimeout(progressTimer)
        progressTimer = null
        await saveProgress(store.progress)
      }
      if (boundsTimer !== null) {
        clearTimeout(boundsTimer)
        boundsTimer = null
        await savePrefs()
      }
      await shutdownWindow()
      registration?.()
    }
  }, 'dsh-fishread')

  ctx.effect(() => () => {
    if (!disposed) void shutdownWindow()
  }, 'dsh-fishread-window')
}
