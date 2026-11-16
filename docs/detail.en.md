# FishRead

Click the book icon in the sidebar's panel list (beside Plugins) and the main area shows the current novel with its import action; one more click floats the small reader window onto the desktop, ready for one novel read offline.

## Why a real window

The reader is not an overlay inside the DSH page and not a browser popup. It is an Electron process started by the plugin, reusing the Electron runtime already shipped inside DeepSeek Harness — nothing extra to install, no second browser to keep around.

- Minimizing, hiding, or even closing the DSH window while its process keeps running leaves the reader untouched.
- When DSH really exits, the window crashes, or the handshake times out, the helper process is cleaned up. No orphans.
- At most one reader window exists; clicking the entry again restores and focuses it.

## Where data lives

The novel text, progress, preferences, and shortcuts live in the plugin's private directory. Nothing is written to Sessions or Workspaces, and the original file path is never stored. The text is copied at import time, so deleting the source file changes nothing.

"Clear reading data" in the settings page asks for a second click before it deletes anything.

## Shortcuts

All three shortcuts are registered with the operating system, so they work while another app is focused:

- Hide / restore window: `Ctrl + ;`
- Previous page: `Ctrl + ,`
- Next page: `Ctrl + .`

On macOS, `Ctrl` means the Control key (⌃). Each one can be re-recorded or reset independently.

## Language

The interface follows the current DSH language and switches between Chinese and English immediately, including the reader window. If DSH is unavailable or the language is unsupported, it falls back to English. Book titles, chapter titles, and body text are never translated — only generated labels such as "第一章" / "Chapter 1".

## Format

`.txt` and `.md` follow exactly the same rules: the first non-empty line is `# Title`, and every `## Chapter name` line starts a chapter. Third-level headings, a missing title, and empty chapters are rejected at import time with the offending line number; text between the title and the first chapter is kept as an unnumbered “Introduction” chapter instead of being refused. The format example is always one click away inside the window.
