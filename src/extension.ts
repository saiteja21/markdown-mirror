import * as vscode from "vscode";
import { MirrorServer } from "./server";
import { MarkdownWatcher } from "./watcher";
import { MarkdownRenderer } from "./renderer";

type AutoOpenMode = "always" | "firstRun" | "never";
const FIRST_RUN_OPENED_KEY = "markdownMirror.firstRunBrowserOpened";

class MirrorRuntime implements vscode.Disposable {
  private readonly renderer = new MarkdownRenderer();
  private readonly server = new MirrorServer(this.renderer);
  private watcher: MarkdownWatcher | undefined;

  public async start(): Promise<string> {
    const serverInfo = await this.server.start();

    if (!this.watcher) {
      this.watcher = new MarkdownWatcher(this.server.getHttpServer(), this.renderer, serverInfo.baseUrl);
    }

    return serverInfo.baseUrl;
  }

  public async stop(): Promise<void> {
    this.watcher?.dispose();
    this.watcher = undefined;
    await this.server.stop();
  }

  public dispose(): void {
    void this.stop();
    this.renderer.dispose();
    this.server.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const runtime = new MirrorRuntime();
  const getAutoOpenMode = (): AutoOpenMode => {
    return vscode.workspace.getConfiguration("markdownMirror").get<AutoOpenMode>("autoOpenMode", "firstRun");
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
    if (await shouldOpenBrowser(manualStart)) {
      void vscode.env.openExternal(vscode.Uri.parse(baseUrl));
    }

    if (manualStart) {
      void vscode.window.showInformationMessage(`Markdown Mirror started at ${baseUrl}`);
    }
  };

  context.subscriptions.push(
    runtime,
    vscode.commands.registerCommand("markdownMirror.start", async () => {
      await startRuntime(true);
    }),
    vscode.commands.registerCommand("markdownMirror.stop", async () => {
      await runtime.stop();
      void vscode.window.showInformationMessage("Markdown Mirror stopped.");
    })
  );

  void autoStart(runtime, startRuntime);
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
