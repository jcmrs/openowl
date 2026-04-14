import * as fs from "node:fs";
import * as path from "node:path";
import { extractDescription, capDescription } from "./description-extractor.js";
import { readJSON } from "../utils/fs-safe.js";
import { writeText } from "../utils/fs-safe.js";
import { normalizePath } from "../utils/paths.js";

interface AnatomyEntry {
  file: string;
  description: string;
  tokens: number;
}

interface OwlConfig {
  version: number;
  openowl: {
    anatomy: {
      max_description_length: number;
      max_files: number;
      exclude_patterns: string[];
    };
    token_audit: {
      chars_per_token_code: number;
      chars_per_token_prose: number;
    };
  };
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".mp3", ".mp4", ".avi", ".mov", ".webm", ".ogg",
  ".sqlite", ".db",
  ".wasm",
  ".lock",
]);

const CODE_EXTENSIONS = new Set([
  ".ts", ".js", ".tsx", ".jsx", ".py", ".rs", ".go", ".java",
  ".c", ".cpp", ".h", ".css", ".scss", ".sql", ".sh", ".yaml",
  ".yml", ".json", ".toml", ".xml",
]);

const PROSE_EXTENSIONS = new Set([".md", ".txt", ".rst", ".adoc"]);

function estimateTokens(text: string, filePath: string, config?: OwlConfig): number {
  const ext = path.extname(filePath).toLowerCase();
  let ratio = config?.openowl?.token_audit?.chars_per_token_code
    ? (config.openowl.token_audit.chars_per_token_code + config.openowl.token_audit.chars_per_token_prose) / 2
    : 3.4;
  if (CODE_EXTENSIONS.has(ext)) ratio = config?.openowl?.token_audit?.chars_per_token_code ?? 3.0;
  if (PROSE_EXTENSIONS.has(ext)) ratio = config?.openowl?.token_audit?.chars_per_token_prose ?? 3.8;
  return Math.ceil(text.length / ratio);
}

const ALWAYS_EXCLUDE_FILES = new Set([".env", ".env.local", ".env.production", ".env.staging", ".env.development"]);

function shouldExclude(
  relPath: string,
  excludePatterns: string[]
): boolean {
  const parts = relPath.split("/");
  const basename = parts[parts.length - 1];

  if (ALWAYS_EXCLUDE_FILES.has(basename)) return true;
  if (basename.startsWith(".env.") || basename === ".env") return true;

  for (const pattern of excludePatterns) {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (relPath.endsWith(ext)) return true;
    } else {
      if (parts.includes(pattern)) return true;
    }
  }
  return false;
}

function walkDir(
  dir: string,
  rootDir: string,
  excludePatterns: string[],
  maxFiles: number,
  entries: Map<string, AnatomyEntry[]>
): void {
  let totalFiles = 0;
  for (const [, list] of entries) totalFiles += list.length;
  if (totalFiles >= maxFiles) return;

  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = normalizePath(path.relative(rootDir, fullPath));

    if (shouldExclude(relPath, excludePatterns)) continue;

    if (item.isDirectory()) {
      walkDir(fullPath, rootDir, excludePatterns, maxFiles, entries);
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;

      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 1024 * 1024) continue;
      } catch {
        continue;
      }

      let content: string;
      try {
        content = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const desc = capDescription(extractDescription(fullPath));
      const tokens = estimateTokens(content, fullPath);
      const section = normalizePath(path.relative(rootDir, dir)) || ".";
      const sectionKey = section === "." ? "./" : section + "/";

      if (!entries.has(sectionKey)) {
        entries.set(sectionKey, []);
      }

      entries.get(sectionKey)!.push({
        file: item.name,
        description: desc,
        tokens,
      });

      totalFiles++;
      if (totalFiles >= maxFiles) return;
    }
  }
}

export function serializeAnatomy(
  sections: Map<string, AnatomyEntry[]>,
  metadata: { lastScanned: string; fileCount: number; hits: number; misses: number }
): string {
  const lines: string[] = [
    "# anatomy.md",
    "",
    `> Auto-maintained by OpenOwl. Last scanned: ${metadata.lastScanned}`,
    `> Files: ${metadata.fileCount} tracked | Anatomy hits: ${metadata.hits} | Misses: ${metadata.misses}`,
    "",
  ];

  const sortedKeys = [...sections.keys()].sort();

  for (const key of sortedKeys) {
    lines.push(`## ${key}`);
    lines.push("");
    const entries = sections.get(key)!;
    entries.sort((a, b) => a.file.localeCompare(b.file));
    for (const entry of entries) {
      const desc = entry.description ? ` — ${entry.description}` : "";
      lines.push(`- \`${entry.file}\`${desc} (~${entry.tokens} tok)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function parseAnatomy(content: string): Map<string, AnatomyEntry[]> {
  const sections = new Map<string, AnatomyEntry[]>();
  let currentSection = "";

  for (const line of content.split("\n")) {
    const sectionMatch = line.match(/^## (.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    if (!currentSection) continue;

    const entryMatch = line.match(/^- `([^`]+)`(?:\s+—\s+(.+?))?\s*\(~(\d+)\s+tok\)$/);
    if (entryMatch) {
      sections.get(currentSection)!.push({
        file: entryMatch[1],
        description: entryMatch[2] || "",
        tokens: parseInt(entryMatch[3], 10),
      });
    }
  }

  return sections;
}

export function buildAnatomy(owlDir: string, projectRoot: string): { content: string; fileCount: number } {
  const configPath = path.join(owlDir, "config.json");
  const config = readJSON<OwlConfig>(configPath, {
    version: 1,
    openowl: {
      anatomy: {
        max_description_length: 100,
        max_files: 500,
        exclude_patterns: ["node_modules", ".git", "dist", "build", ".owl"],
      },
      token_audit: { chars_per_token_code: 3.0, chars_per_token_prose: 3.8 },
    },
  });

  const entries = new Map<string, AnatomyEntry[]>();
  walkDir(
    projectRoot,
    projectRoot,
    config.openowl.anatomy.exclude_patterns,
    config.openowl.anatomy.max_files,
    entries
  );

  let fileCount = 0;
  for (const [, list] of entries) fileCount += list.length;

  const serialized = serializeAnatomy(entries, {
    lastScanned: new Date().toISOString(),
    fileCount,
    hits: 0,
    misses: 0,
  });

  return { content: serialized, fileCount };
}

export function scanProject(owlDir: string, projectRoot: string): number {
  const { content, fileCount } = buildAnatomy(owlDir, projectRoot);
  const anatomyPath = path.join(owlDir, "anatomy.md");
  writeText(anatomyPath, content);
  return fileCount;
}

export function updateAnatomyEntry(
  owlDir: string,
  filePath: string,
  projectRoot: string,
  action: "upsert" | "delete"
): void {
  const anatomyPath = path.join(owlDir, "anatomy.md");
  let content: string;
  try {
    content = fs.readFileSync(anatomyPath, "utf-8");
  } catch {
    content = "# anatomy.md\n\n> Auto-maintained by OpenOwl.\n";
  }

  const sections = parseAnatomy(content);
  const relPath = normalizePath(path.relative(projectRoot, filePath));
  const dir = path.dirname(relPath);
  const fileName = path.basename(relPath);
  const sectionKey = dir === "." ? "./" : dir + "/";

  if (action === "delete") {
    const entries = sections.get(sectionKey);
    if (entries) {
      const idx = entries.findIndex((e) => e.file === fileName);
      if (idx !== -1) entries.splice(idx, 1);
      if (entries.length === 0) sections.delete(sectionKey);
    }
  } else {
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const desc = capDescription(extractDescription(filePath));
    const tokens = estimateTokens(fileContent, filePath);
    const entry: AnatomyEntry = { file: fileName, description: desc, tokens };

    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, []);
    }
    const entries = sections.get(sectionKey)!;
    const idx = entries.findIndex((e) => e.file === fileName);
    if (idx !== -1) {
      entries[idx] = entry;
    } else {
      entries.push(entry);
    }
  }

  let fileCount = 0;
  for (const [, list] of sections) fileCount += list.length;

  const serialized = serializeAnatomy(sections, {
    lastScanned: new Date().toISOString(),
    fileCount,
    hits: 0,
    misses: 0,
  });

  writeText(anatomyPath, serialized);
}
