/**
 * FishRead — Client (Web) half.
 *
 * Two surfaces only: an entry button at the sidebar foot that asks the Host to
 * open the independent reader window, and the plugin's settings page. The novel
 * itself is never rendered inside DSH.
 *
 * @module dsh-fishread/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-fishread',
  factory(require) {
    const React = require('react')
    const h = React.createElement


    const DICT = {
      zh: {
        'entry.label': '摸鱼阅读',
        'entry.open': '打开阅读窗口',
        'entry.hint': '打开独立的小说阅读窗口',
        'settings.title': '摸鱼阅读',
        'settings.summary': '独立的悬浮小说窗口，不占用 DSH 页面。',
        'settings.open': '打开阅读窗口',
        'settings.hide': '隐藏阅读窗口',
        'settings.clear': '清除阅读数据',
        'settings.clearConfirm': '再次点击以确认清除',
        'settings.window': '窗口',
        'settings.windowState': '窗口状态',
        'settings.windowOpen': '已打开',
        'settings.windowClosed': '未打开',
        'settings.alwaysOnTop': '窗口置顶',
        'settings.alwaysOnTopHint': '让阅读窗口保持在其他窗口之上',
        'settings.restorePosition': '记住窗口位置',
        'settings.restorePositionHint': '下次打开时回到上次的位置和大小',
        'settings.reading': '阅读',
        'settings.fontFamily': '字体',
        'settings.fontSize': '字号',
        'settings.lineHeight': '行距',
        'settings.theme': '主题',
        'settings.indent': '首行缩进',
        'settings.progress': '进度显示',
        'settings.shortcuts': '快捷键',
        'settings.shortcutsHint': '全局快捷键，在其他应用聚焦时也可用',
        'settings.book': '当前小说',
        'settings.noBook': '尚未导入小说',
        'settings.chapters': '章',
        'settings.chars': '字',
        'settings.record': '点击录制',
        'settings.recording': '请按下组合键…',
        'settings.reset': '恢复默认',
        'settings.shortcutError': '该组合无法注册，可能已被其他应用占用，请换一个组合。',
        'settings.conflict': '该组合与其他快捷键重复。',
        'settings.invalid': '需要「一个修饰键 + 一个普通键」。',
        'settings.saved': '已保存',
        'settings.opFailed': '操作失败：',
        'font.sans': '无衬线',
        'font.serif': '衬线',
        'font.mono': '等宽',
        'theme.system': '跟随系统',
        'theme.light': '浅色',
        'theme.sepia': '米黄',
        'theme.dark': '深色',
        'indent.off': '关闭',
        'indent.two': '两字符',
        'progress.bar': '进度条',
        'progress.percent': '百分比',
        'progress.both': '两者',
        'panel.subtitle': '独立小窗阅读，DSH 页面不被打扰。',
        'panel.start': '导入小说',
        'panel.import': '导入小说',
        'panel.continue': '继续阅读',
        'panel.replace': '更换小说',
        'panel.hide': '隐藏窗口',
        'panel.noBook': '还没有小说。导入一个 .txt 或 .md 文件即可开始。',
        'panel.chapterCount': '{n} 章',
        'panel.progress': '第 {n} 章 · {p}%',
        'panel.toggleHint': '随时用 {key} 隐藏或恢复窗口。',
        'panel.settingsHint': '窗口、字体与快捷键在「插件 → 摸鱼阅读」里调整。',
        'shortcut.toggle': '隐藏 / 恢复窗口',
        'shortcut.prevPage': '上一页',
        'shortcut.nextPage': '下一页',
      },
      en: {
        'entry.label': 'FishRead',
        'entry.open': 'Open reader window',
        'entry.hint': 'Open the standalone novel reader window',
        'settings.title': 'FishRead',
        'settings.summary': 'A floating novel window that never occupies the DSH page.',
        'settings.open': 'Open reader window',
        'settings.hide': 'Hide reader window',
        'settings.clear': 'Clear reading data',
        'settings.clearConfirm': 'Click again to confirm',
        'settings.window': 'Window',
        'settings.windowState': 'Window state',
        'settings.windowOpen': 'Open',
        'settings.windowClosed': 'Closed',
        'settings.alwaysOnTop': 'Always on Top',
        'settings.alwaysOnTopHint': 'Keep the reader above other windows',
        'settings.restorePosition': 'Restore Last Window Position',
        'settings.restorePositionHint': 'Reopen at the previous position and size',
        'settings.reading': 'Reading',
        'settings.fontFamily': 'Font Family',
        'settings.fontSize': 'Font Size',
        'settings.lineHeight': 'Line Height',
        'settings.theme': 'Theme',
        'settings.indent': 'Paragraph Indent',
        'settings.progress': 'Show Progress',
        'settings.shortcuts': 'Shortcuts',
        'settings.shortcutsHint': 'Global shortcuts, usable while another app is focused',
        'settings.book': 'Current novel',
        'settings.noBook': 'No novel imported yet',
        'settings.chapters': 'chapters',
        'settings.chars': 'chars',
        'settings.record': 'Click to record',
        'settings.recording': 'Press a combination…',
        'settings.reset': 'Reset',
        'settings.shortcutError': 'This combination could not be registered. Another app may own it; pick another one.',
        'settings.conflict': 'This combination is already used by another FishRead shortcut.',
        'settings.invalid': 'Use one modifier plus one normal key.',
        'settings.saved': 'Saved',
        'settings.opFailed': 'Failed: ',
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
        'progress.both': 'Both',
        'panel.subtitle': 'A floating window for reading; the DSH page stays out of it.',
        'panel.start': 'Import a novel',
        'panel.import': 'Import a novel',
        'panel.continue': 'Continue reading',
        'panel.replace': 'Replace novel',
        'panel.hide': 'Hide window',
        'panel.noBook': 'No novel yet. Import a .txt or .md file to begin.',
        'panel.chapterCount': '{n} chapters',
        'panel.progress': 'chapter {n} · {p}%',
        'panel.toggleHint': 'Press {key} anytime to hide or restore the window.',
        'panel.settingsHint': 'Window, type and shortcuts live under Plugins → FishRead.',
        'shortcut.toggle': 'Hide / restore window',
        'shortcut.prevPage': 'Previous page',
        'shortcut.nextPage': 'Next page',
      },
    }

    const DEFAULT_SHORTCUTS = { toggle: 'Control+;', prevPage: 'Control+,', nextPage: 'Control+.' }
    const FONT_FAMILIES = [
      ['sans', 'font.sans'],
      ['serif', 'font.serif'],
      ['mono', 'font.mono'],
    ]
    const FONT_SIZES = ['12', '14', '16', '18', '20']
    const LINE_HEIGHTS = ['1.4', '1.6', '1.8', '2']
    const THEMES = [
      ['system', 'theme.system'],
      ['light', 'theme.light'],
      ['sepia', 'theme.sepia'],
      ['dark', 'theme.dark'],
    ]
    const INDENTS = [
      ['0', 'indent.off'],
      ['2', 'indent.two'],
    ]
    const PROGRESS_MODES = [
      ['bar', 'progress.bar'],
      ['percent', 'progress.percent'],
      ['both', 'progress.both'],
    ]
    const ACTIONS = ['toggle', 'prevPage', 'nextPage']

    const STYLE = `
.fr-card { display:flex; flex-direction:column; gap:18px; color:var(--dsw-alias-label-primary); }
.fr-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.fr-summary p { margin:0; color:var(--dsw-alias-label-secondary); font-size:13px; }
.fr-group { display:flex; flex-direction:column; gap:2px; }
.fr-group-title { font-size:12px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--dsw-alias-label-secondary); padding:6px 0; }
.fr-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:9px 0; border-top:1px solid var(--dsw-alias-border-l1); }
.fr-row:first-of-type { border-top:none; }
.fr-labels { display:flex; flex-direction:column; gap:3px; min-width:0; }
.fr-label { font-size:13px; }
.fr-hint { font-size:12px; color:var(--dsw-alias-label-secondary); }
.fr-control { flex:none; display:flex; align-items:center; gap:8px; }
.fr-switch { width:38px; height:22px; border-radius:11px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); position:relative; cursor:pointer; padding:0; transition:background .15s ease; }
.fr-switch[aria-checked="true"] { background:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); }
.fr-switch::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .15s ease; }
.fr-switch[aria-checked="true"]::after { transform:translateX(16px); }
.fr-select { min-width:132px; font:inherit; font-size:13px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); border:1px solid var(--dsw-alias-border-l1); border-radius:7px; padding:5px 8px; }
.fr-input { font:inherit; font-size:13px; }
.fr-kbd { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; cursor:pointer; color:var(--dsw-alias-label-primary); }
.fr-kbd[data-recording="true"] { border-color:var(--dsw-alias-brand-primary); color:var(--dsw-alias-brand-primary); }
.fr-link { border:none; background:none; padding:0; font:inherit; font-size:12px; color:var(--dsw-alias-label-secondary); cursor:pointer; text-decoration:underline; }
.fr-link:hover { color:var(--dsw-alias-label-primary); }
.fr-btn { font:inherit; font-size:12px; padding:6px 12px; border-radius:7px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); cursor:pointer; }
.fr-btn:hover { background:var(--dsw-alias-bg-layer-1); }
.fr-btn[data-primary="true"] { border-color:var(--dsw-alias-brand-primary); color:#fff; background:var(--dsw-alias-brand-primary); }
.fr-btn[data-danger="true"] { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); }
.fr-btn:disabled { opacity:.5; cursor:default; }
.fr-error { font-size:12px; color:var(--dsw-alias-state-error-primary); }
.fr-actions { display:flex; flex-wrap:wrap; gap:8px; padding-top:4px; border-top:1px solid var(--dsw-alias-border-l1); }
.fr-meta { font-size:12px; color:var(--dsw-alias-label-secondary); }
.fr-entry { display:flex; align-items:center; gap:8px; border:none; background:none; color:inherit; cursor:pointer; padding:0; }
.fr-panel { min-height:100%; box-sizing:border-box; display:flex; justify-content:center; padding:44px 28px; color:var(--dsw-alias-label-primary); }
.fr-panel-inner { width:100%; max-width:520px; display:flex; flex-direction:column; gap:16px; }
.fr-panel-title { margin:0; font-size:20px; font-weight:600; letter-spacing:-.01em; }
.fr-panel-sub { margin:0; font-size:13px; color:var(--dsw-alias-label-secondary); }
.fr-book-card { display:flex; flex-direction:column; gap:6px; padding:18px; border-radius:12px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
.fr-book-title { font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fr-book-meta { font-size:12px; color:var(--dsw-alias-label-secondary); }
.fr-panel-actions { display:flex; flex-wrap:wrap; gap:8px; }
.fr-panel-actions .fr-btn { font-size:13px; padding:8px 14px; }
.fr-panel-hint { margin:0; font-size:12px; line-height:1.5; color:var(--dsw-alias-label-secondary); }
.fr-panel-icon { display:flex; align-items:center; justify-content:center; color:var(--dsw-alias-label-secondary); }
.fr-panel-icon[data-active="true"] { color:var(--dsw-alias-label-primary); }
`

    /** @param {string} key @param {string} accel @param {'mac'|'win'} platform */
    function formatShortcut(key, accel, platform) {
      if (typeof accel !== 'string') return ''
      const parts = accel.split('+')
      return parts
        .map((part) => {
          if (part === 'Control') return platform === 'mac' ? '⌃' : 'Ctrl'
          if (part === 'Alt') return platform === 'mac' ? '⌥' : 'Alt'
          if (part === 'Shift') return platform === 'mac' ? '⇧' : 'Shift'
          if (part === 'Meta') return platform === 'mac' ? '⌘' : 'Win'
          return part
        })
        .join(platform === 'mac' ? ' ' : ' + ')
    }

    const ALLOWED_PUNCT = new Set([',', '.', ';', "'", '/', '\\', '[', ']', '-', '=', '`'])

    function keyName(event) {
      const key = event.key
      if (typeof key !== 'string' || key.length === 0) return null
      if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase()
      if (/^[0-9]$/.test(key)) return key
      if (ALLOWED_PUNCT.has(key)) return key
      if (/^F([1-9]|1[0-2])$/.test(key)) return key
      return null
    }

    function acceleratorOf(event) {
      const modifiers = []
      if (event.ctrlKey) modifiers.push('Control')
      if (event.altKey) modifiers.push('Alt')
      if (event.shiftKey) modifiers.push('Shift')
      if (event.metaKey) modifiers.push('Meta')
      const key = keyName(event)
      if (key === null || modifiers.length !== 1) return null
      return `${modifiers[0]}+${key}`
    }

    async function api(action, payload) {
      const response = await fetch('/api/fishread', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload ?? {}) }),
      })
      const data = await response.json().catch(() => ({ ok: false, message: 'bad response' }))
      return data
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // The locale runtime keeps one dictionary per namespace/locale for the
        // page session, and re-applying a reloaded module must not throw.
        try {
          ctx.locale.register('fishread', DICT)
        } catch (error) {
          if (!/already/.test(String(error?.message ?? error))) throw error
        }
        const bound = ctx.locale.bind('fishread')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-fishread'
          style.textContent = STYLE
          document.head.appendChild(style)
          return () => style.remove()
        }, 'dsh-fishread-style')

        const pushLocale = (active) => {
          void api('locale', { locale: active }).catch(() => {})
        }
        ctx.effect(() => {
          const snapshot = ctx.locale.getLocale()
          pushLocale(snapshot?.active)
          const off = ctx.locale.subscribe((next) => pushLocale(next?.active))
          return () => {
            if (typeof off === 'function') off()
          }
        }, 'dsh-fishread-locale')

        const useLocaleVersion = () => {
          const [version, setVersion] = React.useState(0)
          React.useEffect(() => {
            const off = ctx.locale.subscribe(() => setVersion((value) => value + 1))
            return () => {
              if (typeof off === 'function') off()
            }
          }, [])
          return version
        }

        const useRemoteState = () => {
          const [state, setState] = React.useState(null)
          const [error, setError] = React.useState(null)
          const reload = React.useCallback(async () => {
            const data = await api('state')
            if (data?.ok === true) {
              setState(data)
              setError(null)
            } else {
              setError(data?.message ?? 'state unavailable')
            }
            return data
          }, [])
          React.useEffect(() => {
            void reload()
          }, [reload])
          return { state, setState, error, setError, reload }
        }

        const Switch = ({ checked, onChange, label }) => {
          return h('button', {
            type: 'button',
            className: 'fr-switch',
            role: 'switch',
            'aria-checked': checked ? 'true' : 'false',
            'aria-label': label,
            onClick: () => onChange(!checked),
          })
        }

        const Row = ({ label, hint, children }) =>
          h(
            'div',
            { className: 'fr-row' },
            h(
              'div',
              { className: 'fr-labels' },
              h('span', { className: 'fr-label' }, label),
              hint === undefined ? null : h('span', { className: 'fr-hint' }, hint),
            ),
            h('div', { className: 'fr-control' }, children),
          )

        const Select = ({ options, value, onChange, label }) =>
          h(
            'select',
            {
              className: 'fr-select',
              'aria-label': label,
              value: String(value),
              onChange: (event) => onChange(event.target.value),
            },
            options.map(([id, key]) => h('option', { key: id, value: id }, bound(key))),
          )

        const ShortcutControl = ({ name, shortcuts, platform, recording, setRecording, onSave, onReset, error }) => {
          const active = recording === name
          return h(
            'div',
            { className: 'fr-control' },
            h(
              'button',
              {
                type: 'button',
                className: 'fr-kbd',
                'data-recording': active ? 'true' : 'false',
                onClick: () => setRecording(active ? null : name),
              },
              active ? bound('settings.recording') : formatShortcut(name, shortcuts[name], platform),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'fr-link',
                onClick: () => onReset(name),
              },
              bound('settings.reset'),
            ),
          )
        }

        const SettingsPage = ({ view }) => {
          useLocaleVersion()
          const { state, setState, error, setError, reload } = useRemoteState()
          const [recording, setRecording] = React.useState(null)
          const [message, setMessage] = React.useState(null)
          const [clearArmed, setClearArmed] = React.useState(false)

          React.useEffect(() => {
            if (recording === null) return undefined
            void api('recording', { active: true })
            return () => {
              void api('recording', { active: false })
            }
          }, [recording])

          React.useEffect(() => {
            if (recording === null) return undefined
            const onKeyDown = (event) => {
              if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
                event.preventDefault()
                event.stopPropagation()
                setRecording(null)
                setMessage(null)
                return
              }
              const accelerator = acceleratorOf(event)
              if (accelerator === null) {
                if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta') {
                  event.preventDefault()
                  event.stopPropagation()
                  setMessage(bound('settings.invalid'))
                }
                return
              }
              event.preventDefault()
              event.stopPropagation()
              const conflict = ACTIONS.some(
                (other) => other !== recording && state?.prefs?.shortcuts?.[other] === accelerator,
              )
              if (conflict) {
                setMessage(bound('settings.conflict'))
                return
              }
              setRecording(null)
              setMessage(null)
              void onSave(accelerator)
            }
            window.addEventListener('keydown', onKeyDown, true)
            return () => window.removeEventListener('keydown', onKeyDown, true)
          })

          const patchPrefs = async (patch) => {
            const data = await api('save-prefs', { patch })
            if (data?.ok === true) setState(data)
            else setError(data?.message ?? 'save failed')
          }

          const saveShortcut = async (accelerator) => {
            if (recording === null) return
            const data = await api('save-shortcuts', { shortcuts: { [recording]: accelerator } })
            if (data?.ok !== true) {
              setMessage(data?.code === 'conflict' ? bound('settings.conflict') : bound('settings.shortcutError'))
              return
            }
            setState(data)
            const status = data.shortcutsStatus?.[recording]
            if (status === false) setMessage(bound('settings.shortcutError'))
            else setMessage(bound('settings.saved'))
          }

          const resetShortcut = async (name) => {
            const data = await api('reset-shortcut', { name })
            if (data?.ok === true) {
              setState(data)
              setMessage(bound('settings.saved'))
            } else {
              setError(data?.message ?? 'reset failed')
            }
          }

          const runWindowAction = async (action) => {
            const data = await api(action)
            if (data?.ok === true) setState(data)
            else setError(data?.message ?? bound('settings.opFailed'))
          }

          const clearData = async () => {
            if (!clearArmed) {
              setClearArmed(true)
              return
            }
            setClearArmed(false)
            const data = await api('clear-data')
            if (data?.ok === true) await reload()
            else setError(data?.message ?? 'clear failed')
          }

          if (state === null) {
            return h('div', { className: 'fr-card' }, h('span', { className: 'fr-meta' }, error ?? '…'))
          }

          const prefs = state.prefs
          const platform = state.platform === 'mac' ? 'mac' : 'win'
          const shortcuts = prefs.shortcuts
          const metadata = state.metadata

          const bookLine = metadata
            ? `${metadata.title} · ${metadata.chapterCount} ${bound('settings.chapters')} · ${metadata.charCount} ${bound('settings.chars')}`
            : bound('settings.noBook')

          if (view === 'summary') {
            return h(
              'div',
              { className: 'fr-summary' },
              h('p', null, bound('settings.summary')),
              h(
                'button',
                { type: 'button', className: 'fr-btn', 'data-primary': 'true', onClick: () => runWindowAction('open') },
                bound('settings.open'),
              ),
            )
          }

          return h(
            'div',
            { className: 'fr-card' },
            h(
              'div',
              { className: 'fr-summary' },
              h('span', { className: 'fr-meta' }, bookLine),
              h(
                'button',
                { type: 'button', className: 'fr-btn', onClick: () => runWindowAction('open') },
                bound('settings.open'),
              ),
            ),

            h(
              'div',
              { className: 'fr-group' },
              h('div', { className: 'fr-group-title' }, bound('settings.window')),
              h(
                Row,
                {
                  label: bound('settings.windowState'),
                  hint:
                    state.window?.state === 'visible' || state.window?.state === 'hidden'
                      ? bound('settings.windowOpen')
                      : bound('settings.windowClosed'),
                },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fr-btn',
                    disabled: state.window?.state !== 'visible',
                    onClick: () => runWindowAction('hide'),
                  },
                  bound('settings.hide'),
                ),
              ),
              h(
                Row,
                { label: bound('settings.alwaysOnTop'), hint: bound('settings.alwaysOnTopHint') },
                h(Switch, {
                  checked: prefs.window.alwaysOnTop === true,
                  label: bound('settings.alwaysOnTop'),
                  onChange: (value) => patchPrefs({ window: { alwaysOnTop: value } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.restorePosition'), hint: bound('settings.restorePositionHint') },
                h(Switch, {
                  checked: prefs.window.restoreLastPosition === true,
                  label: bound('settings.restorePosition'),
                  onChange: (value) => patchPrefs({ window: { restoreLastPosition: value } }),
                }),
              ),
            ),

            h(
              'div',
              { className: 'fr-group' },
              h('div', { className: 'fr-group-title' }, bound('settings.reading')),
              h(
                Row,
                { label: bound('settings.fontFamily') },
                h(Select, {
                  options: FONT_FAMILIES,
                  value: prefs.reading.fontFamily,
                  label: bound('settings.fontFamily'),
                  onChange: (value) => patchPrefs({ reading: { fontFamily: value } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.fontSize') },
                h(Select, {
                  options: FONT_SIZES.map((size) => [size, `${size} px`]),
                  value: prefs.reading.fontSize,
                  label: bound('settings.fontSize'),
                  onChange: (value) => patchPrefs({ reading: { fontSize: Number(value) } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.lineHeight') },
                h(Select, {
                  options: LINE_HEIGHTS.map((height) => [height, height]),
                  value: prefs.reading.lineHeight,
                  label: bound('settings.lineHeight'),
                  onChange: (value) => patchPrefs({ reading: { lineHeight: Number(value) } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.theme') },
                h(Select, {
                  options: THEMES,
                  value: prefs.reading.theme,
                  label: bound('settings.theme'),
                  onChange: (value) => patchPrefs({ reading: { theme: value } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.indent') },
                h(Select, {
                  options: INDENTS,
                  value: String(prefs.reading.indent),
                  label: bound('settings.indent'),
                  onChange: (value) => patchPrefs({ reading: { indent: Number(value) } }),
                }),
              ),
              h(
                Row,
                { label: bound('settings.progress') },
                h(Select, {
                  options: PROGRESS_MODES,
                  value: prefs.reading.showProgress,
                  label: bound('settings.progress'),
                  onChange: (value) => patchPrefs({ reading: { showProgress: value } }),
                }),
              ),
            ),

            h(
              'div',
              { className: 'fr-group' },
              h('div', { className: 'fr-group-title' }, bound('settings.shortcuts')),
              ACTIONS.map((name) =>
                h(
                  Row,
                  {
                    key: name,
                    label: bound(`shortcut.${name}`),
                    hint: name === 'toggle' ? bound('settings.shortcutsHint') : undefined,
                  },
                  h(ShortcutControl, {
                    name,
                    shortcuts,
                    platform,
                    recording,
                    setRecording,
                    onSave: saveShortcut,
                    onReset: resetShortcut,
                    error: message,
                  }),
                ),
              ),
              message === null ? null : h('span', { className: 'fr-error' }, message),
              error === null ? null : h('span', { className: 'fr-error' }, `${bound('settings.opFailed')}${error}`),
            ),

            h(
              'div',
              { className: 'fr-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'fr-btn',
                  'data-danger': 'true',
                  onClick: () => void clearData(),
                },
                clearArmed ? bound('settings.clearConfirm') : bound('settings.clear'),
              ),
            ),
          )
        }

        const BookGlyph = ({ size }) =>
          h(
            'svg',
            { viewBox: '0 0 20 20', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
            h('path', {
              d: 'M4 4.6h5.2a1.4 1.4 0 0 1 1.4 1.4v8.6a1.6 1.6 0 0 0-1.6-1.3H4V4.6Z',
              stroke: 'currentColor',
              strokeWidth: 1.3,
              strokeLinejoin: 'round',
            }),
            h('path', {
              d: 'M16 4.6h-5.2a1.4 1.4 0 0 0-1.4 1.4v8.6a1.6 1.6 0 0 1 1.6-1.3H16V4.6Z',
              stroke: 'currentColor',
              strokeWidth: 1.3,
              strokeLinejoin: 'round',
            }),
          )

        const PanelEntry = ({ size, active }) =>
          h(
            'span',
            { className: 'fr-panel-icon', 'data-active': active === true ? 'true' : 'false' },
            h(BookGlyph, { size }),
          )

        const FishReadPanel = () => {
          useLocaleVersion()
          const { state, reload } = useRemoteState()
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)

          const text = React.useCallback((key, params) => {
            let value = String(bound(key))
            for (const [name, replacement] of Object.entries(params ?? {})) {
              value = value.split(`{${name}}`).join(String(replacement))
            }
            return value
          }, [])

          React.useEffect(() => {
            const refresh = () => void reload()
            window.addEventListener('focus', refresh)
            return () => window.removeEventListener('focus', refresh)
          }, [reload])

          const run = async (action, payload) => {
            setBusy(true)
            setError(null)
            try {
              const data = await api(action, payload)
              if (data?.ok !== true) setError(data?.message ?? 'failed')
            } catch (cause) {
              setError(String(cause?.message ?? cause))
            }
            setBusy(false)
            await reload()
          }

          if (state === null) {
            return h(
              'div',
              { className: 'fr-panel' },
              h('div', { className: 'fr-panel-inner' }, h('p', { className: 'fr-panel-hint' }, '…')),
            )
          }

          const platform = state.platform === 'mac' ? 'mac' : 'win'
          const hasBook = state.hasBook === true
          const chapterCount = state.metadata?.chapterCount ?? 0
          const chapterNumber = (state.progress?.chapterIndex ?? 0) + 1
          const percent = Math.round(state.progress?.percent ?? 0)
          const toggleKey = formatShortcut('toggle', state.prefs?.shortcuts?.toggle, platform)
          const visible = state.window?.state === 'visible'

          return h(
            'div',
            { className: 'fr-panel' },
            h(
              'div',
              { className: 'fr-panel-inner' },
              h('h1', { className: 'fr-panel-title' }, bound('entry.label')),
              h('p', { className: 'fr-panel-sub' }, bound('panel.subtitle')),
              h(
                'div',
                { className: 'fr-book-card' },
                h(
                  'span',
                  { className: 'fr-book-title' },
                  hasBook ? state.metadata?.title ?? '' : bound('settings.noBook'),
                ),
                h(
                  'span',
                  { className: 'fr-book-meta' },
                  hasBook
                    ? `${text('panel.chapterCount', { n: chapterCount })} · ${text('panel.progress', {
                        n: chapterNumber,
                        p: percent,
                      })}`
                    : bound('panel.noBook'),
                ),
              ),
              h(
                'div',
                { className: 'fr-panel-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fr-btn',
                    'data-primary': 'true',
                    disabled: busy,
                    onClick: () => void run('open'),
                  },
                  hasBook ? bound('panel.continue') : bound('panel.start'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fr-btn',
                    disabled: busy,
                    onClick: () => void run('open', { import: true }),
                  },
                  hasBook ? bound('panel.replace') : bound('panel.import'),
                ),
                visible
                  ? h(
                      'button',
                      { type: 'button', className: 'fr-btn', disabled: busy, onClick: () => void run('hide') },
                      bound('panel.hide'),
                    )
                  : null,
              ),
              error === null ? null : h('span', { className: 'fr-error' }, `${bound('settings.opFailed')}${error}`),
              h('p', { className: 'fr-panel-hint' }, text('panel.toggleHint', { key: toggleKey })),
              h('p', { className: 'fr-panel-hint' }, bound('panel.settingsHint')),
            ),
          )
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'fishread',
              order: 40,
              label: () => bound('entry.label'),
            },
            PanelEntry,
          ),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'fishread',
            },
            FishReadPanel,
          ),
        )

        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.bundle.config',
              id: 'dsh-fishread-config',
              key: 'dsh-fishread',
              order: 10,
            },
            SettingsPage,
          ),
        )
      },
    }
  },
})
