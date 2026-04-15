import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-scan-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
  fs.mkdirSync(path.join(tmpDir, ".owl"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, ".owl", "config.json"), JSON.stringify({
    version: 1,
    openowl: {
      anatomy: { max_description_length: 100, max_files: 500, exclude_patterns: ["node_modules", ".git", "dist", "build", ".owl"], llm_descriptions: "off" },
      token_audit: { chars_per_token_code: 3.0, chars_per_token_prose: 3.8 },
    },
  }));
  fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const hello = 'world';\n");
  fs.writeFileSync(path.join(tmpDir, "src", "utils.ts"), "export function add(a: number, b: number) { return a + b; }\n");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { scanCommand } from "../cli/scan.js";

describe("scanCommand", () => {
  it("creates anatomy.md with scanned files", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await scanCommand({});
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    const anatomyPath = path.join(tmpDir, ".owl", "anatomy.md");
    expect(fs.existsSync(anatomyPath)).toBe(true);
    const content = fs.readFileSync(anatomyPath, "utf-8");
    expect(content).toContain("anatomy.md");
    expect(content).toContain("Last scanned:");
    expect(content).toContain("index.ts");
    expect(content).toContain("utils.ts");
  });
});
