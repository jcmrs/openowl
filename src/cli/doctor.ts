import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON, readText } from "../core/utils/fs-safe.js";
import { validateInjectionConfig } from "../plugin/injection/token-budget.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export async function doctorCommand(): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");
  const checks: CheckResult[] = [];

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  console.log("OpenOwl Doctor\n=============\n");

  checks.push(checkOwlFiles(owlDir));
  checks.push(checkPluginInstall(projectRoot));
  checks.push(checkAgentsMd(projectRoot));
  checks.push(checkConfig(owlDir));
  checks.push(checkInjectionConfig(owlDir));
  checks.push(checkCerebrumHealth(owlDir));
  checks.push(checkAnatomyFreshness(owlDir));
  checks.push(checkBuglog(owlDir));

  let passes = 0;
  let warns = 0;
  let fails = 0;

  for (const check of checks) {
    const icon = check.status === "pass" ? "OK" : check.status === "warn" ? "!!" : "XX";
    console.log(`  [${icon}] ${check.name}`);
    if (check.message) console.log(`       ${check.message}`);
    if (check.status === "pass") passes++;
    else if (check.status === "warn") warns++;
    else fails++;
  }

  console.log(`\n  ${passes} passed, ${warns} warnings, ${fails} failures`);
  if (fails > 0) process.exitCode = 1;
  console.log("");
}

function checkOwlFiles(owlDir: string): CheckResult {
  const required = ["OWL.md", "cerebrum.md", "anatomy.md", "config.json"];
  const missing = required.filter((f) => !fs.existsSync(path.join(owlDir, f)));
  if (missing.length === 0) return { name: "Core .owl/ files", status: "pass", message: "" };
  return { name: "Core .owl/ files", status: "fail", message: `Missing: ${missing.join(", ")}` };
}

function checkPluginInstall(projectRoot: string): CheckResult {
  const pluginPath = path.join(projectRoot, ".opencode", "plugins", "openowl.ts");
  if (!fs.existsSync(pluginPath)) {
    return { name: "OpenCode plugin", status: "fail", message: "Not installed. Run: openowl init" };
  }

  const content = readText(pluginPath);
  if (content.includes("experimental.chat.system.transform")) {
    return { name: "OpenCode plugin", status: "pass", message: "Injection hook registered" };
  }
  return { name: "OpenCode plugin", status: "warn", message: "Installed but missing injection hook" };
}

function checkAgentsMd(projectRoot: string): CheckResult {
  const agentsMd = path.join(projectRoot, "AGENTS.md");
  if (!fs.existsSync(agentsMd)) {
    return { name: "AGENTS.md", status: "fail", message: "Not found" };
  }

  const content = readText(agentsMd);
  if (content.includes(".owl/OWL.md")) {
    return { name: "AGENTS.md", status: "pass", message: "References .owl/OWL.md" };
  }
  return { name: "AGENTS.md", status: "warn", message: "Exists but does not reference OpenOwl" };
}

function checkConfig(owlDir: string): CheckResult {
  const configPath = path.join(owlDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return { name: "Config", status: "fail", message: "config.json missing" };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!config.version) return { name: "Config", status: "warn", message: "Missing version field" };
    return { name: "Config", status: "pass", message: `v${config.version}` };
  } catch (err) {
    return { name: "Config", status: "fail", message: `Invalid JSON: ${(err as Error).message}` };
  }
}

function checkInjectionConfig(owlDir: string): CheckResult {
  const config = readJSON<Record<string, any>>(path.join(owlDir, "config.json"), {});
  const injectionCfg = config?.openowl?.injection ?? {};

  if (!injectionCfg.enabled && injectionCfg.enabled !== undefined) {
    return { name: "Injection config", status: "warn", message: "Injection disabled" };
  }

  const { warnings } = validateInjectionConfig(injectionCfg);
  if (warnings.length > 0) {
    return { name: "Injection config", status: "warn", message: warnings.join("; ") };
  }

  const maxTokens = injectionCfg.max_tokens ?? 2500;
  return { name: "Injection config", status: "pass", message: `Enabled, ${maxTokens} token budget` };
}

function checkCerebrumHealth(owlDir: string): CheckResult {
  const content = readText(path.join(owlDir, "cerebrum.md"));
  if (!content) return { name: "Cerebrum health", status: "fail", message: "Empty or missing" };

  const taggedEntries = content.match(/^-\s+\[([^\]]+)\]/gm);
  const totalEntries = content.match(/^-\s+/gm);

  if (!totalEntries || totalEntries.length === 0) {
    return { name: "Cerebrum health", status: "warn", message: "No entries found" };
  }

  const taggedCount = taggedEntries?.length ?? 0;
  const legacyCount = totalEntries.length - taggedCount;

  if (legacyCount > 0) {
    return {
      name: "Cerebrum health",
      status: "warn",
      message: `${totalEntries.length} entries (${taggedCount} tagged, ${legacyCount} legacy — consider migrating)`,
    };
  }

  return { name: "Cerebrum health", status: "pass", message: `${totalEntries.length} tagged entries` };
}

function checkAnatomyFreshness(owlDir: string): CheckResult {
  const content = readText(path.join(owlDir, "anatomy.md"));
  if (!content || content.includes("Pending initial scan")) {
    return { name: "Anatomy freshness", status: "warn", message: "No scan data" };
  }

  const scanMatch = content.match(/Last scanned:\s*(.+)/);
  if (!scanMatch) {
    return { name: "Anatomy freshness", status: "warn", message: "No scan timestamp" };
  }

  const scanDate = new Date(scanMatch[1].trim());
  const hoursSince = (Date.now() - scanDate.getTime()) / (1000 * 60 * 60);

  if (hoursSince > 48) {
    return { name: "Anatomy freshness", status: "warn", message: `Scanned ${Math.round(hoursSince)} hours ago — consider rescanning` };
  }

  const entryCount = (content.match(/^- `/gm) || []).length;
  return { name: "Anatomy freshness", status: "pass", message: `${entryCount} files, scanned ${Math.round(hoursSince)}h ago` };
}

function checkBuglog(owlDir: string): CheckResult {
  const buglog = readJSON<{ bugs: Array<{ fix: string }> }>(path.join(owlDir, "buglog.json"), { bugs: [] });
  const openBugs = buglog.bugs.filter((b) => !b.fix || b.fix === "unknown");

  if (openBugs.length === 0) {
    return { name: "Buglog", status: "pass", message: `${buglog.bugs.length} entries, 0 open` };
  }

  return { name: "Buglog", status: "warn", message: `${openBugs.length} open bugs` };
}
