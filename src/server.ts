import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";
import express from "express";
import * as vscode from "vscode";
import matter from "gray-matter";
import { MarkdownRenderer } from "./renderer";
import { isDataFile, renderDataFile } from "./dataRenderer";
import { auditDocument, toWorkspaceRelative } from "./quality";

export interface WorkspaceTreeNode {
  name: string;
  kind: "folder" | "file";
  relativePath: string;
  uri?: string;
  children?: WorkspaceTreeNode[];
}

export interface ServerStartResult {
  host: string;
  port: number;
  baseUrl: string;
}

export class MirrorServer implements vscode.Disposable {
  private readonly app: express.Express;
  private httpServer: http.Server | undefined;
  private readonly host: string;
  private readonly webRootPath: string;

  public constructor(
    private readonly renderer: MarkdownRenderer,
    host = "127.0.0.1",
    webRootPath = path.resolve(process.cwd(), "media")
  ) {
    this.host = host;
    this.webRootPath = webRootPath;
    this.app = express();
    this.configureRoutes();
  }

  public async start(): Promise<ServerStartResult> {
    if (this.httpServer) {
      const address = this.httpServer.address();
      if (address && typeof address !== "string") {
        return {
          host: this.host,
          port: address.port,
          baseUrl: `http://${this.host}:${address.port}`
        };
      }
    }

    await this.assertWebRootIsValid();

    const configuredPort = vscode.workspace.getConfiguration("markdownMirror").get<number>("port", 0);
    const port = configuredPort > 0 ? configuredPort : 0;

    try {
      this.httpServer = await new Promise<http.Server>((resolve, reject) => {
        const server = this.app.listen(port, this.host, () => resolve(server));
        server.on("error", reject);
      });
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "EADDRINUSE") {
        throw new Error(`Port ${port} is already in use. Change markdownMirror.port in settings or set to 0 for auto-assign.`);
      }
      throw error;
    }

    const address = this.httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine server address.");
    }

    return {
      host: this.host,
      port: address.port,
      baseUrl: `http://${this.host}:${address.port}`
    };
  }

  public getHttpServer(): http.Server {
    if (!this.httpServer) {
      throw new Error("Server is not started.");
    }

    return this.httpServer;
  }

  public async stop(): Promise<void> {
    if (!this.httpServer) {
      return;
    }

    const server = this.httpServer;
    this.httpServer = undefined;

    // Force-close all open connections to prevent hang
    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Safety timeout — don't hang forever
      setTimeout(resolve, 3000);
    });
  }

  public dispose(): void {
    void this.stop();
  }

  private configureRoutes(): void {
    this.app.use(express.json({ limit: "200kb" }));

    this.app.use((req, res, next) => {
        const remoteAddress = req.socket.remoteAddress ?? "";
        if (!this.isLoopbackClient(remoteAddress)) {
          res.status(403).json({ error: "Forbidden. Localhost clients only." });
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        next();
      });

    this.app.use(express.static(this.webRootPath, { index: "index.html" }));

    this.app.get("/", (_req, res) => {
      res.sendFile(path.join(this.webRootPath, "index.html"));
    });

    this.app.get("/api/tree", async (_req, res) => {
      try {
        const tree = await this.buildWorkspaceTree();
        res.json({ roots: tree });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    });

    this.app.get("/api/settings", (_req, res) => {
      const config = vscode.workspace.getConfiguration("markdownMirror");
      const rawMermaidTheme = config.get<string>("mermaidTheme", "default");
      const mermaidTheme = this.normalizeMermaidTheme(rawMermaidTheme);
      const enableMath = config.get<boolean>("enableMath", false);
      const customCssPath = (config.get<string>("customCssPath", "") || "").trim();
      const defaultCompareMode = config.get<boolean>("defaultCompareMode", true);
      const defaultTocVisible = config.get<boolean>("defaultTocVisible", true);
      const defaultThemeRaw = (config.get<string>("defaultTheme", "light") || "light").toLowerCase();
      const defaultWidthModeRaw = (config.get<string>("defaultWidthMode", "full") || "full").toLowerCase();
      const defaultTheme = defaultThemeRaw === "dark" ? "dark" : "light";
      const defaultWidthMode = defaultWidthModeRaw === "reading" ? "reading" : "full";
      const enablePrint = config.get<boolean>("enablePrint", true);
      const enableHtmlExport = config.get<boolean>("enableHtmlExport", true);
      const enableWordExport = config.get<boolean>("enableWordExport", true);
      const enableSlides = config.get<boolean>("enableSlides", true);
      const enableCompare = config.get<boolean>("enableCompare", true);
      const enableToc = config.get<boolean>("enableToc", true);
      const enableThemeToggle = config.get<boolean>("enableThemeToggle", true);
      const enableWidthToggle = config.get<boolean>("enableWidthToggle", true);
      const startExplorerCollapsed = config.get<boolean>("startExplorerCollapsed", false);
      const defaultFilePath = (config.get<string>("defaultFilePath", "") || "").trim();

      res.json({
        enableMath,
        mermaidTheme,
        customCssPath,
        defaultCompareMode,
        defaultTocVisible,
        defaultTheme,
        defaultWidthMode,
        enablePrint,
        enableHtmlExport,
        enableWordExport,
        enableSlides,
        enableCompare,
        enableToc,
        enableThemeToggle,
        enableWidthToggle,
        startExplorerCollapsed,
        defaultFilePath
      });
    });

    this.app.get("/api/custom-css", async (_req, res) => {
      const cssPathSetting = (vscode.workspace.getConfiguration("markdownMirror").get<string>("customCssPath", "") || "").trim();
      if (!cssPathSetting) {
        res.status(204).send("");
        return;
      }

      const normalizedSegments = cssPathSetting.replace(/\\/g, "/").split("/").filter((segment) => segment.length > 0);
      if (normalizedSegments.length === 0 || normalizedSegments.some((segment) => segment === "." || segment === "..")) {
        res.status(400).json({ error: "Invalid customCssPath setting." });
        return;
      }

      const folders = vscode.workspace.workspaceFolders ?? [];
      for (const folder of folders) {
        const targetUri = vscode.Uri.joinPath(folder.uri, ...normalizedSegments);
        try {
          const bytes = await vscode.workspace.fs.readFile(targetUri);
          const css = new TextDecoder("utf-8").decode(bytes);
          res.type("text/css").send(css);
          return;
        } catch {
          // Try next workspace folder.
        }
      }

      res.status(404).json({ error: "Custom CSS file not found in workspace." });
    });

    this.app.post("/api/scroll-sync", async (req, res) => {
      const uriRaw = typeof req.body?.uri === "string" ? req.body.uri : "";
      const ratio = typeof req.body?.ratio === "number" ? req.body.ratio : undefined;

      if (!uriRaw || ratio === undefined || Number.isNaN(ratio)) {
        res.status(400).json({ error: "uri and ratio are required." });
        return;
      }

      try {
        const uri = vscode.Uri.parse(uriRaw);
        const editor = vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === uri.toString());
        if (!editor) {
          res.json({ ok: true, skipped: "editor-not-visible" });
          return;
        }

        const document = editor.document;
        const line = Math.max(0, Math.min(document.lineCount - 1, Math.floor(ratio * Math.max(document.lineCount - 1, 0))));
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
        res.json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to sync editor scroll.";
        res.status(500).json({ error: message });
      }
    });

    this.app.post("/api/toggle-checkbox", async (req, res) => {
      const uriRaw = typeof req.body?.uri === "string" ? req.body.uri : "";
      const sourceLine = typeof req.body?.sourceLine === "number" ? req.body.sourceLine : undefined;
      const checked = Boolean(req.body?.checked);

      if (!uriRaw || sourceLine === undefined || Number.isNaN(sourceLine)) {
        res.status(400).json({ error: "uri and sourceLine are required." });
        return;
      }

      try {
        const uri = vscode.Uri.parse(uriRaw);
        const document = await vscode.workspace.openTextDocument(uri);
        const originalText = document.getText();
        const eol = originalText.includes("\r\n") ? "\r\n" : "\n";
        const lines = originalText.split(/\r?\n/);
        const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor(sourceLine - 1)));
        const line = lines[lineIndex];
        const replacement = checked ? "- [x]" : "- [ ]";
        const updated = line.replace(/^(\s*[-*+]\s+)\[( |x|X)\]/, "$1" + replacement.slice(2));

        if (updated === line) {
          res.status(409).json({ error: "No task checkbox found at source line." });
          return;
        }

        lines[lineIndex] = updated;
        const normalized = lines.join(eol);
        if (normalized === originalText) {
          res.json({ ok: true, skipped: "no-op" });
          return;
        }
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(normalized));
        res.json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update checkbox.";
        res.status(500).json({ error: message });
      }
    });

    this.app.get("/asset", async (req, res) => {
      const doc = typeof req.query.doc === "string" ? req.query.doc : undefined;
      const src = typeof req.query.src === "string" ? req.query.src : undefined;

      if (!doc || !src) {
        res.status(400).send("Missing required query parameters: doc, src");
        return;
      }

      try {
        const documentUri = vscode.Uri.parse(doc);
        if (documentUri.scheme !== "file") {
          res.status(400).send("Only file-backed markdown documents are supported.");
          return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (!workspaceFolder) {
          res.status(404).send("Document is not in an open workspace folder.");
          return;
        }

        const candidatePath = path.resolve(path.dirname(documentUri.fsPath), src);
        if (!this.isPathInside(candidatePath, workspaceFolder.uri.fsPath)) {
          res.status(403).send("Blocked path traversal attempt.");
          return;
        }

        await vscode.workspace.fs.stat(vscode.Uri.file(candidatePath));
        res.sendFile(candidatePath);
      } catch {
        res.status(404).send("Asset not found.");
      }
    });

    this.app.get("/api/document", async (req, res) => {
      const uriRaw = typeof req.query.uri === "string" ? req.query.uri : undefined;
      if (!uriRaw) {
        res.status(400).json({ error: "Missing required query parameter: uri" });
        return;
      }

      try {
        const documentUri = vscode.Uri.parse(uriRaw);
        if (documentUri.scheme !== "file") {
          res.status(400).json({ error: "Only file-backed documents are supported." });
          return;
        }

        const fsPathLower = documentUri.fsPath.toLowerCase();
        const isMarkdown = fsPathLower.endsWith(".md");
        const isData = !isMarkdown && this.isDataFileEnabled() && isDataFile(documentUri.fsPath);

        if (!isMarkdown && !isData) {
          res.status(400).json({ error: "Unsupported file type." });
          return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (!workspaceFolder) {
          res.status(404).json({ error: "Document is not in an open workspace folder." });
          return;
        }

        if (!this.isPathInside(documentUri.fsPath, workspaceFolder.uri.fsPath)) {
          res.status(403).json({ error: "Blocked path traversal attempt." });
          return;
        }

        const bytes = await vscode.workspace.fs.readFile(documentUri);
        const content = new TextDecoder("utf-8").decode(bytes);
        const baseUrl = `http://${this.host}:${this.getPort()}`;
        const embedImages = req.query.native === "true";

        let html: string;
        if (isData) {
          html = renderDataFile(content, documentUri.fsPath);
        } else if (embedImages) {
          html = await this.renderer.renderWithEmbeddedImages({
            markdown: content,
            documentUri,
            assetBaseUrl: baseUrl,
            embedImages: true
          });
        } else {
          html = this.renderer.render({
            markdown: content,
            documentUri,
            assetBaseUrl: baseUrl
          });
        }

        res.json({
          uri: documentUri.toString(),
          relativePath: path.relative(workspaceFolder.uri.fsPath, documentUri.fsPath).split(path.sep).join("/"),
          html
        });
      } catch {
        res.status(404).json({ error: "Document not found." });
      }
    });

    this.app.get("/api/search", async (req, res) => {
      const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!query) {
        res.status(400).json({ error: "Missing required query parameter: q" });
        return;
      }

      if (!this.isSearchEnabled()) {
        res.status(403).json({ error: "Search is disabled in settings." });
        return;
      }

      try {
        const results = await this.searchWorkspace(query);
        res.json({ query, results });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search failed.";
        res.status(500).json({ error: message });
      }
    });

    this.app.get("/dashboard", (_req, res) => {
      res.sendFile(path.join(this.webRootPath, "dashboard.html"));
    });

    this.app.get("/api/dashboard", async (_req, res) => {
      try {
        const data = await this.buildDashboardData();
        res.json(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    });
  }


  private async buildDashboardData(): Promise<object> {
    const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**", 5000);
    const maxLineLength = Number(vscode.workspace.getConfiguration("markdownMirror").get<number>("maxLineLength", 120));

    const pathSet = new Set<string>();
    const relativePaths = new Map<string, vscode.Uri>();

    for (const uri of files) {
      const relativePath = toWorkspaceRelative(uri);
      if (relativePath) {
        pathSet.add(relativePath);
        relativePaths.set(relativePath, uri);
      }
    }

    const documents: {
      relativePath: string;
      uri: string;
      healthScore: number;
      findings: { total: number; errors: number; warnings: number; info: number; details: unknown[] };
      metrics: { words: number; characters: number; readingMinutes: number; fleschReadingEase: number };
      lastModified: number;
      daysSinceModified: number;
      headingCount: number;
      linkCount: number;
    }[] = [];

    const entries = Array.from(relativePaths.entries());
    const batchSize = 50;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async ([relativePath, uri]) => {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const content = new TextDecoder("utf-8").decode(bytes);

          const audit = auditDocument({ uri, relativePath, markdown: content }, pathSet, maxLineLength);

          const stat = await vscode.workspace.fs.stat(uri);
          const lastModified = stat.mtime;

          const errorPenalty = audit.findings.filter(f => f.severity === "error").length * 15;
          const warningPenalty = audit.findings.filter(f => f.severity === "warning").length * 5;
          const infoPenalty = audit.findings.filter(f => f.severity === "info").length * 1;
          const readabilityPenalty = Math.abs(audit.metrics.fleschReadingEase - 65) > 30 ? 10 : 0;
          const daysSinceModified = Math.floor((Date.now() - lastModified) / (1000 * 60 * 60 * 24));
          const stalenessPenalty = daysSinceModified > 90 ? Math.min(20, Math.floor((daysSinceModified - 90) / 30) * 5) : 0;
          const healthScore = Math.max(0, Math.min(100, 100 - errorPenalty - warningPenalty - infoPenalty - readabilityPenalty - stalenessPenalty));

          return {
            relativePath,
            uri: uri.toString(),
            healthScore,
            findings: {
              total: audit.findings.length,
              errors: audit.findings.filter(f => f.severity === "error").length,
              warnings: audit.findings.filter(f => f.severity === "warning").length,
              info: audit.findings.filter(f => f.severity === "info").length,
              details: audit.findings.slice(0, 10)
            },
            metrics: audit.metrics,
            lastModified,
            daysSinceModified,
            headingCount: audit.headings.length,
            linkCount: audit.links.length
          };
        } catch {
          return undefined;
        }
      }));

      for (const result of results) {
        if (result) {
          documents.push(result);
        }
      }
    }

    documents.sort((a, b) => a.healthScore - b.healthScore);

    const totalDocs = documents.length;
    const avgHealth = totalDocs > 0 ? Math.round(documents.reduce((sum, d) => sum + d.healthScore, 0) / totalDocs) : 0;
    const staleDocs = documents.filter(d => d.daysSinceModified > 90).length;
    const errorDocs = documents.filter(d => d.findings.errors > 0).length;

    return {
      summary: { totalDocs, avgHealth, staleDocs, errorDocs },
      documents
    };
  }

  private async buildWorkspaceTree(): Promise<WorkspaceTreeNode[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const excludePatterns = this.getExcludePatterns();
    const rootCandidates = (
      await Promise.all(folders.map(async (folder) => {
        const folderRootPathSettings = this.getRootPathSettings(folder);
        return this.resolveTreeRoots(folder, folderRootPathSettings);
      }))
    ).flat();

    const roots = await Promise.all(
      rootCandidates
        .filter((candidate): candidate is { folderName: string; rootUri: vscode.Uri; relativeBase: string } => !!candidate)
        .map(async (candidate) => {
          const children = await this.readDirectory(candidate.rootUri, candidate.relativeBase, excludePatterns);
          return {
            name: candidate.folderName,
            kind: "folder" as const,
            relativePath: candidate.relativeBase,
            children
          };
        })
    );

    return roots.filter((root) => (root.children?.length ?? 0) > 0);
  }

  private async readDirectory(directoryUri: vscode.Uri, relativeBase: string, excludePatterns: string[]): Promise<WorkspaceTreeNode[]> {
    const entries = await vscode.workspace.fs.readDirectory(directoryUri);
    const sorted = [...entries].sort((a, b) => a[0].localeCompare(b[0]));
    const nodes: WorkspaceTreeNode[] = [];

    for (const [name, kind] of sorted) {
      if (name === ".git" || name === "node_modules") {
        continue;
      }

      const childRelativePath = relativeBase ? `${relativeBase}/${name}` : name;

      if (this.isExcluded(childRelativePath, excludePatterns)) {
        continue;
      }

      const childUri = vscode.Uri.joinPath(directoryUri, name);

      if (kind === vscode.FileType.Directory) {
        const children = await this.readDirectory(childUri, childRelativePath, excludePatterns);
        if (children.length === 0) {
          continue;
        }

        nodes.push({
          name,
          kind: "folder",
          relativePath: childRelativePath,
          children
        });
        continue;
      }

      if (kind === vscode.FileType.File && (name.toLowerCase().endsWith(".md") || (this.isDataFileEnabled() && isDataFile(name)))) {
        nodes.push({
          name,
          kind: "file",
          relativePath: childRelativePath,
          uri: childUri.toString()
        });
      }
    }

    return nodes;
  }

  private getRootPathSettings(folder: vscode.WorkspaceFolder): string[] {
    const scopedConfig = vscode.workspace.getConfiguration("markdownMirror", folder.uri);
    const rootPathsInspect = scopedConfig.inspect<string[]>("rootPaths");
    const effectiveRootPaths =
      rootPathsInspect?.workspaceFolderValue ??
      rootPathsInspect?.workspaceValue ??
      rootPathsInspect?.globalValue;
    const hasExplicitRootPathsSetting =
      rootPathsInspect?.workspaceFolderValue !== undefined ||
      rootPathsInspect?.workspaceValue !== undefined ||
      rootPathsInspect?.globalValue !== undefined;

    const normalizedMulti = Array.isArray(effectiveRootPaths)
      ? effectiveRootPaths
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().replace(/\\/g, "/"))
          .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
      : [];

    if (normalizedMulti.length > 0) {
      return normalizedMulti;
    }

    // If rootPaths is explicitly configured (even as an empty array), do not fall back to legacy rootPath.
    if (hasExplicitRootPathsSetting) {
      return [];
    }

    // Backward compatibility for existing users of the single root setting.
    const rootPathInspect = scopedConfig.inspect<string>("rootPath");
    const effectiveRootPath =
      rootPathInspect?.workspaceFolderValue ??
      rootPathInspect?.workspaceValue ??
      rootPathInspect?.globalValue;

    const single = String(effectiveRootPath || "").trim().replace(/\\/g, "/");
    return single ? [single] : [];
  }

  private async resolveTreeRoots(
    folder: vscode.WorkspaceFolder,
    rootPathSettings: string[]
  ): Promise<Array<{ folderName: string; rootUri: vscode.Uri; relativeBase: string }>> {
    if (rootPathSettings.length === 0) {
      return [{
        folderName: folder.name,
        rootUri: folder.uri,
        relativeBase: ""
      }];
    }

    const resolved = await Promise.all(rootPathSettings.map(async (rootPathSetting) => {
      return this.resolveTreeRoot(folder, rootPathSetting);
    }));

    const deduped: Array<{ folderName: string; rootUri: vscode.Uri; relativeBase: string }> = [];
    const seen = new Set<string>();
    for (const candidate of resolved) {
      if (!candidate) {
        continue;
      }
      const key = candidate.rootUri.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(candidate);
    }

    if (deduped.length === 0) {
      // If configured paths are not found in this workspace folder, gracefully fall back to folder root.
      return [{
        folderName: folder.name,
        rootUri: folder.uri,
        relativeBase: ""
      }];
    }

    return deduped;
  }

  private async resolveTreeRoot(
    folder: vscode.WorkspaceFolder,
    rootPathSetting: string
  ): Promise<{ folderName: string; rootUri: vscode.Uri; relativeBase: string } | undefined> {
    if (!rootPathSetting) {
      return {
        folderName: folder.name,
        rootUri: folder.uri,
        relativeBase: ""
      };
    }

    const normalizedSegments = rootPathSetting.split("/").filter((segment) => segment.length > 0);
    const hasTraversal = normalizedSegments.some((segment) => segment === ".." || segment === ".");
    if (hasTraversal || rootPathSetting.startsWith("/") || /^[a-zA-Z]:/.test(rootPathSetting)) {
      return undefined;
    }

    const scopedUri = vscode.Uri.joinPath(folder.uri, ...normalizedSegments);
    try {
      const stat = await vscode.workspace.fs.stat(scopedUri);
      if (stat.type !== vscode.FileType.Directory) {
        return undefined;
      }

      return {
        folderName: `${folder.name}/${rootPathSetting}`,
        rootUri: scopedUri,
        relativeBase: rootPathSetting
      };
    } catch {
      return undefined;
    }
  }

  private isPathInside(candidatePath: string, rootPath: string): boolean {
    const relative = path.relative(rootPath, candidatePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  private getExcludePatterns(): string[] {
    const config = vscode.workspace.getConfiguration("markdownMirror");
    const raw = config.get<string[]>("excludePaths", []);
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().replace(/\\/g, "/"))
      .filter((v) => v.length > 0);
  }

  private isExcluded(relativePath: string, patterns: string[]): boolean {
    if (patterns.length === 0) {
      return false;
    }

    const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase();

      // Exact match
      if (normalized === lowerPattern || normalized.startsWith(lowerPattern + "/")) {
        return true;
      }

      // Glob: **/name matches any path ending with /name or equal to name
      if (lowerPattern.startsWith("**/")) {
        const suffix = lowerPattern.slice(3);
        if (normalized === suffix || normalized.endsWith("/" + suffix)) {
          return true;
        }

        const parts = normalized.split("/");
        if (parts.some((part) => part === suffix)) {
          return true;
        }
      }
    }

    return false;
  }

  private getPort(): number {
    const address = this.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Server is not started.");
    }

    return address.port;
  }

  private getPortSafe(): number {
    try {
      return this.getPort();
    } catch {
      return 0;
    }
  }

  private isLoopbackClient(remoteAddress: string): boolean {
    return remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
  }

  private async assertWebRootIsValid(): Promise<void> {
    const indexPath = path.join(this.webRootPath, "index.html");
    try {
      const stat = await fs.stat(indexPath);
      if (!stat.isFile()) {
        throw new Error("index.html is not a regular file");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown reason";
      throw new Error(`Invalid web root: ${this.webRootPath}. Missing index.html (${reason}).`);
    }
  }

  private normalizeMermaidTheme(value: string): "default" | "dark" | "forest" | "neutral" {
    switch ((value || "").toLowerCase()) {
      case "dark":
        return "dark";
      case "forest":
        return "forest";
      case "neutral":
        return "neutral";
      default:
        return "default";
    }
  }

  private isDataFileEnabled(): boolean {
    return vscode.workspace.getConfiguration("markdownMirror").get<boolean>("enableDataFiles", true);
  }

  private isSearchEnabled(): boolean {
    return vscode.workspace.getConfiguration("markdownMirror").get<boolean>("enableSearch", true);
  }

  private isSupportedFile(name: string): boolean {
    if (name.toLowerCase().endsWith(".md")) {
      return true;
    }
    return this.isDataFileEnabled() && isDataFile(name);
  }

  private async searchWorkspace(query: string): Promise<Array<{ uri: string; relativePath: string; matches: Array<{ line: number; text: string }> }>> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const excludePatterns = this.getExcludePatterns();
    const queryLower = query.toLowerCase();
    const maxResults = 200;
    const results: Array<{ uri: string; relativePath: string; matches: Array<{ line: number; text: string }> }> = [];
    let totalMatches = 0;

    for (const folder of folders) {
      if (totalMatches >= maxResults) {
        break;
      }
      await this.searchDirectory(folder.uri, "", excludePatterns, queryLower, results, maxResults, () => totalMatches, (count) => { totalMatches = count; });
    }

    return results;
  }

  private async searchDirectory(
    directoryUri: vscode.Uri,
    relativeBase: string,
    excludePatterns: string[],
    queryLower: string,
    results: Array<{ uri: string; relativePath: string; matches: Array<{ line: number; text: string }> }>,
    maxResults: number,
    getTotal: () => number,
    setTotal: (n: number) => void
  ): Promise<void> {
    const entries = await vscode.workspace.fs.readDirectory(directoryUri);

    for (const [name, kind] of entries) {
      if (getTotal() >= maxResults) {
        return;
      }
      if (name === ".git" || name === "node_modules") {
        continue;
      }

      const childRelativePath = relativeBase ? `${relativeBase}/${name}` : name;
      if (this.isExcluded(childRelativePath, excludePatterns)) {
        continue;
      }

      const childUri = vscode.Uri.joinPath(directoryUri, name);

      if (kind === vscode.FileType.Directory) {
        await this.searchDirectory(childUri, childRelativePath, excludePatterns, queryLower, results, maxResults, getTotal, setTotal);
        continue;
      }

      if (kind === vscode.FileType.File && this.isSupportedFile(name)) {
        try {
          const bytes = await vscode.workspace.fs.readFile(childUri);
          const content = new TextDecoder("utf-8").decode(bytes);
          const lines = content.split(/\r?\n/);
          const matches: Array<{ line: number; text: string }> = [];

          for (let i = 0; i < lines.length; i++) {
            if (getTotal() >= maxResults) {
              break;
            }
            if (lines[i].toLowerCase().includes(queryLower)) {
              matches.push({ line: i + 1, text: lines[i].substring(0, 300) });
              setTotal(getTotal() + 1);
            }
          }

          if (matches.length > 0) {
            results.push({
              uri: childUri.toString(),
              relativePath: childRelativePath,
              matches
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }
}
