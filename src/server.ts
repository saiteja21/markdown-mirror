import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";
import express from "express";
import * as vscode from "vscode";
import { MarkdownRenderer } from "./renderer";

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

    this.httpServer = await new Promise<http.Server>((resolve, reject) => {
      const server = this.app.listen(0, this.host, () => resolve(server));
      server.on("error", reject);
    });

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

    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.httpServer = undefined;
  }

  public dispose(): void {
    void this.stop();
  }

  private configureRoutes(): void {
    this.app.use((req, res, next) => {
      const remoteAddress = req.socket.remoteAddress ?? "";
      if (!this.isLoopbackClient(remoteAddress)) {
        res.status(403).json({ error: "Forbidden. Localhost clients only." });
        return;
      }
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
          res.status(400).json({ error: "Only file-backed markdown documents are supported." });
          return;
        }

        if (!documentUri.fsPath.toLowerCase().endsWith(".md")) {
          res.status(400).json({ error: "Only markdown documents are supported." });
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
        const markdown = new TextDecoder("utf-8").decode(bytes);
        const baseUrl = `http://${this.host}:${this.getPort()}`;
        const html = this.renderer.render({
          markdown,
          documentUri,
          assetBaseUrl: baseUrl
        });

        res.json({
          uri: documentUri.toString(),
          relativePath: path.relative(workspaceFolder.uri.fsPath, documentUri.fsPath).split(path.sep).join("/"),
          html
        });
      } catch {
        res.status(404).json({ error: "Document not found." });
      }
    });
  }

  private async buildWorkspaceTree(): Promise<WorkspaceTreeNode[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const rootPathSetting = this.getRootPathSetting();

    const rootCandidates = await Promise.all(folders.map(async (folder) => {
      return this.resolveTreeRoot(folder, rootPathSetting);
    }));

    const roots = await Promise.all(
      rootCandidates
        .filter((candidate): candidate is { folderName: string; rootUri: vscode.Uri; relativeBase: string } => !!candidate)
        .map(async (candidate) => {
          const children = await this.readDirectory(candidate.rootUri, candidate.relativeBase);
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

  private async readDirectory(directoryUri: vscode.Uri, relativeBase: string): Promise<WorkspaceTreeNode[]> {
    const entries = await vscode.workspace.fs.readDirectory(directoryUri);
    const sorted = [...entries].sort((a, b) => a[0].localeCompare(b[0]));
    const nodes: WorkspaceTreeNode[] = [];

    for (const [name, kind] of sorted) {
      if (name === ".git" || name === "node_modules") {
        continue;
      }

      const childUri = vscode.Uri.joinPath(directoryUri, name);
      const childRelativePath = relativeBase ? `${relativeBase}/${name}` : name;

      if (kind === vscode.FileType.Directory) {
        const children = await this.readDirectory(childUri, childRelativePath);
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

      if (kind === vscode.FileType.File && name.toLowerCase().endsWith(".md")) {
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

  private getRootPathSetting(): string {
    const value = vscode.workspace.getConfiguration("markdownMirror").get<string>("rootPath", "");
    return (value || "").trim().replace(/\\/g, "/");
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

  private getPort(): number {
    const address = this.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Server is not started.");
    }

    return address.port;
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
}
