/**
 * Electron main process of the reader helper window.
 *
 * The Host half owns storage, preferences and lifecycle; this process owns the
 * native window, OS-global shortcuts and the file picker. They speak
 * newline-delimited JSON over stdio; nothing is exposed to the page except the
 * narrow preload bridge.
 *
 * @module dsh-fishread/runtime/main
 */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeTheme, screen } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NovelParseError, countChars, decodeNovel, isSupportedExtension, parseNovel } from './shared/parse.js'
import { DEFAULT_PREFERENCES, MIN_BOUNDS, normalizePreferences } from './shared/prefs.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const MAX_IMPORT_BYTES = 32 * 1024 * 1024
const BG = { light: '#ffffff', sepia: '#f4ead6', dark: '#17181b' }

/** @type {BrowserWindow | null} */
let win = null
let forceQuit = false
let quitting = false
// Set while the user wants the window hidden, so the late `ready-to-show`
// callback cannot pop it back up when a hide arrives right after `open`.
let hiddenRequested = false
let pendingImport = null
let importToken = 0
let boundsTimer = null
let progressTimer = null
let lastProgress = null
let shortcutsStatus = {}

/** Mirrors Host-side state for this window. */
let state = {
  prefs: normalizePreferences(DEFAULT_PREFERENCES),
  locale: 'en',
  dict: {},
  book: null,
  chaptersMeta: [],
  progress: { chapterIndex: 0, charOffset: 0, percent: 0 },
  shortcuts: { toggle: 'Control+;', prevPage: 'Control+,', nextPage: 'Control+.' },
  platform: process.platform === 'darwin' ? 'mac' : 'win',
}

/* ------------------------------------------------------------------ bridge */

const pendingCalls = new Map()
let nextCallId = 1

/** @param {string} method @param {unknown} [params] */
function call(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextCallId++
    pendingCalls.set(id, { resolve, reject })
    const timer = setTimeout(() => {
      if (!pendingCalls.has(id)) return
      pendingCalls.delete(id)
      reject(new Error(`bridge timeout: ${method}`))
    }, 15000)
    pendingCalls.get(id).timer = timer
    write({ id, method, params })
  })
}

/** @param {Record<string, unknown>} message */
function write(message) {
  try {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  } catch {
    /* The Host is gone; stdin end will quit the app. */
  }
}

/** @param {string} name @param {unknown} [data] */
function emit(name, data) {
  write({ event: name, data })
}

/** @param {unknown} error */
function describe(error) {
  return error instanceof Error ? error.message : String(error)
}

/* ------------------------------------------------------------------ window */

/** @param {'light' | 'sepia' | 'dark'} theme */
function backgroundColor(theme) {
  return BG[theme] ?? BG.light
}

/** @param {string} theme */
function resolvedTheme(theme) {
  if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return ['light', 'sepia', 'dark'].includes(theme) ? theme : 'light'
}

/** Clamp remembered bounds onto a currently attached display. */
function clampedBounds(bounds) {
  if (bounds === null) return null
  const displays = screen.getAllDisplays()
  const visible = displays.some((display) => {
    const area = display.workArea
    const right = bounds.x + bounds.width
    const bottom = bounds.y + bounds.height
    return bounds.x < area.x + area.width - 60 && right > area.x + 60 && bounds.y < area.y + area.height - 40 && bottom > area.y + 40
  })
  if (visible) return bounds
  const display = screen.getPrimaryDisplay().workArea
  return {
    width: Math.min(Math.max(bounds.width, MIN_BOUNDS.width), display.width),
    height: Math.min(Math.max(bounds.height, MIN_BOUNDS.height), display.height),
    x: Math.round(display.x + (display.width - bounds.width) / 2),
    y: Math.round(display.y + (display.height - bounds.height) / 2),
  }
}

function ensureWindow() {
  if (win !== null && !win.isDestroyed()) return win

  const restore = state.prefs.window.restoreLastPosition && state.prefs.window.bounds !== null
  const saved = restore ? clampedBounds(state.prefs.window.bounds) : null
  const theme = resolvedTheme(state.prefs.reading.theme)

  win = new BrowserWindow({
    width: saved?.width ?? 380,
    height: saved?.height ?? 560,
    ...(saved === null ? {} : { x: saved.x, y: saved.y }),
    minWidth: MIN_BOUNDS.width,
    minHeight: MIN_BOUNDS.height,
    show: false,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    backgroundColor: backgroundColor(theme),
    webPreferences: {
      preload: join(HERE, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  win.setAlwaysOnTop(state.prefs.window.alwaysOnTop, 'floating')
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))

  if (process.env.FISHREAD_DEBUG === '1') {
    win.webContents.on('console-message', (_event, level, message, line, source) => {
      console.error(`[renderer:${level}] ${message} (${source}:${line})`)
    })
    win.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[renderer] did-fail-load ${code} ${description} ${url}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer] gone ${JSON.stringify(details)}`)
    })
  }

  win.on('moved', scheduleBoundsReport)
  win.on('resized', scheduleBoundsReport)
  win.on('hide', () => emit('window:state', { state: 'hidden' }))
  win.on('show', () => emit('window:state', { state: 'visible' }))
  win.on('close', (event) => {
    if (forceQuit) return
    event.preventDefault()
    hideWindow()
  })
  win.on('closed', () => {
    win = null
  })
  win.once('ready-to-show', () => {
    if (win === null || win.isDestroyed()) return
    if (hiddenRequested) return
    win.show()
    win.focus()
    emit('window:state', { state: 'visible' })
  })

  win.loadFile(join(HERE, 'renderer', 'index.html'))
  return win
}

function showWindow() {
  const target = ensureWindow()
  hiddenRequested = false
  if (target.isMinimized()) target.restore()
  target.show()
  target.focus()
  emit('window:state', { state: 'visible' })
}

function hideWindow() {
  if (win === null || win.isDestroyed()) return
  hiddenRequested = true
  flushProgress()
  win.hide()
  emit('window:state', { state: 'hidden' })
}

function toggleWindow() {
  if (win === null || win.isDestroyed() || !win.isVisible()) showWindow()
  else hideWindow()
}

function destroyWindow() {
  flushProgress()
  quitting = true
  forceQuit = true
  if (win !== null && !win.isDestroyed()) win.destroy()
  win = null
  emit('window:state', { state: 'closed' })
  app.quit()
}

function scheduleBoundsReport() {
  if (boundsTimer !== null) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    boundsTimer = null
    if (win === null || win.isDestroyed()) return
    const [width, height] = win.getSize()
    const [x, y] = win.getPosition()
    call('window:bounds', { bounds: { x, y, width, height } }).catch(() => {})
  }, 500)
}

/* --------------------------------------------------------------- shortcuts */

let shortcutsSuspended = false

function registerShortcuts() {
  if (shortcutsSuspended) return
  if (!app.isReady()) {
    app.whenReady().then(() => registerShortcuts())
    return
  }
  globalShortcut.unregisterAll()
  shortcutsStatus = {}
  const handlers = {
    toggle: () => toggleWindow(),
    prevPage: () => pageStep(-1),
    nextPage: () => pageStep(1),
  }
  for (const action of /** @type {const} */ (['toggle', 'prevPage', 'nextPage'])) {
    const accelerator = state.shortcuts[action]
    let ok = false
    try {
      ok = globalShortcut.register(accelerator, handlers[action])
    } catch {
      ok = false
    }
    shortcutsStatus[action] = ok
  }
  emit('shortcuts:status', shortcutsStatus)
}

/** Pause global shortcuts while the user records a new combination. */
function suspendShortcuts() {
  shortcutsSuspended = true
  if (app.isReady()) globalShortcut.unregisterAll()
}

function resumeShortcuts() {
  shortcutsSuspended = false
  registerShortcuts()
}

/** @param {number} direction -1 previous page, 1 next page */
function pageStep(direction) {
  // Page keys never open a closed window and do nothing while hidden.
  if (win === null || win.isDestroyed() || !win.isVisible()) return
  win.webContents.send('fishread:page', direction)
}

/* -------------------------------------------------------------------- IPC */

let rendererReady = false
let initPayload = null
let importRequestPending = false

function sendInit() {
  if (!rendererReady || initPayload === null || win === null || win.isDestroyed()) return
  win.webContents.send('fishread:init', initPayload)
}

ipcMain.handle('fishread:ready', () => {
  rendererReady = true
  if (initPayload === null) {
    initPayload = buildInitPayload()
  }
  // Defer one tick so the renderer's listener registration is complete.
  setTimeout(sendInit, 0)
  if (importRequestPending) {
    importRequestPending = false
    setTimeout(() => {
      if (win !== null && !win.isDestroyed()) win.webContents.send('fishread:import')
    }, 40)
  }
  return { ok: true }
})

function buildInitPayload() {
  return {
    prefs: state.prefs,
    locale: state.locale,
    dict: state.dict,
    book: state.book,
    chaptersMeta: state.chaptersMeta,
    progress: state.progress,
    platform: state.platform,
    shortcuts: state.shortcuts,
    shortcutsStatus,
  }
}

/* --------------------------------------------------------------- chapters */

/** @type {Map<number, { index: number, title: string, body: string, charsBefore: number }>} */
const chapterCache = new Map()

/** @param {number} index */
async function chapterAt(index) {
  if (chapterCache.has(index)) return chapterCache.get(index)
  const result = await call('chapter:get', { index })
  if (result?.ok !== true || result.chapter === null || typeof result.chapter !== 'object') {
    throw new Error(result?.message ?? 'chapter unavailable')
  }
  chapterCache.set(index, result.chapter)
  return result.chapter
}

ipcMain.handle('fishread:chapter', async (_event, rawIndex) => {
  const index = Math.trunc(Number(rawIndex))
  if (!Number.isFinite(index) || index < 0 || index >= state.chaptersMeta.length) {
    return { ok: false, message: 'chapter out of range' }
  }
  try {
    const chapter = await chapterAt(index)
    return { ok: true, chapter }
  } catch (error) {
    return { ok: false, message: describe(error) }
  }
})

ipcMain.handle('fishread:hide', () => {
  hideWindow()
  return { ok: true }
})

ipcMain.handle('fishread:close', () => {
  destroyWindow()
  return { ok: true }
})

function formatError(error) {
  if (error instanceof NovelParseError) {
    return { ok: false, code: error.code, line: error.line, extra: error.extra ?? null }
  }
  return { ok: false, code: 'readFailed', line: 0, extra: { message: describe(error) } }
}

function decodeAndParse(bytes, fileName, encoding) {
  const text = decodeNovel(bytes, encoding)
  const parsed = parseNovel(text)
  return { parsed, text }
}

ipcMain.handle('fishread:choose-file', async () => {
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: state.dict['common.import'] ?? 'Import',
    properties: ['openFile'],
    filters: [
      { name: 'Text / Markdown', extensions: ['txt', 'md'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, code: 'canceled' }

  const filePath = result.filePaths[0]
  if (!isSupportedExtension(filePath)) return { ok: false, code: 'unsupportedExt', line: 0 }

  let bytes
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return { ok: false, code: 'readFailed', line: 0 }
    if (info.size > MAX_IMPORT_BYTES) return { ok: false, code: 'readFailed', line: 0, extra: { tooLarge: true } }
    bytes = new Uint8Array(await readFile(filePath))
  } catch (error) {
    return { ok: false, code: 'readFailed', line: 0, extra: { message: describe(error) } }
  }

  try {
    const { parsed } = decodeAndParse(bytes, filePath, 'utf-8')
    importToken += 1
    pendingImport = { token: importToken, bytes, ext: extname(filePath).toLowerCase(), parsed }
    return previewOf(pendingImport, 'utf-8')
  } catch (error) {
    const failure = formatError(error)
    const gbkEligible = extname(filePath).toLowerCase() === '.txt'
    if (failure.code === 'encoding' && gbkEligible) {
      importToken += 1
      pendingImport = { token: importToken, bytes, ext: '.txt', parsed: null }
      return { ...failure, token: importToken, gbkEligible: true }
    }
    return { ...failure, gbkEligible: false }
  }
})

/** @param {{ token: number, parsed: { title: string, chapters: Array<{title: string, line: number, body: string}>, charCount: number } }} pending @param {string} encoding */
function previewOf(pending, encoding) {
  return {
    ok: true,
    token: pending.token,
    encoding,
    title: pending.parsed.title,
    chapterCount: pending.parsed.chapters.filter((chapter) => chapter.intro !== true).length,
    charCount: pending.parsed.charCount,
    chapters: pending.parsed.chapters.map((chapter) => ({
      title: chapter.title,
      line: chapter.line,
      ...(chapter.intro === true ? { intro: true } : {}),
    })),
  }
}

ipcMain.handle('fishread:retry-gbk', (_event, token) => {
  if (pendingImport === null || pendingImport.token !== token) return { ok: false, code: 'readFailed' }
  try {
    const { parsed } = decodeAndParse(pendingImport.bytes, '', 'gb18030')
    pendingImport.parsed = parsed
    return previewOf(pendingImport, 'gb18030')
  } catch (error) {
    return formatError(error)
  }
})

ipcMain.handle('fishread:cancel-import', (_event, token) => {
  if (pendingImport !== null && pendingImport.token === token) pendingImport = null
  return { ok: true }
})

ipcMain.handle('fishread:confirm-import', async (_event, token) => {
  if (pendingImport === null || pendingImport.token !== token || pendingImport.parsed === null) {
    return { ok: false, code: 'readFailed' }
  }
  const parsed = pendingImport.parsed
  const payload = { version: 1, title: parsed.title, chapters: parsed.chapters, charCount: parsed.charCount }
  try {
    const result = await call('book:import', { book: payload })
    if (result?.ok !== true) return { ok: false, code: 'import', extra: { message: result?.message ?? '' } }
    pendingImport = null
    const book = {
      title: payload.title,
      chapterCount: payload.chapters.filter((chapter) => chapter.intro !== true).length,
      charCount: payload.charCount,
    }
    state.book = book
    let charsBefore = 0
    state.chaptersMeta = payload.chapters.map((chapter, index) => {
      const meta = {
        index,
        title: chapter.title,
        charsBefore,
        ...(chapter.intro === true ? { intro: true } : {}),
      }
      charsBefore += countChars(chapter.body)
      return meta
    })
    chapterCache.clear()
    state.progress = { chapterIndex: 0, charOffset: 0, percent: 0 }
    initPayload = buildInitPayload()
    return { ok: true, book, chaptersMeta: state.chaptersMeta, progress: state.progress }
  } catch (error) {
    return { ok: false, code: 'import', extra: { message: describe(error) } }
  }
})

ipcMain.handle('fishread:progress', (_event, progress) => {
  if (progress === null || typeof progress !== 'object') return { ok: false }
  lastProgress = {
    chapterIndex: Math.max(0, Math.trunc(Number(progress.chapterIndex) || 0)),
    charOffset: Math.max(0, Math.trunc(Number(progress.charOffset) || 0)),
    percent: Math.min(100, Math.max(0, Number(progress.percent) || 0)),
  }
  if (progressTimer !== null) return { ok: true }
  progressTimer = setTimeout(() => {
    progressTimer = null
    flushProgress()
  }, 700)
  return { ok: true }
})

function flushProgress() {
  if (progressTimer !== null) {
    clearTimeout(progressTimer)
    progressTimer = null
  }
  if (lastProgress === null) return
  const progress = lastProgress
  lastProgress = null
  state.progress = progress
  call('progress:save', { progress }).catch(() => {})
}

ipcMain.handle('fishread:set-prefs', (_event, patch) => {
  state.prefs = mergePrefs(state.prefs, patch)
  applyPrefs()
  call('prefs:update', { prefs: state.prefs }).catch(() => {})
  return { ok: true, prefs: state.prefs }
})

ipcMain.handle('fishread:example', () => ({ sample: state.dict['example.sample'] ?? '' }))

/** Merge one settings patch without dropping sibling keys. */
function mergePrefs(base, patch) {
  const input = typeof patch === 'object' && patch !== null ? patch : {}
  return normalizePreferences({
    window: { ...base.window, ...(typeof input.window === 'object' && input.window !== null ? input.window : {}) },
    reading: { ...base.reading, ...(typeof input.reading === 'object' && input.reading !== null ? input.reading : {}) },
    shortcuts: { ...base.shortcuts, ...(typeof input.shortcuts === 'object' && input.shortcuts !== null ? input.shortcuts : {}) },
  })
}

function applyPrefs() {
  const theme = resolvedTheme(state.prefs.reading.theme)
  nativeTheme.themeSource = state.prefs.reading.theme === 'sepia' ? 'light' : state.prefs.reading.theme
  if (win !== null && !win.isDestroyed()) {
    win.setBackgroundColor(backgroundColor(theme))
    win.setAlwaysOnTop(state.prefs.window.alwaysOnTop, 'floating')
    win.webContents.send('fishread:prefs', state.prefs)
  }
}

/* ------------------------------------------------------------- host calls */

/** @type {Record<string, (params: any) => Promise<unknown> | unknown>} */
const hostMethods = {
  init: (params) => {
    state.prefs = normalizePreferences(params?.prefs ?? state.prefs)
    state.locale = typeof params?.locale === 'string' ? params.locale : state.locale
    state.dict = typeof params?.dict === 'object' && params.dict !== null ? params.dict : {}
    const incomingTitle = typeof params?.book?.title === 'string' ? params.book.title : null
    const bookChanged = (state.book?.title ?? null) !== incomingTitle
    state.book = params?.book ?? null
    state.chaptersMeta = Array.isArray(params?.chaptersMeta) ? params.chaptersMeta : []
    if (bookChanged) chapterCache.clear()
    state.progress = params?.progress ?? state.progress
    state.platform = params?.platform === 'mac' ? 'mac' : 'win'
    state.shortcuts = normalizePreferences({ shortcuts: params?.shortcuts }).shortcuts
    initPayload = buildInitPayload()
    rendererReady = false
    ensureWindow()
    applyPrefs()
    setImmediate(() => registerShortcuts())
    return { ok: true, platform: state.platform }
  },
  open: (params) => {
    rendererReady = rendererReady && win !== null
    showWindow()
    if (params?.import === true) {
      if (rendererReady && win !== null && !win.isDestroyed()) win.webContents.send('fishread:import')
      else importRequestPending = true
    }
    return { ok: true }
  },
  show: () => {
    showWindow()
    return { ok: true }
  },
  hide: () => {
    hideWindow()
    return { ok: true }
  },
  focus: () => {
    if (win !== null && !win.isDestroyed()) {
      win.show()
      win.focus()
    }
    return { ok: true }
  },
  close: () => {
    destroyWindow()
    return { ok: true }
  },
  prefs: (params) => {
    state.prefs = normalizePreferences(params?.prefs ?? state.prefs)
    applyPrefs()
    return { ok: true }
  },
  locale: (params) => {
    state.locale = typeof params?.locale === 'string' ? params.locale : state.locale
    state.dict = typeof params?.dict === 'object' && params.dict !== null ? params.dict : state.dict
    if (win !== null && !win.isDestroyed()) {
      win.webContents.send('fishread:locale', { locale: state.locale, dict: state.dict })
    }
    return { ok: true }
  },
  shortcuts: (params) => {
    state.shortcuts = normalizePreferences({ shortcuts: params?.shortcuts }).shortcuts
    registerShortcuts()
    return { ok: true, status: shortcutsStatus }
  },
  recording: (params) => {
    if (params?.active === true) suspendShortcuts()
    else resumeShortcuts()
    return { ok: true }
  },
  chapter: (params) => {
    // The Host pushes chapter bodies on demand; this window keeps its own copy.
    return { ok: true, chapter: params?.chapter ?? null }
  },
}

/* -------------------------------------------------------------- stdin loop */

let stdinBuffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  stdinBuffer += chunk
  let newline = stdinBuffer.indexOf('\n')
  while (newline >= 0) {
    const line = stdinBuffer.slice(0, newline)
    stdinBuffer = stdinBuffer.slice(newline + 1)
    newline = stdinBuffer.indexOf('\n')
    if (line.trim() === '') continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }
    void dispatch(message)
  }
})
process.stdin.on('end', () => {
  forceQuit = true
  app.quit()
})
process.stdin.on('close', () => {
  forceQuit = true
  app.quit()
})

async function dispatch(message) {
  if (typeof message?.id === 'number' && typeof message?.method === 'string') {
    const handler = hostMethods[message.method]
    if (handler === undefined) {
      write({ id: message.id, error: { message: `unknown method: ${message.method}` } })
      return
    }
    try {
      const result = await handler(message.params ?? {})
      write({ id: message.id, result: result ?? null })
    } catch (error) {
      write({ id: message.id, error: { message: describe(error) } })
    }
    return
  }
  if (typeof message?.id === 'number' && ('result' in message || 'error' in message)) {
    const pending = pendingCalls.get(message.id)
    if (pending === undefined) return
    pendingCalls.delete(message.id)
    clearTimeout(pending.timer)
    if ('error' in message) pending.reject(new Error(message.error?.message ?? 'bridge error'))
    else pending.resolve(message.result)
  }
}

/* ---------------------------------------------------------------- startup */

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light'
  emit('ready', { pid: process.pid, electron: process.versions.electron })
})

app.on('window-all-closed', () => {
  // The window is the whole app: losing it means the helper can exit, except
  // while the Host is closing it deliberately.
  if (!quitting) {
    forceQuit = true
    app.quit()
  }
})

app.on('before-quit', () => {
  forceQuit = true
  globalShortcut.unregisterAll()
  flushProgress()
})

process.on('uncaughtException', (error) => {
  console.error(`[fishread] ${describe(error)}`)
})
process.on('unhandledRejection', (error) => {
  console.error(`[fishread] ${describe(error)}`)
})
