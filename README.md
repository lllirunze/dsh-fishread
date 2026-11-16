<div align="center">
  <img src="./icon.svg" alt="FishRead icon" width="88" height="88">
  <h1>FishRead</h1>
  <p><strong>A private, offline floating novel reader for DeepSeek Harness</strong></p>
  <p>Read in a dedicated native window—without occupying the DSH workspace, accessing the network, or sending your book to AI.</p>
</div>

---

## Overview

FishRead adds a book icon beside **Plugins** and **Schedules** in the DeepSeek Harness sidebar. Select it to view the current novel, import a new book, or continue reading in a separate window.

### Highlights

- **Independent native window** — A resizable 380 × 560 reader that can stay on top and remain open when the main DSH window is hidden or minimized.
- **Fully offline reading** — Import one `.txt` or `.md` file. Its contents are copied into the plugin's private data directory, so the original file is no longer required.
- **Smooth reading experience** — Continuous scrolling, chapter navigation, lazy rendering, and full-book progress tracking.
- **Global keyboard shortcuts** — Hide or restore the reader and turn pages even when another application is focused.
- **Built-in localization** — The interface follows the DSH language and switches between English and Chinese immediately.

> [!IMPORTANT]
> FishRead does not load network resources, render book content as HTML, or send novel text to AI services.

## Contents

- [Installation](#installation)
- [Book Format](#book-format)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Data and Privacy](#data-and-privacy)
- [Platform Notes](#platform-notes)
- [Uninstallation](#uninstallation)

## Installation

Install the plugin from its local source directory:

```bash
dsh plugin install /absolute/path/to/dsh-fishread
```

The first launch prepares a private reader runtime by copying the Electron runtime bundled with DeepSeek Harness. On macOS, the copied runtime is ad-hoc signed. This one-time setup may take a moment; subsequent launches are immediate.

## Book Format

FishRead accepts `.txt` and `.md` files with the same structure:

```markdown
# The Three-Body Problem

Text between the title and first chapter becomes an unnumbered introduction.

## The Frontiers of Science

The first paragraph.

The second paragraph.

## The Pool Players

Chapter content.
```

Formatting rules:

1. The first non-empty line must be a single `# Book Title` heading.
2. At least one chapter beginning with `## ` is required.
3. Chapter numbers follow file order; numbers written in chapter titles do not affect ordering.
4. Text before the first chapter becomes an unnumbered introduction.
5. Headings at level `###` or deeper are rejected.
6. UTF-8 is preferred. If TXT decoding fails, FishRead can retry with GB18030.

Import errors include the relevant line number and a suggested correction. A failed import never overwrites the current book or reading progress.

To import a book, select **Import Novel** in the sidebar panel and choose a file after the reader opens. The empty reader also provides a **Choose Novel File** action, and **View Format Example** remains available from the reader at any time.

## Keyboard Shortcuts

The defaults are identical on macOS and Windows:

| Action | Shortcut |
| :--- | :---: |
| Hide or restore the reader | `Ctrl + ;` |
| Previous page | `Ctrl + ,` |
| Next page | `Ctrl + .` |

> [!NOTE]
> On macOS, `Ctrl` means the Control key (⌃), not Command (⌘).

Shortcuts can be recorded again or reset individually from plugin settings. Each shortcut must contain exactly one modifier and one regular key. Duplicate combinations are rejected, while system-wide registration conflicts are reported in the reader.

## Settings

Settings are organized into three groups:

- **Window** — Always on top, restore last position, current window status, and hide controls.
- **Reading** — Font, size, line height, theme (system, light, sepia, or dark), first-line indentation, and progress display.
- **Shortcuts** — Custom key combinations for window and page controls.

Reading preferences are also available inside the reader and apply immediately.

## Data and Privacy

| Data | Location |
| :--- | :--- |
| Novel content | `<data-dir>/dsh-fishread/book/book.json` |
| Title and chapter count | `<data-dir>/dsh-fishread/metadata.json` |
| Reading progress | `<data-dir>/dsh-fishread/progress.json` |
| Preferences and shortcuts | `<data-dir>/dsh-fishread/preferences.json` |
| Private reader runtime | `<data-dir>/dsh-fishread/runtime/` |

Default data directories:

- **macOS:** `~/Library/Application Support/dsh-fishread`
- **Windows:** `%APPDATA%\dsh-fishread`

FishRead does not write to the DSH Session or Workspace and does not retain the original import path. The reader uses the Content Security Policy `default-src 'none'`.

Clearing reading data requires two confirmations. It removes the novel, table of contents, progress, and reading preferences while preserving the reusable private runtime.

## Platform Notes

### macOS

FishRead copies the executable and Frameworks from the installed `DeepSeek Harness.app`, creates its own `Resources/app`, and applies an ad-hoc signature with `codesign --force --sign -`. The original DSH application is never modified.

### Windows

FishRead uses the same main-process implementation, copying `electron.exe`, required DLLs, and locale files from the DSH installation before replacing `resources/app` with the reader runtime.

## Uninstallation

Disable FishRead in the plugin manager first, then delete its data directory if you also want to remove imported books and reading progress. Uninstalling the plugin does not automatically delete user data.
