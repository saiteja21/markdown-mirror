# Markdown Mirror

![Markdown Mirror Banner](./banner.png)

Live, local Markdown preview for your full workspace with instant browser updates and a file explorer tree.

## Why Markdown Mirror

Markdown Mirror gives you a docs-site feeling directly from your VS Code workspace.
It scans markdown files, serves a mirrored structure, and updates the browser preview on every keystroke or save.

## Features

- Modern browser UI with workspace explorer and rich markdown renderer
- Full-width rendering by default with persistent reading-width toggle
- Side-by-side compare mode (open two markdown docs simultaneously)
- TOC sidebar for heading-based navigation in the active pane
- Light/Dark preview theme toggle
- Auto-starts on markdown workspaces (configurable)
- WebSocket hot updates (no full-page refresh flicker)
- Relative image path support through local asset mapping
- Mermaid diagram rendering for fenced `mermaid` code blocks
- Download Mermaid diagrams as PNG from browser
- Syntax highlighting with `markdown-it` + `highlight.js`
- Localhost-only server guard (`127.0.0.1`)

## Commands

- `Markdown Mirror: Start`
- `Markdown Mirror: Stop`

## Use In VS Code

### Open Mirror From Command Palette

<table>
	<thead>
		<tr>
			<th>Step</th>
			<th>Action</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>1</td>
			<td>Open Command Palette.</td>
		</tr>
		<tr>
			<td>2</td>
			<td>Use shortcut: Windows/Linux <code>Ctrl+Shift+P</code>, macOS <code>Cmd+Shift+P</code>.</td>
		</tr>
		<tr>
			<td>3</td>
			<td>Run <code>Markdown Mirror: Start</code>.</td>
		</tr>
		<tr>
			<td>4</td>
			<td>A local server URL appears (for example <code>http://127.0.0.1:51315</code>).</td>
		</tr>
		<tr>
			<td>5</td>
			<td>Browser should open automatically based on your settings.</td>
		</tr>
	</tbody>
</table>

If browser does not open, copy the URL from the notification and open it manually.

### Close Mirror

1. Open Command Palette:
	- Windows/Linux: `Ctrl+Shift+P`
	- macOS: `Cmd+Shift+P`
2. Run `Markdown Mirror: Stop`.

This stops the local server for the current VS Code session.

### Configure Settings In VS Code

1. Open Settings UI:
	- Windows/Linux: `Ctrl+,`
	- macOS: `Cmd+,`
2. Search for `Markdown Mirror`.
3. Configure:
	- `markdownMirror.autoStart`
	- `markdownMirror.autoOpenMode`
	- `markdownMirror.rootPath`

You can also open Settings (JSON) and set values directly.

Default behavior (recommended for most users):

- Leave `markdownMirror.rootPath` empty.
- Markdown Mirror uses the currently open workspace root and discovers all markdown files under it.

Example (default behavior):

```json
{
	"markdownMirror.autoStart": true,
	"markdownMirror.autoOpenMode": "always"
}
```

Optional scoped-folder example (only if you want to limit discovery):

- Set `markdownMirror.rootPath` to a folder relative to your workspace root.
- Example below scans only `<workspace>/Compiler`.

```json
{
	"markdownMirror.rootPath": "Compiler"
}
```

## Settings

- `markdownMirror.autoStart`
	- `true` (default): auto-start mirror when markdown files are present in workspace.
- `markdownMirror.autoOpenMode`
	- `always`: open browser on every auto-start.
	- `firstRun` (default): open browser only on first auto-start for this machine/profile.
	- `never`: do not auto-open browser on auto-start.
- `markdownMirror.enableMermaid`
	- `true` (default): render Mermaid diagrams from markdown code fences.
- `markdownMirror.htmlMode`
	- `safe` (default): sanitize rendered HTML.
	- `trusted`: allow raw HTML from markdown without sanitization (trusted content only).
- `markdownMirror.rootPath`
	- Empty (default): use the currently open workspace root and scan all markdown files.
	- Relative path (for example `docs`): only render markdown tree from that folder.

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
6. Use topbar controls for Compare, TOC, Dark/Light theme, and Reading Width.
