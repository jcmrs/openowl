import * as fs from "node:fs";
import * as path from "node:path";
import { getRegisteredProjects, registerProject, type RegisteredProject } from "./registry.js";
import { readJSON, writeText, readText } from "../core/utils/fs-safe.js";
import { ensureDir } from "../core/utils/paths.js";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { findTemplatesDir, generatePluginContent, generateAgentsMdSnippet } from "./shared.js";

const ALWAYS_OVERWRITE = ["OWL.md"];

const USER_DATA_FILES = [
  "identity.md", "cerebrum.md", "memory.md", "anatomy.md",
  "token-ledger.json", "buglog.json", "cron-manifest.json", "cron-state.json",
];

const BACKUP_FILES = [...ALWAYS_OVERWRITE, ...USER_DATA_FILES];

interface UpdateResult {
  project: RegisteredProject;
  status: "updated" | "skipped" | "error";
  backupDir?: string;
  message: string;
}

export async function updateCommand(options: { dryRun?: boolean; project?: string }): Promise<void> {
  const version = "latest";
  const projects = getRegisteredProjects(true);

  if (projects.length === 0) {
    console.log("No registered OpenOwl projects found.");
    console.log("Run 'openowl init' in a project directory to register it.");
    return;
  }

  let targets = projects;
  if (options.project) {
    const search = options.project.toLowerCase();
    targets = projects.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.root.toLowerCase().includes(search)
    );
    if (targets.length === 0) {
      console.log(`No registered project matching "${options.project}".`);
      console.log("Registered projects:");
      for (const p of projects) {
        console.log(`  - ${p.name} (${p.root})`);
      }
      return;
    }
  }

  console.log(`OpenOwl v${version} — updating ${targets.length} project(s)${options.dryRun ? " (dry run)" : ""}...\n`);

  const results: UpdateResult[] = [];
  for (const project of targets) {
    const result = await updateProject(project, version, options.dryRun ?? false);
    results.push(result);
  }

  console.log("\n--- Update Summary ---");
  const updated = results.filter(r => r.status === "updated");
  const skipped = results.filter(r => r.status === "skipped");
  const errors = results.filter(r => r.status === "error");

  if (updated.length > 0) {
    console.log(`\n  Updated (${updated.length}):`);
    for (const r of updated) console.log(`    ${r.project.name} - ${r.message}`);
  }
  if (skipped.length > 0) {
    console.log(`\n  Skipped (${skipped.length}):`);
    for (const r of skipped) console.log(`    ${r.project.name} - ${r.message}`);
  }
  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const r of errors) console.log(`    ${r.project.name} - ${r.message}`);
  }
  console.log("");
}

async function updateProject(
  project: RegisteredProject,
  version: string,
  dryRun: boolean
): Promise<UpdateResult> {
  const { root, name } = project;
  const owlDir = path.join(root, ".owl");

  if (!fs.existsSync(owlDir)) {
    return { project, status: "skipped", message: ".owl/ directory not found" };
  }

  if (name === "openowl") {
    return { project, status: "skipped", message: "openowl source repo - skipped" };
  }

  console.log(`  ${name} (${root})`);

  if (dryRun) {
    console.log(`    [dry run] Would backup, update templates, plugin, AGENTS.md`);
    return { project, status: "updated", message: `would update to v${version}` };
  }

  try {
    const backupDir = createBackup(owlDir);
    console.log(`    Backup: ${path.basename(backupDir)}`);

    const templatesDir = findTemplatesDir();
    for (const file of ALWAYS_OVERWRITE) {
      const srcPath = path.join(templatesDir, file);
      const destPath = path.join(owlDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        console.error(`[OpenOwl] Template not found: ${file}`);
      }
    }
    console.log(`    Templates updated`);

    const pluginPath = path.join(root, ".opencode", "plugins", "openowl.ts");
    const pluginContent = generatePluginContent();
    writeText(pluginPath, pluginContent);
    console.log(`    Plugin updated`);

    const agentsMdPath = path.join(root, "AGENTS.md");
    const snippetContent = generateAgentsMdSnippet();
    if (fs.existsSync(agentsMdPath)) {
      const existing = readText(agentsMdPath);
      if (!existing.includes("OpenOwl")) {
        writeText(agentsMdPath, snippetContent + "\n\n" + existing);
        console.log(`    AGENTS.md updated`);
      }
    }

    try {
      const files = fs.readdirSync(owlDir);
      let cleaned = 0;
      for (const f of files) {
        if (f.endsWith(".tmp")) {
          try { fs.unlinkSync(path.join(owlDir, f)); cleaned++; } catch {}
        }
      }
      if (cleaned > 0) console.log(`    Cleaned ${cleaned} stale .tmp file(s)`);
    } catch {}

    registerProject(root, name, version);

    return {
      project,
      status: "updated",
      backupDir,
      message: `v${project.version} -> v${version}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { project, status: "error", message: msg };
  }
}

function createBackup(owlDir: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "").slice(0, 15);
  const backupDir = path.join(owlDir, "backups", stamp);
  ensureDir(backupDir);

  for (const file of BACKUP_FILES) {
    const src = path.join(owlDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupDir, file));
    }
  }

  const pluginDir = path.join(owlDir, "..", ".opencode", "plugins");
  const pluginPath = path.join(pluginDir, "openowl.ts");
  if (fs.existsSync(pluginPath)) {
    const pluginBackup = path.join(backupDir, ".opencode", "plugins");
    ensureDir(pluginBackup);
    fs.copyFileSync(pluginPath, path.join(pluginBackup, "openowl.ts"));
  }

  return backupDir;
}

export function listProjects(): void {
  const projects = getRegisteredProjects(true);

  if (projects.length === 0) {
    console.log("No registered OpenOwl projects.");
    console.log("Run 'openowl init' in a project directory to register it.");
    return;
  }

  console.log(`Registered OpenOwl projects (${projects.length}):\n`);
  for (const p of projects) {
    const age = Math.floor((Date.now() - new Date(p.last_updated).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${p.name}`);
    console.log(`    Path: ${p.root}`);
    console.log(`    Version: ${p.version} | Updated: ${age}d ago`);
    console.log("");
  }
}

export function restoreCommand(backupName?: string): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");
  const backupsDir = path.join(owlDir, "backups");

  if (!fs.existsSync(backupsDir)) {
    console.log("No backups found for this project.");
    return;
  }

  const backups = fs.readdirSync(backupsDir)
    .filter(d => fs.statSync(path.join(backupsDir, d)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.log("No backups found.");
    return;
  }

  if (!backupName) {
    console.log(`Available backups (${backups.length}):\n`);
    for (const b of backups) {
      const files = fs.readdirSync(path.join(backupsDir, b)).filter(f => !fs.statSync(path.join(backupsDir, b, f)).isDirectory());
      console.log(`  ${b} (${files.length} files)`);
    }
    console.log(`\nTo restore: openowl restore <backup-name>`);
    return;
  }

  const backupDir = path.join(backupsDir, backupName);
  if (!fs.existsSync(backupDir)) {
    console.log(`Backup "${backupName}" not found.`);
    return;
  }

  const files = fs.readdirSync(backupDir).filter(f => fs.statSync(path.join(backupDir, f)).isFile());
  for (const file of files) {
    fs.copyFileSync(path.join(backupDir, file), path.join(owlDir, file));
  }

  const opencodeBackup = path.join(backupDir, ".opencode", "plugins");
  if (fs.existsSync(opencodeBackup)) {
    const dest = path.join(projectRoot, ".opencode", "plugins");
    ensureDir(dest);
    const pluginBackup = path.join(opencodeBackup, "openowl.ts");
    if (fs.existsSync(pluginBackup)) {
      fs.copyFileSync(pluginBackup, path.join(dest, "openowl.ts"));
    }
  }

  console.log(`Restored ${files.length} files from backup "${backupName}".`);
}
