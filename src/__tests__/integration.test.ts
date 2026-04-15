import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-integ-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { OpenOwlPlugin } from "../plugin/index.js";

function setupProject(): string {
  const owlDir = path.join(tmpDir, ".owl");
  fs.mkdirSync(owlDir, { recursive: true });

  fs.writeFileSync(path.join(owlDir, "cerebrum.md"), [
    "## Key Learnings",
    "- [project] Always use TypeScript strict mode",
    "",
    "## Do-Not-Repeat",
    "- Never use var, always use const or let",
    "",
  ].join("\n"));

  fs.writeFileSync(path.join(owlDir, "anatomy.md"), [
    "# anatomy.md",
    "",
    `> Auto-maintained by OpenOwl. Last scanned: ${new Date().toISOString()}`,
    "> Files: 1 tracked | Anatomy hits: 0 | Misses: 0",
    "",
    "## ./",
    "",
    "- `index.ts` — Main entry point (~200 tok)",
    "",
  ].join("\n"));

  fs.writeFileSync(path.join(owlDir, "config.json"), JSON.stringify({
    version: 1,
    openowl: {
      injection: { enabled: true, max_tokens: 2500 },
      anatomy: { max_description_length: 100, max_files: 500, exclude_patterns: ["node_modules", ".git", "dist", "build", ".owl"], llm_descriptions: "off" },
      token_audit: { chars_per_token_code: 3.0, chars_per_token_prose: 3.8 },
    },
  }));

  fs.writeFileSync(path.join(owlDir, "_session.json"), JSON.stringify({
    session_id: "test-session-integration",
    started_at: new Date().toISOString(),
    reads: [],
    writes: [],
    edits_by_file: {},
    total_read_tokens: 0,
    total_write_tokens: 0,
    cerebrum_updated: false,
    buglog_entries: [],
  }));

  fs.writeFileSync(path.join(owlDir, "memory.md"), "# Memory\n");
  fs.writeFileSync(path.join(owlDir, "buglog.json"), JSON.stringify({ version: 1, bugs: [] }));

  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
    name: "test-integration",
    description: "Integration test project",
  }));

  return tmpDir;
}

describe("OpenOwlPlugin integration", () => {
  it("full lifecycle: hooks, injection, tool handling, compacting", async () => {
    const projectDir = setupProject();
    const owlDir = path.join(projectDir, ".owl");

    const mockCtx = {
      directory: projectDir,
      client: {
        app: {
          log: async () => {},
        },
      },
    };

    const hooks = await OpenOwlPlugin(mockCtx as any);

    const expectedHooks = [
      "experimental.chat.system.transform",
      "event",
      "tool.execute.before",
      "tool.execute.after",
      "experimental.session.compacting",
    ];
    for (const hookName of expectedHooks) {
      expect(hooks).toHaveProperty(hookName);
    }

    const systemTransform = hooks["experimental.chat.system.transform"] as Function;
    const systemArray = ["system message 1"];
    const output = { system: systemArray };
    await systemTransform({}, output);
    expect(output.system.length).toBeGreaterThan(1);
    expect(output.system[output.system.length - 1]).toContain("<owl-context>");

    const toolBefore = hooks["tool.execute.before"] as Function;
    const toolBeforeOutput = { args: { filePath: path.join(projectDir, "index.ts") } };
    await toolBefore(
      { tool: "read", sessionID: "test-session-integration", callID: "call-1" },
      toolBeforeOutput
    );

    const toolAfter = hooks["tool.execute.after"] as Function;
    const writeFilePath = path.join(projectDir, "src", "utils.ts");
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(writeFilePath, "export const x = 1;\n");
    await toolAfter(
      {
        tool: "write",
        sessionID: "test-session-integration",
        callID: "call-2",
        args: { filePath: writeFilePath, content: "export const x = 2;\n" },
      },
      { title: "write", output: "", metadata: {} }
    );

    const anatomyAfter = fs.readFileSync(path.join(owlDir, "anatomy.md"), "utf-8");
    expect(anatomyAfter).toContain("utils.ts");

    const compacting = hooks["experimental.session.compacting"] as Function;
    const compactOutput = { context: [] as string[] };
    await compacting({ sessionID: "test-session-integration" }, compactOutput);
    expect(compactOutput.context.length).toBeGreaterThan(0);
    expect(compactOutput.context[0]).toContain("OpenOwl");

    const memoryAfter = fs.readFileSync(path.join(owlDir, "memory.md"), "utf-8");
    expect(memoryAfter.length).toBeGreaterThan("# Memory\n".length);
  });
});
