import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-token-ledger-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { addSessionToLedger, readLedger, incrementSessions } from "../core/tracker/token-ledger.js";

describe("token-ledger", () => {
  describe("readLedger", () => {
    it("returns default ledger when no file exists", () => {
      const ledger = readLedger(tmpDir);
      expect(ledger.version).toBe(1);
      expect(ledger.sessions).toHaveLength(0);
      expect(ledger.lifetime.total_sessions).toBe(0);
    });

    it("reads an existing ledger file", () => {
      const existing = {
        version: 1,
        created_at: new Date().toISOString(),
        lifetime: {
          total_tokens_estimated: 500,
          total_reads: 10,
          total_writes: 5,
          total_sessions: 2,
          anatomy_hits: 3,
          anatomy_misses: 7,
          repeated_reads_blocked: 1,
          estimated_savings_vs_bare_cli: 100,
        },
        sessions: [],
        daemon_usage: [],
        waste_flags: [],
        optimization_report: { last_generated: null, patterns: [] },
      };
      fs.writeFileSync(
        path.join(tmpDir, "token-ledger.json"),
        JSON.stringify(existing)
      );
      const ledger = readLedger(tmpDir);
      expect(ledger.lifetime.total_tokens_estimated).toBe(500);
      expect(ledger.lifetime.total_sessions).toBe(2);
    });
  });

  describe("addSessionToLedger", () => {
    it("adds a session entry and updates lifetime totals", () => {
      addSessionToLedger(tmpDir, {
        id: "sess-abc",
        started: "2025-01-01T00:00:00Z",
        ended: "2025-01-01T01:00:00Z",
        reads: [
          { file: "a.ts", tokens_estimated: 50, was_repeated: false, anatomy_had_description: true },
          { file: "b.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
        ],
        writes: [
          { file: "c.ts", tokens_estimated: 30, action: "edit" },
        ],
        totals: {
          input_tokens_estimated: 150,
          output_tokens_estimated: 30,
          reads_count: 2,
          writes_count: 1,
          repeated_reads_blocked: 0,
          anatomy_lookups: 1,
        },
      });

      const ledger = readLedger(tmpDir);
      expect(ledger.sessions).toHaveLength(1);
      expect(ledger.sessions[0].id).toBe("sess-abc");
      expect(ledger.lifetime.total_reads).toBe(2);
      expect(ledger.lifetime.total_writes).toBe(1);
      expect(ledger.lifetime.total_tokens_estimated).toBe(180);
      expect(ledger.lifetime.anatomy_hits).toBe(1);
    });

    it("accumulates across multiple session entries", () => {
      addSessionToLedger(tmpDir, {
        id: "sess-1",
        started: "2025-01-01T00:00:00Z",
        ended: "2025-01-01T01:00:00Z",
        reads: [],
        writes: [],
        totals: {
          input_tokens_estimated: 100,
          output_tokens_estimated: 50,
          reads_count: 5,
          writes_count: 2,
          repeated_reads_blocked: 1,
          anatomy_lookups: 3,
        },
      });

      addSessionToLedger(tmpDir, {
        id: "sess-2",
        started: "2025-01-02T00:00:00Z",
        ended: "2025-01-02T01:00:00Z",
        reads: [],
        writes: [],
        totals: {
          input_tokens_estimated: 200,
          output_tokens_estimated: 80,
          reads_count: 10,
          writes_count: 4,
          repeated_reads_blocked: 2,
          anatomy_lookups: 5,
        },
      });

      const ledger = readLedger(tmpDir);
      expect(ledger.sessions).toHaveLength(2);
      expect(ledger.lifetime.total_tokens_estimated).toBe(430);
      expect(ledger.lifetime.total_reads).toBe(15);
      expect(ledger.lifetime.total_writes).toBe(6);
      expect(ledger.lifetime.anatomy_hits).toBe(8);
      expect(ledger.lifetime.repeated_reads_blocked).toBe(3);
    });
  });

  describe("incrementSessions", () => {
    it("increments session count from default ledger", () => {
      incrementSessions(tmpDir);
      const ledger = readLedger(tmpDir);
      expect(ledger.lifetime.total_sessions).toBe(1);

      incrementSessions(tmpDir);
      const ledger2 = readLedger(tmpDir);
      expect(ledger2.lifetime.total_sessions).toBe(2);
    });

    it("increments session count preserving other lifetime fields", () => {
      addSessionToLedger(tmpDir, {
        id: "sess-x",
        started: "2025-01-01T00:00:00Z",
        ended: "2025-01-01T01:00:00Z",
        reads: [],
        writes: [],
        totals: {
          input_tokens_estimated: 300,
          output_tokens_estimated: 100,
          reads_count: 8,
          writes_count: 3,
          repeated_reads_blocked: 0,
          anatomy_lookups: 4,
        },
      });

      incrementSessions(tmpDir);

      const ledger = readLedger(tmpDir);
      expect(ledger.lifetime.total_sessions).toBe(1);
      expect(ledger.lifetime.total_tokens_estimated).toBe(400);
    });
  });
});
