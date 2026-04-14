import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { scanProject } from "../core/scanner/anatomy-scanner.js";
import { readJSON, writeJSON, readText, writeText } from "../core/utils/fs-safe.js";
import { ensureDir } from "../core/utils/paths.js";
import { registerProject } from "./registry.js";
import { findTemplatesDir, generatePluginContent, generateAgentsMdSnippet } from "./shared.js";

const ALWAYS_OVERWRITE: string[] = [
  "OWL.md",
];

const CREATE_IF_MISSING = [
  "config.json",
  "identity.md",
  "cerebrum.md",
  "memory.md",
  "anatomy.md",
  "token-ledger.json",
  "buglog.json",
  "cron-manifest.json",
  "cron-state.json",
];

export async function initCommand(): Promise<void> {
  const nodeVersion = parseInt(process.version.slice(1), 10);
  if (nodeVersion < 20) {
    console.error(`Node.js 20+ required. Current: ${process.version}`);
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  console.log(`Project root: ${projectRoot}`);

  const owlDir = path.join(projectRoot, ".owl");
  const isUpgrade = fs.existsSync(owlDir);

  if (isUpgrade) {
    console.log(`Upgrading OpenOwl...`);
  }

  ensureDir(owlDir);

  const templatesDir = findTemplatesDir();

  let createdCount = 0;
  let skippedCount = 0;

  for (const file of ALWAYS_OVERWRITE) {
    writeTemplateFile(templatesDir, owlDir, file);
    createdCount++;
  }

  for (const file of CREATE_IF_MISSING) {
    const destPath = path.join(owlDir, file);
    if (fs.existsSync(destPath)) {
      if (file === "config.json" && isUpgrade) {
        mergeConfig(templatesDir, destPath);
        createdCount++;
      } else {
        skippedCount++;
      }
    } else {
      writeTemplateFile(templatesDir, owlDir, file);
      createdCount++;
    }
  }

  ensureOwlGitignore(projectRoot);

  if (!isUpgrade) {
    seedCerebrum(owlDir, projectRoot);
    seedIdentity(owlDir, projectRoot);
  }

  const ledgerPath = path.join(owlDir, "token-ledger.json");
  const ledger = readJSON<Record<string, unknown>>(ledgerPath, {});
  if (!ledger.created_at) {
    ledger.created_at = new Date().toISOString();
    writeJSON(ledgerPath, ledger);
  }

  ensureDir(path.join(projectRoot, ".opencode"));
  ensureDir(path.join(projectRoot, ".opencode", "plugins"));

  const pluginPath = path.join(projectRoot, ".opencode", "plugins", "openowl.ts");
  const pluginContent = generatePluginContent();
  if (fs.existsSync(pluginPath)) {
    if (!fs.readFileSync(pluginPath, "utf-8").includes("OpenOwlPlugin")) {
      writeText(pluginPath, pluginContent);
      createdCount++;
    } else {
      skippedCount++;
    }
  } else {
    writeText(pluginPath, pluginContent);
    createdCount++;
  }

  const agentsMdPath = path.join(projectRoot, "AGENTS.md");
  const snippetContent = generateAgentsMdSnippet();
  if (fs.existsSync(agentsMdPath)) {
    const existing = readText(agentsMdPath);
    if (!existing.includes("OpenOwl")) {
      writeText(agentsMdPath, snippetContent + "\n\n" + existing);
    }
  } else {
    writeText(agentsMdPath, snippetContent);
  }

  let fileCount = 0;
  if (!isUpgrade) {
    try {
      fileCount = scanProject(owlDir, projectRoot);
    } catch (err) {
      console.log("  Anatomy scan deferred — will run on first session.");
      console.error("[OpenOwl] Scan error:", err);
    }
  } else {
    try {
      const anatomyContent = readText(path.join(owlDir, "anatomy.md"));
      const m = anatomyContent.match(/Files:\s*(\d+)/);
      fileCount = m ? parseInt(m[1], 10) : 0;
    } catch {}
  }

  try {
    const projectName = detectProjectName(projectRoot);
    if (projectName !== "openowl") {
      registerProject(projectRoot, projectName, "unknown");
    }
  } catch {}

  console.log("");
  if (isUpgrade) {
    console.log(`  OpenOwl upgraded`);
    console.log(`  All .owl data preserved (${skippedCount} files)`);
    console.log(`  ${createdCount} config files updated`);
    console.log(`  Anatomy: ${fileCount} files tracked (unchanged)`);
  } else {
    console.log(`  OpenOwl initialized`);
    console.log(`  .owl/ created with ${createdCount} files`);
    console.log(`  OpenCode plugin installed`);
    console.log(`  AGENTS.md updated`);
    console.log(`  Anatomy scan: ${fileCount} files indexed`);
  }
  console.log("");
  console.log("  Ready. Restart OpenCode to activate the plugin.");
  console.log("");
}

function writeTemplateFile(templatesDir: string, owlDir: string, file: string): void {
  const srcPath = path.join(templatesDir, file);
  const destPath = path.join(owlDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  } else {
    generateTemplate(destPath, file);
  }
}

function generateTemplate(destPath: string, file: string): void {
  const templates: Record<string, string> = {
    "OWL.md": `# OpenOwl Operating Protocol

You are working in an OpenOwl-managed project. These rules apply every turn.

> **Note:** OpenOwl runs as an OpenCode plugin and cannot enforce these rules mechanically. The plugin will remind you via log messages, but you are responsible for following them manually. Future versions may add mechanism-based enforcement.

## File Navigation

1. Check \`.owl/anatomy.md\` BEFORE reading any file. It has a 2-3 line description and token estimate for every file in the project.
2. If the description in anatomy.md is sufficient for your task, do NOT read the full file.
3. If a file is not in anatomy.md, search with Grep/Glob, then update anatomy.md with the new entry.

## Code Generation

1. Before generating code, read \`.owl/cerebrum.md\` and respect every entry.
2. Check the \`## Do-Not-Repeat\` section — these are past mistakes that must not recur.
3. Follow all conventions in \`## Key Learnings\` and \`## User Preferences\`.

## After Actions

1. After every significant action, append a one-line entry to \`.owl/memory.md\`:
   \`| HH:MM | description | file(s) | outcome | ~tokens |\`
2. After creating, deleting, or renaming files: update \`.owl/anatomy.md\`.

## Cerebrum Learning (MANDATORY — every session)

OpenOwl's value comes from learning across sessions. You MUST update \`.owl/cerebrum.md\` whenever you learn something useful. This is not optional.

**Update \`## User Preferences\` when the user:**
- Corrects your approach ("no, do it this way instead")
- Expresses a style preference (naming, structure, formatting)
- Shows a preferred workflow or tool choice
- Rejects a suggestion — record what they preferred instead

**Update \`## Key Learnings\` when you discover:**
- A project convention not obvious from the code
- A framework-specific pattern this project uses
- An API behavior that surprised you

**Update \`## Do-Not-Repeat\` (with date) when:**
- The user corrects a mistake you made
- You try something that fails and find the right approach

**Update \`## Decision Log\` when:**
- A significant architectural or technical choice is made

**The bar is LOW.** If in doubt, add it.

## Bug Logging (MANDATORY)

**Log a bug to \`.owl/buglog.json\` whenever ANY of these happen:**
- The user reports an error, bug, or problem
- A test fails or a command produces an error
- You fix something that was broken

**Before fixing:** Read \`.owl/buglog.json\` first — the fix may already be known.

**After fixing:** ALWAYS append to \`.owl/buglog.json\`.

**The threshold is LOW.** When in doubt, log it.

## Token Discipline

- Never re-read a file already read this session unless it was modified since.
- Prefer anatomy.md descriptions over full file reads when possible.
- Prefer targeted Grep over full file reads when searching for specific code.

## Design QC

When the user asks you to check, evaluate, or improve the design/UI:
1. Run \`openowl designqc\` via Bash to capture screenshots.
2. Read the captured screenshot images from \`.owl/designqc-captures/\`.
3. Evaluate and provide specific feedback.

## Session End

Before ending or when asked to wrap up:
1. Write a session summary to \`.owl/memory.md\`.
2. Review the session: did you learn anything? Did you fix a bug? If yes, update \`.owl/cerebrum.md\` and/or \`.owl/buglog.json\`.
`,
    "identity.md": `# Identity\n\n- **Name:** Owl\n- **Role:** AI development assistant for this project\n- **Tone:** Direct, concise, technically precise\n`,
    "cerebrum.md": `# Cerebrum\n\n> OpenOwl's learning memory.\n\n## User Preferences\n\n## Key Learnings\n\n## Do-Not-Repeat\n\n## Decision Log\n`,
    "memory.md": `# Memory\n\n> Chronological action log.\n`,
    "anatomy.md": `# anatomy.md\n\n> Project structure index. Pending initial scan.\n`,
    "config.json": JSON.stringify({
      version: 1,
      openowl: {
        enabled: true,
        anatomy: { auto_scan_on_init: true, rescan_interval_hours: 6, max_description_length: 100, max_files: 500, exclude_patterns: ["node_modules", ".git", "dist", "build", ".owl", ".next", ".nuxt", "coverage", "__pycache__", ".cache", "target", ".vscode", ".idea", ".turbo", ".vercel", ".netlify", ".output", "*.min.js", "*.min.css"] },
        token_audit: { enabled: true, report_frequency: "weekly", waste_threshold_percent: 15, model: "", chars_per_token_code: 3.0, chars_per_token_prose: 3.8 },
        cron: { enabled: true, max_retry_attempts: 3, dead_letter_enabled: true, heartbeat_interval_minutes: 30, ai_command: "opencode -p" },
        memory: { consolidation_after_days: 7, max_entries_before_consolidation: 200 },
        cerebrum: { max_tokens: 2000, reflection_frequency: "weekly" },
        daemon: { port: 18790, log_level: "info" },
        dashboard: { enabled: true, port: 18791 },
        designqc: { enabled: true, viewports: [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 375, height: 812 }], max_screenshots: 6, chrome_path: null },
      },
    }, null, 2),
    "token-ledger.json": JSON.stringify({ version: 1, created_at: "", lifetime: { total_tokens_estimated: 0, total_reads: 0, total_writes: 0, total_sessions: 0, anatomy_hits: 0, anatomy_misses: 0, repeated_reads_blocked: 0, estimated_savings_vs_bare_cli: 0 }, sessions: [], daemon_usage: [], waste_flags: [], optimization_report: { last_generated: null, patterns: [] } }, null, 2),
    "buglog.json": JSON.stringify({ version: 1, bugs: [] }, null, 2),
    "cron-manifest.json": JSON.stringify({ version: 1, tasks: [] }, null, 2),
    "cron-state.json": JSON.stringify({ last_heartbeat: null, engine_status: "initialized", execution_log: [], dead_letter_queue: [], upcoming: [] }, null, 2),
  };

  const content = templates[file] ?? "";
  fs.writeFileSync(destPath, content, "utf-8");
}

function mergeConfig(templatesDir: string, destPath: string): void {
  const srcPath = path.join(templatesDir, "config.json");
  let templateConfig: Record<string, unknown>;
  try {
    templateConfig = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
  } catch {
    return;
  }

  let userConfig: Record<string, unknown>;
  try {
    userConfig = JSON.parse(fs.readFileSync(destPath, "utf-8"));
  } catch {
    fs.copyFileSync(srcPath, destPath);
    return;
  }

  function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (
        key in result &&
        typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key]) &&
        typeof override[key] === "object" && override[key] !== null && !Array.isArray(override[key])
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          result[key] as Record<string, unknown>,
          override[key] as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = override[key];
      }
    }
    return result;
  }

  const merged = deepMerge(userConfig, templateConfig);
  fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

function ensureOwlGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let content = "";
  try {
    content = fs.readFileSync(gitignorePath, "utf-8");
  } catch {}

  if (!content.includes(".owl/")) {
    content += "\n.owl/\n";
    fs.writeFileSync(gitignorePath, content, "utf-8");
  }
}

function seedCerebrum(owlDir: string, projectRoot: string): void {
  const projectName = detectProjectName(projectRoot);
  const projectDescription = detectProjectDescription(projectRoot);
  if (!projectName && !projectDescription) return;

  const cerebrumPath = path.join(owlDir, "cerebrum.md");
  let cerebrum = readText(cerebrumPath);
  const projectInfo = [
    `- **Project:** ${projectName || path.basename(projectRoot)}`,
    projectDescription ? `- **Description:** ${projectDescription}` : "",
  ].filter(Boolean).join("\n");

  cerebrum = cerebrum.replace(
    /## Key Learnings\n\n<!-- Project-specific conventions discovered during development\. -->/,
    `## Key Learnings\n\n${projectInfo}`
  );
  if (!cerebrum.includes("**Project:**")) {
    cerebrum = cerebrum.replace(
      /## Key Learnings\n/,
      `## Key Learnings\n\n${projectInfo}\n`
    );
  }
  writeText(cerebrumPath, cerebrum);
}

function seedIdentity(owlDir: string, projectRoot: string): void {
  const projectName = detectProjectName(projectRoot);
  if (!projectName) return;

  const identityPath = path.join(owlDir, "identity.md");
  let content = readText(identityPath);
  content = content.replace(/\*\*Name:\*\* Owl/, `**Name:** ${projectName}`);
  content = content.replace(
    /\*\*Role:\*\* AI development assistant for this project/,
    `**Role:** AI development assistant for ${projectName}`
  );
  writeText(identityPath, content);
}

function detectProjectName(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg.name) return pkg.name;
  } catch {}
  try {
    const cargo = fs.readFileSync(path.join(projectRoot, "Cargo.toml"), "utf-8");
    const m = cargo.match(/^name\s*=\s*"([^"]+)"/m);
    if (m) return m[1];
  } catch {}
  try {
    const py = fs.readFileSync(path.join(projectRoot, "pyproject.toml"), "utf-8");
    const m = py.match(/^name\s*=\s*"([^"]+)"/m);
    if (m) return m[1];
  } catch {}
  return path.basename(projectRoot);
}

function detectProjectDescription(projectRoot: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    if (pkg.description) return pkg.description;
  } catch {}
  for (const readme of ["README.md", "readme.md", "README.rst", "README.txt"]) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, readme), "utf-8");
      const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("=") && !l.startsWith("-") && !l.startsWith("!["));
      if (lines.length > 0) return lines[0].trim().slice(0, 200);
    } catch {}
  }
  return "";
}
