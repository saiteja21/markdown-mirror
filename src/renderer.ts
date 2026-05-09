import * as vscode from "vscode";
import * as path from "path";
import * as fsPromises from "fs/promises";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";
import matter from "gray-matter";
import markdownItTaskLists from "markdown-it-task-lists";

export interface RenderRequest {
  markdown: string;
  documentUri: vscode.Uri;
  assetBaseUrl: string;
  embedImages?: boolean;
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

      const next = tokens[idx + 1];
      if (next?.type === "inline" && next.content) {
        const base = this.slugifyHeading(next.content);
        const counts = this.getHeadingSlugMap(env);
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        token.attrSet("id", count === 0 ? base : `${base}-${count}`);
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
    const markdown = this.normalizeWikiLinks(this.normalizeCallouts(this.normalizeAzureDevOpsMermaidContainers(parsed.content)));
    const env = {
      documentUri: request.documentUri,
      assetBaseUrl: request.assetBaseUrl,
      headingSlugCounts: new Map<string, number>()
    };

    const tokens = this.md.parse(markdown, env);
    this.rewriteImageSources(tokens, request.documentUri, request.assetBaseUrl);
    const rawHtml = this.md.renderer.render(tokens, this.md.options, env);
    const frontmatterCard = this.renderFrontmatterCard(parsed.data);
    return this.applyHtmlMode(frontmatterCard + rawHtml);
  }

  public async renderWithEmbeddedImages(request: RenderRequest): Promise<string> {
    const parsed = matter(request.markdown);
    const markdown = this.normalizeWikiLinks(this.normalizeCallouts(this.normalizeAzureDevOpsMermaidContainers(parsed.content)));
    const env = {
      documentUri: request.documentUri,
      assetBaseUrl: request.assetBaseUrl,
      headingSlugCounts: new Map<string, number>()
    };

    const tokens = this.md.parse(markdown, env);
    await this.embedImageSources(tokens, request.documentUri);
    const rawHtml = this.md.renderer.render(tokens, this.md.options, env);
    const frontmatterCard = this.renderFrontmatterCard(parsed.data);
    return this.applyHtmlMode(frontmatterCard + rawHtml);
  }

  public dispose(): void {
    // No unmanaged resources to release currently.
  }

  private static readonly EMBED_MIME: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
    ".ico": "image/x-icon", ".svg": "image/svg+xml"
  };

  private async embedImageSources(tokens: MarkdownIt.Token[], documentUri: vscode.Uri): Promise<void> {
    const docDir = path.dirname(documentUri.fsPath);

    for (const token of tokens) {
      if (token.type === "inline" && token.children) {
        await this.embedImageSources(token.children, documentUri);
        continue;
      }

      if (token.type !== "image") {
        continue;
      }

      const source = token.attrGet("src");
      if (!source || !this.isRelativeAsset(source)) {
        continue;
      }

      try {
        const absolutePath = path.resolve(docDir, source);
        const ext = path.extname(absolutePath).toLowerCase();
        const mime = MarkdownRenderer.EMBED_MIME[ext];
        if (!mime) {
          continue;
        }

        // Skip files larger than 10MB to prevent memory issues
        const stat = await fsPromises.stat(absolutePath);
        if (stat.size > 10 * 1024 * 1024) {
          continue;
        }

        const data = await fsPromises.readFile(absolutePath);
        const base64 = data.toString("base64");
        token.attrSet("src", `data:${mime};base64,${base64}`);
      } catch {
        // File not found — leave src as-is
      }
    }
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
        "*": ["class", "id", "title", "aria-label", "data-source-line"],
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
          const output: Record<string, string> = { ...attribs, rel: "noopener noreferrer", target: "_blank" };
          return { tagName, attribs: output };
        }
      }
    });
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

  private normalizeAzureDevOpsMermaidContainers(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const normalized: string[] = [];
    let insideMermaidContainer = false;

    for (const line of lines) {
      if (!insideMermaidContainer && /^\s*:::\s*mermaid\s*$/i.test(line)) {
        normalized.push("```mermaid");
        insideMermaidContainer = true;
        continue;
      }

      if (insideMermaidContainer && /^\s*:::\s*$/.test(line)) {
        normalized.push("```");
        insideMermaidContainer = false;
        continue;
      }

      normalized.push(line);
    }

    if (insideMermaidContainer) {
      normalized.push("```");
    }

    return normalized.join("\n");
  }

  private normalizeWikiLinks(markdown: string): string {
    return markdown.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_full, targetRaw: string, anchorRaw: string, labelRaw: string) => {
      const target = String(targetRaw || "").trim().replace(/\\/g, "/");
      if (!target) {
        return _full;
      }

      const hrefBase = /\.md$/i.test(target) ? target : `${target}.md`;
      const anchor = String(anchorRaw || "").trim();
      const href = anchor ? `${hrefBase}#${this.slugifyHeading(anchor)}` : hrefBase;
      const label = String(labelRaw || target).trim();
      return `[${label}](${href})`;
    });
  }

  private normalizeCallouts(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const output: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const start = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i);
      if (!start) {
        output.push(line);
        i += 1;
        continue;
      }

      const kind = start[1].toLowerCase();
      const title = start[2]?.trim() || start[1];
      const body: string[] = [];
      i += 1;

      while (i < lines.length) {
        const candidate = lines[i];
        if (!candidate.startsWith(">")) {
          break;
        }

        body.push(candidate.replace(/^>\s?/, ""));
        i += 1;
      }

      output.push(`<div class=\"mm-callout mm-callout-${kind}\">`);
      output.push(`<p class=\"mm-callout-title\">${this.md.utils.escapeHtml(title)}</p>`);
      output.push(body.join("\n"));
      output.push("</div>");
    }

    return output.join("\n");
  }

  private slugifyHeading(value: string): string {
    const normalized = value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    return normalized || "section";
  }

  private getHeadingSlugMap(env: unknown): Map<string, number> {
    const candidate = env as { headingSlugCounts?: Map<string, number> };
    if (!candidate.headingSlugCounts) {
      candidate.headingSlugCounts = new Map<string, number>();
    }

    return candidate.headingSlugCounts;
  }
}
