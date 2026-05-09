import * as vscode from "vscode";
import * as path from "path";

type TreeNodeKind = "folder" | "file";

class MarkdownTreeNode {
  public readonly children = new Map<string, MarkdownTreeNode>();

  public constructor(
    public readonly label: string,
    public readonly kind: TreeNodeKind,
    public readonly relativePath: string,
    public readonly uri?: vscode.Uri
  ) {}
}

export class MarkdownTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: MarkdownTreeNode,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(node.label, collapsibleState);

    if (node.kind === "file" && node.uri) {
      this.tooltip = node.uri.fsPath;
      const parentFolder = path.dirname(node.relativePath);
      this.description = parentFolder === "." ? "" : parentFolder;
      this.resourceUri = node.uri;
      this.contextValue = "markdownMirror.file";
      this.command = {
        command: "markdownMirror.openInPreview",
        title: "Open in Preview",
        arguments: [node.uri]
      };
      this.iconPath = vscode.ThemeIcon.File;
    } else {
      this.tooltip = node.relativePath;
      this.iconPath = vscode.ThemeIcon.Folder;
      this.contextValue = "markdownMirror.folder";
    }
  }
}

export class MarkdownTreeProvider implements vscode.TreeDataProvider<MarkdownTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MarkdownTreeItem | undefined | void> = new vscode.EventEmitter<MarkdownTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<MarkdownTreeItem | undefined | void> = this._onDidChangeTreeData.event;
  private readonly root = new MarkdownTreeNode("root", "folder", "");

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MarkdownTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MarkdownTreeItem): Promise<MarkdownTreeItem[]> {
    if (!element) {
      await this.rebuildTree();
      return this.toTreeItems(this.root);
    }

    if (element.node.kind === "file") {
      return [];
    }

    return this.toTreeItems(element.node);
  }

  private toTreeItems(parent: MarkdownTreeNode): MarkdownTreeItem[] {
    const children = Array.from(parent.children.values());
    children.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "folder" ? -1 : 1;
      }

      return a.label.localeCompare(b.label);
    });

    return children.map((node) => {
      const collapsibleState = node.kind === "folder"
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      return new MarkdownTreeItem(node, collapsibleState);
    });
  }

  private async rebuildTree(): Promise<void> {
    this.root.children.clear();

    const excludePatterns = this.getExcludePatterns();
    const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**");
    for (const file of files) {
      const relative = this.toWorkspaceRelative(file);
      if (!relative) {
        continue;
      }

      if (excludePatterns.length > 0 && this.isExcluded(relative, excludePatterns)) {
        continue;
      }

      this.insertFile(relative, file);
    }
  }

  private getExcludePatterns(): string[] {
    const raw = vscode.workspace.getConfiguration("markdownMirror").get<string[]>("excludePaths", []);
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().replace(/\\/g, "/"))
      .filter((v) => v.length > 0);
  }

  private isExcluded(relativePath: string, patterns: string[]): boolean {
    const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
    for (const pattern of patterns) {
      const lp = pattern.toLowerCase();
      if (normalized === lp || normalized.startsWith(lp + "/")) {
        return true;
      }

      if (lp.startsWith("**/")) {
        const suffix = lp.slice(3);
        if (normalized === suffix || normalized.endsWith("/" + suffix) || normalized.split("/").some((p) => p === suffix)) {
          return true;
        }
      }
    }

    return false;
  }

  private toWorkspaceRelative(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }

    const relative = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    if (!relative || relative.startsWith("..")) {
      return undefined;
    }

    const rootPrefix = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1
      ? `${workspaceFolder.name}/${relative}`
      : relative;

    return rootPrefix.replace(/\\/g, "/");
  }

  private insertFile(relativePath: string, uri: vscode.Uri): void {
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length === 0) {
      return;
    }

    let current = this.root;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const isLeaf = index === parts.length - 1;
      const nextRelative = parts.slice(0, index + 1).join("/");

      let next = current.children.get(part);
      if (!next) {
        next = new MarkdownTreeNode(part, isLeaf ? "file" : "folder", nextRelative, isLeaf ? uri : undefined);
        current.children.set(part, next);
      }

      current = next;
    }
  }
}
