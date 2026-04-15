import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-cerebrum-reg-"));
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { extractDoNotRepeatPatterns } from "../plugin/context/cerebrum-guard.js";

describe("cerebrum-guard D-10 regression", () => {
  it("D-10: '## do-not-repeat' (lowercase) extracts patterns", () => {
    fs.writeFileSync(
      path.join(tmpDir, "cerebrum.md"),
      [
        "## do-not-repeat",
        "- Never use var, always use const or let",
        "- Do not import lodash when native methods suffice",
      ].join("\n")
    );

    const patterns = extractDoNotRepeatPatterns(tmpDir);
    expect(patterns.length).toBe(2);
    expect(patterns[0].line).toContain("Never use var");
    expect(patterns[1].line).toContain("Do not import lodash");
  });

  it("'## Do-Not-Repeat' (original case) still works", () => {
    fs.writeFileSync(
      path.join(tmpDir, "cerebrum.md"),
      [
        "## Do-Not-Repeat",
        "- Always prefer early returns",
      ].join("\n")
    );

    const patterns = extractDoNotRepeatPatterns(tmpDir);
    expect(patterns.length).toBe(1);
    expect(patterns[0].line).toContain("Always prefer early returns");
  });

  it("'## DO NOT REPEAT' (spaces, uppercase) is NOT matched — known gap", () => {
    fs.writeFileSync(
      path.join(tmpDir, "cerebrum.md"),
      [
        "## DO NOT REPEAT",
        "- Avoid global state in modules",
      ].join("\n")
    );

    const patterns = extractDoNotRepeatPatterns(tmpDir);
    expect(patterns.length).toBe(0);
  });

  it("empty cerebrum returns empty array", () => {
    fs.writeFileSync(path.join(tmpDir, "cerebrum.md"), "");

    const patterns = extractDoNotRepeatPatterns(tmpDir);
    expect(patterns).toEqual([]);
  });
});
