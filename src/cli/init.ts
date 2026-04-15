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

  const pkgPath = path.join(projectRoot, "package.json");
  let depInstalled = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = pkg.dependencies ?? {};
      if (!deps["opencode-owl"]) {
        const pm = detectPackageManager(projectRoot);
        const installCmd = pm === "pnpm" ? "pnpm add" : pm === "yarn" ? "yarn add" : pm === "bun" ? "bun add" : "npm install";
        console.log(`  Installing opencode-owl as a dependency (${installCmd} opencode-owl)...`);
        const { execSync } = require("node:child_process");
        execSync(`${installCmd} opencode-owl`, { cwd: projectRoot, stdio: "inherit", timeout: 60000 });
        depInstalled = true;
      } else {
        depInstalled = true;
      }
    } catch (err) {
      console.error(`  Warning: Failed to install opencode-owl as a dependency: ${(err as Error).message}`);
      console.error(`  The plugin requires opencode-owl to be installed. Run: npm install opencode-owl`);
    }
  } else {
    console.error(`  Warning: No package.json found. The plugin requires opencode-owl to be installed manually.`);
  }

  const agentsMdPath = path.join(projectRoot, "AGENTS.md");
  const snippetContent = generateAgentsMdSnippet();
  if (fs.existsSync(agentsMdPath)) {
    const existing = readText(agentsMdPath);
    const lines = existing.split("\n");
    const owlStartIdx = lines.findIndex((l) => l === "# OpenOwl");

    if (owlStartIdx === -1) {
      writeText(agentsMdPath, snippetContent + "\n");
    } else {
      let owlEndIdx = lines.length;
      for (let i = owlStartIdx + 1; i < lines.length; i++) {
        if (/^# [A-Z]/.test(lines[i]) && !lines[i].startsWith("## ")) {
          owlEndIdx = i;
          break;
        }
      }
      const before = lines.slice(0, owlStartIdx);
      const after = lines.slice(owlEndIdx);
      const nonOwl = [...before, ...after].join("\n").trim();
      if (nonOwl.length > 0) {
        writeText(agentsMdPath, snippetContent + "\n\n" + nonOwl + "\n");
      } else {
        writeText(agentsMdPath, snippetContent + "\n");
      }
    }
  } else {
    writeText(agentsMdPath, snippetContent + "\n");
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
    if (projectName !== "opencode-owl") {
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
    "OWL.md": `# OpenOwl Contribution Guide

You are working in an OpenOwl-managed project. The plugin injects relevant project knowledge into your system context every turn — you don't need to read .owl/ files to benefit from them.

## What OpenOwl Does For You Automatically

- Injects do-not-repeat entries, key conventions, and file index into your context every turn
- Logs bugs to \`.owl/buglog.json\` when it detects error patterns in your edits
- Updates \`.owl/anatomy.md\` when files are created, deleted, or modified
- Tracks your session for token analysis

## When You Learn Something New

Append a tagged entry to \`.owl/cerebrum.md\`:

\`\`\`
- [scope] YYYY-MM-DD: concise description
\`\`\`

**Add entries when:**
- The user corrects your approach
- You discover a project convention not obvious from the code
- You find an API behavior that surprised you
- You make an architectural decision worth remembering

## When You Fix a Bug

The system auto-logs to \`.owl/buglog.json\`. You don't need to do anything. If the user reports a bug, check \`.owl/buglog.json\` first.

## Session End

Review: did you learn anything this session? If yes, add it to \`.owl/cerebrum.md\`.
`,
    "identity.md": `# Identity\n\n- **Name:** Owl\n- **Role:** AI development assistant for this project\n- **Tone:** Direct, concise, technically precise\n`,
    "cerebrum.md": `# Cerebrum\n\n> OpenOwl's cross-session learning memory. The plugin injects relevant entries into your system context every turn — you don't need to read this file before coding. Update it when you learn something new.\n\n## Do-Not-Repeat\n\n<!-- Mistakes that MUST NOT recur. -->\n\n## Key Learnings\n\n<!-- Project conventions discovered during development. Add with [scope] tags. -->\n\n## User Preferences\n\n<!-- How the user likes things done. Add with [scope] tags. -->\n\n## Decision Log\n\n<!-- Architectural decisions with rationale. -->\n`,
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
        injection: { enabled: true, max_tokens: 2500, include_project: true, include_dnr: true, include_conventions: true, include_anatomy: true, include_bugs: true },
      },
    }, null, 2),
    "token-ledger.json": JSON.stringify({ version: 1, created_at: "", lifetime: { total_tokens_estimated: 0, total_reads: 0, total_writes: 0, total_sessions: 0, anatomy_hits: 0, anatomy_misses: 0, repeated_reads_blocked: 0, estimated_savings_vs_bare_cli: 0 }, sessions: [], daemon_usage: [], waste_flags: [], optimization_report: { last_generated: null, patterns: [] } }, null, 2),
    "buglog.json": JSON.stringify({ version: 1, bugs: [] }, null, 2),
    "cron-manifest.json": JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "anatomy_rescan",
          name: "Anatomy Rescan",
          schedule: "0 */6 * * *",
          description: "Rescan project anatomy every 6 hours",
          action: { type: "scan_project" },
          retry: { max_attempts: 2, backoff: "linear", base_delay_seconds: 60 },
          failsafe: { on_failure: "log", dead_letter: true, alert_after_consecutive_failures: 3 },
          enabled: true,
        },
        {
          id: "cerebrum_staleness",
          name: "Cerebrum Staleness Check",
          schedule: "0 9 * * 1",
          description: "Check if cerebrum.md is stale (weekly on Monday morning)",
          action: { type: "check_cerebrum_staleness", params: { max_age_days: 14 } },
          retry: { max_attempts: 1, backoff: "linear", base_delay_seconds: 30 },
          failsafe: { on_failure: "log" },
          enabled: true,
        },
        {
          id: "memory_consolidation",
          name: "Memory Consolidation",
          schedule: "0 3 * * 0",
          description: "Consolidate old memory entries (weekly on Sunday)",
          action: { type: "consolidate_memory", params: { older_than_days: 7 } },
          retry: { max_attempts: 2, backoff: "linear", base_delay_seconds: 60 },
          failsafe: { on_failure: "log", dead_letter: true },
          enabled: true,
        },
        {
          id: "token_report",
          name: "Token Waste Report",
          schedule: "0 10 * * 1",
          description: "Generate token optimization report (weekly on Monday)",
          action: { type: "generate_token_report" },
          retry: { max_attempts: 1, backoff: "linear", base_delay_seconds: 30 },
          failsafe: { on_failure: "log" },
          enabled: true,
        },
      ],
    }, null, 2),
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
  const framework = detectFramework(projectRoot);
  const testRunner = detectTestRunner(projectRoot);
  const pkgManager = detectPackageManager(projectRoot);

  if (!projectName && !framework && !testRunner) return;

  const cerebrumPath = path.join(owlDir, "cerebrum.md");
  let cerebrum = readText(cerebrumPath);
  const entries: string[] = [];

  if (projectName) {
    entries.push(`- [project] ${new Date().toISOString().slice(0, 10)}: Project is "${projectName}"${projectDescription ? ` — ${projectDescription}` : ""}`);
  }
  if (framework) {
    entries.push(`- [project] ${new Date().toISOString().slice(0, 10)}: Framework: ${framework}`);
  }
  if (testRunner) {
    entries.push(`- [project] ${new Date().toISOString().slice(0, 10)}: Test runner: ${testRunner}`);
  }
  if (pkgManager) {
    entries.push(`- [project] ${new Date().toISOString().slice(0, 10)}: Package manager: ${pkgManager}`);
  }

  if (entries.length === 0) return;

  const learningBlock = entries.map((e) => `  ${e}`).join("\n");
  const insertion = `\n${learningBlock}\n`;

  const klIdx = cerebrum.indexOf("## Key Learnings");
  if (klIdx !== -1) {
    const afterKl = cerebrum.indexOf("\n", klIdx);
    cerebrum = cerebrum.slice(0, afterKl + 1) + insertion + cerebrum.slice(afterKl + 1);
  } else {
    cerebrum += `\n## Key Learnings\n\n${insertion}`;
  }

  writeText(cerebrumPath, cerebrum);
}

function detectFramework(projectRoot: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next || deps["react-dom"] || deps["@next/router"]) return "Next.js (React)";
    if (deps.react && !deps.next) return "React";
    if (deps.vue || deps.nuxt) return "Vue/Nuxt";
    if (deps["@angular/core"]) return "Angular";
    if (deps.svelte || deps["@sveltejs/kit"]) return "Svelte/SvelteKit";
    if (deps.express || deps.fastify) return "Express/Fastify";
    if (deps.hono) return "Hono";
    if (deps.nestjs || deps["@nestjs/common"]) return "NestJS";
    if (deps["@astrojs/compiler"]) return "Astro";
  } catch {}
  try {
    const cargo = fs.readFileSync(path.join(projectRoot, "Cargo.toml"), "utf-8");
    if (cargo.includes("actix")) return "Actix-web (Rust)";
    if (cargo.includes("axum")) return "Axum (Rust)";
    if (cargo.includes("rocket")) return "Rocket (Rust)";
    return "Rust";
  } catch {}
  return "";
}

function detectTestRunner(projectRoot: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    const devDeps = pkg.devDependencies ?? {};
    if (devDeps.vitest || devDeps["@testing-library/react"]) return "Vitest + Testing Library";
    if (devDeps.jest) return "Jest";
    if (devDeps.mocha) return "Mocha";
  } catch {}
  try {
    if (fs.existsSync(path.join(projectRoot, "pytest.ini")) || fs.existsSync(path.join(projectRoot, "pyproject.toml"))) return "pytest";
  } catch {}
  return "";
}

function detectPackageManager(projectRoot: string): string {
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(projectRoot, "package-lock.json"))) return "npm";
  return "";
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
