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

export function checkBuglog(
  owlDir: string,
  filePath: string,
  content?: string
): BuglogCheckResult {
  const normalizedTarget = filePath.replace(/\\/g, "/");

  const buglog = readJSON<{ bugs: BugEntry[] }>(
    path.join(owlDir, "buglog.json"),
    { bugs: [] }
  );

  const relevant = buglog.bugs.filter((b) => {
    const normalizedFile = (b.file ?? "").replace(/\\/g, "/");
    if (normalizedFile === normalizedTarget) return true;

    if (content && content.trim().length > 0) {
      const lower = content.toLowerCase();
      return (b.error_message ?? "").toLowerCase().includes(lower) ||
             lower.includes((b.error_message ?? "").toLowerCase());
    }

    return false;
  });

  return {
    similarBugs: relevant.slice(0, 2).map((b) => ({
      id: b.id,
      error_message: b.error_message,
      file: b.file,
      fix: b.fix,
      score: 1.0,
    })),
  };
}
