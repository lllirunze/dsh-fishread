/* global window, document, matchMedia, requestAnimationFrame */
/**
 * Reader window renderer. Everything it shows comes from the preload bridge:
 * the book summary, chapter bodies on demand, preferences and the dictionary.
 * It never touches the filesystem or the network, and renders text nodes only
 * (never book content as HTML).
 */
;(() => {
  'use strict'

  const api = window.fishread
  const byId = (id) => document.getElementById(id)

  const FONT_FAMILIES = [
    ['sans', 'font.sans'],
    ['serif', 'font.serif'],
    ['mono', 'font.mono'],
  ]
  const FONT_STACKS = {
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    serif: '"Songti SC", "Noto Serif SC", "Source Han Serif SC", Georgia, "Times New Roman", serif',
    mono: '"SF Mono", Menlo, Consolas, "PingFang SC", monospace',
  }
  const FONT_SIZES = [12, 14, 16, 18, 20]
  const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0]
  const THEMES = [
    ['system', 'theme.system'],
    ['light', 'theme.light'],
    ['sepia', 'theme.sepia'],
    ['dark', 'theme.dark'],
  ]
  const INDENTS = [
    [0, 'indent.off'],
    [2, 'indent.two'],
  ]
  const PROGRESS_MODES = [
    ['bar', 'progress.bar'],
    ['percent', 'progress.percent'],
    ['both', 'progress.both'],
  ]

  const ICONS = {
    toc: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.1" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.8v1.6M8 12.6v1.6M2.4 8H1M15 8h-1.4M3.7 3.7 2.6 2.6M13.4 13.4l-1.1-1.1M3.7 12.3l-1.1 1.1M13.4 2.6l-1.1 1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  }

  const state = {
    prefs: null,
    locale: 'en',
    dict: {},
    book: null,
    chaptersMeta: [],
    totalChars: 0,
    platform: 'mac',
    epoch: 0,
    windowData: [],
    currentIndex: 0,
    progress: { chapterIndex: 0, charOffset: 0, percent: 0 },
    overlay: null,
    toastTimer: null,
    saveTimer: null,
    scrollFrame: 0,
    mutating: false,
  }

  const cache = new Map()
  const loading = new Map()

  /* ------------------------------------------------------------- i18n ---- */

  function t(key, params) {
    let value = state.dict[key]
    if (value === undefined) value = key
    if (params !== undefined) {
      value = value.replace(/\{(\w+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
      )
    }
    return value
  }

  const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const ZH_UNITS = ['', '十', '百', '千']

  function chineseNumber(value) {
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

  function chapterLabel(number) {
    return state.locale === 'zh' ? `第${chineseNumber(number)}章` : `Chapter ${number}`
  }

  /** Heading for one slot; the intro is unnumbered, so it never shifts 第N章. */
  function chapterHeading(index) {
    const meta = state.chaptersMeta[index]
    if (meta?.intro === true) return t('chapter.intro')
    let number = 0
    for (let cursor = 0; cursor <= index && cursor < state.chaptersMeta.length; cursor += 1) {
      if (state.chaptersMeta[cursor]?.intro !== true) number += 1
    }
    return chapterLabel(Math.max(number, 1))
  }
  function tocLabel(index) {
    const label = chapterHeading(index)
    const title = String(state.chaptersMeta[index]?.title ?? '').trim()
    if (title === '') return label
    return state.locale === 'zh' ? `${label} ${title}` : `${label} · ${title}`
  }

  /* --------------------------------------------------------- preferences -- */

  function resolvedTheme(theme) {
    if (theme === 'system') {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return THEMES.some(([id]) => id === theme) ? theme : 'light'
  }

  function applyPrefs(next, options) {
    const preserve = options?.preserve !== false && state.book !== null
    const anchor = preserve ? measureAnchor() : null
    state.prefs = next
    const body = document.body
    body.style.setProperty('--fs', `${next.reading.fontSize}px`)
    body.style.setProperty('--lh', String(next.reading.lineHeight))
    body.style.setProperty('--font', FONT_STACKS[next.reading.fontFamily] ?? FONT_STACKS.sans)
    body.dataset.indent = String(next.reading.indent)
    body.dataset.theme = resolvedTheme(next.reading.theme)
    updateFooter()
    if (anchor !== null) {
      requestAnimationFrame(() => restoreAnchor(anchor))
    }
  }

  function patchPrefs(section, key, value) {
    const patch = { [section]: { [key]: value } }
    api.setPrefs(patch).then((result) => {
      if (result?.prefs) applyPrefs(result.prefs)
    })
  }

  /* ------------------------------------------------------------- layout -- */

  function setText(el, text) {
    el.textContent = text
  }

  function renderChrome() {
    setText(byId('title'), state.book === null ? t('app.name') : state.book.title)
    const toc = byId('btn-toc')
    toc.title = t('reader.toc')
    toc.setAttribute('aria-label', t('reader.toc'))
    toc.hidden = state.book === null
    const settings = byId('btn-settings')
    settings.title = t('reader.settings')
    settings.setAttribute('aria-label', t('reader.settings'))
    const hide = byId('btn-hide')
    hide.title = t('reader.hide')
    hide.setAttribute('aria-label', t('reader.hide'))
    const close = byId('btn-close')
    close.title = t('reader.close')
    close.setAttribute('aria-label', t('reader.close'))

    setText(byId('empty-title'), t('empty.title'))
    setText(byId('empty-body'), t('empty.body'))
    setText(byId('btn-import'), t('empty.import'))
    setText(byId('btn-example'), t('example.title'))
    document.title = state.book === null ? t('app.name') : `${state.book.title} · ${t('app.name')}`
  }

  function showEmpty() {
    byId('empty').hidden = false
    byId('reader').hidden = true
    byId('progress').hidden = true
  }

  function showReader() {
    byId('empty').hidden = true
    byId('reader').hidden = false
    updateFooter()
  }

  /* ----------------------------------------------------------- chapters -- */

  function episodeCharCount(text) {
    return text.replace(/\s/gu, '').length
  }

  function loadChapter(index) {
    if (index < 0 || index >= state.chaptersMeta.length) return Promise.reject(new Error('out of range'))
    if (cache.has(index)) return Promise.resolve(cache.get(index))
    if (loading.has(index)) return loading.get(index)
    const epoch = state.epoch
    const promise = api
      .getChapter(index)
      .then((result) => {
        if (epoch !== state.epoch) throw new Error('stale')
        if (!result?.ok || !result.chapter) throw new Error(result?.message ?? 'chapter failed')
        const chapter = result.chapter
        const paragraphs = String(chapter.body)
          .split(/\n+/u)
          .filter((line) => line.trim() !== '')
          .map((text) => ({ text, chars: episodeCharCount(text) }))
        const entry = {
          index,
          title: chapter.title,
          paragraphs,
          charsBefore: Number(chapter.charsBefore) || 0,
        }
        cache.set(index, entry)
        loading.delete(index)
        return entry
      })
      .catch((error) => {
        loading.delete(index)
        throw error
      })
    loading.set(index, promise)
    return promise
  }

  function chapterElement(entry) {
    const section = document.createElement('section')
    section.className = 'chapter'
    section.dataset.index = String(entry.index)
    const heading = document.createElement('h2')
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = chapterHeading(entry.index)
    heading.appendChild(label)
    heading.appendChild(document.createTextNode(entry.title))
    section.appendChild(heading)
    const paragraphNodes = []
    for (const paragraph of entry.paragraphs) {
      const p = document.createElement('p')
      p.textContent = paragraph.text
      section.appendChild(p)
      paragraphNodes.push({ el: p, chars: paragraph.chars })
    }
    return { el: section, paragraphs: paragraphNodes }
  }

  function rebuildWindow(indices, options) {
    const scroller = byId('scroll')
    const anchor = options?.anchor ?? null
    scroller.textContent = ''
    state.windowData = []
    for (const index of indices) {
      const entry = cache.get(index)
      if (entry === undefined) continue
      const built = chapterElement(entry)
      scroller.appendChild(built.el)
      state.windowData.push({
        index,
        el: built.el,
        paragraphs: built.paragraphs,
        charsBefore: entry.charsBefore,
      })
    }
    if (anchor !== null) restoreAnchor(anchor)
    else updateProgress()
  }

  async function renderAround(index, options) {
    const total = state.chaptersMeta.length
    if (total === 0) return
    const center = Math.max(0, Math.min(total - 1, index))
    const start = Math.max(0, center - 1)
    const end = Math.min(total - 1, center + 1)
    const indices = []
    for (let cursor = start; cursor <= end; cursor += 1) indices.push(cursor)
    await Promise.all(indices.map((cursor) => loadChapter(cursor)))
    rebuildWindow(indices)
    if (options?.anchor !== null && options?.anchor !== undefined) {
      requestAnimationFrame(() => restoreAnchor(options.anchor))
    } else if (options?.toBottom === true) {
      requestAnimationFrame(() => {
        const scroller = byId('scroll')
        scroller.scrollTop = scroller.scrollHeight
        updateProgress()
      })
    }
  }

  function scrollerRect() {
    return byId('scroll').getBoundingClientRect()
  }

  function measureAnchor() {
    if (state.windowData.length === 0) return null
    const scroller = byId('scroll')
    const top = scrollerRect().top
    let current = state.windowData[0]
    for (const entry of state.windowData) {
      if (entry.el.getBoundingClientRect().top <= top + 4) current = entry
    }
    let partial = 0
    let chapterChars = 0
    for (const paragraph of current.paragraphs) {
      chapterChars += paragraph.chars
      if (paragraph.el.getBoundingClientRect().bottom <= top + 4) partial += paragraph.chars
    }
    const chars = current.charsBefore + partial
    const percent =
      state.totalChars <= 0 ? 0 : Math.min(100, Math.max(0, (chars / state.totalChars) * 100))
    const chapterPercent = chapterChars <= 0 ? 0 : Math.min(100, Math.max(0, (partial / chapterChars) * 100))
    return { chapterIndex: current.index, charOffset: partial, percent, chapterPercent }
  }

  function restoreAnchor(anchor) {
    if (anchor === null) return
    const scroller = byId('scroll')
    let entry = state.windowData.find((item) => item.index === anchor.chapterIndex)
    if (entry === undefined) {
      // The anchor chapter is no longer mounted; caller re-renders around it.
      return
    }
    let target = entry.paragraphs[0]
    let accumulated = 0
    for (const paragraph of entry.paragraphs) {
      if (accumulated + paragraph.chars >= anchor.charOffset) {
        target = paragraph
        break
      }
      accumulated += paragraph.chars
      target = paragraph
    }
    if (target === undefined) return
    if (anchor.percent >= 99.99) {
      scroller.scrollTop = scroller.scrollHeight
    } else {
      const delta = target.el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      scroller.scrollTop += delta - 6
    }
    updateProgress()
  }

  function updateProgress() {
    const anchor = measureAnchor()
    if (anchor !== null) state.progress = anchor
    byId('title').textContent = state.book === null ? t('app.name') : state.book.title
    updateFooter()
  }

  function updateFooter() {
    if (state.book === null || state.prefs === null) return
    const mode = state.prefs.reading.showProgress
    const footer = byId('progress')
    footer.hidden = mode === 'none'
    const anchor = state.windowData.length > 0 ? state.progress : null
    const index = anchor?.chapterIndex ?? state.progress.chapterIndex ?? 0
    const meta = state.chaptersMeta[index]
    const title = meta === undefined ? '' : String(meta.title ?? '').trim()
    let chapterText =
      meta === undefined
        ? t('reader.chapterOf', { current: index + 1, total: state.chaptersMeta.length })
        : title === ''
          ? chapterHeading(index)
          : `${chapterHeading(index)} · ${title}`
    if (anchor !== null && anchor.chapterIndex === index) {
      chapterText = `${chapterText} · ${Math.round(anchor.chapterPercent)}%`
    }
    setText(byId('progress-chapter'), chapterText)
    const percent = Math.round(anchor?.percent ?? state.progress.percent ?? 0)
    setText(byId('progress-percent'), t('reader.progress', { percent }))
    byId('progress-percent').hidden = mode === 'bar'
    byId('progress-track').hidden = mode === 'percent'
    byId('progress-fill').style.width = `${percent}%`
  }

  /* ------------------------------------------------------------ scrolling */

  function scheduleScrollWork() {
    if (state.scrollFrame !== 0) return
    state.scrollFrame = requestAnimationFrame(() => {
      state.scrollFrame = 0
      updateProgress()
      void ensureNeighbors()
      scheduleSave()
    })
  }

  async function ensureNeighbors() {
    if (state.mutating || state.book === null || state.windowData.length === 0) return
    const anchor = measureAnchor()
    if (anchor === null) return
    const total = state.chaptersMeta.length
    const first = state.windowData[0].index
    const last = state.windowData[state.windowData.length - 1].index
    const cur = anchor.chapterIndex

    if (cur === last && last < total - 1) {
      state.mutating = true
      try {
        await loadChapter(last + 1)
        const scroller = byId('scroll')
        const entry = cache.get(last + 1)
        const built = chapterElement(entry)
        scroller.appendChild(built.el)
        state.windowData.push({
          index: last + 1,
          el: built.el,
          paragraphs: built.paragraphs,
          charsBefore: entry.charsBefore,
        })
        while (state.windowData.length > 3 && state.windowData[0].index < cur) {
          const removed = state.windowData.shift()
          removed.el.remove()
        }
        restoreAnchor(anchor)
      } catch {
        /* A failed neighbour load keeps the current window usable. */
      } finally {
        state.mutating = false
      }
      return
    }

    if (cur === first && first > 0) {
      state.mutating = true
      try {
        await loadChapter(first - 1)
        const scroller = byId('scroll')
        const entry = cache.get(first - 1)
        const built = chapterElement(entry)
        scroller.insertBefore(built.el, scroller.firstChild)
        state.windowData.unshift({
          index: first - 1,
          el: built.el,
          paragraphs: built.paragraphs,
          charsBefore: entry.charsBefore,
        })
        while (state.windowData.length > 3 && state.windowData[state.windowData.length - 1].index > cur) {
          const removed = state.windowData.pop()
          removed.el.remove()
        }
        restoreAnchor(anchor)
      } catch {
        /* keep the current window */
      } finally {
        state.mutating = false
      }
    }
  }

  function atBottom() {
    const scroller = byId('scroll')
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
  }

  function scheduleSave() {
    if (state.saveTimer !== null) clearTimeout(state.saveTimer)
    state.saveTimer = setTimeout(() => {
      state.saveTimer = null
      const anchor = measureAnchor()
      if (anchor !== null) api.saveProgress(anchor)
    }, 600)
  }

  function flushProgress() {
    const anchor = measureAnchor()
    if (anchor !== null) api.saveProgress(anchor)
  }

  function page(direction) {
    if (state.book === null || state.overlay !== null) return
    const scroller = byId('scroll')
    const step = Math.max(60, scroller.clientHeight * 0.9)
    if (direction > 0) {
      if (atBottom() && state.windowData[state.windowData.length - 1].index >= state.chaptersMeta.length - 1) {
        toast(t('chapter.after'))
        return
      }
      scroller.scrollBy({ top: step, behavior: 'auto' })
    } else {
      if (scroller.scrollTop <= 0 && state.windowData[0].index === 0) {
        toast(t('chapter.before'))
        return
      }
      scroller.scrollBy({ top: -step, behavior: 'auto' })
    }
    scheduleScrollWork()
  }

  async function jumpToChapter(index) {
    closeOverlay()
    const anchor = { chapterIndex: index, charOffset: 0, percent: 0 }
    const target = state.chaptersMeta[index]
    if (target !== undefined) {
      anchor.percent = Math.min(100, (target.charsBefore / Math.max(1, state.totalChars)) * 100)
    }
    state.progress = anchor
    cache.clear()
    await renderAround(index, { anchor: { chapterIndex: index, charOffset: 0, percent: 0 } })
    const scroller = byId('scroll')
    scroller.scrollTop = 0
    updateProgress()
    scheduleSave()
  }

  /* ------------------------------------------------------------- overlays */

  function openOverlay(kind, data, build) {
    state.overlay = { kind, data, build }
    const overlay = byId('overlay')
    overlay.hidden = false
    overlay.className = `overlay ${kind === 'toc' ? 'toc' : kind === 'dialog' ? 'dialog' : 'sheet'}`
    overlay.textContent = ''
    build(overlay, data)
  }

  function closeOverlay() {
    state.overlay = null
    const overlay = byId('overlay')
    overlay.hidden = true
    overlay.textContent = ''
  }

  function refreshOverlay() {
    if (state.overlay === null) return
    const { kind, data, build } = state.overlay
    openOverlay(kind, data, build)
  }

  function button(label, options) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `btn${options?.primary ? ' primary' : ''}${options?.ghost ? ' ghost' : ''}`
    el.textContent = label
    if (options?.onClick) el.addEventListener('click', options.onClick)
    return el
  }

  function dialogShell(title, bodyNodes, actions) {
    const dialog = document.createElement('div')
    dialog.className = 'dialog'
    const head = document.createElement('div')
    head.className = 'dialog-head'
    const h3 = document.createElement('h3')
    h3.textContent = title
    head.appendChild(h3)
    const body = document.createElement('div')
    body.className = 'dialog-body'
    for (const node of bodyNodes) body.appendChild(node)
    const foot = document.createElement('div')
    foot.className = 'dialog-foot'
    for (const action of actions) {
      foot.appendChild(button(action.label, { primary: action.primary, onClick: action.onClick }))
    }
    dialog.appendChild(head)
    dialog.appendChild(body)
    dialog.appendChild(foot)
    return dialog
  }

  function metaRow(label, value) {
    const row = document.createElement('div')
    row.className = 'meta-row'
    const left = document.createElement('span')
    left.textContent = label
    const right = document.createElement('span')
    right.textContent = value
    row.appendChild(left)
    row.appendChild(right)
    return row
  }

  function toast(message) {
    if (state.toastTimer !== null) clearTimeout(state.toastTimer)
    const existing = document.querySelector('.toast')
    if (existing !== null) existing.remove()
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = message
    document.querySelector('.stage').appendChild(el)
    state.toastTimer = setTimeout(() => {
      el.remove()
      state.toastTimer = null
    }, 1600)
  }

  /* ----------------------------------------------------------------- TOC -- */

  function openToc() {
    if (state.book === null) return
    openOverlay('toc', null, (overlay) => {
      const panel = document.createElement('div')
      panel.className = 'toc-panel'
      const head = document.createElement('div')
      head.className = 'sheet-head'
      const h3 = document.createElement('h3')
      h3.textContent = t('reader.toc')
      const closeBtn = document.createElement('button')
      closeBtn.type = 'button'
      closeBtn.className = 'icon-btn'
      closeBtn.innerHTML = ICONS.close
      closeBtn.title = t('common.close')
      closeBtn.addEventListener('click', closeOverlay)
      head.appendChild(h3)
      head.appendChild(closeBtn)
      const list = document.createElement('div')
      list.className = 'toc-list'
      const current = state.progress.chapterIndex
      state.chaptersMeta.forEach((meta, index) => {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'toc-item'
        item.setAttribute('aria-current', index === current ? 'true' : 'false')
        item.textContent = tocLabel(index)
        item.addEventListener('click', () => {
          void jumpToChapter(index)
        })
        list.appendChild(item)
      })
      panel.appendChild(head)
      panel.appendChild(list)
      overlay.appendChild(panel)
    })
  }

  /* ------------------------------------------------------------ settings -- */

  function selectControl(options, value, onChange) {
    const select = document.createElement('select')
    for (const [id, labelKey] of options) {
      const option = document.createElement('option')
      option.value = String(id)
      option.textContent = t(labelKey)
      if (String(id) === String(value)) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const raw = select.value
      const numeric = Number(raw)
      onChange(Number.isFinite(numeric) && raw.trim() !== '' ? numeric : raw)
    })
    return select
  }

  function switchControl(checked, onChange) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'switch'
    el.setAttribute('role', 'switch')
    el.setAttribute('aria-checked', checked ? 'true' : 'false')
    el.addEventListener('click', () => {
      const next = el.getAttribute('aria-checked') !== 'true'
      el.setAttribute('aria-checked', next ? 'true' : 'false')
      onChange(next)
    })
    return el
  }

  function row(labelKey, control, hintKey) {
    const el = document.createElement('div')
    el.className = 'row'
    const labels = document.createElement('div')
    labels.className = 'row-label'
    const label = document.createElement('div')
    label.textContent = t(labelKey)
    labels.appendChild(label)
    if (hintKey !== undefined) {
      const hint = document.createElement('div')
      hint.className = 'row-hint'
      hint.textContent = t(hintKey)
      labels.appendChild(hint)
    }
    el.appendChild(labels)
    el.appendChild(control)
    return el
  }

  function groupTitle(key) {
    const el = document.createElement('div')
    el.className = 'group-title'
    el.textContent = t(key)
    return el
  }

  function openSettings() {
    openOverlay('settings', null, (overlay) => {
      const sheet = document.createElement('div')
      sheet.className = 'sheet'
      const head = document.createElement('div')
      head.className = 'sheet-head'
      const h3 = document.createElement('h3')
      h3.textContent = t('settings.title')
      const closeBtn = document.createElement('button')
      closeBtn.type = 'button'
      closeBtn.className = 'icon-btn'
      closeBtn.innerHTML = ICONS.close
      closeBtn.addEventListener('click', closeOverlay)
      head.appendChild(h3)
      head.appendChild(closeBtn)
      const body = document.createElement('div')
      body.className = 'sheet-body'
      const prefs = state.prefs

      body.appendChild(groupTitle('settings.window'))
      body.appendChild(
        row(
          'settings.alwaysOnTop',
          switchControl(prefs.window.alwaysOnTop, (value) => patchPrefs('window', 'alwaysOnTop', value)),
          'settings.alwaysOnTopHint',
        ),
      )
      body.appendChild(
        row(
          'settings.restorePosition',
          switchControl(prefs.window.restoreLastPosition, (value) =>
            patchPrefs('window', 'restoreLastPosition', value),
          ),
          'settings.restorePositionHint',
        ),
      )

      body.appendChild(groupTitle('settings.reading'))
      body.appendChild(
        row(
          'settings.fontFamily',
          selectControl(FONT_FAMILIES, prefs.reading.fontFamily, (value) =>
            patchPrefs('reading', 'fontFamily', value),
          ),
        ),
      )
      body.appendChild(
        row(
          'settings.fontSize',
          selectControl(
            FONT_SIZES.map((size) => [size, `${size} px`]),
            prefs.reading.fontSize,
            (value) => patchPrefs('reading', 'fontSize', Number(value)),
          ),
        ),
      )
      body.appendChild(
        row(
          'settings.lineHeight',
          selectControl(
            LINE_HEIGHTS.map((height) => [height, String(height)]),
            prefs.reading.lineHeight,
            (value) => patchPrefs('reading', 'lineHeight', Number(value)),
          ),
        ),
      )
      body.appendChild(
        row('settings.theme', selectControl(THEMES, prefs.reading.theme, (value) => patchPrefs('reading', 'theme', value))),
      )
      body.appendChild(
        row(
          'settings.indent',
          selectControl(INDENTS, prefs.reading.indent, (value) => patchPrefs('reading', 'indent', Number(value))),
        ),
      )
      body.appendChild(
        row(
          'settings.progress',
          selectControl(PROGRESS_MODES, prefs.reading.showProgress, (value) =>
            patchPrefs('reading', 'showProgress', value),
          ),
        ),
      )

      const foot = document.createElement('div')
      foot.className = 'sheet-foot'
      foot.appendChild(
        button(t('settings.windowClose'), {
          onClick: () => api.closeWindow(),
        }),
      )
      foot.appendChild(
        button(t('common.close'), {
          primary: true,
          onClick: () => {
            if (state.book === null) void chooseFile()
            else closeOverlay()
          },
        }),
      )

      sheet.appendChild(head)
      sheet.appendChild(body)
      sheet.appendChild(foot)
      overlay.appendChild(sheet)
    })
  }

  /* -------------------------------------------------------------- example */

  function openExample() {
    openOverlay('example', null, (overlay) => {
      const pre = document.createElement('pre')
      pre.className = 'example-text'
      pre.textContent = t('example.sample')
      const hint = document.createElement('p')
      hint.textContent = t('example.hint')
      const dialog = dialogShell(t('example.title'), [hint, pre], [
        { label: t('example.close'), primary: true, onClick: closeOverlay },
      ])
      overlay.appendChild(dialog)
    })
  }

  /* --------------------------------------------------------------- import */

  async function chooseFile() {
    const result = await api.chooseFile()
    if (result === undefined || result === null) return
    if (result.ok === true) {
      openPreview(result)
      return
    }
    if (result.code === 'canceled') return
    if (result.code === 'encoding' && result.gbkEligible === true) {
      openEncoding(result)
      return
    }
    openError(result)
  }

  function openEncoding(result) {
    openOverlay('encoding', result, (overlay, data) => {
      const body = document.createElement('p')
      body.textContent = t('encoding.body')
      const dialog = dialogShell(t('encoding.title'), [body], [
        { label: t('common.cancel'), onClick: () => void api.cancelImport(data.token).then(closeOverlay) },
        {
          label: t('encoding.retry'),
          primary: true,
          onClick: () => {
            api.retryGbk(data.token).then((retried) => {
              if (retried?.ok === true) openPreview(retried)
              else openError(retried)
            })
          },
        },
      ])
      overlay.appendChild(dialog)
    })
  }

  function openPreview(data) {
    openOverlay('preview', data, (overlay, preview) => {
      const meta = document.createElement('div')
      meta.className = 'meta'
      meta.appendChild(metaRow(t('preview.bookTitle'), preview.title))
      meta.appendChild(metaRow(t('preview.chapters'), String(preview.chapterCount)))
      meta.appendChild(metaRow(t('preview.characters'), String(preview.charCount)))
      const list = document.createElement('div')
      list.className = 'preview-chapters'
      const shown = preview.chapters.slice(0, 40)
      let shownNumber = 0
      list.textContent = shown
        .map((chapter) => {
          if (chapter.intro === true) return t('chapter.intro')
          shownNumber += 1
          const title = String(chapter.title ?? '').trim()
          const label = chapterLabel(shownNumber)
          return title === '' ? label : state.locale === 'zh' ? `${label} ${title}` : `${label} · ${title}`
        })
        .join('\n')
      const bodyNodes = [meta]
      if (preview.chapters.length > 0) bodyNodes.push(list)
      const dialog = dialogShell(t('preview.title'), bodyNodes, [
        {
          label: t('common.cancel'),
          onClick: () => {
            void api.cancelImport(preview.token)
            closeOverlay()
          },
        },
        { label: t('preview.confirm'), primary: true, onClick: () => confirmPreview(preview) },
      ])
      overlay.appendChild(dialog)
    })
  }

  function confirmPreview(preview) {
    if (state.book === null) {
      void finishImport(preview)
      return
    }
    openOverlay('replace', preview, (overlay, data) => {
      const body = document.createElement('p')
      body.textContent = t('preview.replaceBody')
      const dialog = dialogShell(t('preview.replaceTitle'), [body], [
        { label: t('common.cancel'), onClick: () => openPreview(data) },
        { label: t('preview.replace'), primary: true, onClick: () => void finishImport(data) },
      ])
      overlay.appendChild(dialog)
    })
  }

  async function finishImport(preview) {
    const result = await api.confirmImport(preview.token)
    if (result?.ok !== true) {
      openError({ code: result?.code ?? 'import', line: 0, extra: result?.extra })
      return
    }
    closeOverlay()
    state.epoch += 1
    cache.clear()
    loading.clear()
    state.book = result.book
    state.chaptersMeta = result.chaptersMeta
    state.totalChars = result.book.charCount
    state.progress = { chapterIndex: 0, charOffset: 0, percent: 0 }
    renderChrome()
    showReader()
    await renderAround(0)
    updateProgress()
    scheduleSave()
  }

  function openError(failure) {
    const code = failure.code ?? 'readFailed'
    const messageKey = `error.${code}`
    openOverlay('error', failure, (overlay, data) => {
      const body = document.createElement('p')
      body.textContent = t(messageKey)
      const extra = document.createElement('p')
      if (typeof data.extra?.message === 'string' && data.extra.message !== '') {
        extra.className = 'err-line'
        extra.textContent = data.extra.message
      } else {
        extra.textContent = t('error.hint')
      }
      const line = document.createElement('p')
      if (typeof data.line === 'number' && data.line > 0) {
        line.className = 'err-line'
        line.textContent = t('error.line', { line: data.line, message: '' }).trim()
      }
      const nodes = [body]
      if (line.textContent !== '') nodes.push(line)
      nodes.push(extra)
      const actions = [{ label: t('common.close'), onClick: closeOverlay }]
      if (data.code === 'encoding' && data.gbkEligible === true) {
        actions.unshift({
          label: t('encoding.retry'),
          primary: true,
          onClick: () => {
            api.retryGbk(data.token).then((retried) => {
              if (retried?.ok === true) openPreview(retried)
              else openError(retried)
            })
          },
        })
      }
      const dialog = dialogShell(t('error.title'), nodes, actions)
      overlay.appendChild(dialog)
    })
  }

  /* ------------------------------------------------------------- lifecycle */

  function bindEvents() {
    byId('btn-import').addEventListener('click', () => void chooseFile())
    byId('btn-example').addEventListener('click', openExample)
    byId('btn-toc').addEventListener('click', openToc)
    byId('btn-settings').addEventListener('click', openSettings)
    byId('btn-hide').addEventListener('click', () => {
      flushProgress()
      api.hideWindow()
    })
    byId('btn-close').addEventListener('click', () => {
      flushProgress()
      api.closeWindow()
    })
    byId('overlay').addEventListener('click', (event) => {
      if (event.target === byId('overlay')) closeOverlay()
    })
    const scroller = byId('scroll')
    scroller.addEventListener('scroll', scheduleScrollWork, { passive: true })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.overlay !== null) {
          event.preventDefault()
          closeOverlay()
        }
        return
      }
      if (state.overlay !== null || state.book === null) return
      if (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
        event.preventDefault()
        page(1)
      } else if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
        event.preventDefault()
        page(-1)
      }
    })
    window.addEventListener('beforeunload', flushProgress)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushProgress()
    })
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.prefs !== null && state.prefs.reading.theme === 'system') {
        document.body.dataset.theme = resolvedTheme('system')
      }
    })
  }

  function applyInit(payload) {
    state.prefs = payload.prefs
    state.locale = payload.locale
    state.dict = payload.dict ?? {}
    state.platform = payload.platform === 'mac' ? 'mac' : 'win'
    state.book = payload.book ?? null
    state.chaptersMeta = Array.isArray(payload.chaptersMeta) ? payload.chaptersMeta : []
    state.totalChars = state.book?.charCount ?? 0
    state.progress = payload.progress ?? { chapterIndex: 0, charOffset: 0, percent: 0 }
    renderChrome()
    applyPrefs(payload.prefs, { preserve: false })
    if (state.book === null) {
      showEmpty()
      return
    }
    showReader()
    const target = Math.max(0, Math.min(state.chaptersMeta.length - 1, state.progress.chapterIndex))
    const toBottom = state.progress.percent >= 99.9
    renderAround(target, { toBottom }).then(() => {
      const anchor = {
        chapterIndex: target,
        charOffset: toBottom ? 0 : state.progress.charOffset ?? 0,
        percent: toBottom ? 100 : state.progress.percent ?? 0,
      }
      restoreAnchor(anchor)
      // Persist the restored position once so a fresh import always has a
      // resumable progress record.
      scheduleSave()
    })
  }

  function boot() {
    byId('btn-toc').innerHTML = ICONS.toc
    byId('btn-settings').innerHTML = ICONS.gear
    byId('btn-hide').innerHTML = ICONS.minus
    byId('btn-close').innerHTML = ICONS.close
    bindEvents()

    api.onInit(applyInit)
    api.onPrefs((next) => applyPrefs(next))
    api.onLocale((payload) => {
      state.locale = payload.locale
      state.dict = payload.dict ?? {}
      const anchor = measureAnchor()
      renderChrome()
      if (state.book !== null) {
        const indices = state.windowData.map((entry) => entry.index)
        if (indices.length > 0) rebuildWindow(indices, { anchor })
      }
      refreshOverlay()
    })
    api.onImport(() => {
      closeOverlay()
      void chooseFile()
    })
    api.onPage((direction) => page(direction))
    api.ready()
  }

  boot()
})()
