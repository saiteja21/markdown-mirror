# Maintainer Publish Guide

This document is for maintainers only. It is intentionally kept outside the public README.

## Prerequisites

- Node.js 20+
- VS Code 1.98+
- Marketplace publisher access (`ForkedCode`)
- Valid PAT with Marketplace publish permissions

## Local Build

```powershell
npm install
npm run compile
npm run build
```

## Package VSIX

```powershell
npm run package
```

Expected output: `markdown-mirror-<version>.vsix`

## Publish

```powershell
npx @vscode/vsce login ForkedCode
npm run publish
```

Or with environment variable PAT:

```powershell
$env:VSCE_PAT = "<PAT>"
npx @vscode/vsce publish --pat $env:VSCE_PAT
Remove-Item Env:VSCE_PAT -ErrorAction SilentlyContinue
```

## Pre-Release Checklist

- Update version in `package.json`
- Update `CHANGELOG.md`
- Verify `README.md` user-facing content
- Verify repository, bugs, homepage URLs in `package.json`
- Run a clean install smoke test in VS Code

## CI Suggestion

```powershell
npm ci
npm run compile
npm run build
npx @vscode/vsce package --no-dependencies
```
