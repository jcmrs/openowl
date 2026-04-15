import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-stat-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { statusCommand } from "../cli/status.js";

function writeOwlFile(name: string, content: string): void {
  const owlDir = path.join(tmpDir, ".owl");
  fs.mkdirSync(owlDir, { recursive: true });
  fs.writeFileSync(path.join(owlDir, name), content, "utf-8");
}

describe("statusCommand", () => {
  it("prints not initialized when .owl/ is missing", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await statusCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    expect(logs.some((l) => l.includes("not initialized"))).toBe(true);
  });

  it("prints file counts and stats when .owl/ is present", async () => {
    writeOwlFile("OWL.md", "# OWL");
    writeOwlFile("identity.md", "# Identity");
    writeOwlFile("cerebrum.md", "## Key Learnings\n- test entry");
    writeOwlFile("memory.md", "# Memory");
    writeOwlFile("anatomy.md", `# anatomy.md\n\n## ./\n\n- \`index.ts\` — main (~100 tok)\n`);
    writeOwlFile("config.json", JSON.stringify({ version: 1 }));
    writeOwlFile("token-ledger.json", JSON.stringify({
      lifetime: { total_sessions: 5, total_reads: 100, total_writes: 20, total_tokens_estimated: 50000, estimated_savings_vs_bare_cli: 10000 },
    }));
    writeOwlFile("buglog.json", JSON.stringify({ bugs: [{ id: "bug-1", error_message: "test" }] }));
    writeOwlFile("cron-manifest.json", JSON.stringify({ version: 1, tasks: [] }));
    writeOwlFile("cron-state.json", JSON.stringify({ engine_status: "running", last_heartbeat: null }));

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await statusCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("OpenOwl Status");
    expect(allOutput).toContain("All 10 core files present");
    expect(allOutput).toContain("Sessions: 5");
    expect(allOutput).toContain("Total reads: 100");
    expect(allOutput).toContain("Anatomy: 1 files tracked");
    expect(allOutput).toContain("Buglog: 1 entries");
    expect(allOutput).toContain("Daemon: running");
  });
});
