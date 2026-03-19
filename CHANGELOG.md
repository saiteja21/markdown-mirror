# Changelog

All notable changes to this project are documented in this file.

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
