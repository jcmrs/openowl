import * as fs from "node:fs";
import * as path from "node:path";
import { readLedger } from "./token-ledger.js";

interface WasteFlag {
  pattern: string;
  description: string;
  tokens_wasted: number;
  suggestion: string;
  detected_at: string;
}

export function detectWaste(owlDir: string): WasteFlag[] {
  const flags: WasteFlag[] = [];
  const ledger = readLedger(owlDir);
  const now = new Date().toISOString();

  for (const session of ledger.sessions) {
    const readCounts = new Map<string, number>();
    for (const read of session.reads) {
      const count = (readCounts.get(read.file) ?? 0) + 1;
      readCounts.set(read.file, count);
    }
    for (const [file, count] of readCounts) {
      if (count > 1) {
        flags.push({
          pattern: "repeated_reads",
          description: `File ${file} was read ${count} times in session ${session.id}`,
          tokens_wasted: Math.round(
            (session.reads.find((r) => r.file === file)?.tokens_estimated ?? 200) * (count - 1)
          ),
          suggestion: "Plugin should have warned about repeated reads.",
          detected_at: now,
        });
      }
    }
  }

  for (const session of ledger.sessions) {
    for (const read of session.reads) {
      if (read.tokens_estimated > 500 && read.anatomy_had_description) {
        flags.push({
          pattern: "anatomy_could_suffice",
          description: `anatomy.md had a description for ${read.file} (~${read.tokens_estimated} tok)`,
          tokens_wasted: read.tokens_estimated,
          suggestion: "Full read may not have been needed — anatomy description was available.",
          detected_at: now,
        });
      }
    }
  }

  try {
    const memoryPath = path.join(owlDir, "memory.md");
    const memContent = fs.readFileSync(memoryPath, "utf-8");
    const memTokens = Math.ceil(memContent.length / 3.8);
    if (memTokens > 5000) {
      flags.push({
        pattern: "memory_bloat",
        description: `memory.md is ~${memTokens} tokens`,
        tokens_wasted: memTokens - 5000,
        suggestion: "memory.md is growing large. Consolidation should run more frequently.",
        detected_at: now,
      });
    }
  } catch (err) {
    console.error("[OpenOwl] Error reading memory.md:", err);
  }

  try {
    const cerebrumPath = path.join(owlDir, "cerebrum.md");
    const stat = fs.statSync(cerebrumPath);
    const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 14) {
      flags.push({
        pattern: "cerebrum_stale",
        description: `cerebrum.md hasn't been updated in ${Math.floor(daysSinceModified)} days`,
        tokens_wasted: 0,
        suggestion: "Learning may not be active. Check if cerebrum is being updated by the plugin.",
        detected_at: now,
      });
    }
  } catch (err) {
    console.error("[OpenOwl] Error reading cerebrum.md:", err);
  }

  for (const session of ledger.sessions) {
    const projectReads = session.reads.filter(r => {
      const normalized = r.file.replace(/\\/g, "/");
      return !normalized.includes("/.owl/");
    });
    const projectReadCount = projectReads.length;
    const hits = session.totals.anatomy_lookups;
    if (projectReadCount > 0) {
      const missRate = (projectReadCount - hits) / projectReadCount;
      if (missRate > 0.2) {
        flags.push({
          pattern: "anatomy_miss_rate",
          description: `${Math.round(missRate * 100)}% of file lookups missed anatomy in session ${session.id}`,
          tokens_wasted: 0,
          suggestion: "Run openowl scan to refresh anatomy.md.",
          detected_at: now,
        });
      }
    }
  }

  return flags;
}
