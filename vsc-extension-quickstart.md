# VS Code Extension Quickstart (Production)

This guide shows how to bundle and publish Markdown Mirror using `esbuild` and `vsce`.

## 1) Prerequisites

- Node.js 20+
- VS Code 1.98+
- Azure DevOps/GitHub account (optional, for CI)
- Visual Studio Marketplace publisher account

## 2) Install Dependencies

```powershell
npm install
```

## 3) Build For Production

`esbuild` bundles `src/extension.ts` into `out/extension.js`.

```powershell
npm run build
```

What this does:
- removes the old `out` directory
- bundles extension code with `esbuild`
- externalizes the `vscode` module

## 4) Package `.vsix`

```powershell
npm run package
```

Expected output: a versioned `.vsix` file in the project root.

## 5) Publish To Marketplace

1. Create a Personal Access Token (PAT) in the Marketplace publisher portal.
2. Login once:

```powershell
npx @vscode/vsce login ForkedCode
```

3. Publish:

```powershell
npm run publish
```

## 6) Validate Before Publish

```powershell
npm run compile
npx @vscode/vsce ls
```

Checks:
- `out/extension.js` exists
- `media/` assets are present
- package size is reasonable
- no secrets in package

## 7) Recommended CI Steps

Use this sequence in CI for release branches/tags:

```powershell
npm ci
npm run compile
npm run build
npx @vscode/vsce package --no-dependencies
```

For auto publish, inject `VSCE_PAT` securely and run:

```powershell
npx @vscode/vsce publish --pat $env:VSCE_PAT
```

## 8) Marketplace Hygiene

- Keep `README.md` updated with usage and commands.
- Keep `LICENSE` in repository root.
- Use semantic versioning in `package.json`.
- Add changelog entries for each release.

Repository links currently used by this extension:

- https://github.com/saiteja21/markdown-mirror
- https://github.com/saiteja21/markdown-mirror/issues
