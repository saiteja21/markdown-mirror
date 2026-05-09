import * as path from "path";
import * as vscode from "vscode";

export type FindingKind = "style" | "structure" | "link" | "accessibility";

export interface QualityFinding {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  kind: FindingKind;
}

export interface DocumentMetrics {
  words: number;
  characters: number;
  readingMinutes: number;
  fleschReadingEase: number;
}

export interface HeadingEntry {
  line: number;
  level: number;
  text: string;
  id: string;
}

export interface LinkEntry {
  line: number;
  target: string;
  normalizedTarget: string;
  isWikiLink: boolean;
}

export interface DocumentAudit {
  uri: vscode.Uri;
  relativePath: string;
  findings: QualityFinding[];
  headings: HeadingEntry[];
  links: LinkEntry[];
  metrics: DocumentMetrics;
}

export interface BacklinkEntry {
  sourceUri: vscode.Uri;
  sourceRelativePath: string;
  line: number;
  excerpt: string;
}

export interface WorkspaceAuditSummary {
  documents: DocumentAudit[];
  totalFindings: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface DocumentContext {
  uri: vscode.Uri;
  relativePath: string;
  markdown: string;
}

interface ValidationContext {
  currentRelativePath: string;
  existingRelativeMarkdownPaths: Set<string>;
  headingIds: Set<string>;
}

export function extractHeadings(markdown: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const slugCounts = new Map<string, number>();
  const lines = markdown.split(/\r?\n/);
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

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const rawText = match[2].replace(/\s+#+\s*$/, "").trim();
    if (!rawText) {
      continue;
    }

    const text = cleanHeadingText(rawText);
    const slugBase = slugify(text);
    const count = slugCounts.get(slugBase) ?? 0;
    slugCounts.set(slugBase, count + 1);
    const id = count === 0 ? slugBase : `${slugBase}-${count}`;

    headings.push({ line: i + 1, level, text, id });
  }

  return headings;
}

export function extractLinks(markdown: string, relativePath: string): LinkEntry[] {
  const links: LinkEntry[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const match of line.matchAll(/(!?)\[[^\]]+\]\(([^)]+)\)/g)) {
      const isImage = match[1] === "!";
      if (isImage) {
        continue;
      }

      const rawTarget = (match[2] || "").trim();
      if (!rawTarget || rawTarget.startsWith("http://") || rawTarget.startsWith("https://") || rawTarget.startsWith("mailto:")) {
        continue;
      }

      links.push({
        line: i + 1,
        target: rawTarget,
        normalizedTarget: normalizeLinkTarget(rawTarget, relativePath),
        isWikiLink: false
      });
    }

    for (const match of line.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/g)) {
      const rawDoc = (match[1] || "").trim();
      const rawAnchor = (match[2] || "").trim();
      const target = rawAnchor ? `${rawDoc}#${rawAnchor}` : rawDoc;
      links.push({
        line: i + 1,
        target,
        normalizedTarget: normalizeWikiLinkTarget(rawDoc, rawAnchor, relativePath),
        isWikiLink: true
      });
    }
  }

  return links;
}

export function computeMetrics(markdown: string): DocumentMetrics {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~\[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = plain.length > 0 ? plain.split(/\s+/).length : 0;
  const characters = plain.replace(/\s+/g, "").length;
  const sentences = Math.max(1, (plain.match(/[.!?]+/g) || []).length);
  const syllables = countSyllables(plain);
  const readingMinutes = Math.max(1, Math.ceil(words / 225));

  const fleschReadingEase = Number((206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / Math.max(words, 1))).toFixed(1));

  return {
    words,
    characters,
    readingMinutes,
    fleschReadingEase
  };
}

export function auditDocument(
  context: DocumentContext,
  existingRelativeMarkdownPaths: Set<string>,
  maxLineLength: number
): DocumentAudit {
  const findings: QualityFinding[] = [];
  const headings = extractHeadings(context.markdown);
  const headingIds = new Set(headings.map((heading) => heading.id));
  const links = extractLinks(context.markdown, context.relativePath);

  const validationContext: ValidationContext = {
    currentRelativePath: context.relativePath,
    existingRelativeMarkdownPaths,
    headingIds
  };

  addHeadingStructureFindings(findings, headings);
  addLineLengthFindings(findings, context.markdown, maxLineLength);
  addAccessibilityFindings(findings, context.markdown);
  addLinkFindings(findings, links, validationContext);

  return {
    uri: context.uri,
    relativePath: context.relativePath,
    findings,
    headings,
    links,
    metrics: computeMetrics(context.markdown)
  };
}

export async function runWorkspaceAudit(maxLineLength: number): Promise<WorkspaceAuditSummary> {
  const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**", 5000);
  const pathSet = new Set<string>();
  const relativePaths = new Map<string, vscode.Uri>();

  for (const uri of files) {
    const relativePath = toWorkspaceRelative(uri);
    if (relativePath) {
      pathSet.add(relativePath);
      relativePaths.set(relativePath, uri);
    }
  }

  const documents: DocumentAudit[] = [];
  const batchSize = 50;
  const entries = Array.from(relativePaths.entries());

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async ([relativePath, uri]) => {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const markdown = new TextDecoder("utf-8").decode(bytes);
        return auditDocument({ uri, relativePath, markdown }, pathSet, maxLineLength);
      } catch {
        return undefined;
      }
    }));

    for (const result of results) {
      if (result) {
        documents.push(result);
      }
    }
  }

  const totalFindings = documents.reduce((sum, item) => sum + item.findings.length, 0);
  const errorCount = documents.reduce((sum, item) => sum + item.findings.filter((finding) => finding.severity === "error").length, 0);
  const warningCount = documents.reduce((sum, item) => sum + item.findings.filter((finding) => finding.severity === "warning").length, 0);
  const infoCount = documents.reduce((sum, item) => sum + item.findings.filter((finding) => finding.severity === "info").length, 0);

  return {
    documents,
    totalFindings,
    errorCount,
    warningCount,
    infoCount
  };
}

export async function findBacklinks(targetUri: vscode.Uri): Promise<BacklinkEntry[]> {
  const targetRelativePath = toWorkspaceRelative(targetUri);
  if (!targetRelativePath) {
    return [];
  }

  const targetNoExt = targetRelativePath.replace(/\.md$/i, "");
  const targetBasename = path.posix.basename(targetNoExt);
  const files = await vscode.workspace.findFiles("**/*.md", "**/{node_modules,.git}/**");
  const backlinks: BacklinkEntry[] = [];

  for (const sourceUri of files) {
    if (sourceUri.toString() === targetUri.toString()) {
      continue;
    }

    const sourceRelativePath = toWorkspaceRelative(sourceUri);
    if (!sourceRelativePath) {
      continue;
    }

    const bytes = await vscode.workspace.fs.readFile(sourceUri);
    const markdown = new TextDecoder("utf-8").decode(bytes);
    const links = extractLinks(markdown, sourceRelativePath);

    for (const link of links) {
      const normalized = link.normalizedTarget.split("#")[0];
      if (normalized === targetRelativePath || normalized === `${targetNoExt}.md` || normalized.endsWith(`/${targetBasename}.md`)) {
        const sourceLine = markdown.split(/\r?\n/)[link.line - 1] || "";
        backlinks.push({
          sourceUri,
          sourceRelativePath,
          line: link.line,
          excerpt: sourceLine.trim().slice(0, 200)
        });
      }
    }
  }

  return backlinks;
}

export function toWorkspaceRelative(uri: vscode.Uri): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return undefined;
  }

  const relative = path.relative(folder.uri.fsPath, uri.fsPath);
  if (!relative || relative.startsWith("..")) {
    return undefined;
  }

  const rootPrefix = (vscode.workspace.workspaceFolders ?? []).length > 1 ? `${folder.name}/${relative}` : relative;
  return rootPrefix.split(path.sep).join("/");
}

export function renderAuditReport(summary: WorkspaceAuditSummary): string {
  const lines: string[] = [];
  lines.push("# Mirror Quality Report");
  lines.push("");
  lines.push(`Documents scanned: ${summary.documents.length}`);
  lines.push(`Findings: ${summary.totalFindings} (errors: ${summary.errorCount}, warnings: ${summary.warningCount}, info: ${summary.infoCount})`);
  lines.push("");

  for (const doc of summary.documents) {
    lines.push(`## ${doc.relativePath}`);
    lines.push(`- Metrics: ${doc.metrics.words} words, ${doc.metrics.characters} chars, ${doc.metrics.readingMinutes} min read, Flesch ${doc.metrics.fleschReadingEase}`);

    if (doc.findings.length === 0) {
      lines.push("- No findings.");
      lines.push("");
      continue;
    }

    for (const finding of doc.findings) {
      lines.push(`- [${finding.severity}] L${finding.line} ${finding.code}: ${finding.message}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function addHeadingStructureFindings(findings: QualityFinding[], headings: HeadingEntry[]): void {
  const seen = new Set<string>();

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const key = heading.text.toLowerCase();

    if (seen.has(key)) {
      findings.push({
        code: "duplicate-heading",
        message: `Duplicate heading text: \"${heading.text}\".`,
        severity: "warning",
        line: heading.line,
        kind: "structure"
      });
    }

    seen.add(key);

    const previous = headings[i - 1];
    if (previous && heading.level - previous.level > 1) {
      findings.push({
        code: "heading-level-jump",
        message: `Heading level jumps from H${previous.level} to H${heading.level}.`,
        severity: "warning",
        line: heading.line,
        kind: "structure"
      });
    }
  }
}

function addLineLengthFindings(findings: QualityFinding[], markdown: string, maxLineLength: number): void {
  if (maxLineLength <= 0) {
    return;
  }

  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const length = lines[i].length;
    if (length <= maxLineLength) {
      continue;
    }

    findings.push({
      code: "line-too-long",
      message: `Line has ${length} characters (limit: ${maxLineLength}).`,
      severity: "info",
      line: i + 1,
      kind: "style"
    });
  }
}

function addAccessibilityFindings(findings: QualityFinding[], markdown: string): void {
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const image of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      const alt = (image[1] || "").trim();
      if (alt.length > 0) {
        continue;
      }

      findings.push({
        code: "missing-image-alt",
        message: "Image is missing alt text.",
        severity: "warning",
        line: i + 1,
        kind: "accessibility"
      });
    }
  }
}

function addLinkFindings(findings: QualityFinding[], links: LinkEntry[], context: ValidationContext): void {
  for (const link of links) {
    if (link.target.startsWith("#")) {
      const anchor = slugify(link.target.slice(1));
      if (!context.headingIds.has(anchor)) {
        findings.push({
          code: "missing-anchor",
          message: `Anchor target not found: ${link.target}`,
          severity: "error",
          line: link.line,
          kind: "link"
        });
      }
      continue;
    }

    const [pathPart, anchorPart] = link.normalizedTarget.split("#");
    if (pathPart.length > 0) {
      // Only validate links that resolve to .md files
      const lowerPath = pathPart.toLowerCase();
      if (lowerPath.endsWith(".md") && !context.existingRelativeMarkdownPaths.has(pathPart)) {
        findings.push({
          code: "missing-doc-link",
          message: `Linked markdown document not found: ${link.target}`,
          severity: "error",
          line: link.line,
          kind: "link"
        });
      }
      continue;
    }

    if (!anchorPart) {
      continue;
    }
  }
}

function normalizeLinkTarget(target: string, currentRelativePath: string): string {
  const withoutQuery = target.split("?")[0].trim();
  const [pathPart, anchor = ""] = withoutQuery.split("#");

  if (!pathPart) {
    return anchor ? `#${slugify(anchor)}` : "";
  }

  if (pathPart.startsWith("/")) {
    const normalized = path.posix.normalize(pathPart).replace(/^\//, "");
    const withExt = normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
    return anchor ? `${withExt}#${slugify(anchor)}` : withExt;
  }

  const fromDir = path.posix.dirname(currentRelativePath);
  const normalized = path.posix.normalize(path.posix.join(fromDir, pathPart));
  const withExt = normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
  return anchor ? `${withExt}#${slugify(anchor)}` : withExt;
}

function normalizeWikiLinkTarget(rawDoc: string, rawAnchor: string, currentRelativePath: string): string {
  const docPath = rawDoc.replace(/\\/g, "/").trim();
  const fromDir = path.posix.dirname(currentRelativePath);
  const normalized = path.posix.normalize(path.posix.join(fromDir, docPath));
  const withExt = normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
  return rawAnchor ? `${withExt}#${slugify(rawAnchor)}` : withExt;
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

function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let total = 0;

  for (const wordRaw of words) {
    let word = wordRaw;
    if (word.length <= 3) {
      total += 1;
      continue;
    }

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    const groups = word.match(/[aeiouy]{1,2}/g);
    total += groups ? groups.length : 1;
  }

  return Math.max(total, 1);
}
