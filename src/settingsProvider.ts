import * as vscode from "vscode";

interface SettingSpec {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "enum";
  enumValues?: string[];
}

const SETTINGS: SettingSpec[] = [
  { key: "autoStart", label: "Auto Start", description: "Start when workspace opens", type: "boolean" },
  { key: "hostMode", label: "Host Mode", description: "Where preview opens", type: "enum", enumValues: ["vscode", "browser", "both"] },
  { key: "nativeUiProfile", label: "UI Profile", description: "VS Code panel layout style", type: "enum", enumValues: ["focused", "classic"] },
  { key: "enableMath", label: "Math (KaTeX)", description: "Render math expressions", type: "boolean" },
  { key: "enableMermaid", label: "Mermaid Diagrams", description: "Render diagram code blocks", type: "boolean" },
  { key: "enableQualityDiagnostics", label: "Quality Diagnostics", description: "Show quality checks in Problems panel", type: "boolean" },
  { key: "enablePrint", label: "Print Action", description: "Show Print / PDF button", type: "boolean" },
  { key: "enableHtmlExport", label: "HTML Export", description: "Show Export HTML action", type: "boolean" },
  { key: "enableWordExport", label: "Word Export", description: "Show Export Word action", type: "boolean" },
  { key: "enableSlides", label: "Slides Mode", description: "Show Slides action", type: "boolean" },
  { key: "enableCompare", label: "Compare Mode", description: "Show Compare action", type: "boolean" },
  { key: "enableToc", label: "TOC Panel", description: "Show TOC toggle", type: "boolean" },
  { key: "showFrontmatter", label: "Frontmatter Card", description: "Show YAML frontmatter", type: "enum", enumValues: ["card", "none"] },
  { key: "htmlMode", label: "HTML Mode", description: "Sanitize or trust raw HTML", type: "enum", enumValues: ["safe", "trusted"] },
  { key: "defaultTheme", label: "Default Theme", description: "Preview theme for new sessions", type: "enum", enumValues: ["light", "dark"] },
  { key: "defaultWidthMode", label: "Width Mode", description: "Default content width", type: "enum", enumValues: ["full", "reading"] },
  { key: "startExplorerCollapsed", label: "Start Collapsed", description: "Start browser with explorer collapsed", type: "boolean" },
  { key: "port", label: "Server Port", description: "Fixed port (0 = auto)", type: "enum", enumValues: [] },
  { key: "defaultFilePath", label: "Default File", description: "File to open on browser launch", type: "enum", enumValues: [] }
];

export class SettingsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly spec: SettingSpec,
    public readonly currentValue: string
  ) {
    super(spec.label, vscode.TreeItemCollapsibleState.None);

    const icon = spec.type === "boolean"
      ? (currentValue === "true" ? "check" : "circle-slash")
      : "gear";

    this.iconPath = new vscode.ThemeIcon(icon);
    this.description = `${currentValue}`;
    this.tooltip = `${spec.description}\nSetting: markdownMirror.${spec.key}\nCurrent: ${currentValue}`;
    this.contextValue = "markdownMirror.setting";

    this.command = {
      command: "markdownMirror.toggleSetting",
      title: "Toggle Setting",
      arguments: [spec]
    };
  }
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingsTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SettingsTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: SettingsTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<SettingsTreeItem[]> {
    const config = vscode.workspace.getConfiguration("markdownMirror");
    return SETTINGS.map((spec) => {
      const raw = config.get(spec.key);
      const value = raw === undefined ? "" : String(raw);
      return new SettingsTreeItem(spec, value);
    });
  }
}

export async function toggleSetting(spec: SettingSpec): Promise<void> {
  const config = vscode.workspace.getConfiguration("markdownMirror");
  const current = config.get(spec.key);

  if (spec.type === "boolean") {
    const next = !current;
    await config.update(spec.key, next, vscode.ConfigurationTarget.Workspace);
    return;
  }

  if (spec.type === "enum" && spec.enumValues && spec.enumValues.length > 0) {
    const picked = await vscode.window.showQuickPick(
      spec.enumValues.map((v) => ({ label: v, picked: v === String(current) })),
      { title: `Set ${spec.label}`, placeHolder: `Current: ${current}` }
    );

    if (picked) {
      await config.update(spec.key, picked.label, vscode.ConfigurationTarget.Workspace);
    }
  }
}
