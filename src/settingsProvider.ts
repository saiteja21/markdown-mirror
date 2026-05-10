import * as vscode from "vscode";

interface SettingSpec {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "enum" | "multiSelect";
  enumValues?: string[];
  options?: string[];
}

const SETTINGS: SettingSpec[] = [
  {
    key: "dataFileExtensions",
    label: "File Extensions",
    description: "Which file types to load in the explorer",
    type: "multiSelect",
    options: [".md", ".yaml", ".yml", ".json", ".txt"]
  },
  { key: "autoStart", label: "Auto Start", description: "Start when workspace opens", type: "boolean" },
  { key: "hostMode", label: "Host Mode", description: "Where preview opens", type: "enum", enumValues: ["vscode", "browser", "both"] },
  { key: "nativeUiProfile", label: "UI Profile", description: "VS Code panel layout style", type: "enum", enumValues: ["focused", "classic"] },
  { key: "enableMath", label: "Math (KaTeX)", description: "Render math expressions", type: "boolean" },
  { key: "enableMermaid", label: "Mermaid Diagrams", description: "Render diagram code blocks", type: "boolean" },
  { key: "enablePlantUml", label: "PlantUML Diagrams", description: "Render PlantUML via external server", type: "boolean" },
  { key: "enableDataFiles", label: "Data File Preview", description: "Show YAML/JSON files with rich preview", type: "boolean" },
  { key: "enableSearch", label: "Workspace Search", description: "Full-text search in browser", type: "boolean" },
  { key: "enableTransclusion", label: "Content Transclusion", description: "Enable include directives", type: "boolean" },
  { key: "autoFixLinksOnRename", label: "Auto-Fix Links", description: "Update links when files are renamed", type: "boolean" },
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
      : spec.type === "multiSelect"
        ? "list-filter"
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
      let value: string;
      if (spec.type === "multiSelect" && Array.isArray(raw)) {
        value = raw.length === 0 ? "(none)" : raw.join(", ");
      } else {
        value = raw === undefined ? "" : String(raw);
      }
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

  if (spec.type === "multiSelect" && spec.options && spec.options.length > 0) {
    const currentArr = Array.isArray(current) ? current as string[] : [];
    const items = spec.options.map((opt) => ({
      label: opt,
      picked: currentArr.includes(opt)
    }));

    const picked = await vscode.window.showQuickPick(items, {
      title: `Select ${spec.label}`,
      placeHolder: `Choose which extensions to include`,
      canPickMany: true
    });

    if (picked) {
      await config.update(spec.key, picked.map((p) => p.label), vscode.ConfigurationTarget.Workspace);
    }
  }
}
