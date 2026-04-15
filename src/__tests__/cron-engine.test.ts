import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-cron-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { CronEngine } from "../core/daemon/cron-engine.js";

function makeEngine(
  owlDirOverride?: string,
  broadcastFn?: (msg: unknown) => void
): CronEngine {
  const owlDir = owlDirOverride ?? path.join(tmpDir, ".owl");
  fs.mkdirSync(owlDir, { recursive: true });

  const logs: string[] = [];
  const mockLogger = {
    info: (msg: string) => logs.push(`info:${msg}`),
    warn: (msg: string) => logs.push(`warn:${msg}`),
    error: (msg: string) => logs.push(`error:${msg}`),
    debug: (msg: string) => logs.push(`debug:${msg}`),
  };

  const broadcast = broadcastFn ?? (() => {});
  return new CronEngine(owlDir, tmpDir, mockLogger as any, broadcast);
}

describe("CronEngine", () => {
  it("executeTask with check_cerebrum_staleness calls staleness check", async () => {
    const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const owlDir = path.join(tmpDir, ".owl");
    fs.mkdirSync(owlDir, { recursive: true });
    fs.writeFileSync(path.join(owlDir, "cerebrum.md"), "# Cerebrum\n- entry");
    fs.utimesSync(path.join(owlDir, "cerebrum.md"), oldDate, oldDate);

    const broadcastMessages: unknown[] = [];
    const engine = makeEngine(owlDir, (msg) => broadcastMessages.push(msg));

    await engine["executeTask"]({
      id: "task-1",
      name: "Check Cerebrum Staleness",
      schedule: "* * * * *",
      description: "Check cerebrum freshness",
      action: { type: "check_cerebrum_staleness", params: { max_age_days: 14 } },
      retry: { max_attempts: 1, backoff: "linear", base_delay_seconds: 5 },
      failsafe: { on_failure: "log" },
      enabled: true,
    });

    expect(broadcastMessages.length).toBeGreaterThan(0);
    const staleMsg = broadcastMessages.find(
      (m: any) => m.type === "cerebrum_stale"
    ) as any;
    expect(staleMsg).toBeDefined();
    expect(staleMsg.age_days).toBeGreaterThanOrEqual(20);
  });

  it("executeTask with consolidate_memory consolidates old entries", async () => {
    const owlDir = path.join(tmpDir, ".owl");
    fs.mkdirSync(owlDir, { recursive: true });

    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldDateStr = oldDate.toISOString().slice(0, 10);

    const memoryContent = [
      `## Session: ${oldDateStr}`,
      `| 10:00 | wrote code | src/foo.ts | written | ~50 |`,
      `| 10:05 | read file | src/bar.ts | read | ~30 |`,
      `| 10:10 | edited | src/baz.ts | written | ~40 |`,
      ``,
      `## Session: ${new Date().toISOString().slice(0, 10)}`,
      `| 14:00 | started | — | — | ~0 |`,
      `| 14:05 | wrote code | src/new.ts | written | ~60 |`,
      ``,
    ].join("\n");

    fs.writeFileSync(path.join(owlDir, "memory.md"), memoryContent);

    const engine = makeEngine(owlDir);

    await engine["executeTask"]({
      id: "task-2",
      name: "Consolidate Memory",
      schedule: "0 0 * * *",
      description: "Consolidate old memory entries",
      action: { type: "consolidate_memory", params: { older_than_days: 7 } },
      retry: { max_attempts: 1, backoff: "linear", base_delay_seconds: 5 },
      failsafe: { on_failure: "log" },
      enabled: true,
    });

    const result = fs.readFileSync(path.join(owlDir, "memory.md"), "utf-8");
    expect(result).toContain("Consolidated session");
    expect(result).toContain("3 actions");
    expect(result).toContain("## Session: " + new Date().toISOString().slice(0, 10));
  });
});
