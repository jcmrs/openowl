import { findSimilarBugs } from "../../core/buglog/bug-tracker.js";

export interface BuglogCheckResult {
  similarBugs: Array<{
    id: string;
    error_message: string;
    file: string;
    fix: string;
    score: number;
  }>;
}

export function checkBuglog(
  owlDir: string,
  filePath: string,
  content?: string
): BuglogCheckResult {
  const errorMessage = content && content.trim().length > 0 ? content : filePath;
  const similar = findSimilarBugs(owlDir, errorMessage);

  const relevant = similar
    .filter((s) => {
      const normalizedFile = s.bug.file.replace(/\\/g, "/");
      const normalizedTarget = filePath.replace(/\\/g, "/");
      return normalizedFile === normalizedTarget || s.score > 0.5;
    })
    .slice(0, 3);

  return {
    similarBugs: relevant.map((s) => ({
      id: s.bug.id,
      error_message: s.bug.error_message,
      file: s.bug.file,
      fix: s.bug.fix,
      score: s.score,
    })),
  };
}
