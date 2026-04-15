import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-memlog-test-"));
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { logToMemory } from "../plugin/context/memory-logger.js";

const HEADER_LINES = [
  "# Memory Log",
  "",
  "| Time | Action | Files | Outcome | Tokens |",
  "|------|--------|-------|---------|--------|",
  "> Chronological",
  "",
];

function countLines(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  return content.split("\n").length;
}

describe("memory-logger D-03 regression", () => {
  it("normal logging appends a line", () => {
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "");
    logToMemory(tmpDir, "edit", "src/foo.ts", "success", 100);

    const content = fs.readFileSync(path.join(tmpDir, "memory.md"), "utf-8");
    expect(content).toContain("edit");
    expect(content).toContain("src/foo.ts");
    expect(content).toContain("~100");
  });

  it("with > Chronological marker: trimming preserves header", () => {
    const header = HEADER_LINES.join("\n") + "\n";
    fs.writeFileSync(path.join(tmpDir, "memory.md"), header);

    for (let i = 0; i < 205; i++) {
      logToMemory(tmpDir, "read", `file${i}.ts`, "ok", 10);
    }

    const content = fs.readFileSync(path.join(tmpDir, "memory.md"), "utf-8");
    expect(content).toContain("> Chronological");
    const lines = content.split("\n");
    expect(lines.length).toBeLessThanOrEqual(220);
  });

  it("D-03: without > Chronological marker, header is lost after trimming (known bug)", () => {
    const minimalHeader = "# Memory Log\n\n";
    fs.writeFileSync(path.join(tmpDir, "memory.md"), minimalHeader);

    for (let i = 0; i < 210; i++) {
      logToMemory(tmpDir, "read", `file${i}.ts`, "ok", 10);
    }

    const content = fs.readFileSync(path.join(tmpDir, "memory.md"), "utf-8");
    const lines = content.split("\n");
    expect(lines.length).toBeLessThanOrEqual(210);
    expect(content.startsWith("# Memory Log")).toBe(false);
  });

  it("empty memory.md: logging works (creates content)", () => {
    fs.writeFileSync(path.join(tmpDir, "memory.md"), "");
    logToMemory(tmpDir, "init", "—", "—", 0);

    const content = fs.readFileSync(path.join(tmpDir, "memory.md"), "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });
});
