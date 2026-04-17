import * as path from "node:path";
import { readJSON } from "../../core/utils/fs-safe.js";

export interface BuglogCheckResult {
  similarBugs: Array<{
    id: string;
    error_message: string;
    file: string;
    fix: string;
    score: number;
  }>;
}

interface BugEntry {
  id: string;
  error_message: string;
  file: string;
  fix: string;
  tags: string[];
  occurrences: number;
}

interface ScoredBug {
  id: string;
  error_message: string;
  file: string;
  fix: string;
  score: number;
}

export function checkBuglog(
  owlDir: string,
  filePath: string,
  content?: string
): BuglogCheckResult {
  const normalizedTarget = filePath.replace(/\\/g, "/");
  const targetBasename = path.basename(normalizedTarget);

  const buglog = readJSON<{ bugs: BugEntry[] }>(
    path.join(owlDir, "buglog.json"),
    { bugs: [] }
  );

  const scored: ScoredBug[] = [];

  for (const b of buglog.bugs) {
    const normalizedFile = (b.file ?? "").replace(/\\/g, "/");
    if (normalizedFile === normalizedTarget || normalizedFile === targetBasename || normalizedTarget.endsWith("/" + normalizedFile)) {
      scored.push({
        id: b.id,
        error_message: b.error_message,
        file: b.file,
        fix: b.fix,
        score: 2.0,
      });
      continue;
    }

    if (content && content.trim().length > 0) {
      const lowerContent = content.toLowerCase();
      const lowerMsg = (b.error_message ?? "").toLowerCase();
      if (lowerContent.includes(lowerMsg)) {
        scored.push({
          id: b.id,
          error_message: b.error_message,
          file: b.file,
          fix: b.fix,
          score: 1.0,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return { similarBugs: scored.slice(0, 2) };
}
