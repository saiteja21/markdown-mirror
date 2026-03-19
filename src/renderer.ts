import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";

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

    this.defaultFenceRule = this.md.renderer.rules.fence ?? ((tokens, idx, options, _env, self) => {
      return self.renderToken(tokens, idx, options);
    });

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
    const env = {
      documentUri: request.documentUri,
      assetBaseUrl: request.assetBaseUrl
    };

    const tokens = this.md.parse(request.markdown, env);
    this.rewriteImageSources(tokens, request.documentUri, request.assetBaseUrl);
    const rawHtml = this.md.renderer.render(tokens, this.md.options, env);
    return this.applyHtmlMode(rawHtml);
  }

  public dispose(): void {
    // No unmanaged resources to release currently.
  }

  private rewriteImageSources(tokens: MarkdownIt.Token[], documentUri: vscode.Uri, assetBaseUrl: string): void {
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
    if (mode === "trusted") {
      return html;
    }

    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "h1",
        "h2",
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
        "summary"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["class", "id", "title", "aria-label"],
        a: ["href", "name", "target", "rel"],
        img: ["src", "alt", "title", "width", "height"],
        code: ["class"],
        div: ["class"],
        span: ["class"]
      },
      allowedSchemes: ["http", "https", "mailto", "data"],
      transformTags: {
        a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true)
      }
    });
  }
}
