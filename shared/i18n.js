/**
 * Bilingual copy shared by every surface (Host routes, the DSH settings page
 * and the reader window). The active language follows DSH; unsupported
 * languages fall back to English. Only interface text and generated chapter
 * numbers are localized — book titles, chapter titles and body text are never
 * translated.
 *
 * @module dsh-fishread/shared/i18n
 */

/** Fallback language for anything unsupported or missing. */
export const FALLBACK_LOCALE = 'en'

/** @typedef {typeof DICTS.zh} Dict */

const zh = {
  'app.name': '摸鱼阅读',
  'app.tagline': '离线小窗阅读',
  'app.open': '打开阅读窗口',
  'app.toggle': '隐藏 / 恢复阅读窗口',
  'app.close': '关闭阅读窗口',

  'common.cancel': '取消',
  'common.confirm': '确定',
  'common.import': '导入小说',
  'common.retry': '重试',
  'common.reset': '恢复默认',
  'common.close': '关闭',
  'common.back': '返回',
  'common.loading': '加载中…',
  'common.chapters': '{count} 章',
  'common.characters': '{count} 字',

  'entry.label': '摸鱼阅读',
  'entry.title': '摸鱼阅读',
  'entry.description': '在独立的原生小窗里离线阅读单本小说。',
  'entry.open': '打开',
  'entry.stateClosed': '未打开',
  'entry.stateVisible': '阅读窗口已打开',
  'entry.stateHidden': '阅读窗口已隐藏',

  'error.title': '无法导入',
  'error.unsupportedExt': '仅支持 .txt 与 .md 文件',
  'error.encoding': '文件不是有效的 UTF-8 文本',
  'error.emptyFile': '文件为空或只有空白内容',
  'error.missingTitle': '缺少书名：文件第一条非空内容必须是 “# 书名”',
  'error.duplicateTitle': '重复书名：只能有一个 “# 书名”',
  'error.emptyTitle': '书名为空：“#” 后需要书名',
  'error.noChapter': '没有章节：至少需要一个 “## 章节名”',
  'error.emptyChapterTitle': '章节名为空：“##” 后需要章节名',
  'error.noBody': '这一章没有正文',
  'error.headingLevel': '暂不支持三级及以上标题',
  'error.readFailed': '读取文件失败',
  'error.hint': '格式示例：第一行 “# 书名”，之后用 “## 章节名” 分章；书名与第一章之间的文字会作为“引言”保留。',
  'error.line': '第 {line} 行：{message}',
  'error.wholeFile': '整个文件：{message}',
  'error.window': '无法创建阅读窗口：{message}',
  'error.import': '保存导入的小说失败：{message}',

  'empty.title': '还没有小说',
  'empty.body': '导入一本 .txt 或 .md 文件，就能在这个小窗里摸鱼。',
  'empty.import': '选择小说文件',

  'preview.title': '导入预览',
  'preview.bookTitle': '书名',
  'preview.chapters': '章节',
  'preview.characters': '有效字数',
  'preview.confirm': '开始阅读',
  'preview.replaceTitle': '替换当前小说？',
  'preview.replaceBody': '替换当前小说将清除当前小说阅读进度。',
  'preview.replace': '替换并导入',

  'example.title': '格式示例',
  'example.hint': '复制下面的写法，用同样的结构保存为 .txt 或 .md；书名与第一章之间的文字会作为不编号的「引言」。',
  'example.sample': '# 示例书名\n\n写在前面：这里可以写引言，不占用章节编号。\n\n## 第一章 科学边界\n\n第一章正文第一段。\n\n第一章正文第二段。\n\n## 第二章 射手与农场主\n\n第二章正文。',
  'example.close': '知道了',

  'encoding.title': '编码无法识别',
  'encoding.body': '这个文件不是 UTF-8。要按 GB18030（常见中文 TXT 编码）重新尝试解码吗？',
  'encoding.retry': '按 GB18030 重试',

  'reader.toc': '目录',
  'reader.settings': '阅读设置',
  'reader.close': '关闭窗口',
  'reader.hide': '隐藏窗口',
  'reader.noBook': '还没有导入小说',
  'reader.chapterOf': '第 {current} / {total} 章',
  'reader.progress': '{percent}%',
  'reader.prevPage': '上一页',
  'reader.nextPage': '下一页',
  'reader.jump': '跳到这一章',
  'reader.bookmark': '书签',
  'reader.import': '导入',
  'reader.loadingChapter': '正在加载章节…',
  'chapter.intro': '引言',

  'settings.title': '设置',
  'settings.window': '窗口',
  'settings.alwaysOnTop': '窗口置顶',
  'settings.alwaysOnTopHint': '让阅读窗口保持在其他窗口之上。',
  'settings.restorePosition': '记住窗口位置',
  'settings.restorePositionHint': '下次打开时回到上次的位置和大小。',
  'settings.reading': '阅读',
  'settings.fontFamily': '字体',
  'settings.fontSize': '字号',
  'settings.lineHeight': '行距',
  'settings.theme': '主题',
  'settings.indent': '段首缩进',
  'settings.progress': '进度显示',
  'settings.shortcuts': '快捷键',
  'settings.shortcutsHint': '在所有应用中生效，需要「一个修饰键 + 一个普通键」。',
  'settings.toggle': '隐藏 / 恢复窗口',
  'settings.prevPage': '上一页',
  'settings.nextPage': '下一页',
  'settings.record': '点击录制',
  'settings.recording': '请按下组合键…',
  'settings.recordHint': 'Esc 取消',
  'settings.shortcutInactive': '窗口未打开，快捷键暂未注册',
  'settings.shortcutRegistered': '已生效',
  'settings.shortcutFailed': '注册失败，可能被其他应用占用',
  'settings.shortcutConflict': '与另一项快捷键重复',
  'settings.shortcutInvalid': '需要「一个修饰键 + 一个普通键」',
  'settings.windowOpen': '打开阅读窗口',
  'settings.windowClose': '关闭阅读窗口',
  'settings.windowHidden': '阅读窗口被隐藏',

  'font.sans': '无衬线',
  'font.serif': '衬线',
  'font.mono': '等宽',
  'theme.system': '跟随系统',
  'theme.light': '浅色',
  'theme.sepia': '米黄',
  'theme.dark': '深色',
  'indent.off': '关闭',
  'indent.two': '2 字符',
  'progress.bar': '进度条',
  'progress.percent': '百分比',
  'progress.both': '进度条 + 百分比',

  'chapter.before': '已经是第一页',
  'chapter.after': '已经是最后一页',
}

const en = {
  'app.name': 'FishRead',
  'app.tagline': 'Offline reading in a small window',
  'app.open': 'Open reader window',
  'app.toggle': 'Hide / restore reader window',
  'app.close': 'Close reader window',

  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.import': 'Import novel',
  'common.retry': 'Retry',
  'common.reset': 'Reset',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.loading': 'Loading…',
  'common.chapters': '{count} chapters',
  'common.characters': '{count} characters',

  'entry.label': 'FishRead',
  'entry.title': 'FishRead',
  'entry.description': 'Read one novel offline in its own native window.',
  'entry.open': 'Open',
  'entry.stateClosed': 'Not open',
  'entry.stateVisible': 'Reader window is open',
  'entry.stateHidden': 'Reader window is hidden',

  'error.title': 'Cannot import',
  'error.unsupportedExt': 'Only .txt and .md files are supported',
  'error.encoding': 'The file is not valid UTF-8 text',
  'error.emptyFile': 'The file is empty',
  'error.missingTitle': 'Missing title: the first non-empty line must be “# Title”',
  'error.duplicateTitle': 'Duplicate title: only one “# Title” line is allowed',
  'error.emptyTitle': 'Empty title: put the title after “#”',
  'error.noChapter': 'No chapters: at least one “## Chapter name” line is required',
  'error.emptyChapterTitle': 'Empty chapter name: put the name after “##”',
  'error.noBody': 'This chapter has no body text',
  'error.headingLevel': 'Third-level headings and deeper are not supported',
  'error.readFailed': 'Could not read the file',
  'error.hint': 'Format: “# Title” first, then one or more “## Chapter name” lines; text before the first chapter is kept as an introduction.',
  'error.line': 'Line {line}: {message}',
  'error.wholeFile': 'Whole file: {message}',
  'error.window': 'Could not open the reader window: {message}',
  'error.import': 'Could not save the imported novel: {message}',

  'empty.title': 'No novel yet',
  'empty.body': 'Import a .txt or .md file and read it in this little window.',
  'empty.import': 'Choose a novel file',

  'preview.title': 'Import preview',
  'preview.bookTitle': 'Title',
  'preview.chapters': 'Chapters',
  'preview.characters': 'Body characters',
  'preview.confirm': 'Start reading',
  'preview.replaceTitle': 'Replace the current novel?',
  'preview.replaceBody': 'Replacing the current novel clears its reading progress.',
  'preview.replace': 'Replace and import',

  'example.title': 'Format example',
  'example.hint': 'Save a file with this structure as .txt or .md; text between the title and the first chapter stays as an unnumbered introduction.',
  'example.sample': '# Example title\n\nPreface: this line is kept as an introduction and gets no chapter number.\n\n## Chapter 1 The boundary\n\nFirst paragraph.\n\nSecond paragraph.\n\n## Chapter 2 The archer\n\nChapter two body.',
  'example.close': 'Got it',

  'encoding.title': 'Unknown encoding',
  'encoding.body': 'This file is not UTF-8. Try decoding it as GB18030 (common for Chinese TXT files)?',
  'encoding.retry': 'Retry as GB18030',

  'reader.toc': 'Contents',
  'reader.settings': 'Reading settings',
  'reader.close': 'Close window',
  'reader.hide': 'Hide window',
  'reader.noBook': 'No novel imported yet',
  'reader.chapterOf': 'Chapter {current} / {total}',
  'reader.progress': '{percent}%',
  'reader.prevPage': 'Previous page',
  'reader.nextPage': 'Next page',
  'reader.jump': 'Jump to chapter',
  'reader.bookmark': 'Bookmark',
  'reader.import': 'Import',
  'reader.loadingChapter': 'Loading chapter…',
  'chapter.intro': 'Introduction',

  'settings.title': 'Settings',
  'settings.window': 'Window',
  'settings.alwaysOnTop': 'Always on top',
  'settings.alwaysOnTopHint': 'Keep the reader window above other windows.',
  'settings.restorePosition': 'Remember window position',
  'settings.restorePositionHint': 'Reopen at the last position and size.',
  'settings.reading': 'Reading',
  'settings.fontFamily': 'Font family',
  'settings.fontSize': 'Font size',
  'settings.lineHeight': 'Line height',
  'settings.theme': 'Theme',
  'settings.indent': 'Paragraph indent',
  'settings.progress': 'Show progress',
  'settings.shortcuts': 'Shortcuts',
  'settings.shortcutsHint': 'Work in every app: one modifier plus one regular key.',
  'settings.toggle': 'Hide / restore window',
  'settings.prevPage': 'Previous page',
  'settings.nextPage': 'Next page',
  'settings.record': 'Click to record',
  'settings.recording': 'Press a combination…',
  'settings.recordHint': 'Esc to cancel',
  'settings.shortcutInactive': 'Window is closed; shortcuts are not registered',
  'settings.shortcutRegistered': 'Active',
  'settings.shortcutFailed': 'Registration failed; another app may own this combination',
  'settings.shortcutConflict': 'Already used by another FishRead shortcut',
  'settings.shortcutInvalid': 'Use one modifier plus one regular key',
  'settings.windowOpen': 'Open reader window',
  'settings.windowClose': 'Close reader window',
  'settings.windowHidden': 'Reader window is hidden',

  'font.sans': 'Sans',
  'font.serif': 'Serif',
  'font.mono': 'Monospace',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.sepia': 'Sepia',
  'theme.dark': 'Dark',
  'indent.off': 'Off',
  'indent.two': '2 characters',
  'progress.bar': 'Bar',
  'progress.percent': 'Percentage',
  'progress.both': 'Bar and percentage',

  'chapter.before': 'Already at the first page',
  'chapter.after': 'Already at the last page',
}

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

/**
 * Chinese numerals for chapter labels, 0–99999.
 * 10 → 十, 12 → 十二, 20 → 二十, 101 → 一百零一.
 * @param {number} value
 */
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
  // 十, 十一 rather than 一十, 一十一.
  return out.startsWith('一十') ? out.slice(1) : out
}

/**
 * Generated chapter label only; never the chapter's own title.
 * @param {number} number 1-based
 * @param {string} locale
 */
export function formatChapterLabel(number, locale) {
  return normalizeLocale(locale) === 'zh' ? `第${chineseNumber(number)}章` : `Chapter ${number}`
}

/**
 * Table-of-contents row text: generated label plus the author's chapter title.
 * @param {number} number 1-based
 * @param {string} title
 * @param {string} locale
 */
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

/**
 * Display one stored accelerator for the current platform.
 * @param {string} accelerator e.g. `Control+;`
 * @param {'mac' | 'win'} platform
 */
export function formatShortcut(accelerator, platform) {
  return String(accelerator)
    .split('+')
    .filter(Boolean)
    .map((part) => MODIFIER_GLYPHS[part]?.[platform] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join(' ')
}
