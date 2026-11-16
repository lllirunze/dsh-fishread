/**
 * Preferences, defaults and shortcut grammar. Stored in the plugin's private
 * data directory; the DSH settings page and the reader window both read the
 * same normalized shape.
 *
 * @module dsh-fishread/shared/prefs
 */

/** Default window / reading / shortcut values required by v0.1.0. */
export const DEFAULT_PREFERENCES = Object.freeze({
  window: Object.freeze({
    alwaysOnTop: false,
    restoreLastPosition: true,
    bounds: null,
  }),
  reading: Object.freeze({
    fontFamily: 'sans',
    fontSize: 14,
    lineHeight: 1.6,
    theme: 'system',
    indent: 2,
    showProgress: 'both',
  }),
  shortcuts: Object.freeze({
    toggle: 'Control+;',
    prevPage: 'Control+,',
    nextPage: 'Control+.',
  }),
})

export const FONT_FAMILIES = ['sans', 'serif', 'mono']
export const FONT_SIZES = [12, 14, 16, 18, 20]
export const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0]
export const THEMES = ['system', 'light', 'sepia', 'dark']
export const INDENTS = [0, 2]
export const PROGRESS_MODES = ['bar', 'percent', 'both']
export const SHORTCUT_ACTIONS = ['toggle', 'prevPage', 'nextPage']
export const DEFAULT_BOUNDS = Object.freeze({ width: 380, height: 560 })
export const MIN_BOUNDS = Object.freeze({ width: 280, height: 240 })

const MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta']
const MODIFIER_ALIASES = new Map([
  ['control', 'Control'],
  ['ctrl', 'Control'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['meta', 'Meta'],
  ['cmd', 'Meta'],
  ['command', 'Meta'],
  ['super', 'Meta'],
])

const PUNCTUATION = new Set([',', '.', ';', "'", '/', '\\', '[', ']', '-', '=', '`'])
const FUNCTION_KEY = /^F(?:[1-9]|1[0-2])$/u

/**
 * Canonicalize a recorded combination to Electron accelerator form.
 * @param {string} accelerator
 * @returns {string | null} null when the combination is not usable
 */
export function canonicallyAccelerator(accelerator) {
  if (typeof accelerator !== 'string') return null
  const raw = accelerator.trim()
  if (raw === '') return null
  const parts = raw.split('+').map((part) => part.trim())
  if (parts.length !== 2) return null
  const [modifierPart, keyPart] = parts
  const modifier = MODIFIER_ALIASES.get(modifierPart.toLowerCase())
  if (modifier === undefined || !MODIFIERS.includes(modifier)) return null
  const key = normalizeKey(keyPart)
  if (key === null) return null
  return `${modifier}+${key}`
}

/** @param {string} key */
function normalizeKey(key) {
  if (key.length === 1) {
    if (/[a-z]/iu.test(key)) return key.toLowerCase()
    if (/[0-9]/u.test(key)) return key
    if (PUNCTUATION.has(key)) return key
    return null
  }
  if (key.length > 1 && FUNCTION_KEY.test(key.toUpperCase())) return key.toUpperCase()
  return null
}

/**
 * Validate one stored shortcut. Returns a dictionary key on failure so both
 * surfaces can explain the same reason.
 * @param {unknown} accelerator
 * @returns {{ ok: true, value: string } | { ok: false, code: string }}
 */
export function validateShortcut(accelerator) {
  const value = canonicallyAccelerator(String(accelerator ?? ''))
  if (value === null) return { ok: false, code: 'invalid' }
  return { ok: true, value }
}

/**
 * Find the first pair of actions sharing one combination.
 * @param {Record<string, string>} shortcuts
 * @returns {[string, string] | null}
 */
export function findShortcutConflict(shortcuts) {
  const seen = new Map()
  for (const action of SHORTCUT_ACTIONS) {
    const value = shortcuts[action]
    if (typeof value !== 'string') continue
    const other = seen.get(value)
    if (other !== undefined) return [other, action]
    seen.set(value, action)
  }
  return null
}

/** @param {unknown} value */
function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

/** @param {unknown} value @param {number[]} allowed @param {number} fallback */
function oneNumber(value, allowed, fallback) {
  return typeof value === 'number' && allowed.includes(value) ? value : fallback
}

/** @param {unknown} value */
function normalizeBounds(value) {
  if (typeof value !== 'object' || value === null) return null
  const raw = /** @type {Record<string, unknown>} */ (value)
  const x = raw.x
  const y = raw.y
  const width = raw.width
  const height = raw.height
  if (![x, y, width, height].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    return null
  }
  if (width < MIN_BOUNDS.width || height < MIN_BOUNDS.height) return null
  if (width > 4000 || height > 4000) return null
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

/**
 * Merge arbitrary input over the defaults, dropping anything invalid.
 * @param {unknown} input
 */
export function normalizePreferences(input) {
  const raw = typeof input === 'object' && input !== null ? /** @type {Record<string, unknown>} */ (input) : {}
  const windowInput = typeof raw.window === 'object' && raw.window !== null ? raw.window : {}
  const readingInput = typeof raw.reading === 'object' && raw.reading !== null ? raw.reading : {}
  const shortcutInput = typeof raw.shortcuts === 'object' && raw.shortcuts !== null ? raw.shortcuts : {}

  const shortcuts = {}
  for (const action of SHORTCUT_ACTIONS) {
    const candidate = validateShortcut(shortcutInput[action] ?? DEFAULT_PREFERENCES.shortcuts[action])
    shortcuts[action] = candidate.ok ? candidate.value : DEFAULT_PREFERENCES.shortcuts[action]
  }

  return {
    window: {
      alwaysOnTop: typeof windowInput.alwaysOnTop === 'boolean' ? windowInput.alwaysOnTop : DEFAULT_PREFERENCES.window.alwaysOnTop,
      restoreLastPosition:
        typeof windowInput.restoreLastPosition === 'boolean'
          ? windowInput.restoreLastPosition
          : DEFAULT_PREFERENCES.window.restoreLastPosition,
      bounds: normalizeBounds(windowInput.bounds),
    },
    reading: {
      fontFamily: oneOf(readingInput.fontFamily, FONT_FAMILIES, DEFAULT_PREFERENCES.reading.fontFamily),
      fontSize: oneNumber(readingInput.fontSize, FONT_SIZES, DEFAULT_PREFERENCES.reading.fontSize),
      lineHeight: oneNumber(readingInput.lineHeight, LINE_HEIGHTS, DEFAULT_PREFERENCES.reading.lineHeight),
      theme: oneOf(readingInput.theme, THEMES, DEFAULT_PREFERENCES.reading.theme),
      indent: oneNumber(readingInput.indent, INDENTS, DEFAULT_PREFERENCES.reading.indent),
      showProgress: oneOf(readingInput.showProgress, PROGRESS_MODES, DEFAULT_PREFERENCES.reading.showProgress),
    },
    shortcuts,
  }
}

/**
 * Replace exactly one shortcut after validation, refusing duplicates.
 * @param {Record<string, string>} shortcuts
 * @param {string} action
 * @param {string} accelerator
 * @returns {{ ok: true, shortcuts: Record<string, string> } | { ok: false, code: string, conflictWith?: string }}
 */
export function withShortcut(shortcuts, action, accelerator) {
  if (!SHORTCUT_ACTIONS.includes(action)) return { ok: false, code: 'invalid' }
  const candidate = validateShortcut(accelerator)
  if (!candidate.ok) return { ok: false, code: candidate.code }
  for (const other of SHORTCUT_ACTIONS) {
    if (other !== action && shortcuts[other] === candidate.value) {
      return { ok: false, code: 'conflict', conflictWith: other }
    }
  }
  return { ok: true, shortcuts: { ...shortcuts, [action]: candidate.value } }
}
