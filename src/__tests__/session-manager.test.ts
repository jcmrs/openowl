import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { initSession, readSession, recordRead, recordWrite, finalizeSession, writeSession } from "../plugin/context/session-manager.js";
import { addSessionToLedger, readLedger } from "../core/tracker/token-ledger.js";

describe("session-manager", () => {
  it("initializes a session and reads it back", () => {
    const session = initSession(tmpDir, "test-session-1");
    expect(session.session_id).toBe("test-session-1");
    expect(session.reads).toHaveLength(0);
    expect(session.writes).toHaveLength(0);

    const loaded = readSession(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.session_id).toBe("test-session-1");
  });

  it("records reads and persists them", () => {
    initSession(tmpDir, "test-session-2");
    const session = readSession(tmpDir)!;
    recordRead(session, "src/index.ts", true, 50);
    writeSession(tmpDir, session);

    const loaded = readSession(tmpDir)!;
    expect(loaded.reads).toHaveLength(1);
    expect(loaded.reads[0].file_path).toBe("src/index.ts");
    expect(loaded.total_read_tokens).toBe(50);
  });

  it("records writes and persists them", () => {
    initSession(tmpDir, "test-session-3");
    const session = readSession(tmpDir)!;
    recordWrite(session, "src/foo.ts", "edited foo.ts", 30);
    writeSession(tmpDir, session);

    const loaded = readSession(tmpDir)!;
    expect(loaded.writes).toHaveLength(1);
    expect(loaded.edits_by_file["src/foo.ts"]).toBe(1);
    expect(loaded.total_write_tokens).toBe(30);
  });

  it("finalizes session and persists to ledger", () => {
    initSession(tmpDir, "test-session-4");
    const session = readSession(tmpDir)!;
    recordRead(session, "src/a.ts", false, 100);
    recordWrite(session, "src/b.ts", "edit", 50);
    writeSession(tmpDir, session);

    finalizeSession(tmpDir);

    // Session file should be cleaned up
    expect(readSession(tmpDir)).toBeNull();

    // Ledger should have the session
    const ledger = readLedger(tmpDir);
    expect(ledger.sessions).toHaveLength(1);
    expect(ledger.sessions[0].totals.reads_count).toBe(1);
    expect(ledger.sessions[0].totals.writes_count).toBe(1);
  });

  it("uses callID for read correlation", () => {
    initSession(tmpDir, "test-session-5");
    const session = readSession(tmpDir)!;
    recordRead(session, "src/a.ts", false, 50, "call-1");
    recordRead(session, "src/b.ts", false, 30, "call-2");
    writeSession(tmpDir, session);

    const loaded = readSession(tmpDir)!;
    expect(loaded.pending_read_call_ids).toBeDefined();
    expect(loaded.pending_read_call_ids!["call-1"]).toBe(0);
    expect(loaded.pending_read_call_ids!["call-2"]).toBe(1);
  });
});
