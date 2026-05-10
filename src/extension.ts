import * as fs from "fs/promises";
import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import { promisify } from "util";
import { MirrorServer } from "./server";
import { MarkdownWatcher } from "./watcher";
import { MarkdownRenderer } from "./renderer";
import { isDataFile, renderDataFile } from "./dataRenderer";
import { MarkdownTreeProvider } from "./treeProvider";
import { MarkdownTocProvider, TocHeading } from "./tocProvider";
import { SettingsTreeProvider, toggleSetting } from "./settingsProvider";
import {
  auditDocument,
  extractHeadings,
  extractExternalLinks,
  checkExternalUrl,
  findBacklinks,
  renderAuditReport,
  runWorkspaceAudit,
  toWorkspaceRelative,
  WorkspaceAuditSummary,
  ExternalLinkCheckResult
} from "./quality";

type AutoOpenMode = "always" | "firstRun" | "never";
type HostMode = "browser" | "vscode" | "both";
type ExportProfile = "web" | "review" | "print";
const FIRST_RUN_OPENED_KEY = "markdownMirror.firstRunBrowserOpened";
const execFileAsync = promisify(cp.execFile);
type BrowserLaunchMode = "compare" | "slides";

const EXTERNAL_LINK_CACHE_TTL = 86400000; // 24 hours
const externalLinkCache = new Map<string, { result: ExternalLinkCheckResult; checkedAt: number }>();

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function applyMarkdownFormatting(action: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith(".md")) {
    void vscode.window.showInformationMessage("Open a Markdown file in the editor to use formatting.");
    return;
  }
  const sel = editor.selection;
  const selectedText = editor.document.getText(sel);

  switch (action) {
    case "bold": {
      if (selectedText) {
        await editor.edit(eb => eb.replace(sel, `**${selectedText}**`));
      } else {
        const pos = sel.active;
        await editor.edit(eb => eb.insert(pos, "**text**"));
        const start = new vscode.Position(pos.line, pos.character + 2);
        const end = new vscode.Position(pos.line, pos.character + 6);
        editor.selection = new vscode.Selection(start, end);
      }
      break;
    }
    case "italic": {
      if (selectedText) {
        await editor.edit(eb => eb.replace(sel, `_${selectedText}_`));
      } else {
        const pos = sel.active;
        await editor.edit(eb => eb.insert(pos, "_text_"));
        const start = new vscode.Position(pos.line, pos.character + 1);
        const end = new vscode.Position(pos.line, pos.character + 5);
        editor.selection = new vscode.Selection(start, end);
      }
      break;
    }
    case "heading": {
      const line = editor.document.lineAt(sel.active.line);
      const lineText = line.text;
      const lineRange = line.range;
      let newText: string;
      if (lineText.startsWith("### ")) {
        newText = lineText.slice(4);
      } else if (lineText.startsWith("## ")) {
        newText = "### " + lineText.slice(3);
      } else if (lineText.startsWith("# ")) {
        newText = "## " + lineText.slice(2);
      } else {
        newText = "# " + lineText;
      }
      await editor.edit(eb => eb.replace(lineRange, newText));
      break;
    }
    case "link": {
      if (selectedText) {
        const startPos = sel.start;
        await editor.edit(eb => eb.replace(sel, `[${selectedText}](url)`));
        const urlStart = new vscode.Position(startPos.line, startPos.character + selectedText.length + 3);
        const urlEnd = new vscode.Position(startPos.line, startPos.character + selectedText.length + 6);
        editor.selection = new vscode.Selection(urlStart, urlEnd);
      } else {
        const pos = sel.active;
        await editor.edit(eb => eb.insert(pos, "[text](url)"));
        const urlStart = new vscode.Position(pos.line, pos.character + 7);
        const urlEnd = new vscode.Position(pos.line, pos.character + 10);
        editor.selection = new vscode.Selection(urlStart, urlEnd);
      }
      break;
    }
    case "code": {
      if (selectedText && selectedText.includes("\n")) {
        await editor.edit(eb => eb.replace(sel, "```\n" + selectedText + "\n```"));
      } else if (selectedText) {
        await editor.edit(eb => eb.replace(sel, "`" + selectedText + "`"));
      } else {
        const pos = sel.active;
        await editor.edit(eb => eb.insert(pos, "`code`"));
        const start = new vscode.Position(pos.line, pos.character + 1);
        const end = new vscode.Position(pos.line, pos.character + 5);
        editor.selection = new vscode.Selection(start, end);
      }
      break;
    }
    case "bulletList": {
      const startLine = sel.start.line;
      const endLine = sel.end.line;
      await editor.edit(eb => {
        for (let i = startLine; i <= endLine; i++) {
          const line = editor.document.lineAt(i);
          if (line.text.startsWith("- ")) {
            eb.replace(line.range, line.text.slice(2));
          } else {
            eb.replace(line.range, "- " + line.text);
          }
        }
      });
      break;
    }
    case "numberedList": {
      const startLine = sel.start.line;
      const endLine = sel.end.line;
      await editor.edit(eb => {
        for (let i = startLine; i <= endLine; i++) {
          const line = editor.document.lineAt(i);
          const numMatch = line.text.match(/^\d+\.\s/);
          if (numMatch) {
            eb.replace(line.range, line.text.slice(numMatch[0].length));
          } else {
            eb.replace(line.range, `${i - startLine + 1}. ${line.text}`);
          }
        }
      });
      break;
    }
    case "blockquote": {
      const startLine = sel.start.line;
      const endLine = sel.end.line;
      await editor.edit(eb => {
        for (let i = startLine; i <= endLine; i++) {
          const line = editor.document.lineAt(i);
          if (line.text.startsWith("> ")) {
            eb.replace(line.range, line.text.slice(2));
          } else {
            eb.replace(line.range, "> " + line.text);
          }
        }
      });
      break;
    }
    case "table": {
      const pos = sel.active;
      const table = "\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n";
      await editor.edit(eb => eb.insert(pos, table));
      break;
    }
    case "horizontalRule": {
      const pos = sel.active;
      await editor.edit(eb => eb.insert(pos, "\n---\n"));
      break;
    }
  }
}

class MirrorRuntime implements vscode.Disposable {
  private readonly renderer = new MarkdownRenderer();
  public readonly server: MirrorServer;
  private watcher: MarkdownWatcher | undefined;
  public currentBaseUrl: string | undefined;

  public constructor(extensionPath: string) {
    const mediaPath = path.join(extensionPath, "media");
    this.server = new MirrorServer(this.renderer, "127.0.0.1", mediaPath);
  }

  public async start(): Promise<string> {
    const serverInfo = await this.server.start();

    if (!this.watcher) {
      this.watcher = new MarkdownWatcher(this.server.getHttpServer(), this.renderer, serverInfo.baseUrl);
    }

    this.currentBaseUrl = serverInfo.baseUrl;
    return serverInfo.baseUrl;
  }

  public async stop(): Promise<void> {
    this.watcher?.dispose();
    this.watcher = undefined;
    await this.server.stop();
    this.currentBaseUrl = undefined;
  }

  public notifyConfigurationChanged(): void {
    this.watcher?.publishSettingsUpdated();
  }

  public async renderDocumentHtml(documentUri: vscode.Uri): Promise<{ html: string; title: string }> {
    if (documentUri.scheme !== "file") {
      throw new Error("Only file-based documents are supported.");
    }

    const fsPathLower = documentUri.fsPath.toLowerCase();
    const isMarkdown = fsPathLower.endsWith(".md");
    const isData = isDataFile(documentUri.fsPath);

    if (!isMarkdown && !isData) {
      throw new Error("Unsupported file type.");
    }

    const bytes = await vscode.workspace.fs.readFile(documentUri);
    const content = new TextDecoder("utf-8").decode(bytes);
    const baseUrl = this.currentBaseUrl ?? await this.start();

    let html: string;
    if (isData) {
      html = renderDataFile(content, documentUri.fsPath);
    } else {
      html = this.renderer.render({
        markdown: content,
        documentUri,
        assetBaseUrl: baseUrl
      });
    }

    return {
      html,
      title: path.basename(documentUri.fsPath, path.extname(documentUri.fsPath))
    };
  }

  public async renderDocumentHtmlEmbedded(documentUri: vscode.Uri): Promise<{ html: string; title: string }> {
    if (documentUri.scheme !== "file" || !documentUri.fsPath.toLowerCase().endsWith(".md")) {
      throw new Error("Only file-based markdown documents are supported.");
    }

    const bytes = await vscode.workspace.fs.readFile(documentUri);
    const markdown = new TextDecoder("utf-8").decode(bytes);
    const baseUrl = this.currentBaseUrl ?? await this.start();
    const html = await this.renderer.renderWithEmbeddedImages({
      markdown,
      documentUri,
      assetBaseUrl: baseUrl,
      embedImages: true
    });

    return {
      html,
      title: path.basename(documentUri.fsPath, path.extname(documentUri.fsPath))
    };
  }

  public async renderDocumentHtmlForExport(documentUri: vscode.Uri): Promise<{ html: string; title: string }> {
    return this.renderDocumentHtmlEmbedded(documentUri);
  }

  public dispose(): void {
    void this.stop();
    this.renderer.dispose();
    this.server.dispose();
  }
}

class NativePreviewManager {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentTargetUri: string | undefined;
  private static focusModeEnabled = false;
  public static onTargetChanged: ((uri: vscode.Uri | undefined) => void) | undefined;

  private static resolvePreviewTarget(uri?: vscode.Uri): string | undefined {
    if (uri && uri.scheme === "file" && uri.fsPath.toLowerCase().endsWith(".md")) {
      return uri.toString();
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return undefined;
    }

    const activeUri = activeEditor.document.uri;
    if (activeUri.scheme !== "file") {
      return undefined;
    }

    if (activeEditor.document.languageId !== "markdown" && !activeUri.fsPath.toLowerCase().endsWith(".md")) {
      return undefined;
    }

    return activeUri.toString();
  }

  public static getCurrentTargetUri(): vscode.Uri | undefined {
    if (!this.currentTargetUri) {
      return undefined;
    }

    try {
      return vscode.Uri.parse(this.currentTargetUri);
    } catch {
      return undefined;
    }
  }

  public static updateTarget(uri: string): void {
    this.currentTargetUri = uri;
    this.onTargetChanged?.(this.getCurrentTargetUri());
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({ type: "force-update-target", uri });
    }
  }

  public static revealHeadingInPreview(heading: TocHeading): void {
    if (!this.currentPanel) {
      return;
    }

    this.currentPanel.webview.postMessage({ type: "reveal-heading", heading });
  }

  public static print(): void {
    this.currentPanel?.webview.postMessage({ type: "print" });
  }

  public static setFocusMode(enabled: boolean): void {
    this.focusModeEnabled = enabled;
    this.currentPanel?.webview.postMessage({ type: "toggle-focus-mode", enabled });
  }

  private static lastBaseUrl: string | undefined;

  public static async show(runtime: MirrorRuntime, context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
    const targetUri = this.resolvePreviewTarget(uri);
    if (targetUri) {
      this.currentTargetUri = targetUri;
      this.onTargetChanged?.(vscode.Uri.parse(targetUri));
    }

    let baseUrl = runtime.currentBaseUrl;
    if (!baseUrl) {
      baseUrl = await runtime.start();
    }

    if (NativePreviewManager.currentPanel) {
      // Always refresh HTML to ensure correct server URL
      NativePreviewManager.currentPanel.webview.html = this.getHtmlForWebview(baseUrl, targetUri || this.currentTargetUri || "");
      this.lastBaseUrl = baseUrl;
      NativePreviewManager.currentPanel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    this.lastBaseUrl = baseUrl;

    NativePreviewManager.currentPanel = vscode.window.createWebviewPanel(
      "markdownMirrorNative",
      "Markdown Mirror Preview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    NativePreviewManager.currentPanel.webview.html = this.getHtmlForWebview(baseUrl, targetUri || "");

    NativePreviewManager.currentPanel.webview.onDidReceiveMessage(
      async (message: { type: string; command?: string; href?: string; action?: string }) => {
        if (message.type === "format-markdown" && message.action) {
          await applyMarkdownFormatting(message.action);
        } else if (message.type === "run-command" && message.command) {
          if (message.command === "markdownMirror.openSettings") {
            await vscode.commands.executeCommand("workbench.action.openSettings", "markdownMirror");
          } else if (message.command === "markdownMirror.openInBrowser") {
            const currentBaseUrl = runtime.currentBaseUrl ?? await runtime.start();
            const launchUrl = new URL(currentBaseUrl);
            launchUrl.searchParams.set("mm_theme", getVsCodeThemeKind());
            const currentTarget = NativePreviewManager.getCurrentTargetUri();
            if (currentTarget) {
              launchUrl.searchParams.set("mm_open_uri", currentTarget.toString());
            }
            await vscode.env.openExternal(vscode.Uri.parse(launchUrl.toString()));
          } else if (message.command === "markdownMirror.printPreview") {
            // VS Code webviews don't support window.print() — export HTML and open in browser
            const printTarget = NativePreviewManager.getCurrentTargetUri();
            if (printTarget) {
              const rendered = await runtime.renderDocumentHtmlForExport(printTarget);
              const printHtml = buildStandaloneHtml(rendered.title, rendered.html, "print");
              const printUri = vscode.Uri.joinPath(context.globalStorageUri, "print-preview.html");
              await vscode.workspace.fs.createDirectory(context.globalStorageUri);
              await vscode.workspace.fs.writeFile(printUri, new TextEncoder().encode(printHtml));
              await vscode.env.openExternal(printUri);
            }
          } else if (message.command === "markdownMirror.showBacklinks") {
            const backlinkTarget = NativePreviewManager.getCurrentTargetUri();
            if (backlinkTarget) {
              await vscode.commands.executeCommand("markdownMirror.showBacklinks", backlinkTarget);
            } else {
              void vscode.window.showInformationMessage("Open a markdown file in preview first.");
            }
          } else {
            await vscode.commands.executeCommand(message.command);
          }
        } else if (message.type === "open-link" && message.href) {
          const href = message.href;
          if (/^https?:\/\//i.test(href)) {
            await vscode.env.openExternal(vscode.Uri.parse(href));
          } else {
            // Relative markdown link - resolve against current target document
            const currentTarget = NativePreviewManager.getCurrentTargetUri();
            if (currentTarget) {
              const dir = vscode.Uri.joinPath(currentTarget, "..");
              const resolved = vscode.Uri.joinPath(dir, href.split("#")[0]);
              if (resolved.fsPath.toLowerCase().endsWith(".md")) {
                await vscode.commands.executeCommand("markdownMirror.openInPreview", resolved);
              } else {
                try {
                  await vscode.workspace.fs.stat(resolved);
                  await vscode.env.openExternal(resolved);
                } catch {
                  await vscode.env.openExternal(vscode.Uri.parse(href));
                }
              }
            }
          }
        }
      },
      undefined,
      context.subscriptions
    );

    NativePreviewManager.currentPanel.onDidDispose(
      () => {
        NativePreviewManager.currentPanel = undefined;
      },
      null,
      context.subscriptions
    );
  }

  private static getHtmlForWebview(baseUrlInput: string, targetUri: string): string {
    const nonce = getNonce();
    const baseUrl = baseUrlInput.replace(/\/$/, "");
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";

    return `<!DOCTYPE html>
<html lang="en" style="height: 100%;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${baseUrl} ${wsUrl}; style-src 'unsafe-inline' ${baseUrl}; img-src data: https: http: *; script-src 'unsafe-inline' 'nonce-${nonce}' ${baseUrl}; font-src 'self' data: ${baseUrl};" />
    <title>Markdown Mirror Preview</title>
    <link rel="stylesheet" href="${baseUrl}/vendor/highlightjs/github.min.css" />
    <link rel="stylesheet" href="${baseUrl}/vendor/katex/katex.min.css" />
    <style>
      :root { color-scheme: light dark; }
      body {
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
        font-size: var(--vscode-font-size, 14px);
        line-height: 1.6;
        padding: 24px 32px;
        margin: 0;
        overflow-y: auto;
        overflow-wrap: break-word;
        height: 100%;
        box-sizing: border-box;
      }

      h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.25; margin-top: 24px; margin-bottom: 16px; color: var(--vscode-editor-foreground); }
      h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid var(--vscode-panel-border); }
      h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid var(--vscode-panel-border); }
      h3 { font-size: 1.25em; }
      a { color: var(--vscode-textLink-foreground); text-decoration: none; }
      a:hover { text-decoration: underline; }
      pre { background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.05)); border-radius: 6px; padding: 16px; overflow: auto; margin: 16px 0; }
      code { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.05)); padding: 2px 4px; border-radius: 4px; }
      pre code { padding: 0; background-color: transparent; }
      blockquote { margin: 16px 0; padding: 0 1em; color: var(--vscode-textBlockQuote-foreground, #6a737d); border-left: .25em solid var(--vscode-textBlockQuote-border, #dfe2e5); }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      th, td { padding: 6px 13px; border: 1px solid var(--vscode-panel-border, #dfe2e5); }
      tr:nth-child(2n) { background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(0, 0, 0, 0.02)); }
      img { max-width: 100%; box-sizing: content-box; cursor: zoom-in; transition: transform 0.25s ease; }
      img.mm-zoomed { position: relative; z-index: 50; transform: scale(2); cursor: zoom-out; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
      .mermaid { overflow: auto; margin: 16px 0; }
      .mermaid svg { max-width: 100%; height: auto !important; cursor: zoom-in; display: block; }
      .mermaid svg.mm-zoomed { position: relative; z-index: 50; transform: scale(1.8); cursor: zoom-out; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
      #loader { color: var(--vscode-descriptionForeground); text-align: center; padding: 24px; font-style: italic; }
      body.mm-focus-mode { padding: 56px 88px; }
      body.mm-focus-mode #content > :not(h1):not(h2):not(h3):not(p):not(ul):not(ol):not(pre):not(blockquote):not(table):not(img) { opacity: 0.94; }
      .mm-toc-target { animation: mm-highlight 1.2s ease; }
      @keyframes mm-highlight {
        0% { background-color: color-mix(in srgb, var(--vscode-editorInfo-foreground, #4ea1ff) 32%, transparent); }
        100% { background-color: transparent; }
      }

      /* Toolbar */
      .mm-toolbar {
        position: sticky; top: 0; z-index: 100;
        display: flex; flex-wrap: wrap; gap: 4px;
        padding: 6px 8px; margin: -24px -32px 16px -32px;
        background: var(--vscode-editorWidget-background, #f3f3f3);
        border-bottom: 1px solid var(--vscode-panel-border, #e0e0e0);
      }
      .mm-toolbar button {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;
        background: var(--vscode-button-secondaryBackground, #e0e0e0);
        color: var(--vscode-button-secondaryForeground, #333);
      }
      .mm-toolbar button:hover {
        background: var(--vscode-button-secondaryHoverBackground, #d0d0d0);
      }
      .mm-toolbar .mm-sep { width: 1px; background: var(--vscode-panel-border, #ccc); margin: 2px 4px; }
    </style>
  </head>
  <body class="vscode-body">
    <div class="mm-toolbar" id="mm-toolbar">
      <button data-cmd="exportHtml" title="Export HTML">&#128196; Export HTML</button>
      <button data-cmd="exportToWord" title="Export Word">&#128220; Export Word</button>
      <button data-cmd="printPreview" title="Print / PDF">&#128424; Print</button>
      <div class="mm-sep"></div>
      <button data-cmd="findHeading" title="Find Heading">&#128209; Headings</button>
      <button data-cmd="showBacklinks" title="Backlinks">&#128257; Backlinks</button>
      <div class="mm-sep"></div>
      <button data-cmd="openInBrowser" title="Open in Browser">&#127760; Open in Browser</button>
      <button data-cmd="openSettings" title="Open Settings">&#9881; Settings</button>
    </div>
    <div id="loader">Connecting to Markdown Mirror server...</div>
    <div id="content" class="markdown-body"></div>

    <script nonce="${nonce}">
      let targetUri = ${JSON.stringify(targetUri)};
      let focusModeEnabled = ${JSON.stringify(this.focusModeEnabled)};
      let pendingHeadingReveal = null;
      const baseUrl = ${JSON.stringify(baseUrl)};
      const wsUrl = ${JSON.stringify(wsUrl)};
      const contentEl = document.getElementById('content');
      const loaderEl = document.getElementById('loader');

      const vscodeApi = acquireVsCodeApi();

      // Toolbar button clicks → send command to extension host
      document.getElementById('mm-toolbar').addEventListener('click', function(e) {
        const fmtBtn = e.target.closest('[data-format]');
        if (fmtBtn) {
          vscodeApi.postMessage({ type: 'format-markdown', action: fmtBtn.dataset.format });
          return;
        }
        const btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        vscodeApi.postMessage({ type: 'run-command', command: 'markdownMirror.' + btn.dataset.cmd });
      });

      // Unified click handler for links and image zoom
      contentEl.addEventListener('click', function(e) {
        // Image/Mermaid zoom
        const img = e.target.closest('img, .mermaid svg');
        if (img && !e.target.closest('a[href]')) {
          e.preventDefault();
          const prev = contentEl.querySelector('.mm-zoomed');
          if (prev && prev !== img) prev.classList.remove('mm-zoomed');
          img.classList.toggle('mm-zoomed');
          return;
        }

        // Link handling
        const anchor = e.target.closest('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;
        e.preventDefault();
        e.stopPropagation();
        if (href.startsWith('#')) {
          const target = document.getElementById(href.slice(1));
          if (target) {
            const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
            const targetTop = target.getBoundingClientRect().top - contentEl.getBoundingClientRect().top + contentEl.scrollTop - 8;
            contentEl.scrollTo({ top: Math.max(0, Math.min(targetTop, maxScroll)), behavior: 'smooth' });
          }
          return;
        }
        vscodeApi.postMessage({ type: 'open-link', href: href });
      });

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'force-update-target') {
          targetUri = message.uri;
          fetchDocument();
          return;
        }

        if (message.type === 'reveal-heading') {
          if (!contentEl.children.length) {
            pendingHeadingReveal = message.heading;
            return;
          }

          const revealed = revealHeading(message.heading);
          if (!revealed) {
            pendingHeadingReveal = message.heading;
          }
        }

        if (message.type === 'print') {
          // Print is handled by the extension host, not the webview
          return;
        }

        if (message.type === 'toggle-focus-mode') {
          focusModeEnabled = Boolean(message.enabled);
          document.body.classList.toggle('mm-focus-mode', focusModeEnabled);
        }
      });

      let socket;
      let reconnectTimer;
      let reconnectDelay = 1000;
      let reconnectAttempts = 0;

      function connect() {
        try {
          socket = new WebSocket(wsUrl);
        } catch {
          scheduleReconnect();
          return;
        }

        document.body.classList.toggle('mm-focus-mode', focusModeEnabled);

        socket.addEventListener('open', () => {
          reconnectDelay = 1000;
          reconnectAttempts = 0;
          loaderEl.style.display = 'none';
          if (targetUri) {
            fetchDocument();
          } else {
            contentEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--vscode-descriptionForeground)">No Markdown file currently active.<br><br>Open a <code>.md</code> file in the editor to see the preview.</div>';
          }
        });

        socket.addEventListener('message', (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'document-updated' && (!targetUri || msg.uri === targetUri)) {
              targetUri = msg.uri;
              fetchDocument();
            }
          } catch {
            // Ignore malformed websocket messages.
          }
        });

        socket.addEventListener('close', () => {
          scheduleReconnect();
        });

        socket.addEventListener('error', () => {
          // Will trigger close event
        });
      }

      function scheduleReconnect() {
        reconnectAttempts++;
        loaderEl.style.display = 'block';
        if (reconnectAttempts <= 3) {
          loaderEl.textContent = 'Connecting to Markdown Mirror server...';
        } else {
          loaderEl.innerHTML = 'Server disconnected. Reconnecting...<br><small style="color:var(--vscode-descriptionForeground)">If this persists, run <code>Markdown Mirror: Start</code> from the Command Palette.</small>';
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
      }

      function fetchDocument() {
        if (!targetUri) {
          return;
        }

        fetch(baseUrl + '/api/document?native=true&uri=' + encodeURIComponent(targetUri))
          .then(res => res.json())
          .then(data => {
            if (data.html) {
              contentEl.innerHTML = data.html;
              executeScriptsWhenReady(contentEl);
              if (pendingHeadingReveal) {
                revealHeading(pendingHeadingReveal);
                pendingHeadingReveal = null;
              }
            } else if (data.error) {
              contentEl.innerHTML = '<p style="color:var(--vscode-errorForeground)">Error: ' + data.error + '</p>';
            }
          })
          .catch(() => {
            contentEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--vscode-errorForeground)">' +
              '<p style="font-size:1.2em;font-weight:600">Unable to load preview</p>' +
              '<p style="color:var(--vscode-descriptionForeground);margin-top:8px">The preview server may not be running.</p>' +
              '<p style="color:var(--vscode-descriptionForeground);margin-top:4px">Run <code>Markdown Mirror: Start</code> from the Command Palette (Ctrl+Shift+P),<br>or click the <strong>Mirror</strong> status bar item at the bottom.</p>' +
              '</div>';
          });
      }

      // Wait for external scripts to load before running post-render
      function executeScriptsWhenReady(element) {
        var attempts = 0;
        function tryRun() {
          attempts++;
          var mermaidReady = !element.querySelector('.mermaid') || typeof mermaid !== 'undefined';
          var katexReady = typeof renderMathInElement === 'function';

          if (mermaidReady && katexReady) {
            executeScripts(element);
          } else if (attempts < 20) {
            setTimeout(tryRun, 250);
          } else {
            // Run what we can after timeout
            executeScripts(element);
          }
        }
        tryRun();
      }

      function revealHeading(heading) {
        if (!heading) {
          return false;
        }

        let target = null;
        if (heading.line) {
          target = contentEl.querySelector('[data-source-line="' + String(heading.line) + '"]');
        }

        if (!target && heading.id) {
          target = document.getElementById(heading.id);
        }

        if (!target && heading.text) {
          const expected = String(heading.text).trim().toLowerCase();
          const candidates = contentEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
          for (const candidate of candidates) {
            if ((candidate.textContent || '').trim().toLowerCase() === expected) {
              target = candidate;
              break;
            }
          }
        }

        if (!target) {
          return false;
        }

        target.classList.remove('mm-toc-target');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.requestAnimationFrame(() => target.classList.add('mm-toc-target'));
        window.setTimeout(() => target.classList.remove('mm-toc-target'), 1200);
        return true;
      }

      function executeScripts(element) {
        if (element.querySelector('.mermaid') && typeof mermaid !== 'undefined') {
          try {
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default'
            });
            mermaid.run({ querySelector: '.mermaid' });
          } catch {}
        }
        tryRenderMath(element);
      }

      function tryRenderMath(element) {
        if (typeof renderMathInElement === 'function') {
          try {
            renderMathInElement(element, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
              ]
            });
          } catch {}
        } else {
          // KaTeX scripts may still be loading — retry once
          setTimeout(function() {
            if (typeof renderMathInElement === 'function') {
              try {
                renderMathInElement(element, {
                  delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                  ]
                });
              } catch {}
            }
          }, 500);
        }
      }

      connect();
    </script>
    <script src="${baseUrl}/vendor/mermaid/mermaid.min.js" nonce="${nonce}"></script>
    <script src="${baseUrl}/vendor/katex/katex.min.js" nonce="${nonce}"></script>
    <script src="${baseUrl}/vendor/katex/contrib/auto-render.min.js" nonce="${nonce}"></script>
  </body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const runtime = new MirrorRuntime(context.extensionPath);
  const treeProvider = new MarkdownTreeProvider();
  const tocProvider = new MarkdownTocProvider();
  const settingsProvider = new SettingsTreeProvider();

  const treeView = vscode.window.createTreeView("markdownMirror.fileTree", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  const tocTreeView = vscode.window.createTreeView("markdownMirror.tocTree", {
    treeDataProvider: tocProvider,
    showCollapseAll: true
  });

  const settingsTreeView = vscode.window.createTreeView("markdownMirror.settingsTree", {
    treeDataProvider: settingsProvider
  });

  // Status bar item — shows server status with quick actions
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.text = "$(book) Mirror: Stopped";
  statusBar.tooltip = "Markdown Mirror — Click for actions";
  statusBar.command = "markdownMirror.showStatusActions";
  statusBar.show();

  const updateStatusBar = (): void => {
    if (runtime.currentBaseUrl) {
      const port = runtime.currentBaseUrl.match(/:(\d+)/)?.[1] || "";
      statusBar.text = `$(book) Mirror: Running :${port}`;
      statusBar.tooltip = `Markdown Mirror — Server at ${runtime.currentBaseUrl}\nClick for actions`;
      statusBar.backgroundColor = undefined;
    } else {
      statusBar.text = "$(book) Mirror: Stopped";
      statusBar.tooltip = "Markdown Mirror — Click to start";
      statusBar.backgroundColor = undefined;
    }
  };
  updateStatusBar();

  const syncTocTarget = (uri: vscode.Uri | undefined): void => {
    tocProvider.setTargetUri(uri);
    tocTreeView.message = uri
      ? "Headings for active preview file"
      : "Open a markdown file in preview to see headings.";
  };

  syncTocTarget(NativePreviewManager.getCurrentTargetUri());
  NativePreviewManager.onTargetChanged = syncTocTarget;

  const treeWatcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  treeWatcher.onDidCreate(() => { treeProvider.refresh(); invalidatePathSetCache(); });
  treeWatcher.onDidDelete(() => { treeProvider.refresh(); invalidatePathSetCache(); });
  treeWatcher.onDidChange((uri) => {
    treeProvider.refresh();
    const target = NativePreviewManager.getCurrentTargetUri();
    if (target?.toString() === uri.toString()) {
      tocProvider.refresh();
    }
  });

  const getAutoOpenMode = (): AutoOpenMode => {
    return vscode.workspace.getConfiguration("markdownMirror").get<AutoOpenMode>("autoOpenMode", "firstRun");
  };

  const getHostMode = (): HostMode => {
    return vscode.workspace.getConfiguration("markdownMirror").get<HostMode>("hostMode", "vscode");
  };

  const getMaxLineLength = (): number => {
    return vscode.workspace.getConfiguration("markdownMirror").get<number>("maxLineLength", 120);
  };

  const diagnostics = vscode.languages.createDiagnosticCollection("markdownMirror");
  const diagnosticTimers = new Map<string, NodeJS.Timeout>();
  let cachedPathSet: Set<string> | undefined;
  let pathSetCacheTimer: NodeJS.Timeout | undefined;

  const getWorkspacePathSet = async (): Promise<Set<string>> => {
    if (cachedPathSet) {
      return cachedPathSet;
    }

    const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**", 5000);
    const set = new Set<string>();
    for (const file of files) {
      const relative = toWorkspaceRelative(file);
      if (relative) {
        set.add(relative);
      }
    }

    cachedPathSet = set;
    // Invalidate cache after 10s so file creates/deletes are picked up
    clearTimeout(pathSetCacheTimer);
    pathSetCacheTimer = setTimeout(() => { cachedPathSet = undefined; }, 10000);
    return set;
  };

  const invalidatePathSetCache = (): void => {
    cachedPathSet = undefined;
  };

  const runDocumentAuditForUri = async (uri: vscode.Uri) => {
    const relative = toWorkspaceRelative(uri);
    if (!relative) {
      return undefined;
    }

    const bytes = await vscode.workspace.fs.readFile(uri);
    const markdown = new TextDecoder("utf-8").decode(bytes);
    const pathSet = await getWorkspacePathSet();
    return auditDocument({
      uri,
      relativePath: relative,
      markdown
    }, pathSet, getMaxLineLength());
  };

  const refreshDiagnosticsForUri = async (uri: vscode.Uri): Promise<void> => {
    const diagnosticsEnabled = vscode.workspace.getConfiguration("markdownMirror").get<boolean>("enableQualityDiagnostics", true);
    if (!diagnosticsEnabled) {
      diagnostics.delete(uri);
      return;
    }

    if (uri.scheme !== "file" || !uri.fsPath.toLowerCase().endsWith(".md")) {
      return;
    }

    const audit = await runDocumentAuditForUri(uri);
    if (!audit) {
      diagnostics.delete(uri);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    const diags = audit.findings.map((finding) => {
      const lineIndex = Math.min(Math.max(finding.line - 1, 0), Math.max(doc.lineCount - 1, 0));
      const lineText = doc.lineAt(lineIndex).text;
      const range = new vscode.Range(lineIndex, 0, lineIndex, Math.max(lineText.length, 1));
      const severity = finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : finding.severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(range, `[${finding.kind}] ${finding.message}`, severity);
      diagnostic.code = finding.code;
      diagnostic.source = "Markdown Mirror";
      return diagnostic;
    });

    diagnostics.set(uri, diags);
  };

  const scheduleDiagnostics = (uri: vscode.Uri): void => {
    const key = uri.toString();
    const existing = diagnosticTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      diagnosticTimers.delete(key);
      void refreshDiagnosticsForUri(uri);
    }, 220);

    diagnosticTimers.set(key, timer);
  };

  const openAuditSummary = async (summary: WorkspaceAuditSummary, title = "Mirror Quality Report"): Promise<void> => {
    const report = renderAuditReport(summary);
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: report
    });

    await vscode.window.showTextDocument(doc, { preview: false });
    void vscode.window.showInformationMessage(`${title}: ${summary.totalFindings} findings across ${summary.documents.length} documents.`);
  };

  const composeMarkdownBundle = async (): Promise<void> => {
    const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**");
    const picks = files
      .map((uri) => {
        const relative = toWorkspaceRelative(uri);
        if (!relative) {
          return undefined;
        }

        return {
          label: relative,
          uri
        };
      })
      .filter((item): item is { label: string; uri: vscode.Uri } => !!item);

    if (picks.length === 0) {
      void vscode.window.showInformationMessage("No markdown files found to compose.");
      return;
    }

    const selected = await vscode.window.showQuickPick(picks, {
      title: "Compose Bundle",
      canPickMany: true,
      placeHolder: "Select markdown files to combine into one HTML report"
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const renderedSections: string[] = [];
    for (const item of selected) {
      const rendered = await runtime.renderDocumentHtmlForExport(item.uri);
      renderedSections.push(`<section><h1>${item.label}</h1>${rendered.html}</section>`);
    }

    const saveUri = await vscode.window.showSaveDialog({
      title: "Save Composed HTML Bundle",
      defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(), "mirror-bundle.html")),
      filters: { HTML: ["html"] }
    });

    if (!saveUri) {
      return;
    }

    const html = buildStandaloneHtml("Mirror Bundle", renderedSections.join("\n<hr />\n"), "review");
    await vscode.workspace.fs.writeFile(saveUri, new TextEncoder().encode(html));
    void vscode.window.showInformationMessage(`Saved composed bundle: ${saveUri.fsPath}`);
  };

  const shouldOpenBrowser = async (manualStart: boolean): Promise<boolean> => {
    if (manualStart) {
      return true;
    }

    const mode = getAutoOpenMode();
    if (mode === "never") {
      return false;
    }

    if (mode === "always") {
      return true;
    }

    const alreadyOpened = context.globalState.get<boolean>(FIRST_RUN_OPENED_KEY, false);
    if (alreadyOpened) {
      return false;
    }

    await context.globalState.update(FIRST_RUN_OPENED_KEY, true);
    return true;
  };

  const startRuntime = async (manualStart: boolean): Promise<void> => {
    const baseUrl = await runtime.start();
    const hostMode = getHostMode();

    if (hostMode === "vscode" || hostMode === "both") {
      await NativePreviewManager.show(runtime, context);
    }

    if ((hostMode === "browser" || hostMode === "both") && await shouldOpenBrowser(manualStart)) {
      const launchUrl = new URL(baseUrl);
      launchUrl.searchParams.set("mm_theme", getVsCodeThemeKind());
      void vscode.env.openExternal(vscode.Uri.parse(launchUrl.toString()));
    }

    if (manualStart) {
      void vscode.window.showInformationMessage(`Markdown Mirror started at ${baseUrl}`);
    }

    updateStatusBar();
  };

  const openBrowserInMode = async (mode: BrowserLaunchMode): Promise<void> => {
    const baseUrl = await runtime.start();
    const target = resolveTargetMarkdownUri();
    const url = new URL(baseUrl);
    url.searchParams.set(`mm_${mode}`, "1");
    url.searchParams.set("mm_theme", getVsCodeThemeKind());
    if (target) {
      url.searchParams.set("mm_open_uri", target.toString());
    }
    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
  };

  context.subscriptions.push(
    runtime,
    treeView,
    tocTreeView,
    settingsTreeView,
    statusBar,
    treeWatcher,
    diagnostics,
    vscode.commands.registerCommand("markdownMirror.showStatusActions", async () => {
      const isRunning = !!runtime.currentBaseUrl;
      const items: { label: string; action: string }[] = [];

      if (isRunning) {
        items.push(
          { label: "$(globe) Open in Browser", action: "openBrowser" },
          { label: "$(open-preview) Open Preview Panel", action: "openPreview" },
          { label: "$(copy) Copy Server URL", action: "copyUrl" },
          { label: "$(cloud-upload) Share via Dev Tunnel", action: "tunnel" },
          { label: "$(stop-circle) Stop Server", action: "stop" }
        );
      } else {
        items.push(
          { label: "$(play) Start Markdown Mirror", action: "start" }
        );
      }

      items.push({ label: "$(gear) Open Settings", action: "settings" });

      const picked = await vscode.window.showQuickPick(items, {
        title: "Markdown Mirror",
        placeHolder: isRunning ? `Server running at ${runtime.currentBaseUrl}` : "Server is not running"
      });

      if (!picked) {
        return;
      }

      switch (picked.action) {
        case "start":
          await vscode.commands.executeCommand("markdownMirror.start");
          break;
        case "stop":
          await vscode.commands.executeCommand("markdownMirror.stop");
          break;
        case "openBrowser": {
          const baseUrl = runtime.currentBaseUrl!;
          const launchUrl = new URL(baseUrl);
          launchUrl.searchParams.set("mm_theme", getVsCodeThemeKind());
          await vscode.env.openExternal(vscode.Uri.parse(launchUrl.toString()));
          break;
        }
        case "openPreview":
          await vscode.commands.executeCommand("markdownMirror.openNativePreview");
          break;
        case "copyUrl":
          await vscode.commands.executeCommand("markdownMirror.copyServerUrl");
          break;
        case "tunnel":
          await vscode.commands.executeCommand("markdownMirror.shareViaTunnel");
          break;
        case "settings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "markdownMirror");
          break;
      }
    }),
    vscode.commands.registerCommand("markdownMirror.toggleSetting", async (spec) => {
      await toggleSetting(spec);
      settingsProvider.refresh();
    }),
    vscode.commands.registerCommand("markdownMirror.start", async () => {
      await startRuntime(true);
    }),
    vscode.commands.registerCommand("markdownMirror.openNativePreview", async () => {
      await NativePreviewManager.show(runtime, context);
    }),
    vscode.commands.registerCommand("markdownMirror.openCompareMode", async () => {
      await openBrowserInMode("compare");
    }),
    vscode.commands.registerCommand("markdownMirror.openSlidesMode", async () => {
      await openBrowserInMode("slides");
    }),
    vscode.commands.registerCommand("markdownMirror.openInPreview", async (uri: vscode.Uri) => {
      await NativePreviewManager.show(runtime, context, uri);
    }),
    vscode.commands.registerCommand("markdownMirror.openActiveInPreview", async () => {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (!activeUri || activeUri.scheme !== "file" || !activeUri.fsPath.toLowerCase().endsWith(".md")) {
        void vscode.window.showInformationMessage("Open a markdown file in the editor, then run Markdown Mirror: Preview Active File.");
        return;
      }

      await NativePreviewManager.show(runtime, context, activeUri);
    }),
    vscode.commands.registerCommand("markdownMirror.runDocumentAudit", async () => {
      const targetUri = resolveTargetMarkdownUri();
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const audit = await runDocumentAuditForUri(targetUri);
      if (!audit) {
        void vscode.window.showWarningMessage("Unable to audit this document.");
        return;
      }

      await openAuditSummary({
        documents: [audit],
        totalFindings: audit.findings.length,
        errorCount: audit.findings.filter((item) => item.severity === "error").length,
        warningCount: audit.findings.filter((item) => item.severity === "warning").length,
        infoCount: audit.findings.filter((item) => item.severity === "info").length
      }, "Mirror Document Review");
    }),
    vscode.commands.registerCommand("markdownMirror.openReviewMode", async () => {
      await vscode.commands.executeCommand("markdownMirror.runDocumentAudit");
    }),
    vscode.commands.registerCommand("markdownMirror.runWorkspaceAudit", async () => {
      const summary = await runWorkspaceAudit(getMaxLineLength());
      await openAuditSummary(summary);
    }),
    vscode.commands.registerCommand("markdownMirror.validateLinks", async () => {
      const summary = await runWorkspaceAudit(getMaxLineLength());
      const broken = summary.documents.flatMap((doc) => doc.findings
        .filter((finding) => finding.kind === "link" && finding.severity === "error")
        .map((finding) => ({
          label: `${doc.relativePath}:L${finding.line}`,
          description: finding.message,
          uri: doc.uri,
          line: finding.line
        }))
      );

      if (broken.length === 0) {
        void vscode.window.showInformationMessage("No broken markdown links detected.");
        return;
      }

      const selected = await vscode.window.showQuickPick(broken, {
        title: `Broken Links (${broken.length})`,
        placeHolder: "Select a broken link to open in editor"
      });

      if (!selected) {
        return;
      }

      const doc = await vscode.workspace.openTextDocument(selected.uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const lineIndex = Math.min(Math.max(selected.line - 1, 0), Math.max(doc.lineCount - 1, 0));
      const position = new vscode.Position(lineIndex, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
    }),
    vscode.commands.registerCommand("markdownMirror.checkExternalLinks", async () => {
      const config = vscode.workspace.getConfiguration("markdownMirror");
      if (!config.get<boolean>("enableExternalLinkCheck", true)) {
        void vscode.window.showInformationMessage("External link checking is disabled in settings.");
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Checking external links...",
        cancellable: true
      }, async (progress, token) => {
        const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**", 5000);
        if (files.length === 0) {
          void vscode.window.showInformationMessage("No markdown files found in workspace.");
          return;
        }

        // Collect all external links from all files
        const allLinks: { uri: vscode.Uri; relativePath: string; line: number; url: string }[] = [];
        for (const uri of files) {
          if (token.isCancellationRequested) { return; }
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const markdown = new TextDecoder("utf-8").decode(bytes);
            const relativePath = toWorkspaceRelative(uri) || path.basename(uri.fsPath);
            const links = extractExternalLinks(markdown);
            for (const link of links) {
              allLinks.push({ uri, relativePath, line: link.line, url: link.url });
            }
          } catch {
            // skip unreadable files
          }
        }

        // Deduplicate URLs
        const uniqueUrls = [...new Set(allLinks.map((l) => l.url))];
        if (uniqueUrls.length === 0) {
          void vscode.window.showInformationMessage("No external links found in workspace.");
          return;
        }

        // Check URLs with concurrency limit of 5
        const results = new Map<string, ExternalLinkCheckResult>();
        const now = Date.now();
        let completed = 0;

        const checkUrl = async (url: string): Promise<void> => {
          const cached = externalLinkCache.get(url);
          if (cached && (now - cached.checkedAt) < EXTERNAL_LINK_CACHE_TTL) {
            results.set(url, cached.result);
          } else {
            const result = await checkExternalUrl(url);
            externalLinkCache.set(url, { result, checkedAt: now });
            results.set(url, result);
          }
          completed++;
          progress.report({ message: `${completed}/${uniqueUrls.length} URLs checked`, increment: (100 / uniqueUrls.length) });
        };

        // Process in chunks of 5 for concurrency
        for (let i = 0; i < uniqueUrls.length; i += 5) {
          if (token.isCancellationRequested) { return; }
          const chunk = uniqueUrls.slice(i, i + 5);
          await Promise.all(chunk.map(checkUrl));
        }

        // Build broken link items
        const brokenItems = allLinks
          .filter((link) => {
            const result = results.get(link.url);
            return result && !result.ok;
          })
          .map((link) => {
            const result = results.get(link.url)!;
            const statusText = typeof result.status === "number" ? `${result.status}` : result.status;
            return {
              label: `${link.relativePath}:L${link.line}`,
              description: `${statusText} — ${link.url}`,
              uri: link.uri,
              line: link.line
            };
          });

        if (brokenItems.length === 0) {
          void vscode.window.showInformationMessage("All external links are valid");
          return;
        }

        const selected = await vscode.window.showQuickPick(brokenItems, {
          title: `Broken External Links (${brokenItems.length})`,
          placeHolder: "Select a broken link to open in editor"
        });

        if (!selected) { return; }

        const doc = await vscode.workspace.openTextDocument(selected.uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const lineIndex = Math.min(Math.max(selected.line - 1, 0), Math.max(doc.lineCount - 1, 0));
        const position = new vscode.Position(lineIndex, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
      });
    }),
    vscode.commands.registerCommand("markdownMirror.findHeading", async () => {
      const targetUri = resolveTargetMarkdownUri();
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const bytes = await vscode.workspace.fs.readFile(targetUri);
      const markdown = new TextDecoder("utf-8").decode(bytes);
      const headings = extractHeadings(markdown);
      if (headings.length === 0) {
        void vscode.window.showInformationMessage("No headings found in this document.");
        return;
      }

      const selected = await vscode.window.showQuickPick(headings.map((heading) => ({
        label: `${"#".repeat(heading.level)} ${heading.text}`,
        description: `Line ${heading.line}`,
        heading
      })), {
        title: "Find Heading",
        placeHolder: "Search and jump to a heading"
      });

      if (!selected) {
        return;
      }

      const payload: TocHeading = {
        uri: targetUri.toString(),
        text: selected.heading.text,
        level: selected.heading.level,
        line: selected.heading.line,
        id: selected.heading.id
      };

      await vscode.commands.executeCommand("markdownMirror.revealHeadingInPreview", payload);
    }),
    vscode.commands.registerCommand("markdownMirror.showBacklinks", async (uriOrItem?: vscode.Uri | { node?: { uri?: vscode.Uri }; resourceUri?: vscode.Uri }) => {
      let targetUri: vscode.Uri | undefined;
      if (uriOrItem instanceof vscode.Uri) {
        targetUri = uriOrItem;
      } else if (uriOrItem && typeof uriOrItem === "object") {
        targetUri = (uriOrItem as any).resourceUri ?? (uriOrItem as any).node?.uri;
      }
      if (!targetUri) {
        targetUri = resolveTargetMarkdownUri();
      }
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const backlinks = await findBacklinks(targetUri);
      if (backlinks.length === 0) {
        void vscode.window.showInformationMessage("No backlinks found for this file.");
        return;
      }

      const selected = await vscode.window.showQuickPick(backlinks.map((entry) => ({
        label: `${entry.sourceRelativePath}:L${entry.line}`,
        description: entry.excerpt,
        entry
      })), {
        title: `Backlinks (${backlinks.length})`,
        placeHolder: "Select a backlink to open"
      });

      if (!selected) {
        return;
      }

      const doc = await vscode.workspace.openTextDocument(selected.entry.sourceUri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const lineIndex = Math.min(Math.max(selected.entry.line - 1, 0), Math.max(doc.lineCount - 1, 0));
      const position = new vscode.Position(lineIndex, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
    }),
    vscode.commands.registerCommand("markdownMirror.toggleFocusMode", async () => {
      const config = vscode.workspace.getConfiguration("markdownMirror");
      const current = config.get<string>("nativeUiProfile", "focused");
      const next = current === "focused" ? "classic" : "focused";
      await config.update("nativeUiProfile", next, vscode.ConfigurationTarget.Workspace);
      NativePreviewManager.setFocusMode(next === "focused");
      void vscode.window.showInformationMessage(`Markdown Mirror focus mode: ${next}`);
    }),
    vscode.commands.registerCommand("markdownMirror.formatBold", () => applyMarkdownFormatting("bold")),
    vscode.commands.registerCommand("markdownMirror.formatItalic", () => applyMarkdownFormatting("italic")),
    vscode.commands.registerCommand("markdownMirror.formatHeading", () => applyMarkdownFormatting("heading")),
    vscode.commands.registerCommand("markdownMirror.formatLink", () => applyMarkdownFormatting("link")),
    vscode.commands.registerCommand("markdownMirror.formatCode", () => applyMarkdownFormatting("code")),
    vscode.commands.registerCommand("markdownMirror.formatBulletList", () => applyMarkdownFormatting("bulletList")),
    vscode.commands.registerCommand("markdownMirror.formatNumberedList", () => applyMarkdownFormatting("numberedList")),
    vscode.commands.registerCommand("markdownMirror.formatBlockquote", () => applyMarkdownFormatting("blockquote")),
    vscode.commands.registerCommand("markdownMirror.formatTable", () => applyMarkdownFormatting("table")),
    vscode.commands.registerCommand("markdownMirror.formatHorizontalRule", () => applyMarkdownFormatting("horizontalRule")),
    vscode.commands.registerCommand("markdownMirror.composeWorkspaceBundle", async () => {
      await composeMarkdownBundle();
    }),
    vscode.commands.registerCommand("markdownMirror.refreshFileTree", () => {
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("markdownMirror.refreshToc", () => {
      tocProvider.refresh();
    }),
    vscode.commands.registerCommand("markdownMirror.revealHeadingInPreview", async (heading: TocHeading) => {
      if (!heading || !heading.uri) {
        return;
      }

      let uri: vscode.Uri;
      try {
        uri = vscode.Uri.parse(heading.uri);
      } catch {
        return;
      }

      await NativePreviewManager.show(runtime, context, uri);
      NativePreviewManager.revealHeadingInPreview(heading);
    }),
    vscode.commands.registerCommand("markdownMirror.revealHeadingInEditor", async (heading: TocHeading) => {
      if (!heading?.uri || !heading.line || heading.line < 1) {
        return;
      }

      let uri: vscode.Uri;
      try {
        uri = vscode.Uri.parse(heading.uri);
      } catch {
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, { preview: false });
      const lineIndex = Math.min(Math.max(heading.line - 1, 0), Math.max(document.lineCount - 1, 0));
      const position = new vscode.Position(lineIndex, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
    }),
    vscode.commands.registerCommand("markdownMirror.exportHtml", async () => {
      await vscode.commands.executeCommand("markdownMirror.exportHtmlWithProfile");
    }),
    vscode.commands.registerCommand("markdownMirror.exportHtmlWithProfile", async () => {
      const targetUri = resolveTargetMarkdownUri();
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const profileChoice = await vscode.window.showQuickPick([
        { label: "Web Article", profile: "web" as ExportProfile },
        { label: "Review Snapshot", profile: "review" as ExportProfile },
        { label: "Print Friendly", profile: "print" as ExportProfile }
      ], {
        title: "Select HTML Export Profile",
        placeHolder: "Choose a visual profile for the exported HTML"
      });

      if (!profileChoice) {
        return;
      }

      const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, ".html"));
      const saveUri = await vscode.window.showSaveDialog({
        title: "Export as HTML",
        defaultUri,
        filters: {
          HTML: ["html"]
        }
      });

      if (!saveUri) {
        return;
      }

      const rendered = await runtime.renderDocumentHtmlForExport(targetUri);
      const fullHtml = buildStandaloneHtml(rendered.title, rendered.html, profileChoice.profile);
      await vscode.workspace.fs.writeFile(saveUri, new TextEncoder().encode(fullHtml));
      void vscode.window.showInformationMessage(`Exported ${profileChoice.label} HTML to ${saveUri.fsPath}`);
    }),
    vscode.commands.registerCommand("markdownMirror.exportToWord", async () => {
      const targetUri = resolveTargetMarkdownUri();
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const defaultUri = vscode.Uri.file(targetUri.fsPath.replace(/\.md$/i, ".docx"));
      const saveUri = await vscode.window.showSaveDialog({
        title: "Export as Word",
        defaultUri,
        filters: {
          "Word Document": ["docx"]
        }
      });

      if (!saveUri) {
        return;
      }

      const pandocInstalled = await isPandocInstalled();
      if (!pandocInstalled) {
        const choice = await vscode.window.showWarningMessage(
          "Pandoc is required for Word export. Install Pandoc and retry, or export HTML instead.",
          "Export HTML",
          "Cancel"
        );
        if (choice === "Export HTML") {
          await vscode.commands.executeCommand("markdownMirror.exportHtml");
        }
        return;
      }

      try {
        const docDir = path.dirname(targetUri.fsPath);
        const rendered = await runtime.renderDocumentHtmlForExport(targetUri);
        const tempHtmlPath = path.join(docDir, `.mm-export-${Date.now()}.html`);
        const fullHtml = buildStandaloneHtml(rendered.title, rendered.html, "print");
        await fs.writeFile(tempHtmlPath, fullHtml, "utf-8");
        try {
          await execFileAsync("pandoc", [
            tempHtmlPath,
            "-f", "html",
            "-o", saveUri.fsPath,
            "--resource-path=" + docDir
          ], { cwd: docDir });
          void vscode.window.showInformationMessage(`Exported Word file to ${saveUri.fsPath}`);
        } finally {
          await fs.unlink(tempHtmlPath).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown pandoc error";
        void vscode.window.showErrorMessage(`Word export failed: ${message}`);
      }
    }),
    vscode.commands.registerCommand("markdownMirror.printPreview", async () => {
      await NativePreviewManager.show(runtime, context);
      NativePreviewManager.print();
    }),
    vscode.commands.registerCommand("markdownMirror.stop", async () => {
      await runtime.stop();
      updateStatusBar();
      void vscode.window.showInformationMessage("Markdown Mirror stopped.");
    }),
    vscode.commands.registerCommand("markdownMirror.copyServerUrl", async () => {
      const baseUrl = runtime.currentBaseUrl ?? await runtime.start();
      await vscode.env.clipboard.writeText(baseUrl);
      void vscode.window.showInformationMessage(`Server URL copied: ${baseUrl}`);
    }),
    vscode.commands.registerCommand("markdownMirror.shareViaTunnel", async () => {
      const baseUrl = runtime.currentBaseUrl ?? await runtime.start();
      const portMatch = baseUrl.match(/:(\d+)/);
      if (!portMatch) {
        void vscode.window.showErrorMessage("Could not determine server port.");
        return;
      }
      const port = parseInt(portMatch[1], 10);
      try {
        await vscode.commands.executeCommand("remote-tunnels.forwardPort", { port });
        void vscode.window.showInformationMessage(`Port ${port} forwarded. Check the Ports panel for the public URL.`);
      } catch {
        // Fallback: open Ports panel and guide user
        try {
          await vscode.commands.executeCommand("workbench.panel.ports.focus");
          void vscode.window.showInformationMessage(
            `Forward port ${port} in the Ports panel to share your preview. Tip: Set markdownMirror.port to a fixed number for consistent URLs.`
          );
        } catch {
          void vscode.window.showInformationMessage(
            `Server running on port ${port}. Use VS Code Ports panel or 'devtunnel port create ${port}' to share.`
          );
        }
      }
    }),
    vscode.commands.registerCommand("markdownMirror.compareWithGit", async () => {
      const targetUri = resolveTargetMarkdownUri();
      if (!targetUri) {
        void vscode.window.showInformationMessage("Open a markdown file in preview or editor first.");
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
      if (!workspaceFolder) {
        void vscode.window.showWarningMessage("File is not in an open workspace folder.");
        return;
      }

      const relativePath = path.relative(workspaceFolder.uri.fsPath, targetUri.fsPath).split(path.sep).join("/");

      // Get current content
      const currentBytes = await vscode.workspace.fs.readFile(targetUri);
      const currentMarkdown = new TextDecoder("utf-8").decode(currentBytes);

      // Get git HEAD content
      let previousMarkdown: string;
      try {
        previousMarkdown = await new Promise<string>((resolve, reject) => {
          cp.execFile("git", ["show", `HEAD:${relativePath}`], { cwd: workspaceFolder.uri.fsPath, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
          });
        });
      } catch {
        void vscode.window.showWarningMessage("Could not retrieve git history for this file. Is it tracked by git?");
        return;
      }

      if (currentMarkdown === previousMarkdown) {
        void vscode.window.showInformationMessage("No changes detected compared to git HEAD.");
        return;
      }

      // Render both versions using a standalone renderer
      const diffRenderer = new MarkdownRenderer();
      try {
        const baseUrl = runtime.currentBaseUrl ?? await runtime.start();
        const previousHtml = diffRenderer.render({ markdown: previousMarkdown, documentUri: targetUri, assetBaseUrl: baseUrl });
        const currentHtml = diffRenderer.render({ markdown: currentMarkdown, documentUri: targetUri, assetBaseUrl: baseUrl });

        const diffHtml = computeRenderedDiff(previousHtml, currentHtml);
        showDiffPanel(context, diffHtml, relativePath);
      } finally {
        diffRenderer.dispose();
      }
    }),
    vscode.workspace.onDidRenameFiles(async (event) => {
      const enabled = vscode.workspace.getConfiguration("markdownMirror").get<boolean>("autoFixLinksOnRename", true);
      if (!enabled) {
        return;
      }

      const mdRenames = event.files.filter(
        (f) => f.oldUri.fsPath.toLowerCase().endsWith(".md") && f.newUri.fsPath.toLowerCase().endsWith(".md")
      );
      if (mdRenames.length === 0) {
        return;
      }

      const allMdFiles = await vscode.workspace.findFiles("**/*.md");
      const edit = new vscode.WorkspaceEdit();
      let totalReferences = 0;
      const affectedFiles = new Set<string>();

      for (const rename of mdRenames) {
        const oldFsPath = rename.oldUri.fsPath;
        const newFsPath = rename.newUri.fsPath;
        const oldBaseName = path.basename(oldFsPath, ".md");
        const newBaseName = path.basename(newFsPath, ".md");

        for (const fileUri of allMdFiles) {
          // Skip the renamed file itself
          if (fileUri.fsPath === newFsPath || fileUri.fsPath === oldFsPath) {
            continue;
          }

          let content: string;
          try {
            const rawBytes = await vscode.workspace.fs.readFile(fileUri);
            content = Buffer.from(rawBytes).toString("utf-8");
          } catch {
            continue;
          }

          const fileDir = path.dirname(fileUri.fsPath);
          const lines = content.split("\n");
          let fileModified = false;

          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let lineModified = false;

            // Match standard markdown links: [text](path) or [text](path#anchor)
            const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
            let match: RegExpExecArray | null;
            const replacements: { start: number; end: number; replacement: string }[] = [];

            while ((match = mdLinkRegex.exec(line)) !== null) {
              const linkText = match[1];
              const fullRef = match[2];

              // Skip external URLs and non-file references
              if (fullRef.startsWith("http://") || fullRef.startsWith("https://") || fullRef.startsWith("mailto:") || fullRef.startsWith("#")) {
                continue;
              }

              // Separate anchor from path
              const anchorIndex = fullRef.indexOf("#");
              const linkPath = anchorIndex >= 0 ? fullRef.substring(0, anchorIndex) : fullRef;
              const anchor = anchorIndex >= 0 ? fullRef.substring(anchorIndex) : "";

              if (!linkPath) {
                continue;
              }

              // Resolve the link path relative to the referencing file's directory
              const resolvedPath = path.resolve(fileDir, linkPath.replace(/\//g, "\\"));

              if (resolvedPath.toLowerCase() === oldFsPath.toLowerCase()) {
                const newRelative = path.relative(fileDir, newFsPath).replace(/\\/g, "/");
                const newFullRef = newRelative + anchor;
                const replacement = `[${linkText}](${newFullRef})`;
                replacements.push({
                  start: match.index,
                  end: match.index + match[0].length,
                  replacement,
                });
                lineModified = true;
              }
            }

            // Match wiki links: [[target]] or [[target|display]]
            const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
            while ((match = wikiLinkRegex.exec(line)) !== null) {
              const target = match[1].trim();
              const displayText = match[2];

              // Check if the wiki link target matches the old file name
              const targetLower = target.toLowerCase();
              const oldBaseNameLower = oldBaseName.toLowerCase();

              const isMatch =
                targetLower === oldBaseNameLower ||
                targetLower === oldBaseNameLower + ".md";

              if (isMatch) {
                const newTarget = targetLower.endsWith(".md") ? newBaseName + ".md" : newBaseName;
                const replacement = displayText !== undefined
                  ? `[[${newTarget}|${displayText}]]`
                  : `[[${newTarget}]]`;
                replacements.push({
                  start: match.index,
                  end: match.index + match[0].length,
                  replacement,
                });
                lineModified = true;
              }
            }

            if (lineModified) {
              // Apply replacements in reverse order to preserve indices
              replacements.sort((a, b) => b.start - a.start);
              let updatedLine = line;
              for (const r of replacements) {
                updatedLine = updatedLine.substring(0, r.start) + r.replacement + updatedLine.substring(r.end);
              }
              const range = new vscode.Range(i, 0, i, line.length);
              edit.replace(fileUri, range, updatedLine);
              totalReferences += replacements.length;
              fileModified = true;
            }
          }

          if (fileModified) {
            affectedFiles.add(fileUri.fsPath);
          }
        }
      }

      if (totalReferences > 0) {
        await vscode.workspace.applyEdit(edit);
        void vscode.window.showInformationMessage(
          `Markdown Mirror: Updated ${totalReferences} references in ${affectedFiles.size} files.`
        );
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === "markdown" || document.uri.fsPath.toLowerCase().endsWith(".md")) {
        scheduleDiagnostics(document.uri);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === "markdown" || document.uri.fsPath.toLowerCase().endsWith(".md")) {
        scheduleDiagnostics(document.uri);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "markdown" || event.document.uri.fsPath.toLowerCase().endsWith(".md")) {
        scheduleDiagnostics(event.document.uri);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.scheme === "file" && (editor.document.languageId === "markdown" || editor.document.uri.fsPath.toLowerCase().endsWith(".md"))) {
        NativePreviewManager.updateTarget(editor.document.uri.toString());
        scheduleDiagnostics(editor.document.uri);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("markdownMirror")) {
        return;
      }
      runtime.notifyConfigurationChanged();
      settingsProvider.refresh();
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId === "markdown" || editor.document.uri.fsPath.toLowerCase().endsWith(".md")) {
          scheduleDiagnostics(editor.document.uri);
        }
      }
    }),
    new vscode.Disposable(() => {
      for (const timer of diagnosticTimers.values()) {
        clearTimeout(timer);
      }
      diagnosticTimers.clear();
    })
  );

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === "markdown" || editor.document.uri.fsPath.toLowerCase().endsWith(".md")) {
      scheduleDiagnostics(editor.document.uri);
    }
  }

  void autoStart(runtime, startRuntime);
}

function getVsCodeThemeKind(): "light" | "dark" {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast
    ? "dark"
    : "light";
}

function resolveTargetMarkdownUri(): vscode.Uri | undefined {
  const previewTarget = NativePreviewManager.getCurrentTargetUri();
  if (previewTarget?.scheme === "file" && previewTarget.fsPath.toLowerCase().endsWith(".md")) {
    return previewTarget;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file" && activeUri.fsPath.toLowerCase().endsWith(".md")) {
    return activeUri;
  }

  return undefined;
}

async function isPandocInstalled(): Promise<boolean> {
  try {
    await execFileAsync("pandoc", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

function buildStandaloneHtml(title: string, bodyHtml: string, profile: ExportProfile): string {
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const profileStyles = getStandaloneProfileStyles(profile);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { max-width: 860px; margin: 32px auto; padding: 0 16px 48px; font-family: Segoe UI, Arial, sans-serif; line-height: 1.65; color: #0f172a; }
      h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin-top: 1.4em; }
      pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; overflow-x: auto; }
      code { background: #f1f5f9; border-radius: 4px; padding: 1px 4px; }
      pre code { background: transparent; padding: 0; }
      img { max-width: 100%; }
      blockquote { border-left: 4px solid #cbd5e1; margin: 1em 0; padding: 0 1em; color: #334155; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #cbd5e1; padding: 6px 10px; }
      ${profileStyles}
    </style>
  </head>
  <body>
${bodyHtml}
  </body>
</html>`;
}

function getStandaloneProfileStyles(profile: ExportProfile): string {
  switch (profile) {
    case "review":
      return `
      body { max-width: 980px; background: #f8fafc; color: #0f172a; }
      h1, h2, h3 { border-left: 4px solid #2563eb; padding-left: 10px; }
      pre { border-left: 4px solid #0ea5e9; }
      `;
    case "print":
      return `
      body { max-width: 760px; color: #111827; }
      a { color: #111827; text-decoration: underline; }
      @media print {
        body { margin: 0; padding: 0; max-width: 100%; font-size: 12pt; }
        pre, blockquote, table { page-break-inside: avoid; }
      }
      `;
    case "web":
    default:
      return `
      body { max-width: 900px; }
      `;
  }
}

export function deactivate(): void {
  // Runtime cleanup is handled by extension subscriptions.
}

async function autoStart(runtime: MirrorRuntime, startRuntime: (manualStart: boolean) => Promise<void>): Promise<void> {
  const autoStartEnabled = vscode.workspace.getConfiguration("markdownMirror").get<boolean>("autoStart", true);
  if (!autoStartEnabled) {
    return;
  }

  const hasWorkspaceFolder = (vscode.workspace.workspaceFolders ?? []).length > 0;
  if (!hasWorkspaceFolder) {
    return;
  }

  const hasMarkdown = await hasMarkdownFiles();
  if (!hasMarkdown) {
    return;
  }

  try {
    await startRuntime(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    void vscode.window.showWarningMessage(`Markdown Mirror failed to auto-start: ${message}`);
    void runtime.stop();
  }
}

async function hasMarkdownFiles(): Promise<boolean> {
  const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**", 1);
  return files.length > 0;
}

function computeRenderedDiff(oldHtml: string, newHtml: string): string {
  const tokenize = (html: string): string[] =>
    html.split(/(\s+|<[^>]+>)/).filter((t) => t.length > 0);

  const oldTokens = tokenize(oldHtml);
  const newTokens = tokenize(newHtml);

  // Guard against extremely large diffs that would exhaust memory
  const MAX_TOKENS = 5000;
  if (oldTokens.length > MAX_TOKENS || newTokens.length > MAX_TOKENS) {
    return `<div class="mm-diff-header" style="background:#fff3cd;padding:12px;border-radius:6px;margin-bottom:16px;">
      <strong>⚠️ Document too large for rendered diff</strong> (${oldTokens.length} / ${newTokens.length} tokens). Showing current version only.
    </div>${newHtml}`;
  }

  // LCS-based diff using Myers-like approach
  const n = oldTokens.length;
  const m = newTokens.length;

  // Build LCS table (optimised for moderate sizes)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Back-trace to produce diff operations
  const ops: Array<{ type: "keep" | "del" | "ins"; token: string }> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ type: "keep", token: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "ins", token: newTokens[j - 1] });
      j--;
    } else {
      ops.push({ type: "del", token: oldTokens[i - 1] });
      i--;
    }
  }
  ops.reverse();

  // Merge consecutive same-type ops and wrap in <ins>/<del>
  const parts: string[] = [];
  let idx = 0;
  while (idx < ops.length) {
    const op = ops[idx];
    if (op.type === "keep") {
      parts.push(op.token);
      idx++;
    } else {
      const collected: string[] = [];
      const kind = op.type;
      while (idx < ops.length && ops[idx].type === kind) {
        collected.push(ops[idx].token);
        idx++;
      }
      const joined = collected.join("");
      if (kind === "del") {
        parts.push(`<del class="mm-diff-del">${joined}</del>`);
      } else {
        parts.push(`<ins class="mm-diff-add">${joined}</ins>`);
      }
    }
  }

  return parts.join("");
}

function showDiffPanel(context: vscode.ExtensionContext, diffHtml: string, fileName: string): void {
  const panel = vscode.window.createWebviewPanel(
    "markdownMirrorDiff",
    `Diff: ${fileName}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  const safeFileName = fileName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; line-height: 1.6; }
    .mm-diff-del { background-color: #ffeef0; color: #b31d28; text-decoration: line-through; }
    .mm-diff-add { background-color: #e6ffec; color: #22863a; text-decoration: none; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
    img { max-width: 100%; }
    table { border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px 12px; }
    .mm-diff-header { background: #f0f0f0; padding: 10px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9em; color: #555; }
  </style>
</head>
<body>
  <div class="mm-diff-header">
    <strong>Rendered Diff:</strong> ${safeFileName} — comparing HEAD → current
    <br><span style="color:#22863a">■</span> Added &nbsp; <span style="color:#b31d28">■</span> Removed
  </div>
  ${diffHtml}
</body>
</html>`;
}
