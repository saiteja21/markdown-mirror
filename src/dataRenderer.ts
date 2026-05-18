import * as path from "path";
import * as yaml from "js-yaml";
import hljs from "highlight.js";
import { XMLParser } from "fast-xml-parser";

export type DataFileType = "yaml" | "json" | "xml" | "unknown";

const DATA_EXTENSIONS: Record<string, DataFileType> = {
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".jsonc": "json",
  ".xml": "xml"
};

export function getDataFileType(filePath: string): DataFileType {
  const ext = path.extname(filePath).toLowerCase();
  return DATA_EXTENSIONS[ext] ?? "unknown";
}

export function isDataFile(filePath: string): boolean {
  return getDataFileType(filePath) !== "unknown";
}

export function renderDataFile(content: string, filePath: string): string {
  const fileType = getDataFileType(filePath);
  if (fileType === "unknown") {
    return `<pre><code>${escapeHtml(content)}</code></pre>`;
  }

  const fileName = path.basename(filePath);
  let parsed: unknown;
  let parseError: string | undefined;

  try {
    if (fileType === "yaml") {
      parsed = yaml.load(content);
    } else if (fileType === "xml") {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        preserveOrder: false
      });
      parsed = parser.parse(content);
    } else {
      parsed = parseJsonLenient(content);
    }
  } catch (err) {
    parseError = err instanceof Error ? err.message : "Failed to parse file.";
  }

  // Check if it's an OpenAPI spec
  if (!parseError && parsed && typeof parsed === "object" && isOpenApiSpec(parsed)) {
    return renderOpenApiSpec(parsed as Record<string, unknown>, content, fileType, fileName);
  }

  const treeHtml = parseError
    ? `<div class="data-parse-error">${escapeHtml(parseError)}</div>`
    : renderTree(parsed, 0, fileType === "xml");

  const highlightLang = fileType === "yaml" ? "yaml" : fileType === "xml" ? "xml" : "json";
  let highlightedSource: string;
  if (hljs.getLanguage(highlightLang)) {
    highlightedSource = hljs.highlight(content, { language: highlightLang, ignoreIllegals: true }).value;
  } else {
    highlightedSource = escapeHtml(content);
  }

  const sourceHtml = `<pre class="data-source-code"><code class="hljs language-${highlightLang}">${highlightedSource}</code></pre>`;

  return `
<div class="data-file-viewer" data-file-type="${fileType}">
  <div class="data-file-header">
    <span class="data-file-name">${escapeHtml(fileName)}</span>
    <span class="data-file-badge">${fileType.toUpperCase()}</span>
    <div class="data-view-toggle">
      <button class="data-view-btn active" data-view="tree" title="Tree View">Tree</button>
      <button class="data-view-btn" data-view="source" title="Source View">Source</button>
    </div>
  </div>
  <div class="data-view-panel data-tree-panel active">${treeHtml}</div>
  <div class="data-view-panel data-source-panel">${sourceHtml}</div>
</div>`;
}

function renderTree(value: unknown, depth: number = 0, xmlMode: boolean = false): string {
  if (value === null || value === undefined) {
    return `<span class="data-value data-null">null</span>`;
  }

  if (typeof value === "boolean") {
    return `<span class="data-value data-boolean">${value}</span>`;
  }

  if (typeof value === "number") {
    return `<span class="data-value data-number">${value}</span>`;
  }

  if (typeof value === "string") {
    // Long strings get truncated in tree view with a tooltip
    const display = value.length > 120 ? escapeHtml(value.slice(0, 120)) + "…" : escapeHtml(value);
    return `<span class="data-value data-string">"${display}"</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<span class="data-value data-empty">[ ]</span>`;
    }
    const items = value.map((item, index) => {
      const childHtml = renderTree(item, depth + 1, xmlMode);
      const isExpandable = typeof item === "object" && item !== null;
      return `<li class="data-node${isExpandable ? " data-expandable" : ""}">
        <span class="data-key data-index">[${index}]</span>: ${childHtml}
      </li>`;
    }).join("");
    const countLabel = value.length === 1 ? "1 item" : `${value.length} items`;
    return `<span class="data-bracket">[${countLabel}]</span>
      <ul class="data-tree-list">${items}</ul>`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return `<span class="data-value data-empty">{ }</span>`;
    }
    const items = entries.map(([key, val]) => {
      const childHtml = renderTree(val, depth + 1, xmlMode);
      const isExpandable = typeof val === "object" && val !== null;
      const isAttr = xmlMode && key.startsWith("@_");
      if (isAttr) {
        return `<li class="data-node data-attr-node">
          <span class="data-xml-attr">${escapeHtml(key.slice(2))}</span> = <span class="data-value data-string">"${escapeHtml(String(val))}"</span>
        </li>`;
      }
      return `<li class="data-node${isExpandable ? " data-expandable" : ""}">
        <span class="data-key">${escapeHtml(key)}</span>: ${childHtml}
      </li>`;
    }).join("");
    const countLabel = entries.length === 1 ? "1 property" : `${entries.length} properties`;
    return `<span class="data-bracket">{${countLabel}}</span>
      <ul class="data-tree-list">${items}</ul>`;
  }

  return `<span class="data-value">${escapeHtml(String(value))}</span>`;
}

function isOpenApiSpec(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const version = String(obj.openapi ?? "");
  return /^3\.\d+\.\d+$/.test(version);
}

function renderOpenApiSpec(spec: Record<string, unknown>, rawContent: string, fileType: DataFileType, fileName: string): string {
  const info = (spec.info ?? {}) as Record<string, unknown>;
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
  const servers = (spec.servers ?? []) as Record<string, unknown>[];

  let html = '<div class="mm-openapi">';

  // Header
  html += '<div class="mm-openapi-header">';
  html += `<h1 class="mm-openapi-title">${escapeHtml(String(info.title ?? "API Documentation"))}</h1>`;
  if (info.version) {
    html += `<span class="mm-openapi-version">v${escapeHtml(String(info.version))}</span>`;
  }
  if (info.description) {
    html += `<p class="mm-openapi-desc">${escapeHtml(String(info.description))}</p>`;
  }
  html += '</div>';

  // Servers
  if (servers.length > 0) {
    html += '<div class="mm-openapi-section"><h2>Servers</h2><ul class="mm-openapi-servers">';
    for (const server of servers) {
      html += `<li><code>${escapeHtml(String(server.url ?? ""))}</code>`;
      if (server.description) html += ` — ${escapeHtml(String(server.description))}`;
      html += '</li>';
    }
    html += '</ul></div>';
  }

  // Paths
  if (Object.keys(paths).length > 0) {
    html += '<div class="mm-openapi-section"><h2>Endpoints</h2>';

    for (const [pathStr, methods] of Object.entries(paths)) {
      if (!methods || typeof methods !== "object") continue;

      for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
        if (["get", "post", "put", "patch", "delete", "options", "head"].indexOf(method.toLowerCase()) === -1) continue;

        const op = (operation ?? {}) as Record<string, unknown>;
        const methodUpper = method.toUpperCase();
        const methodClass = `mm-method-${method.toLowerCase()}`;

        html += `<div class="mm-openapi-endpoint">`;
        html += `<div class="mm-openapi-endpoint-header">`;
        html += `<span class="mm-openapi-method ${methodClass}">${methodUpper}</span>`;
        html += `<code class="mm-openapi-path">${escapeHtml(pathStr)}</code>`;
        if (op.summary) html += `<span class="mm-openapi-summary">${escapeHtml(String(op.summary))}</span>`;
        html += `</div>`;

        if (op.description) {
          html += `<p class="mm-openapi-op-desc">${escapeHtml(String(op.description))}</p>`;
        }

        // Parameters
        const params = (op.parameters ?? []) as Record<string, unknown>[];
        if (params.length > 0) {
          html += '<div class="mm-openapi-params"><h4>Parameters</h4>';
          html += '<table class="mm-openapi-params-table"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>';
          for (const param of params) {
            const schema = (param.schema ?? {}) as Record<string, unknown>;
            html += '<tr>';
            html += `<td><code>${escapeHtml(String(param.name ?? ""))}</code></td>`;
            html += `<td>${escapeHtml(String(param.in ?? ""))}</td>`;
            html += `<td>${escapeHtml(String(schema.type ?? ""))}</td>`;
            html += `<td>${param.required ? "✓" : ""}</td>`;
            html += `<td>${escapeHtml(String(param.description ?? ""))}</td>`;
            html += '</tr>';
          }
          html += '</tbody></table></div>';
        }

        // Responses
        const responses = (op.responses ?? {}) as Record<string, unknown>;
        if (Object.keys(responses).length > 0) {
          html += '<div class="mm-openapi-responses"><h4>Responses</h4>';
          for (const [code, resp] of Object.entries(responses)) {
            const respObj = (resp ?? {}) as Record<string, unknown>;
            const statusClass = code.startsWith("2") ? "mm-status-success" : code.startsWith("4") || code.startsWith("5") ? "mm-status-error" : "mm-status-info";
            html += `<div class="mm-openapi-response">`;
            html += `<span class="mm-openapi-status ${statusClass}">${escapeHtml(code)}</span>`;
            html += `<span>${escapeHtml(String(respObj.description ?? ""))}</span>`;

            // Show response schema if present
            const respContent = (respObj.content ?? {}) as Record<string, unknown>;
            for (const [mediaType, mediaObj] of Object.entries(respContent)) {
              const mediaData = (mediaObj ?? {}) as Record<string, unknown>;
              if (mediaData.schema) {
                html += `<div class="mm-openapi-schema"><code>${escapeHtml(mediaType)}</code>`;
                html += `<pre>${escapeHtml(JSON.stringify(mediaData.schema, null, 2))}</pre>`;
                html += '</div>';
              }
            }

            html += '</div>';
          }
          html += '</div>';
        }

        // Tags
        const tags = (op.tags ?? []) as string[];
        if (tags.length > 0) {
          html += '<div class="mm-openapi-tags">';
          tags.forEach(function(tag) {
            html += `<span class="mm-openapi-tag">${escapeHtml(String(tag))}</span>`;
          });
          html += '</div>';
        }

        html += '</div>'; // endpoint
      }
    }

    html += '</div>'; // section
  }

  // Components/Schemas
  const components = (spec.components ?? {}) as Record<string, unknown>;
  const schemas = (components.schemas ?? {}) as Record<string, unknown>;
  if (Object.keys(schemas).length > 0) {
    html += '<div class="mm-openapi-section"><h2>Schemas</h2>';
    for (const [name, schema] of Object.entries(schemas)) {
      html += `<div class="mm-openapi-schema-def">`;
      html += `<h3><code>${escapeHtml(name)}</code></h3>`;
      html += `<pre>${escapeHtml(JSON.stringify(schema, null, 2))}</pre>`;
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>'; // mm-openapi

  // Source view toggle (reuses existing pattern)
  const highlightLang = fileType === "yaml" ? "yaml" : "json";
  let sourceHtml: string;
  if (hljs.getLanguage(highlightLang)) {
    sourceHtml = hljs.highlight(rawContent, { language: highlightLang, ignoreIllegals: true }).value;
  } else {
    sourceHtml = escapeHtml(rawContent);
  }

  return `
<div class="data-file-viewer" data-file-type="${fileType}">
  <div class="data-file-header">
    <span class="data-file-name">${escapeHtml(fileName)}</span>
    <span class="data-file-badge">OpenAPI</span>
    <div class="data-view-toggle">
      <button class="data-view-btn active" data-view="tree" title="API View">🔌 API</button>
      <button class="data-view-btn" data-view="source" title="Source View">&lt;/&gt; Source</button>
    </div>
  </div>
  <div class="data-view-panel data-tree-panel active">${html}</div>
  <div class="data-view-panel data-source-panel">
    <pre><code class="hljs language-${highlightLang}">${sourceHtml}</code></pre>
  </div>
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Parse JSON leniently — strips single/multi-line comments and trailing commas
 * so JSONC files (e.g. VS Code settings, mcp.json, tsconfig) render correctly.
 */
function parseJsonLenient(text: string): unknown {
  // Remove single-line comments (// ...) and multi-line comments (/* ... */)
  // while preserving strings that might contain // or /*
  let result = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (ch === "\\" && i + 1 < text.length) {
        result += text[++i];
      } else if (ch === '"') {
        inString = false;
      }
      i++;
    } else if (ch === '"') {
      inString = true;
      result += ch;
      i++;
    } else if (ch === "/" && i + 1 < text.length && text[i + 1] === "/") {
      // Skip single-line comment
      i += 2;
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && i + 1 < text.length && text[i + 1] === "*") {
      // Skip multi-line comment
      i += 2;
      while (i < text.length && !(text[i] === "*" && i + 1 < text.length && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      result += ch;
      i++;
    }
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(result);
}
