import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON, readText } from "../core/utils/fs-safe.js";

export async function statusCommand(): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  console.log("OpenOwl Status");
  console.log("===============\n");

  const requiredFiles = [
    "OWL.md", "identity.md", "cerebrum.md", "memory.md",
    "anatomy.md", "config.json", "token-ledger.json", "buglog.json",
    "cron-manifest.json", "cron-state.json",
  ];

  let missingCount = 0;
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(owlDir, file));
    if (!exists) {
      console.log(`  x Missing: .owl/${file}`);
      missingCount++;
    }
  }
  if (missingCount === 0) {
    console.log(`  All ${requiredFiles.length} core files present`);
  }

  const pluginPath = path.join(projectRoot, ".opencode", "plugins", "openowl.ts");
  if (fs.existsSync(pluginPath)) {
    console.log("  OpenCode plugin installed");
  } else {
    console.log("  OpenCode plugin NOT installed");
  }

  const agentsMd = path.join(projectRoot, "AGENTS.md");
  if (fs.existsSync(agentsMd)) {
    const content = readText(agentsMd);
    if (content.includes("OpenOwl")) {
      console.log("  AGENTS.md references OpenOwl");
    } else {
      console.log("  AGENTS.md exists but does not reference OpenOwl");
    }
  } else {
    console.log("  AGENTS.md not found");
  }

  const ledger = readJSON<{
    lifetime: {
      total_sessions: number;
      total_reads: number;
      total_writes: number;
      total_tokens_estimated: number;
      estimated_savings_vs_bare_cli: number;
    };
  }>(path.join(owlDir, "token-ledger.json"), {
    lifetime: { total_sessions: 0, total_reads: 0, total_writes: 0, total_tokens_estimated: 0, estimated_savings_vs_bare_cli: 0 },
  });

  const activeSession = readJSON<{
    reads: unknown[];
    writes: unknown[];
    total_read_tokens: number;
    total_write_tokens: number;
  } | null>(path.join(owlDir, "_session.json"), null);

  const liveReads = activeSession ? activeSession.reads.length : 0;
  const liveWrites = activeSession ? activeSession.writes.length : 0;
  const liveTokens = activeSession ? activeSession.total_read_tokens + activeSession.total_write_tokens : 0;

  console.log(`\nToken Stats:`);
  console.log(`  Sessions: ${ledger.lifetime.total_sessions}`);
  console.log(`  Total reads: ${ledger.lifetime.total_reads + liveReads}${liveReads > 0 ? ` (${liveReads} this session)` : ""}`);
  console.log(`  Total writes: ${ledger.lifetime.total_writes + liveWrites}${liveWrites > 0 ? ` (${liveWrites} this session)` : ""}`);
  console.log(`  Tokens tracked: ~${(ledger.lifetime.total_tokens_estimated + liveTokens).toLocaleString()}`);
  console.log(`  Estimated savings: ~${ledger.lifetime.estimated_savings_vs_bare_cli.toLocaleString()} tokens`);

  const anatomyContent = readText(path.join(owlDir, "anatomy.md"));
  const entryCount = (anatomyContent.match(/^- `/gm) || []).length;
  console.log(`\nAnatomy: ${entryCount} files tracked`);

  const buglog = readJSON<{ bugs: unknown[] }>(path.join(owlDir, "buglog.json"), { bugs: [] });
  console.log(`Buglog: ${buglog.bugs.length} entries`);

  const cronState = readJSON<{ engine_status: string; last_heartbeat: string | null }>(
    path.join(owlDir, "cron-state.json"),
    { engine_status: "unknown", last_heartbeat: null }
  );
  console.log(`\nDaemon: ${cronState.engine_status}`);
  if (cronState.last_heartbeat) {
    const elapsed = Date.now() - new Date(cronState.last_heartbeat).getTime();
    const mins = Math.floor(elapsed / 60000);
    console.log(`  Last heartbeat: ${mins} minutes ago`);
  }

  console.log("");
}
