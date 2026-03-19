# Markdown Mirror

![Markdown Mirror Banner](./banner.png)

Live, local Markdown preview for your full workspace with instant browser updates and a file explorer tree.

![Markdown Mirror Logo](./logo.png)

## Why Markdown Mirror

Markdown Mirror gives you a docs-site feeling directly from your VS Code workspace.
It scans markdown files, serves a mirrored structure, and updates the browser preview on every keystroke or save.

## Features

- Two-pane browser UI:
	- Left pane: markdown file explorer
	- Right pane: rendered markdown content
- Auto-starts on markdown workspaces (configurable)
- WebSocket hot updates (no full-page refresh flicker)
- Relative image path support through local asset mapping
- Syntax highlighting with `markdown-it` + `highlight.js`
- Localhost-only server guard (`127.0.0.1`)

## Commands

- `Markdown Mirror: Start`
- `Markdown Mirror: Stop`

## Settings

- `markdownMirror.autoStart`
	- `true` (default): auto-start mirror when markdown files are present in workspace.
- `markdownMirror.autoOpenMode`
	- `always`: open browser on every auto-start.
	- `firstRun` (default): open browser only on first auto-start for this machine/profile.
	- `never`: do not auto-open browser on auto-start.

Manual command start always opens the browser.

## Security

- HTTP server listens on `127.0.0.1`.
- Requests from non-loopback addresses are rejected.
- Asset requests are workspace-bounded to prevent path traversal.

## Quick Start

1. Install the extension from the VS Code Marketplace.
2. Open a workspace that contains `.md` files.
3. Extension auto-starts (if enabled) and opens your browser based on `autoOpenMode`.
4. Click any markdown file in the left explorer.
5. Edit markdown in VS Code and see live updates in browser.

## Development

```powershell
npm install
npm run compile
npm run build
```

## Package And Publish

```powershell
npm run package
npx @vscode/vsce login ForkedCode
npm run publish
```

Output package file:

- `markdown-mirror-<version>.vsix`
