/**
 * The single novel parser shared by every surface of the plugin: the Host
 * validates imports with it, the reader window previews with the same copy, and
 * the tests pin its behaviour.
 *
 * Format contract (identical for .txt and .md):
 *   - the first non-empty line is the only `# Title`;
 *   - every chapter starts with a line that begins with `## `;
 *   - text between the title and the first `## ` is the preamble ("引言"): it
 *     becomes an unnumbered opening chapter, so it is neither rejected nor lost;
 *   - `###` and deeper headings are rejected;
 *   - chapter numbers come from `##` order only, never from the title text.
 *
 * Parsing is pure: no filesystem, no locale, no network.
 *
 * @module dsh-fishread/shared/parse
 */

/** A rejected import. `code` is stable; `line` is 1-based (0 = whole file). */
export class NovelParseError extends Error {
  /**
   * @param {string} code stable dictionary key
   * @param {number} [line] 1-based source line, 0 when the whole file is at fault
   * @param {Record<string, unknown>} [extra] formatter values (e.g. `{ encoding }`)
   */
  constructor(code, line = 0, extra = undefined) {
    super(code)
    this.name = 'NovelParseError'
    this.code = code
    this.line = line
    this.extra = extra
  }
}

const SUPPORTED_EXTENSIONS = ['.txt', '.md']

/** @param {string} name file name or path */
export function extensionOf(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(name))
  return match === null ? '' : `.${match[1].toLowerCase()}`
}

/** @param {string} name */
export function isSupportedExtension(name) {
  return SUPPORTED_EXTENSIONS.includes(extensionOf(name))
}

/** Characters that count as "body text" for overall progress. @param {string} text */
export function countChars(text) {
  return text.replace(/\s/gu, '').length
}

/**
 * Decode imported bytes. Encoding failures are reported apart from structural
 * failures so the UI can offer an explicit GB18030 retry.
 *
 * @param {Uint8Array} bytes
 * @param {'utf-8' | 'gb18030'} [encoding]
 * @returns {string}
 */
export function decodeNovel(bytes, encoding = 'utf-8') {
  if (!(bytes instanceof Uint8Array)) throw new NovelParseError('readFailed')
  const decoder = (() => {
    try {
      return new TextDecoder(encoding, { fatal: true })
    } catch {
      throw new NovelParseError('encoding', 0, { encoding })
    }
  })()
  let text
  try {
    text = decoder.decode(bytes)
  } catch {
    throw new NovelParseError('encoding', 0, { encoding })
  }
  return text.replace(/^\uFEFF/u, '')
}

const HEADING3 = /^#{3,}/u
const TITLE = /^# (.*)$/u
const EMPTY_TITLE = /^#\s*$/u
const CHAPTER = /^## (.*)$/u
const EMPTY_CHAPTER = /^##\s*$/u

/**
 * Parse one decoded novel.
 *
 * @param {string} source
 * @returns {{
 *   title: string,
 *   chapters: Array<{ title: string, body: string, line: number, intro?: true }>,
 *   charCount: number,
 * }}
 */
export function parseNovel(source) {
  if (typeof source !== 'string') throw new NovelParseError('readFailed')
  const text = source.replace(/^\uFEFF/u, '')
  if (text.trim() === '') throw new NovelParseError('emptyFile', 1)

  const lines = text.split(/\r\n|\n|\r/u)

  let index = 0
  while (index < lines.length && lines[index].trim() === '') index += 1
  const first = lines[index]
  const firstLine = index + 1

  if (HEADING3.test(first)) throw new NovelParseError('headingLevel', firstLine)

  let title
  const titleMatch = TITLE.exec(first)
  if (titleMatch !== null) {
    title = titleMatch[1].trim()
    if (title === '') throw new NovelParseError('emptyTitle', firstLine)
  } else if (EMPTY_TITLE.test(first)) {
    throw new NovelParseError('emptyTitle', firstLine)
  } else if (/^## |^##$/u.test(first)) {
    throw new NovelParseError('missingTitle', firstLine)
  } else {
    throw new NovelParseError('missingTitle', firstLine)
  }

  /** @type {Array<{ title: string, body: string[], line: number, intro?: true }>} */
  const chapters = []
  /** Everything between the title and the first `## `, blank lines included. */
  const preamble = []
  let current = null

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]
    const lineNo = cursor + 1

    if (HEADING3.test(line)) throw new NovelParseError('headingLevel', lineNo)
    if (EMPTY_TITLE.test(line)) throw new NovelParseError('emptyTitle', lineNo)
    if (TITLE.test(line)) throw new NovelParseError('duplicateTitle', lineNo)
    if (EMPTY_CHAPTER.test(line)) throw new NovelParseError('emptyChapterTitle', lineNo)

    const chapterMatch = CHAPTER.exec(line)
    if (chapterMatch !== null) {
      const chapterTitle = chapterMatch[1].trim()
      if (chapterTitle === '') throw new NovelParseError('emptyChapterTitle', lineNo)
      current = { title: chapterTitle, body: [], line: lineNo }
      chapters.push(current)
      continue
    }

    if (current === null) {
      preamble.push(line)
      continue
    }
    current.body.push(line)
  }

  const preambleBody = trimBlankEdges(preamble)
  if (preambleBody.length > 0) {
    const lineNo = index + 2 + preamble.findIndex((line) => line.trim() !== '')
    chapters.unshift({ title: '', body: preambleBody, line: lineNo, intro: true })
  }

  if (chapters.every((chapter) => chapter.intro === true)) {
    throw new NovelParseError('noChapter', firstLine)
  }

  const parsed = chapters.map((chapter) => ({
    title: chapter.title,
    body: trimBlankEdges(chapter.body).join('\n'),
    line: chapter.line,
    ...(chapter.intro === true ? { intro: true } : {}),
  }))

  let charCount = 0
  for (const chapter of parsed) {
    if (countChars(chapter.body) === 0) {
      throw new NovelParseError('noBody', chapter.line)
    }
    charCount += countChars(chapter.body)
  }

  return { title, chapters: parsed, charCount }
}

/**
 * Drop leading/trailing blank lines while keeping interior paragraph breaks.
 * @param {string[]} lines
 */
function trimBlankEdges(lines) {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === '') start += 1
  while (end > start && lines[end - 1].trim() === '') end -= 1
  return lines.slice(start, end)
}
