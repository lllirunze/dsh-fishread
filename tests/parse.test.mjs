import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeNovel, parseNovel, NovelParseError, isSupportedExtension } from '../shared/parse.js'
import { formatChapterLabel, formatTocLabel, normalizeLocale, translate } from '../shared/i18n.js'
import {
  canonicallyAccelerator,
  findShortcutConflict,
  normalizePreferences,
  validateShortcut,
  withShortcut,
} from '../shared/prefs.js'

const SAMPLE = '# 三体\n\n## 科学边界\n\n第一段。\n\n第二段。\n\n## 射手与农场主\n\n第二章正文。\n'

function failure(source, code) {
  try {
    parseNovel(source)
  } catch (error) {
    assert.ok(error instanceof NovelParseError, 'expected NovelParseError')
    assert.equal(error.code, code)
    return error
  }
  assert.fail(`expected ${code}`)
}

test('txt and md parse identically', () => {
  const a = parseNovel(SAMPLE)
  const b = parseNovel(SAMPLE)
  assert.deepEqual(a, b)
  assert.equal(a.title, '三体')
  assert.equal(a.chapters.length, 2)
  assert.equal(a.chapters[0].title, '科学边界')
  assert.equal(a.chapters[0].body, '第一段。\n\n第二段。')
  assert.equal(a.charCount, 14)
})

test('chapter numbering follows ## order, never the title text', () => {
  const book = parseNovel('# T\n\n## 第七章 无关\n\nx\n\n## 第五章 也无关\n\ny\n')
  assert.equal(book.chapters[0].title, '第七章 无关')
  assert.equal(formatChapterLabel(1, 'zh'), '第一章')
  assert.equal(formatChapterLabel(2, 'zh'), '第二章')
})

test('CRLF and BOM are tolerated', () => {
  const book = parseNovel('\uFEFF# T\r\n\r\n## C\r\n\r\nbody\r\n')
  assert.equal(book.title, 'T')
  assert.equal(book.chapters[0].body, 'body')
})

test('structural errors carry line numbers', () => {
  assert.equal(failure('', 'emptyFile').line, 1)
  assert.equal(failure('intro\n# T\n\n## C\n\nb\n', 'missingTitle').line, 1)
  assert.equal(failure('#\n\n## C\n\nb\n', 'emptyTitle').line, 1)
  assert.equal(failure('# T\n\n# U\n\n## C\n\nb\n', 'duplicateTitle').line, 3)
  assert.equal(failure('# T\n', 'noChapter').line, 1)
  assert.equal(failure('# T\n\n##\n\nb\n', 'emptyChapterTitle').line, 3)
  assert.equal(failure('# T\n\n## C\n\n\n', 'noBody').line, 3)
  assert.equal(failure('# T\n\n## C\n\n### deep\n\nb\n', 'headingLevel').line, 5)
})

test('text before the first chapter becomes an unnumbered introduction', () => {
  const book = parseNovel('# T\n\n写在前面。\n\n第二段。\n\n## C\n\nb\n')
  assert.equal(book.chapters.length, 2)
  assert.equal(book.chapters[0].intro, true)
  assert.equal(book.chapters[0].title, '')
  assert.equal(book.chapters[0].body, '写在前面。\n\n第二段。')
  assert.equal(book.chapters[0].line, 3)
  assert.equal(book.chapters[1].title, 'C')
  assert.equal(book.chapters[1].intro, undefined)
})

test('blank lines between the title and the first chapter are not an introduction', () => {
  const book = parseNovel('# T\n\n\n## C\n\nb\n')
  assert.equal(book.chapters.length, 1)
  assert.equal(book.chapters[0].intro, undefined)
})

test('an introduction without any chapter is still rejected', () => {
  assert.equal(failure('# T\n\n写在前面。\n', 'noChapter').line, 1)
})

test('unsupported extensions and encodings are rejected', () => {
  assert.equal(isSupportedExtension('a.txt'), true)
  assert.equal(isSupportedExtension('a.MD'), true)
  assert.equal(isSupportedExtension('a.pdf'), false)
  assert.throws(() => decodeNovel(Uint8Array.from([0x80, 0x81])), (error) => error.code === 'encoding')
  assert.equal(decodeNovel(Uint8Array.from([0xef, 0xbb, 0xbf, 0x23])), '#')
})

test('chapter labels are localized, titles are not', () => {
  assert.equal(formatChapterLabel(10, 'zh'), '第十章')
  assert.equal(formatChapterLabel(12, 'zh'), '第十二章')
  assert.equal(formatChapterLabel(100, 'zh'), '第一百章')
  assert.equal(formatChapterLabel(12, 'en'), 'Chapter 12')
  assert.equal(formatTocLabel(1, '科学边界', 'zh'), '第一章 科学边界')
  assert.equal(formatTocLabel(1, '科学边界', 'en'), 'Chapter 1 · 科学边界')
})

test('locale falls back to English', () => {
  assert.equal(normalizeLocale('zh-CN'), 'zh')
  assert.equal(normalizeLocale('fr'), 'en')
  assert.equal(normalizeLocale(undefined), 'en')
  assert.equal(translate('fr', 'empty.title'), 'No novel yet')
  assert.equal(translate('zh', 'error.line', { line: 4, message: 'x' }), '第 4 行：x')
})

test('shortcuts need one modifier plus one key', () => {
  assert.equal(canonicallyAccelerator('Control+;'), 'Control+;')
  assert.equal(canonicallyAccelerator('ctrl+,'), 'Control+,')
  assert.equal(canonicallyAccelerator('Alt+F4'), 'Alt+F4')
  assert.equal(canonicallyAccelerator('A'), null)
  assert.equal(canonicallyAccelerator('Control+Shift+A'), null)
  assert.equal(canonicallyAccelerator('Control+Space'), null)
  assert.equal(validateShortcut('Meta+.').value, 'Meta+.')
})

test('duplicate shortcuts are refused', () => {
  const base = { toggle: 'Control+;', prevPage: 'Control+,', nextPage: 'Control+.' }
  assert.equal(findShortcutConflict(base), null)
  const result = withShortcut(base, 'prevPage', 'Control+.')
  assert.equal(result.ok, false)
  assert.equal(result.code, 'conflict')
  const renamed = withShortcut(base, 'nextPage', 'Alt+PageDown')
  assert.equal(renamed.ok, false, 'PageDown is not a supported single key')
  const ok = withShortcut(base, 'nextPage', 'Alt+.')
  assert.equal(ok.ok, true)
  assert.equal(ok.shortcuts.nextPage, 'Alt+.')
})

test('preferences normalize unknown values back to defaults', () => {
  const prefs = normalizePreferences({
    window: { alwaysOnTop: 'yes', bounds: { x: 0, y: 0, width: 10, height: 10 } },
    reading: { fontSize: 99, lineHeight: 1.6, theme: 'neon', indent: 5, showProgress: 'both' },
    shortcuts: { toggle: 'A' },
  })
  assert.equal(prefs.window.alwaysOnTop, false)
  assert.equal(prefs.window.bounds, null)
  assert.equal(prefs.reading.fontSize, 14)
  assert.equal(prefs.reading.theme, 'system')
  assert.equal(prefs.reading.indent, 2)
  assert.equal(prefs.shortcuts.toggle, 'Control+;')
})
