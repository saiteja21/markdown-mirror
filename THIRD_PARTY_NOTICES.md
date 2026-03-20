# Third-Party Notices

This project contains and/or depends on third-party software.

The project itself is licensed under MIT. Third-party components remain under their own licenses.

## Bundled Runtime Assets (Shipped In Repository)

These files are distributed in the repository and extension package under [media/vendor](media/vendor):

| Component | Path | License | Version Tracking | Source |
|---|---|---|---|---|
| highlight.js styles (GitHub theme CSS) | [media/vendor/highlightjs/github.min.css](media/vendor/highlightjs/github.min.css) | BSD-3-Clause (highlight.js project) | Tracked via dependency `highlight.js` in [package.json](package.json) | https://github.com/highlightjs/highlight.js |
| KaTeX runtime bundle | [media/vendor/katex/katex.min.js](media/vendor/katex/katex.min.js) | MIT | Vendored file (verify/update version on upgrade) | https://github.com/KaTeX/KaTeX |
| KaTeX CSS and fonts | [media/vendor/katex/katex.min.css](media/vendor/katex/katex.min.css) and [media/vendor/katex/fonts](media/vendor/katex/fonts) | MIT | Vendored file set (verify/update version on upgrade) | https://github.com/KaTeX/KaTeX |
| Mermaid runtime bundle | [media/vendor/mermaid/mermaid.min.js](media/vendor/mermaid/mermaid.min.js) | MIT (Mermaid project) | Vendored file (verify/update version on upgrade) | https://github.com/mermaid-js/mermaid |

## Direct npm Dependencies

The following are direct dependencies declared in [package.json](package.json) with license metadata from [package-lock.json](package-lock.json):

### Runtime Dependencies

| Package | Declared Version | License |
|---|---|---|
| express | ^4.21.2 | MIT |
| gray-matter | ^4.0.3 | MIT |
| highlight.js | ^11.11.1 | BSD-3-Clause |
| markdown-it | ^14.1.0 | MIT |
| markdown-it-task-lists | ^2.1.1 | ISC |
| sanitize-html | ^2.14.0 | MIT |
| ws | ^8.18.0 | MIT |

### Development Dependencies

| Package | Declared Version | License |
|---|---|---|
| @types/express | ^4.17.21 | MIT |
| @types/markdown-it | ^14.1.2 | MIT |
| @types/node | ^20.17.24 | MIT |
| @types/sanitize-html | ^2.13.0 | MIT |
| @types/vscode | ^1.98.0 | MIT |
| @types/ws | ^8.5.14 | MIT |
| @vscode/vsce | ^3.5.0 | MIT |
| esbuild | ^0.25.3 | MIT |
| typescript | ^5.8.2 | Apache-2.0 |

## Compliance Notes

- Keep this file updated whenever dependencies or vendored files change.
- When upgrading vendored runtime files, record the exact upstream release/tag and verify license terms.
- Include this file and the root [LICENSE](LICENSE) in release artifacts.

## Disclaimer

This file is provided for engineering compliance support and is not legal advice.
