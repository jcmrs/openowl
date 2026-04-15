import { initSession } from "../context/session-manager.js";
import { stat } from "node:fs/promises";

export async function handleSessionCreated(
  owlDir: string,
  sessionId: string,
  warnings: string[]
): Promise<void> {
  initSession(owlDir, sessionId);

  try {
    const cerebrumPath = `${owlDir}/cerebrum.md`;
    const cerebrumStat = await stat(cerebrumPath);
    const daysSinceModified = (Date.now() - cerebrumStat.mtimeMs) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 3) {
      warnings.push(`CEREBRUM STALE: cerebrum.md hasn't been updated in ${Math.floor(daysSinceModified)} days`);
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error("[OpenOwl] Error checking cerebrum staleness:", err);
    }
  }

  try {
    const buglogPath = `${owlDir}/buglog.json`;
    const buglogStat = await stat(buglogPath);
    const buglogSize = buglogStat.size;
    if (buglogSize < 50) {
      warnings.push(`BUGLOG EMPTY: No bugs logged yet. Consider logging past fixes for future reference.`);
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error("[OpenOwl] Error checking buglog size:", err);
    }
  }
}
