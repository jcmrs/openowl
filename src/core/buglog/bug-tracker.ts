import * as path from "node:path";
import * as crypto from "node:crypto";
import { readJSON, writeJSON } from "../utils/fs-safe.js";

export interface BugEntry {
  id: string;
  timestamp: string;
  error_message: string;
  file: string;
  line?: number;
  root_cause: string;
  fix: string;
  tags: string[];
  related_bugs: string[];
  occurrences: number;
  last_seen: string;
}

interface BugLog {
  version: number;
  bugs: BugEntry[];
}

function getBugLogPath(owlDir: string): string {
  return path.join(owlDir, "buglog.json");
}

export function readBugLog(owlDir: string): BugLog {
  return readJSON<BugLog>(getBugLogPath(owlDir), { version: 1, bugs: [] });
}

export function logBug(
  owlDir: string,
  bug: {
    error_message: string;
    file: string;
    line?: number;
    root_cause: string;
    fix: string;
    tags: string[];
  }
): void {
  const bugLog = readBugLog(owlDir);
  const now = new Date().toISOString();

  const similar = findSimilarBugs(owlDir, bug.error_message);
  if (similar.length > 0 && similar[0].score > 0.8) {
    const existing = bugLog.bugs.find((b) => b.id === similar[0].bug.id);
    if (existing) {
      existing.occurrences++;
      existing.last_seen = now;
      writeJSON(getBugLogPath(owlDir), bugLog);
      return;
    }
  }

  const id = `bug-${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`;
  bugLog.bugs.push({
    id,
    timestamp: now,
    error_message: bug.error_message,
    file: bug.file,
    line: bug.line,
    root_cause: bug.root_cause,
    fix: bug.fix,
    tags: bug.tags,
    related_bugs: [],
    occurrences: 1,
    last_seen: now,
  });

  writeJSON(getBugLogPath(owlDir), bugLog);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "N").replace(/[^\w\s]/g, " ").trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(/\s+/).filter((w) => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

interface ScoredBug {
  bug: BugEntry;
  score: number;
}

export function findSimilarBugs(owlDir: string, errorMessage: string): ScoredBug[] {
  const bugLog = readBugLog(owlDir);
  const normalizedInput = normalize(errorMessage);
  const inputTokens = tokenize(errorMessage);
  const results: ScoredBug[] = [];

  for (const bug of bugLog.bugs) {
    let score = 0;

    if (
      normalize(bug.error_message).includes(normalizedInput) ||
      normalizedInput.includes(normalize(bug.error_message))
    ) {
      score += 1.0;
    }

    const bugTokens = tokenize(bug.error_message);
    score += jaccardSimilarity(inputTokens, bugTokens) * 0.5;

    if (score > 0.3) {
      results.push({ bug, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function searchBugs(owlDir: string, term: string): BugEntry[] {
  const bugLog = readBugLog(owlDir);
  const lower = term.toLowerCase();
  return bugLog.bugs.filter(
    (b) =>
      b.error_message.toLowerCase().includes(lower) ||
      b.root_cause.toLowerCase().includes(lower) ||
      b.fix.toLowerCase().includes(lower) ||
      b.tags.some((t) => t.toLowerCase().includes(lower)) ||
      b.file.toLowerCase().includes(lower)
  );
}
