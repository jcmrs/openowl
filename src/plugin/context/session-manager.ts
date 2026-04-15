import * as path from "node:path";
import * as fs from "node:fs";
import { readJSON, writeJSON, readText, appendText } from "../../core/utils/fs-safe.js";
import { addSessionToLedger, incrementSessions } from "../../core/tracker/token-ledger.js";
import type { SessionEntry } from "../../core/tracker/token-ledger.js";
import { appendCerebrumEntry } from "./cerebrum-logger.js";

export interface SessionState {
  session_id: string;
  started_at: string;
  reads: SessionRead[];
  writes: SessionWrite[];
  edits_by_file: Record<string, number>;
  total_read_tokens: number;
  total_write_tokens: number;
  cerebrum_updated: boolean;
  buglog_entries: string[];
  auto_bug_log_count: number;
  churn_warned_files: string[];
  pending_read_call_ids?: Record<string, number>;
}

interface SessionRead {
  file_path: string;
  timestamp: string;
  anatomy_hit: boolean;
  estimated_tokens: number;
  actual_tokens?: number;
}

interface SessionWrite {
  file_path: string;
  timestamp: string;
  summary: string;
  estimated_tokens: number;
  is_bug_fix: boolean;
}

function getSessionPath(owlDir: string): string {
  return path.join(owlDir, "_session.json");
}

function cleanTempFiles(owlDir: string): void {
  const tmpPattern = /^.*\.tmp$/;
  try {
    const files = fs.readdirSync(owlDir);
    for (const file of files) {
      if (tmpPattern.test(file)) {
        try { fs.unlinkSync(path.join(owlDir, file)); } catch {}
      }
    }
  } catch {}
}

export function initSession(owlDir: string, sessionId: string): SessionState {
  cleanTempFiles(owlDir);

  const state: SessionState = {
    session_id: sessionId,
    started_at: new Date().toISOString(),
    reads: [],
    writes: [],
    edits_by_file: {},
    total_read_tokens: 0,
    total_write_tokens: 0,
    cerebrum_updated: false,
    buglog_entries: [],
    auto_bug_log_count: 0,
    churn_warned_files: [],
  };

  writeJSON(getSessionPath(owlDir), state);

  if (!fs.existsSync(getSessionPath(owlDir))) {
    console.error("[OpenOwl] CRITICAL: Failed to write session state file");
  }

  try {
    incrementSessions(owlDir);
  } catch {
    console.error("[OpenOwl] Failed to increment session count in ledger");
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  appendText(
    path.join(owlDir, "memory.md"),
    `\n## Session: ${dateStr} ${timeStr}\n\n| Time | Action | File(s) | Outcome | ~Tokens |\n|------|--------|---------|---------|--------|\n`
  );

  return state;
}

export function readSession(owlDir: string): SessionState | null {
  return readJSON<SessionState | null>(getSessionPath(owlDir), null);
}

export function writeSession(owlDir: string, state: SessionState): void {
  writeJSON(getSessionPath(owlDir), state);
}

export function recordRead(
  state: SessionState,
  filePath: string,
  anatomyHit: boolean,
  estimatedTokens: number,
  callID?: string
): void {
  const entry: SessionRead = {
    file_path: filePath,
    timestamp: new Date().toISOString(),
    anatomy_hit: anatomyHit,
    estimated_tokens: estimatedTokens,
  };
  state.reads.push(entry);
  state.total_read_tokens += estimatedTokens;
  if (callID) {
    state.pending_read_call_ids = state.pending_read_call_ids ?? {};
    state.pending_read_call_ids[callID] = state.reads.length - 1;
  }
}

export function recordWrite(
  state: SessionState,
  filePath: string,
  summary: string,
  estimatedTokens: number
): void {
  state.writes.push({
    file_path: filePath,
    timestamp: new Date().toISOString(),
    summary,
    estimated_tokens: estimatedTokens,
    is_bug_fix: false,
  });
  state.total_write_tokens += estimatedTokens;
  state.edits_by_file[filePath] = (state.edits_by_file[filePath] ?? 0) + 1;
}

export function resolveReadByCallID(
  state: SessionState,
  callID: string,
  filePath: string,
  actualTokens: number
): void {
  const idx = state.pending_read_call_ids?.[callID];
  if (idx !== undefined && state.reads[idx]) {
    state.reads[idx].actual_tokens = actualTokens;
    state.total_read_tokens += Math.max(0, actualTokens - state.reads[idx].estimated_tokens);
    delete state.pending_read_call_ids![callID];
  } else {
    const normalized = filePath.replace(/\\/g, "/");
    const lastIdx = state.reads.length - 1;
    if (lastIdx >= 0 && state.reads[lastIdx].file_path.replace(/\\/g, "/") === normalized) {
      state.reads[lastIdx].actual_tokens = actualTokens;
      state.total_read_tokens += Math.max(0, actualTokens - state.reads[lastIdx].estimated_tokens);
    }
  }
}

export function finalizeSession(owlDir: string): void {
  const sessionPath = getSessionPath(owlDir);
  const state = readJSON<SessionState | null>(sessionPath, null);
  if (!state) return;

  const sessionEntry: SessionEntry = {
    id: state.session_id,
    started: state.started_at,
    ended: new Date().toISOString(),
    reads: state.reads.map((r) => ({
      file: r.file_path,
      tokens_estimated: r.estimated_tokens,
      was_repeated: false,
      anatomy_had_description: r.anatomy_hit,
    })),
    writes: state.writes.map((w) => ({
      file: w.file_path,
      tokens_estimated: w.estimated_tokens,
      action: w.summary,
    })),
    totals: {
      input_tokens_estimated: state.total_read_tokens,
      output_tokens_estimated: state.total_write_tokens,
      reads_count: state.reads.length,
      writes_count: state.writes.length,
      repeated_reads_blocked: 0,
      anatomy_lookups: state.reads.filter((r) => r.anatomy_hit).length,
    },
  };

  addSessionToLedger(owlDir, sessionEntry);

  try {
    fs.unlinkSync(sessionPath);
  } catch (err) {
    console.error("[OpenOwl] Failed to clean up session file:", err);
  }

  const files = state.writes.map((w) => path.basename(w.file_path));
  const unique = [...new Set(files)];
  const totalTokens = state.total_read_tokens + state.total_write_tokens;
  const fileListStr = unique.length > 0 ? unique.join(", ") : "\u2014";

  appendText(
    path.join(owlDir, "memory.md"),
    `\n| --:-- | Session end: ${state.writes.length} write(s) across ${unique.length} file(s) (${fileListStr}) | ${state.reads.length} reads | ~${totalTokens} tokens |\n`
  );

  if (state.writes.length >= 2) {
    appendCerebrumEntry(
      owlDir,
      "key-learnings",
      "session",
      `Modified ${unique.length} file(s): ${unique.join(", ")} (${state.reads.length} reads, ~${totalTokens} tokens)`
    );
  }
}
