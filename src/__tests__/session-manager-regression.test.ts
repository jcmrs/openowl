import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-session-reg-"));
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import {
  initSession,
  readSession,
  recordRead,
  recordWrite,
  resolveReadByCallID,
  finalizeSession,
  writeSession,
} from "../plugin/context/session-manager.js";

describe("session-manager D-07/D-08/D-09 regression", () => {
  it("initSession creates session file", () => {
    initSession(tmpDir, "sess-1");
    const session = readSession(tmpDir);
    expect(session).not.toBeNull();
    expect(session!.session_id).toBe("sess-1");
    expect(session!.total_read_tokens).toBe(0);
  });

  it("recordRead and recordWrite update session state", () => {
    initSession(tmpDir, "sess-2");
    const state = readSession(tmpDir)!;
    recordRead(state, "src/a.ts", true, 200, "call-x");
    recordWrite(state, "src/b.ts", "edit b.ts", 100);
    writeSession(tmpDir, state);

    const loaded = readSession(tmpDir)!;
    expect(loaded.reads).toHaveLength(1);
    expect(loaded.reads[0].file_path).toBe("src/a.ts");
    expect(loaded.reads[0].estimated_tokens).toBe(200);
    expect(loaded.writes).toHaveLength(1);
    expect(loaded.writes[0].file_path).toBe("src/b.ts");
    expect(loaded.total_read_tokens).toBe(200);
    expect(loaded.total_write_tokens).toBe(100);
  });

  it("D-09: resolveReadByCallID with actualTokens < estimatedTokens keeps total_read_tokens >= 0", () => {
    initSession(tmpDir, "sess-3");
    const state = readSession(tmpDir)!;
    recordRead(state, "src/x.ts", false, 500, "call-a");
    writeSession(tmpDir, state);

    const loaded = readSession(tmpDir)!;
    resolveReadByCallID(loaded, "call-a", "src/x.ts", 50);
    expect(loaded.total_read_tokens).toBeGreaterThanOrEqual(0);
  });

  it("finalizeSession creates ledger entry and deletes session file", () => {
    initSession(tmpDir, "sess-4");
    const state = readSession(tmpDir)!;
    recordRead(state, "src/a.ts", false, 100);
    recordWrite(state, "src/b.ts", "fix", 50);
    writeSession(tmpDir, state);

    finalizeSession(tmpDir);

    expect(readSession(tmpDir)).toBeNull();

    const ledgerPath = path.join(tmpDir, "token-ledger.json");
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
    expect(ledger.sessions).toHaveLength(1);
    expect(ledger.sessions[0].totals.reads_count).toBe(1);
    expect(ledger.sessions[0].totals.writes_count).toBe(1);
  });

  it("D-07: session file exists on disk after initSession", () => {
    initSession(tmpDir, "sess-5");
    const sessionPath = path.join(tmpDir, "_session.json");
    expect(fs.existsSync(sessionPath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
    expect(raw.session_id).toBe("sess-5");
    expect(raw.reads).toEqual([]);
    expect(raw.writes).toEqual([]);
  });
});
