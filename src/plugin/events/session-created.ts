import { initSession, readSession } from "../context/session-manager.js";
import { appendText } from "../../core/utils/fs-safe.js";
import { stat } from "node:fs/promises";

export async function handleSessionCreated(
  owlDir: string,
  sessionId: string,
  warnings: string[]
): Promise<void> {
  const existingSession = readSession(owlDir);
  const isResume = !!existingSession;

  if (isResume) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    appendText(
      `${owlDir}/memory.md`,
      `\n## Session: ${dateStr} ${timeStr} (resumed)\n\n| Time | Action | File(s) | Outcome | ~Tokens |\n|------|--------|---------|---------|--------|\n`
    );
  } else {
    initSession(owlDir, sessionId);
  }

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
