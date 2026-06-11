# Markflow

A Typora-inspired, local-first Markdown editor for macOS, built with Tauri v2.

The Markdown source text stays the single source of truth — there is no
contenteditable WYSIWYG layer. Instead, CodeMirror 6 decorations render a live
preview in place and reveal the raw syntax whenever the cursor enters a span.

## Features

- **Live-preview decorations** (source ⇆ preview toggles by cursor position):
  - Headings (`#`–`######`) with size scaling and muted markers
  - Inline `**bold**`, `*italic*`, `` `code` ``, and `[links](url)`
  - Inline image previews (local files via the asset protocol, relative paths resolved against the document)
  - Math via KaTeX (inline `$…$` and block `$$…$$`)
  - GFM tables
  - Mermaid diagrams (lazy-loaded)
- **Native macOS integration**:
  - Menu bar (File / Edit / Window + Open Recent)
  - `Cmd+N` / `Cmd+O` / `Cmd+S` / `Cmd+Shift+S`
  - Unsaved-changes confirmation before closing (covers `Cmd+Q`)
  - Open `.md` files from Finder (file association)
  - Recent-files list (persisted, up to 10)
- **Document state**: outline sidebar, status bar (char/line count, saved state, file path), dirty indicator, window-title sync

## Tech stack

- Tauri v2 + React 19 + TypeScript
- CodeMirror 6 for editing and decorations
- Rust commands for file I/O (`read_markdown_file` / `write_markdown_file`, limited to `.md` / `.markdown` / `.txt`)
- `@tauri-apps/plugin-dialog` for native Open / Save dialogs
- KaTeX (math), Mermaid (diagrams)
- Vitest + `cargo test`

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build               # produces .app and .dmg
```

Artifacts land in:

- `src-tauri/target/release/bundle/macos/Markflow.app`
- `src-tauri/target/release/bundle/dmg/Markflow_0.1.0_aarch64.dmg`

The bundle is ad-hoc signed (`signingIdentity: "-"`). Developer ID signing and
notarization are not yet configured.

## Tests

```bash
npm run test                      # Vitest (frontend)
cd src-tauri && cargo test        # Rust commands
```
