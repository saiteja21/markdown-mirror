import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";
import matter from "gray-matter";
import markdownItTaskLists from "markdown-it-task-lists";

export interface RenderRequest {
  markdown: string;
  documentUri: vscode.Uri;
  assetBaseUrl: string;
}

export class MarkdownRenderer implements vscode.Disposable {
  private readonly md: MarkdownIt;
  private readonly defaultFenceRule: (...args: any[]) => string;

  public constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: (code: string, language: string) => {
        if (language && hljs.getLanguage(language)) {
          const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
          return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
        }

        const escaped = this.md.utils.escapeHtml(code);
        return `<pre><code class="hljs">${escaped}</code></pre>`;
      }
    });

    this.md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });

    this.defaultFenceRule = this.md.renderer.rules.fence ?? ((tokens, idx, options, _env, self) => {
      return self.renderToken(tokens, idx, options);
    });

    this.md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.map.length > 0) {
        token.attrSet("data-source-line", String(token.map[0] + 1));
      }
      return self.renderToken(tokens, idx, options);
    };

    this.md.renderer.rules.list_item_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.map.length > 0) {
        token.attrSet("data-source-line", String(token.map[0] + 1));
      }
      return self.renderToken(tokens, idx, options);
    };

    this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const info = (token.info || "").trim();
      const language = info.split(/\s+/g)[0]?.toLowerCase() ?? "";
      if (language === "mermaid" && this.isMermaidEnabled()) {
        const diagram = this.md.utils.escapeHtml(token.content);
        return `<div class="mermaid">${diagram}</div>`;
      }

      return this.defaultFenceRule(tokens, idx, options, env, self);
    };
  }

  public render(request: RenderRequest): string {
    const parsed = matter(request.markdown);
    const markdown = parsed.content;
    const env = {
      documentUri: request.documentUri,
      assetBaseUrl: request.assetBaseUrl
    };

    const tokens = this.md.parse(markdown, env);
    this.rewriteImageSources(tokens, request.documentUri, request.assetBaseUrl);
    const rawHtml = this.md.renderer.render(tokens, this.md.options, env);
    const frontmatterCard = this.renderFrontmatterCard(parsed.data);
    return this.applyHtmlMode(frontmatterCard + rawHtml);
  }

  public dispose(): void {
    // No unmanaged resources to release currently.
  }

  private rewriteImageSources(tokens: MarkdownIt.Token[], documentUri: vscode.Uri, assetBaseUrl: string): void {
    const offlineMode = this.isOfflineModeEnabled();

    for (const token of tokens) {
      if (token.type === "inline" && token.children) {
        this.rewriteImageSources(token.children, documentUri, assetBaseUrl);
        continue;
      }

      if (token.type !== "image") {
        continue;
      }

      const source = token.attrGet("src");
      if (!source || !this.isRelativeAsset(source)) {
        if (source && offlineMode && this.isExternalHttpUrl(source)) {
          token.attrSet("src", this.buildOfflineBlockedImageDataUri());
          token.attrSet("title", "Blocked in markdownMirror.offlineMode");
        }
        continue;
      }

      const mapped = this.buildAssetUrl(assetBaseUrl, documentUri, source);
      token.attrSet("src", mapped);
    }
  }

  private buildAssetUrl(assetBaseUrl: string, documentUri: vscode.Uri, source: string): string {
    const trimmedBase = assetBaseUrl.endsWith("/") ? assetBaseUrl.slice(0, -1) : assetBaseUrl;
    const query = `doc=${encodeURIComponent(documentUri.toString())}&src=${encodeURIComponent(source)}`;
    return `${trimmedBase}/asset?${query}`;
  }

  private isRelativeAsset(source: string): boolean {
    if (source.startsWith("#") || source.startsWith("/")) {
      return false;
    }

    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(source)) {
      return false;
    }

    if (/^(?:data:|mailto:|vscode:|file:)/i.test(source)) {
      return false;
    }

    return true;
  }

  private isMermaidEnabled(): boolean {
    return vscode.workspace.getConfiguration("markdownMirror").get<boolean>("enableMermaid", true);
  }

  private applyHtmlMode(html: string): string {
    const mode = vscode.workspace.getConfiguration("markdownMirror").get<string>("htmlMode", "safe");
    const offlineMode = this.isOfflineModeEnabled();
    if (mode === "trusted") {
      if (!offlineMode) {
        return html;
      }

      return sanitizeHtml(html, {
        allowedTags: false,
        allowedAttributes: false,
        transformTags: {
          a: (tagName, attribs) => {
            const output: Record<string, string> = { ...attribs };
            if (output.href && this.isExternalHttpUrl(output.href)) {
              delete output.href;
              output["data-offline-blocked"] = "true";
              output.title = "Blocked in markdownMirror.offlineMode";
            }

            return {
              tagName,
              attribs: output
            };
          },
          img: (tagName, attribs) => {
            const output: Record<string, string> = { ...attribs };
            if (output.src && this.isExternalHttpUrl(output.src)) {
              output.src = this.buildOfflineBlockedImageDataUri();
              output["data-offline-blocked"] = "true";
              output.title = "Blocked in markdownMirror.offlineMode";
            }

            return {
              tagName,
              attribs: output
            };
          }
        }
      });
    }

    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "h1",
        "h2",
        "input",
        "label",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "pre",
        "code",
        "span",
        "div",
        "details",
        "summary",
        "dl",
        "dt",
        "dd"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["class", "id", "title", "aria-label", "data-offline-blocked", "data-source-line"],
        a: ["href", "name", "target", "rel"],
        img: ["src", "alt", "title", "width", "height"],
        code: ["class"],
        div: ["class"],
        span: ["class"],
        input: ["type", "checked", "disabled", "id", "data-source-line"]
      },
      allowedSchemes: ["http", "https", "mailto", "data"],
      transformTags: {
        a: (tagName, attribs) => {
          const output: Record<string, string> = { ...attribs, rel: "noopener noreferrer" };
          if (offlineMode && output.href && this.isExternalHttpUrl(output.href)) {
            delete output.href;
            output["data-offline-blocked"] = "true";
            output.title = "Blocked in markdownMirror.offlineMode";
          }
          return {
            tagName,
            attribs: output
          };
        },
        img: (tagName, attribs) => {
          const output: Record<string, string> = { ...attribs };
          if (offlineMode && output.src && this.isExternalHttpUrl(output.src)) {
            output.src = this.buildOfflineBlockedImageDataUri();
            output["data-offline-blocked"] = "true";
            output.title = "Blocked in markdownMirror.offlineMode";
          }
          return {
            tagName,
            attribs: output
          };
        }
      }
    });
  }

  private isOfflineModeEnabled(): boolean {
    return true;
  }

  private isExternalHttpUrl(value: string): boolean {
    return /^(?:https?:)?\/\//i.test(value);
  }

  private buildOfflineBlockedImageDataUri(): string {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='700' height='140' viewBox='0 0 700 140'><rect width='700' height='140' fill='#f8fafc' stroke='#cbd5e1'/><text x='20' y='78' fill='#334155' font-family='Segoe UI,Arial,sans-serif' font-size='16'>External image blocked in markdownMirror.offlineMode</text></svg>";
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  private renderFrontmatterCard(frontmatterData: Record<string, unknown>): string {
    if (!this.isFrontmatterCardEnabled() || !frontmatterData || Object.keys(frontmatterData).length === 0) {
      return "";
    }

    const rows = Object.entries(frontmatterData)
      .map(([key, value]) => {
        const safeKey = this.md.utils.escapeHtml(key);
        const safeValue = this.md.utils.escapeHtml(this.stringifyFrontmatterValue(value));
        return `<div class="fm-row"><dt>${safeKey}</dt><dd>${safeValue}</dd></div>`;
      })
      .join("");

    return `<details class="frontmatter-card" open><summary>Frontmatter</summary><dl class="fm-grid">${rows}</dl></details>`;
  }

  private stringifyFrontmatterValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(", ");
    }

    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  private isFrontmatterCardEnabled(): boolean {
    const mode = vscode.workspace.getConfiguration("markdownMirror").get<string>("showFrontmatter", "card");
    return mode !== "none";
  }
}
