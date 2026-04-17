import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;
let owlDir: string;
let projectRoot: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-tool-after-"));
  owlDir = path.join(tmpDir, ".owl");
  projectRoot = tmpDir;
  fs.mkdirSync(owlDir, { recursive: true });

  fs.writeFileSync(
    path.join(owlDir, "anatomy.md"),
    "# anatomy.md\n\n> Auto-maintained by OpenOwl.\n"
  );

  fs.writeFileSync(
    path.join(owlDir, "memory.md"),
    ""
  );

  fs.writeFileSync(
    path.join(owlDir, "_session.json"),
    JSON.stringify({
      session_id: "sess-1",
      started_at: new Date().toISOString(),
      reads: [],
      writes: [],
      edits_by_file: {},
      total_read_tokens: 0,
      total_write_tokens: 0,
      cerebrum_updated: false,
      buglog_entries: [],
      pending_read_call_ids: {},
    })
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { handleToolAfter } from "../plugin/events/tool-after.js";

describe("handleToolAfter", () => {
  it("updates anatomy and logs memory for write tool", async () => {
    const targetFile = path.join(projectRoot, "src", "new-file.ts");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "export const x = 1;");

    const warnings: string[] = [];
    await handleToolAfter(
      owlDir,
      projectRoot,
      { tool: "write", sessionID: "sess-1", callID: "call-1", args: { filePath: targetFile, content: "export const x = 1;" } },
      { title: "write", output: "OK", metadata: {} },
      warnings
    );

    expect(warnings).toHaveLength(0);

    const anatomyContent = fs.readFileSync(path.join(owlDir, "anatomy.md"), "utf-8");
    expect(anatomyContent).toContain("new-file.ts");

    const memoryContent = fs.readFileSync(path.join(owlDir, "memory.md"), "utf-8");
    expect(memoryContent).toContain("Created");
  });

  it("resolves read by callID and logs memory for read tool", async () => {
    const warnings: string[] = [];

    const session = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    session.reads = [{
      file_path: "src/index.ts",
      timestamp: new Date().toISOString(),
      anatomy_hit: false,
      estimated_tokens: 50,
    }];
    session.pending_read_call_ids = { "call-2": 0 };
    fs.writeFileSync(path.join(owlDir, "_session.json"), JSON.stringify(session));

    await handleToolAfter(
      owlDir,
      projectRoot,
      { tool: "read", sessionID: "sess-1", callID: "call-2", args: { filePath: "src/index.ts" } },
      { title: "read", output: "export const x = 1;\nexport const y = 2;", metadata: {} },
      warnings
    );

    expect(warnings).toHaveLength(0);

    const updated = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    expect(updated.reads).toHaveLength(1);
    expect(updated.reads[0].actual_tokens).toBeGreaterThan(0);
  });

  it("does not auto-detect bugs (disabled)", async () => {
    const targetFile = path.join(projectRoot, "src", "fix.ts");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "");

    const warnings: string[] = [];
    await handleToolAfter(
      owlDir,
      projectRoot,
      { tool: "edit", sessionID: "sess-1", callID: "call-3", args: { filePath: targetFile, oldString: "old", newString: "const result = obj.nested.value;\nconst msg = TypeError: Cannot read properties of undefined (reading 'nested')\n" } },
      { title: "edit", output: "OK", metadata: {} },
      warnings
    );

    const bugWarning = warnings.find((w: string) => w.includes("BUG DETECTED"));
    expect(bugWarning).toBeUndefined();

    const bugLogPath = path.join(owlDir, "buglog.json");
    expect(fs.existsSync(bugLogPath)).toBe(false);
  });

  it("warns about multi-edit on files edited many times", async () => {
    const targetFile = path.join(projectRoot, "src", "multi.ts");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "");

    const session = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    session.edits_by_file = { [targetFile]: 2 };
    session.churn_warned_files = [];
    session.auto_bug_log_count = 0;
    fs.writeFileSync(path.join(owlDir, "_session.json"), JSON.stringify(session));

    const warnings: string[] = [];
    await handleToolAfter(
      owlDir,
      projectRoot,
      { tool: "write", sessionID: "sess-1", callID: "call-4", args: { filePath: targetFile, content: "more edits" } },
      { title: "write", output: "OK", metadata: {} },
      warnings
    );

    const multiEdit = warnings.find((w: string) => w.includes("MULTI-EDIT"));
    expect(multiEdit).toBeDefined();
    expect(multiEdit).toContain("3 times");
  });

  it("does not crash when session file does not exist", async () => {
    const emptyOwl = fs.mkdtempSync(path.join(os.tmpdir(), "owl-no-session-after-"));
    try {
      const warnings: string[] = [];
      await handleToolAfter(
        emptyOwl,
        projectRoot,
        { tool: "read", sessionID: "sess-1", callID: "call-5", args: { filePath: "x.ts" } },
        { title: "read", output: "", metadata: {} },
        warnings
      );
      expect(warnings).toHaveLength(0);
    } finally {
      fs.rmSync(emptyOwl, { recursive: true, force: true });
    }
  });
});
