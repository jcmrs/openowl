import * as path from "node:path";
import { readText, readJSON } from "../../core/utils/fs-safe.js";
import { selectRelevantEntries } from "./relevance.js";

export interface InjectionConfig {
  enabled: boolean;
  max_tokens: number;
  include_project: boolean;
  include_dnr: boolean;
  include_conventions: boolean;
  include_anatomy: boolean;
  include_bugs: boolean;
}

const DEFAULT_CONFIG: InjectionConfig = {
  enabled: true,
  max_tokens: 2500,
  include_project: true,
  include_dnr: true,
  include_conventions: true,
  include_anatomy: true,
  include_bugs: true,
};

interface CerebrumEntry {
  tag: string;
  date: string;
  text: string;
  section: string;
}

interface AnatomyDirectory {
  path: string;
  summary: string;
  files: number;
  tokens: number;
}

interface BugEntry {
  id: string;
  error_message: string;
  file: string;
  fix: string;
  tags: string[];
  occurrences: number;
}

export function buildInjectionContext(
  owlDir: string,
  projectRoot: string,
  config?: Partial<InjectionConfig>
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled) return "";

  const sections: Array<{ priority: number; content: string }> = [];

  if (cfg.include_project) {
    const project = buildProjectSection(owlDir, projectRoot);
    if (project) sections.push({ priority: 0, content: project });
  }

  if (cfg.include_dnr) {
    const dnr = buildDNRSection(owlDir);
    if (dnr) sections.push({ priority: 1, content: dnr });
  }

  if (cfg.include_conventions) {
    const conventions = buildConventionsSection(owlDir);
    if (conventions) sections.push({ priority: 2, content: conventions });
  }

  if (cfg.include_anatomy) {
    const anatomy = buildAnatomySection(owlDir);
    if (anatomy) sections.push({ priority: 3, content: anatomy });
  }

  if (cfg.include_bugs) {
    const bugs = buildBugsSection(owlDir);
    if (bugs) sections.push({ priority: 4, content: bugs });
  }

  sections.sort((a, b) => a.priority - b.priority);

  let block = "<owl-context>\n";
  for (const s of sections) {
    block += s.content + "\n";
  }
  block += "</owl-context>";

  return trimToTokenBudget(block, cfg.max_tokens);
}

function buildProjectSection(owlDir: string, projectRoot: string): string {
  const pkgPath = path.join(projectRoot, "package.json");
  let name = path.basename(projectRoot);
  let description = "";

  try {
    const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf-8"));
    if (pkg.name) name = pkg.name;
    if (pkg.description) description = pkg.description;
  } catch {}

  if (!description) {
    const cerebrum = readText(path.join(owlDir, "cerebrum.md"));
    const m = cerebrum.match(/\*\*Project:\*\*\s*(.+)/);
    if (m) description = m[1].trim();
  }

  let section = `## Project: ${name}\n`;
  if (description) section += `${description}\n`;
  return section;
}

function parseCerebrumEntries(content: string): CerebrumEntry[] {
  const entries: CerebrumEntry[] = [];
  const lines = content.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      currentSection = headingMatch[1].toLowerCase().replace(/\s+/g, "_");
      continue;
    }

    const entryMatch = line.match(/^\s*-\s+\[([^\]]+)\]\s+(\d{4}-\d{2}-\d{2})?\s*[:：]?\s*(.+)/);
    if (entryMatch) {
      entries.push({
        tag: entryMatch[1],
        date: entryMatch[2] || "",
        text: entryMatch[3].trim(),
        section: currentSection,
      });
      continue;
    }

    const legacyMatch = line.match(/^\s*-\s+(.+)/);
    if (legacyMatch && currentSection) {
      entries.push({
        tag: "general",
        date: "",
        text: legacyMatch[1].trim(),
        section: currentSection,
      });
    }
  }

  return entries;
}

function buildDNRSection(owlDir: string): string {
  const content = readText(path.join(owlDir, "cerebrum.md"));
  const entries = parseCerebrumEntries(content);

  const dnrEntries = entries.filter(
    (e) => e.section === "do-not-repeat" || e.section.includes("dnr")
  );

  if (dnrEntries.length === 0) {
    const legacyContent = content;
    const dnrIdx = legacyContent.indexOf("## Do-Not-Repeat");
    if (dnrIdx === -1) return "";

    const dnrSection = legacyContent.slice(dnrIdx);
    const nextHeading = dnrSection.indexOf("\n## ", 1);
    const dnrText = nextHeading === -1 ? dnrSection : dnrSection.slice(0, nextHeading);
    const legacyEntries = dnrText
      .split("\n")
      .filter((l) => l.match(/^\s*-\s/))
      .map((l) => l.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean);

    if (legacyEntries.length === 0) return "";

    let section = "## Do-Not-Repeat\n";
    for (const entry of legacyEntries.slice(0, 10)) {
      section += `- ${entry}\n`;
    }
    return section;
  }

  let section = "## Do-Not-Repeat\n";
  const recent = dnrEntries.slice(-10).reverse();
  for (const entry of recent) {
    const prefix = entry.date ? `[${entry.tag}] ${entry.date}: ` : `[${entry.tag}] `;
    section += `- ${prefix}${entry.text}\n`;
  }
  return section;
}

function buildConventionsSection(owlDir: string): string {
  const content = readText(path.join(owlDir, "cerebrum.md"));
  const entries = parseCerebrumEntries(content);

  const conventionEntries = entries.filter(
    (e) => e.section === "key_learnings" || e.section.includes("convention")
  );

  if (conventionEntries.length === 0) {
    const klIdx = content.indexOf("## Key Learnings");
    if (klIdx === -1) return "";

    const klSection = content.slice(klIdx);
    const nextHeading = klSection.indexOf("\n## ", 1);
    const klText = nextHeading === -1 ? klSection : klSection.slice(0, nextHeading);
    const legacyEntries = klText
      .split("\n")
      .filter((l) => l.match(/^\s*-\s/) && l.length > 10)
      .map((l) => l.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean);

    if (legacyEntries.length === 0) return "";

    let section = "## Key Conventions\n";
    for (const entry of legacyEntries.slice(0, 8)) {
      section += `- ${entry}\n`;
    }
    return section;
  }

  let section = "## Key Conventions\n";
  for (const entry of conventionEntries.slice(0, 8)) {
    const prefix = entry.tag !== "general" ? `[${entry.tag}] ` : "";
    section += `- ${prefix}${entry.text}\n`;
  }
  return section;
}

function buildAnatomySection(owlDir: string): string {
  const content = readText(path.join(owlDir, "anatomy.md"));
  if (!content || content.includes("Pending initial scan")) return "";

  const { directorySummaries, fileEntries } = selectRelevantEntries(content, {
    maxFileEntries: 15,
  });

  if (directorySummaries.length === 0 && fileEntries.length === 0) return "";

  let section = "## File Index\n";

  for (const summary of directorySummaries) {
    section += `${summary}\n`;
  }

  if (directorySummaries.length > 0 && fileEntries.length > 0) {
    section += "\n";
  }

  for (const entry of fileEntries) {
    section += `${entry}\n`;
  }

  return section;
}

function buildBugsSection(owlDir: string): string {
  const buglog = readJSON<{ bugs: BugEntry[] }>(
    path.join(owlDir, "buglog.json"),
    { bugs: [] }
  );

  const openBugs = buglog.bugs.filter((b) => !b.fix || b.fix === "unknown");
  if (openBugs.length === 0) return "";

  let section = "## Active Bugs\n";
  for (const bug of openBugs.slice(0, 5)) {
    section += `- [${bug.id}] ${bug.file}: ${bug.error_message.slice(0, 80)}`;
    if (bug.occurrences > 1) section += ` (${bug.occurrences}x)`;
    section += "\n";
  }
  return section;
}

function trimToTokenBudget(block: string, maxTokens: number): string {
  const estimatedTokens = Math.ceil(block.length / 3.5);
  if (estimatedTokens <= maxTokens) return block;

  const lines = block.split("\n");
  const header: string[] = [];
  const body: string[] = [];
  let pastHeader = false;

  for (const line of lines) {
    if (line.startsWith("<owl-context>") || line.startsWith("</owl-context>")) {
      header.push(line);
      continue;
    }
    if (line.startsWith("## ") && !pastHeader) {
      header.push(line);
      continue;
    }
    pastHeader = true;
    body.push(line);
  }

  const maxBodyTokens = (maxTokens * 3.5) - header.join("\n").length;
  let totalLen = header.join("\n").length;
  const trimmed: string[] = [];

  for (const line of body) {
    if (totalLen + line.length + 1 > maxBodyTokens) break;
    trimmed.push(line);
    totalLen += line.length + 1;
  }

  if (trimmed.length < body.length) {
    trimmed.push("... (truncated for token budget)");
  }

  return [...header, ...trimmed].join("\n");
}
