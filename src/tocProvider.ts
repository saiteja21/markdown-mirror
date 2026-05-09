import * as vscode from "vscode";

export interface TocHeading {
  uri: string;
  text: string;
  level: number;
  line: number;
  id: string;
}

interface TocNode {
  heading: TocHeading;
  children: TocNode[];
}

export class TocTreeItem extends vscode.TreeItem {
  public constructor(
    public readonly node: TocNode,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(node.heading.text, collapsibleState);

    this.description = `L${node.heading.line}`;
    this.tooltip = `${node.heading.text} (line ${node.heading.line})`;
    this.contextValue = "markdownMirror.tocHeading";
    this.iconPath = new vscode.ThemeIcon("symbol-key");
    this.command = {
      command: "markdownMirror.revealHeadingInPreview",
      title: "Go to Heading in Preview",
      arguments: [node.heading]
    };
  }
}

export class MarkdownTocProvider implements vscode.TreeDataProvider<TocTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TocTreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<TocTreeItem | undefined | void> = this.onDidChangeTreeDataEmitter.event;

  private targetUri: vscode.Uri | undefined;
  private cacheKey = "";
  private cache: TocNode[] = [];

  public setTargetUri(uri: vscode.Uri | undefined): void {
    const previous = this.targetUri?.toString();
    const next = uri?.toString();
    if (previous === next) {
      return;
    }

    this.targetUri = uri;
    this.cacheKey = "";
    this.onDidChangeTreeDataEmitter.fire();
  }

  public refresh(): void {
    this.cacheKey = "";
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: TocTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: TocTreeItem): Promise<TocTreeItem[]> {
    if (!this.targetUri) {
      return [];
    }

    await this.ensureCache();

    const nodes = element ? element.node.children : this.cache;
    return nodes.map((node) => new TocTreeItem(
      node,
      node.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    ));
  }

  private async ensureCache(): Promise<void> {
    if (!this.targetUri) {
      this.cache = [];
      return;
    }

    let key = this.targetUri.toString();
    try {
      const stat = await vscode.workspace.fs.stat(this.targetUri);
      key += `:${stat.mtime}:${stat.size}`;
    } catch {
      this.cache = [];
      return;
    }

    if (this.cacheKey === key) {
      return;
    }

    const bytes = await vscode.workspace.fs.readFile(this.targetUri);
    const markdown = new TextDecoder("utf-8").decode(bytes);
    const headings = extractHeadings(markdown, this.targetUri);
    this.cache = buildHierarchy(headings);
    this.cacheKey = key;
  }
}

function extractHeadings(markdown: string, uri: vscode.Uri): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = markdown.split(/\r?\n/);
  const slugCounts = new Map<string, number>();

  let fence: { marker: string; size: number } | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const size = fenceMatch[1].length;
      if (!fence) {
        fence = { marker, size };
      } else if (fence.marker === marker && size >= fence.size) {
        fence = undefined;
      }
      continue;
    }

    if (fence) {
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length;
    const rawText = headingMatch[2].replace(/\s+#+\s*$/, "").trim();
    if (!rawText) {
      continue;
    }

    const plainText = cleanHeadingText(rawText);
    const slugBase = slugify(plainText);
    const count = slugCounts.get(slugBase) ?? 0;
    slugCounts.set(slugBase, count + 1);
    const slug = count === 0 ? slugBase : `${slugBase}-${count}`;

    headings.push({
      uri: uri.toString(),
      text: plainText,
      level,
      line: i + 1,
      id: slug
    });
  }

  return headings;
}

function buildHierarchy(headings: TocHeading[]): TocNode[] {
  const root: TocNode = {
    heading: { uri: "", text: "root", level: 0, line: 0, id: "root" },
    children: []
  };

  const stack: TocNode[] = [root];

  for (const heading of headings) {
    const node: TocNode = { heading, children: [] };

    while (stack.length > 1 && stack[stack.length - 1].heading.level >= heading.level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children;
}

function cleanHeadingText(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .trim();
}

function slugify(text: string): string {
  const normalized = text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized || "section";
}
