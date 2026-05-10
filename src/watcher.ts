import * as http from "http";
import * as path from "path";
import * as vscode from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { MarkdownRenderer } from "./renderer";
import { isDataFile, renderDataFile } from "./dataRenderer";

const SUPPORTED_LANGUAGE_IDS = new Set(["markdown", "yaml", "json", "jsonc", "xml"]);

interface WatcherMessage {
  type: "connected" | "document-updated" | "document-deleted" | "viewport-updated" | "settings-updated";
  uri?: string;
  relativePath?: string;
  html?: string;
  reason?: "typed" | "saved" | "created";
  changedLine?: number;
  topLine?: number;
  totalLines?: number;
  timestamp: number;
}

export class MarkdownWatcher implements vscode.Disposable {
  private readonly wsServer: WebSocketServer;
  private readonly fileWatcher: vscode.FileSystemWatcher;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly renderDebounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingChangedLineByUri = new Map<string, number>();
  private viewportThrottleTimer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly httpServer: http.Server,
    private readonly renderer: MarkdownRenderer,
    private readonly assetBaseUrl: string
  ) {
    this.wsServer = new WebSocketServer({ server: this.httpServer, path: "/ws" });
    this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.{md,yaml,yml,json,xml}");

    this.wsServer.on("connection", (socket) => {
      this.send(socket, {
        type: "connected",
        timestamp: Date.now()
      });
    });

    this.disposables.push(
      this.fileWatcher,
      this.fileWatcher.onDidChange((uri) => void this.publishFromDisk(uri, "saved")),
      this.fileWatcher.onDidCreate((uri) => void this.publishFromDisk(uri, "created")),
      this.fileWatcher.onDidDelete((uri) => this.publishDelete(uri)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!SUPPORTED_LANGUAGE_IDS.has(event.document.languageId)) {
          return;
        }
        this.schedulePublishFromEditor(event.document, event.contentChanges);
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        if (!SUPPORTED_LANGUAGE_IDS.has(event.textEditor.document.languageId)) {
          return;
        }
        this.throttledPublishViewport(event.textEditor);
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || !SUPPORTED_LANGUAGE_IDS.has(editor.document.languageId)) {
          return;
        }
        this.publishViewport(editor);
      }),
      new vscode.Disposable(() => this.wsServer.close())
    );
  }

  public dispose(): void {
    for (const timer of this.renderDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.renderDebounceTimers.clear();
    this.pendingChangedLineByUri.clear();

    vscode.Disposable.from(...this.disposables).dispose();
  }

  public publishSettingsUpdated(): void {
    this.broadcast({
      type: "settings-updated",
      timestamp: Date.now()
    });
  }

  private schedulePublishFromEditor(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]): void {
    const key = document.uri.toString();
    const changedLine = this.getChangedLine(changes);
    if (changedLine > 0) {
      this.pendingChangedLineByUri.set(key, changedLine);
    }

    const existingTimer = this.renderDebounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.renderDebounceTimers.delete(key);
      const pendingLine = this.pendingChangedLineByUri.get(key);
      this.pendingChangedLineByUri.delete(key);
      this.publish(document.uri, document.getText(), "typed", pendingLine);
    }, 180);

    this.renderDebounceTimers.set(key, timer);
  }

  private async publishFromDisk(uri: vscode.Uri, reason: "saved" | "created"): Promise<void> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder("utf-8").decode(bytes);
      this.publish(uri, content, reason);
    } catch {
      // The file may have been removed between event and read.
    }
  }

  private publishDelete(uri: vscode.Uri): void {
    this.broadcast({
      type: "document-deleted",
      uri: uri.toString(),
      relativePath: this.toRelativePath(uri),
      timestamp: Date.now()
    });
  }

  private publish(uri: vscode.Uri, content: string, reason: "typed" | "saved" | "created", changedLine?: number): void {
    let html: string;
    if (isDataFile(uri.fsPath)) {
      html = renderDataFile(content, uri.fsPath);
    } else {
      html = this.renderer.render({
        markdown: content,
        documentUri: uri,
        assetBaseUrl: this.assetBaseUrl
      });
    }

    this.broadcast({
      type: "document-updated",
      uri: uri.toString(),
      relativePath: this.toRelativePath(uri),
      html,
      reason,
      changedLine,
      timestamp: Date.now()
    });
  }

  private getChangedLine(changes: readonly vscode.TextDocumentContentChangeEvent[]): number {
    if (!Array.isArray(changes) || changes.length === 0) {
      return 0;
    }

    let minLine = Number.MAX_SAFE_INTEGER;
    for (const change of changes) {
      const line = change.range.start.line + 1;
      if (line < minLine) {
        minLine = line;
      }
    }

    return Number.isFinite(minLine) ? minLine : 0;
  }

  private throttledPublishViewport(editor: vscode.TextEditor): void {
    if (this.viewportThrottleTimer) {
      return;
    }

    this.viewportThrottleTimer = setTimeout(() => {
      this.viewportThrottleTimer = undefined;
      this.publishViewport(editor);
    }, 60);
  }

  private publishViewport(editor: vscode.TextEditor): void {
    const visibleRange = editor.visibleRanges[0];
    if (!visibleRange) {
      return;
    }

    this.broadcast({
      type: "viewport-updated",
      uri: editor.document.uri.toString(),
      relativePath: this.toRelativePath(editor.document.uri),
      topLine: visibleRange.start.line,
      totalLines: editor.document.lineCount,
      timestamp: Date.now()
    });
  }

  private broadcast(message: WatcherMessage): void {
    if (this.wsServer.clients.size === 0) {
      return;
    }

    const payload = JSON.stringify(message);
    for (const client of this.wsServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private send(socket: WebSocket, message: WatcherMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  }

  private toRelativePath(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return uri.fsPath;
    }

    return path.relative(folder.uri.fsPath, uri.fsPath).split(path.sep).join("/");
  }
}
