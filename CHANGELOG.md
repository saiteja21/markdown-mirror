# Changelog

All notable changes to this project are documented in this file.

## [0.5.1] - 2026-03-19

### Fixed

- Fixed math rendering on live typed updates so KaTeX expressions render consistently without waiting for a save.
- Fixed offline mode enforcement in trusted HTML mode by blocking external HTTP/HTTPS links and images.

### Changed

- Set `markdownMirror.enableMath` default to `true` for better out-of-box math rendering.
- Expanded README troubleshooting steps for beginners.
- Added author links (GitHub and LinkedIn) to README.

## [0.5.0] - 2026-03-19

### Added

- Editor-to-browser and browser-to-editor scroll sync.
- Slide mode with `---` section splitting, keyboard navigation, and full-screen overlay.
- Standalone HTML export with inlined styles and Mermaid SVG image embedding.
- Interactive markdown task checkboxes with source write-back.
- YAML frontmatter card rendering (`markdownMirror.showFrontmatter`).
- Document tabs for recently opened files.
- Image lightbox/zoom overlay.
- Favorites/pinned file section in sidebar.
- Back-to-top floating action button.
- Sidebar markdown file count.
- Internal markdown link validation highlighting.
- Custom CSS injection from workspace (`markdownMirror.customCssPath`).
- Multi-workspace visual distinction using workspace color dots.
- Local vendor asset bundling for Mermaid/KaTeX/highlight.js (no CDN dependency).

### Changed

- Improved live typing performance by reducing heavy reprocessing during `typed` updates.
- Added runtime performance telemetry logs for boot, tree load, and document render timings.
- TOC is now toggled exclusively through the topbar TOC button.

## [0.3.0] - 2026-03-19

### Added

- Print / PDF export action via browser print dialog.
- Print-optimized stylesheet for cleaner PDF and paper output.
- KaTeX math rendering support controlled by `markdownMirror.enableMath`.
- Word count, character count, and reading-time stats bar.
- Keyboard shortcuts overlay and fast navigation shortcuts.
- Heading anchor links for deep-link sharing.
- New setting `markdownMirror.mermaidTheme` to control Mermaid diagram theme.

### Changed

- Mermaid theme now respects both dark mode and explicit Mermaid theme settings.
- Browser preview now exposes runtime settings through a dedicated API.

## [0.1.3] - 2026-03-19

### Added

- Full-width rendering mode by default with a persistent reading-width toggle.
- Side-by-side compare mode for opening two markdown documents at the same time.
- Table of Contents (TOC) sidebar for active document heading navigation.
- Light/Dark theme toggle in the preview UI.
- New setting `markdownMirror.rootPath` to scope markdown discovery to a specific folder.

### Changed

- Updated browser UI with compare-aware panes and active pane targeting from the file tree.
- Mermaid export wording and behavior standardized to PNG.

## [0.1.2] - 2026-03-19

### Added

- Mermaid diagram rendering for fenced `mermaid` markdown code blocks.
- Browser-side "Download PNG" action for rendered Mermaid diagrams.
- New setting `markdownMirror.enableMermaid`.
- New setting `markdownMirror.htmlMode` with `safe` and `trusted` options.

### Changed

- Safe mode now sanitizes rendered HTML output by default.

## [0.1.1] - 2026-03-19

### Fixed

- Fixed production startup path resolution so installed extension serves UI from the packaged `media` folder.
- Added startup validation for missing `media/index.html` to fail fast with clear errors.
- Added IPv6 loopback (`::1`) support for localhost request checks.

## [0.1.0] - 2026-03-19

### Added

- Express-based localhost mirror server for markdown workspaces.
- WebSocket HDR updates for markdown changes.
- Markdown renderer wrapper with syntax highlighting.
- Relative image URL remapping through local asset middleware.
- Browser client with file explorer and rendered preview panes.
- Configurable auto-start and auto-open behavior.
- Esbuild and VSCE packaging workflow.

### Changed

- Renamed extension branding to Markdown Mirror.
- Updated command IDs to `markdownMirror.start` and `markdownMirror.stop`.
