import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;
let owlDir: string;
let projectRoot: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-tool-before-"));
  owlDir = path.join(tmpDir, ".owl");
  projectRoot = tmpDir;
  fs.mkdirSync(owlDir, { recursive: true });

  fs.writeFileSync(
    path.join(owlDir, "cerebrum.md"),
    "# Cerebrum\n\n## do-not-repeat\n- Never import from internal utils barrel file because it causes module resolution errors\n"
  );

  fs.writeFileSync(
    path.join(owlDir, "anatomy.md"),
    "# anatomy.md\n\n## src/\n\n- `index.ts` — main entry (~100 tok)\n"
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
    })
  );

  fs.writeFileSync(
    path.join(owlDir, "memory.md"),
    ""
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { handleToolBefore } from "../plugin/events/tool-before.js";

describe("handleToolBefore", () => {
  it("records a read and checks anatomy", async () => {
    const warnings: string[] = [];
    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "read", sessionID: "sess-1", callID: "call-1" },
      { args: { path: path.join(projectRoot, "src", "index.ts") } },
      warnings
    );

    expect(warnings).toHaveLength(0);

    const session = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    expect(session.reads).toHaveLength(1);
    expect(session.reads[0].file_path).toContain("src");
    expect(session.reads[0].file_path).toContain("index.ts");
    expect(session.reads[0].anatomy_hit).toBe(true);
  });

  it("warns when a file was already read this session", async () => {
    const warnings: string[] = [];

    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "read", sessionID: "sess-1", callID: "call-1" },
      { args: { path: "src/index.ts" } },
      warnings
    );

    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "read", sessionID: "sess-1", callID: "call-2" },
      { args: { path: "src/index.ts" } },
      warnings
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("ALREADY READ");
    expect(warnings[0]).toContain("src/index.ts");
  });

  it("checks DNR and records write for tool write", async () => {
    const warnings: string[] = [];
    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "write", sessionID: "sess-1", callID: "call-3" },
      { args: { path: "src/foo.ts", new_string: "import from internal utils barrel file because it causes module resolution errors here" } },
      warnings
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CEREBRUM DNR");

    const session = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    expect(session.writes).toHaveLength(1);
    expect(session.writes[0].file_path).toBe("src/foo.ts");
  });

  it("does nothing for bash tool", async () => {
    const warnings: string[] = [];
    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "bash", sessionID: "sess-1", callID: "call-4" },
      { args: { command: "npm test" } },
      warnings
    );

    expect(warnings).toHaveLength(0);

    const session = JSON.parse(fs.readFileSync(path.join(owlDir, "_session.json"), "utf-8"));
    expect(session.reads).toHaveLength(0);
    expect(session.writes).toHaveLength(0);
  });

  it("does not crash when session file does not exist", async () => {
    const emptyOwl = fs.mkdtempSync(path.join(os.tmpdir(), "owl-no-session-"));
    try {
      const warnings: string[] = [];
      await handleToolBefore(
        emptyOwl,
        projectRoot,
        { tool: "read", sessionID: "sess-1", callID: "call-5" },
        { args: { path: "src/index.ts" } },
        warnings
      );
      expect(warnings).toHaveLength(0);
    } finally {
      fs.rmSync(emptyOwl, { recursive: true, force: true });
    }
  });

  it("populates warnings for DNR matches with edit tool", async () => {
    const warnings: string[] = [];
    await handleToolBefore(
      owlDir,
      projectRoot,
      { tool: "edit", sessionID: "sess-1", callID: "call-6" },
      { args: { path: "src/bar.ts", new_string: "import from internal utils barrel file because it causes module resolution errors again" } },
      warnings
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CEREBRUM DNR");
  });
});
