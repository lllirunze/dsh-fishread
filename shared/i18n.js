/**
 * Locale selection and formatting shared by the Host and reader runtime.
 * Language copy lives in one module per locale under `shared/i18n/`.
 *
 * @module dsh-fishread/shared/i18n
 */
import en from './i18n/en.js'
import zh from './i18n/zh.js'

/** Fallback language for anything unsupported or missing. */
export const FALLBACK_LOCALE = 'en'

/** @typedef {typeof en} Dict */

export const DICTS = { zh, en }

/** @param {string} locale */
export function normalizeLocale(locale) {
  const tag = String(locale ?? '').toLowerCase()
  if (tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('zh_')) return 'zh'
  if (tag === 'en' || tag.startsWith('en-') || tag.startsWith('en_')) return 'en'
  return FALLBACK_LOCALE
}

/** @param {string} locale */
export function dictFor(locale) {
  return DICTS[normalizeLocale(locale)]
}

/** @param {string} locale @param {string} key @param {Record<string, unknown>} [params] */
export function translate(locale, key, params) {
  const dict = dictFor(locale)
  let value = dict[key] ?? DICTS[FALLBACK_LOCALE][key] ?? key
  if (params !== undefined) {
    value = value.replace(/\{(\w+)\}/gu, (whole, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
    )
  }
  return value
}

const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const ZH_UNITS = ['', '十', '百', '千']

/** Chinese numerals for generated chapter labels, 0–99999. @param {number} value */
export function chineseNumber(value) {
  const n = Math.max(0, Math.trunc(value))
  if (n === 0) return ZH_DIGITS[0]
  if (n >= 100000) return String(n)
  if (n >= 10000) {
    const high = Math.floor(n / 10000)
    const low = n % 10000
    return `${chineseNumber(high)}万${low === 0 ? '' : chineseNumber(low)}`
  }
  const digits = String(n).split('').map(Number)
  let out = ''
  let pendingZero = false
  digits.forEach((digit, offset) => {
    const unit = ZH_UNITS[digits.length - offset - 1]
    if (digit === 0) {
      pendingZero = out !== ''
      return
    }
    if (pendingZero) {
      out += ZH_DIGITS[0]
      pendingZero = false
    }
    out += ZH_DIGITS[digit] + unit
  })
  return out.startsWith('一十') ? out.slice(1) : out
}

/** @param {number} number @param {string} locale */
export function formatChapterLabel(number, locale) {
  return normalizeLocale(locale) === 'zh' ? `第${chineseNumber(number)}章` : `Chapter ${number}`
}

/** @param {number} number @param {string} title @param {string} locale */
export function formatTocLabel(number, title, locale) {
  const label = formatChapterLabel(number, locale)
  return normalizeLocale(locale) === 'zh' ? `${label} ${title}` : `${label} · ${title}`
}

const MODIFIER_GLYPHS = {
  Control: { mac: '⌃', win: 'Ctrl' },
  Alt: { mac: '⌥', win: 'Alt' },
  Shift: { mac: '⇧', win: 'Shift' },
  Meta: { mac: '⌘', win: 'Win' },
}

/** @param {string} accelerator @param {'mac' | 'win'} platform */
export function formatShortcut(accelerator, platform) {
  return String(accelerator)
    .split('+')
    .filter(Boolean)
    .map((part) => MODIFIER_GLYPHS[part]?.[platform] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join(' ')
}
