import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-waste-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { detectWaste } from "../core/tracker/waste-detector.js";

describe("detectWaste", () => {
  it("detects repeated reads within a session", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 1000,
        total_reads: 4,
        total_writes: 0,
        total_sessions: 1,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [
        {
          id: "sess-repeat",
          started: "2025-01-01T00:00:00Z",
          ended: "2025-01-01T01:00:00Z",
          reads: [
            { file: "src/index.ts", tokens_estimated: 300, was_repeated: false, anatomy_had_description: false },
            { file: "src/index.ts", tokens_estimated: 300, was_repeated: false, anatomy_had_description: false },
          ],
          writes: [],
          totals: {
            input_tokens_estimated: 600,
            output_tokens_estimated: 0,
            reads_count: 2,
            writes_count: 0,
            repeated_reads_blocked: 0,
            anatomy_lookups: 0,
          },
        },
      ],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "small memory");

    const flags = detectWaste(tmpDir);
    const repeatedFlags = flags.filter((f) => f.pattern === "repeated_reads");
    expect(repeatedFlags).toHaveLength(1);
    expect(repeatedFlags[0].description).toContain("src/index.ts");
    expect(repeatedFlags[0].tokens_wasted).toBe(300);
  });

  it("detects anatomy_could_suffice when anatomy had a description for a large read", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 800,
        total_reads: 1,
        total_writes: 0,
        total_sessions: 1,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [
        {
          id: "sess-anatomy",
          started: "2025-01-01T00:00:00Z",
          ended: "2025-01-01T01:00:00Z",
          reads: [
            { file: "src/big-module.ts", tokens_estimated: 800, was_repeated: false, anatomy_had_description: true },
          ],
          writes: [],
          totals: {
            input_tokens_estimated: 800,
            output_tokens_estimated: 0,
            reads_count: 1,
            writes_count: 0,
            repeated_reads_blocked: 0,
            anatomy_lookups: 0,
          },
        },
      ],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "small memory");

    const flags = detectWaste(tmpDir);
    const anatomyFlags = flags.filter((f) => f.pattern === "anatomy_could_suffice");
    expect(anatomyFlags).toHaveLength(1);
    expect(anatomyFlags[0].tokens_wasted).toBe(800);
  });

  it("detects memory_bloat when memory.md is large", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 0,
        total_reads: 0,
        total_writes: 0,
        total_sessions: 0,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));

    const largeMemory = "x".repeat(20000);
    fs.writeFileSync(path.join(tmpDir, "memory.md"), largeMemory);

    const flags = detectWaste(tmpDir);
    const bloatFlags = flags.filter((f) => f.pattern === "memory_bloat");
    expect(bloatFlags).toHaveLength(1);
    expect(bloatFlags[0].tokens_wasted).toBeGreaterThan(0);
  });

  it("detects cerebrum_stale when cerebrum.md is old", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 0,
        total_reads: 0,
        total_writes: 0,
        total_sessions: 0,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "small");

    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    fs.utimesSync(cerebrumPath, new Date(thirtyDaysAgo), new Date(thirtyDaysAgo));

    const flags = detectWaste(tmpDir);
    const staleFlags = flags.filter((f) => f.pattern === "cerebrum_stale");
    expect(staleFlags).toHaveLength(1);
    expect(staleFlags[0].description).toContain("days");
  });

  it("detects anatomy_miss_rate when miss rate exceeds threshold", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 500,
        total_reads: 5,
        total_writes: 0,
        total_sessions: 1,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [
        {
          id: "sess-miss",
          started: "2025-01-01T00:00:00Z",
          ended: "2025-01-01T01:00:00Z",
          reads: [
            { file: "src/a.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
            { file: "src/b.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
            { file: "src/c.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
            { file: "src/d.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
            { file: "src/e.ts", tokens_estimated: 100, was_repeated: false, anatomy_had_description: false },
          ],
          writes: [],
          totals: {
            input_tokens_estimated: 500,
            output_tokens_estimated: 0,
            reads_count: 5,
            writes_count: 0,
            repeated_reads_blocked: 0,
            anatomy_lookups: 1,
          },
        },
      ],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "small memory");

    const flags = detectWaste(tmpDir);
    const missFlags = flags.filter((f) => f.pattern === "anatomy_miss_rate");
    expect(missFlags).toHaveLength(1);
  });

  it("returns empty array when there is no waste", () => {
    const ledger = {
      version: 1,
      created_at: new Date().toISOString(),
      lifetime: {
        total_tokens_estimated: 0,
        total_reads: 0,
        total_writes: 0,
        total_sessions: 0,
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_blocked: 0,
        estimated_savings_vs_bare_cli: 0,
      },
      sessions: [],
      daemon_usage: [],
      waste_flags: [],
      optimization_report: { last_generated: null, patterns: [] },
    };

    fs.writeFileSync(path.join(tmpDir, "token-ledger.json"), JSON.stringify(ledger));
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "small memory");

    const now = new Date();
    fs.writeFileSync(path.join(tmpDir, "cerebrum.md"), "# Cerebrum");
    fs.utimesSync(path.join(tmpDir, "cerebrum.md"), now, now);

    const flags = detectWaste(tmpDir);
    expect(flags).toHaveLength(0);
  });

  it("returns empty array when ledger has no sessions and no memory/cerebrum files", () => {
    const flags = detectWaste(tmpDir);
    expect(flags).toHaveLength(0);
  });
});
