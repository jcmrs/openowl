import { describe, it, expect } from "vitest";
import { extractDoNotRepeatPatterns, checkDoNotRepeat } from "../plugin/context/cerebrum-guard.js";

describe("cerebrum-guard", () => {
  it("extracts patterns from Do-Not-Repeat section", () => {
    const patterns = extractDoNotRepeatPatterns("tests/fixtures");
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("returns null when no patterns match", () => {
    const match = checkDoNotRepeat("some random content that has nothing to do with anything", []);
    expect(match).toBeNull();
  });

  it("matches quoted strings with word boundaries", () => {
    const patterns = [
      { line: 'Never use "var" in TypeScript', patterns: ["var"] },
    ];
    const match1 = checkDoNotRepeat("const x = 1;", patterns);
    expect(match1).toBeNull();

    const match2 = checkDoNotRepeat("var result = compute();", patterns);
    expect(match2).not.toBeNull();
    expect(match2!.line).toContain("var");
  });

  it("does not match substrings", () => {
    const patterns = [
      { line: 'Never use "var" in TypeScript', patterns: ["var"] },
    ];
    const match = checkDoNotRepeat("const variable = 1;", patterns);
    expect(match).toBeNull();
  });

  it("extracts patterns from 'never use X' phrases", () => {
    const patterns = [
      { line: "Never use setTimeout for polling", patterns: ["setTimeout"] },
    ];
    const match1 = checkDoNotRepeat("const timer = setInterval(() => {}, 1000);", patterns);
    expect(match1).toBeNull();

    const match2 = checkDoNotRepeat("setTimeout(() => {}, 1000);", patterns);
    expect(match2).not.toBeNull();
  });

  it("matches case-insensitively", () => {
    const patterns = [
      { line: 'Never use "Var" anywhere', patterns: ["Var"] },
    ];
    const match = checkDoNotRepeat("var x = 1;", patterns);
    expect(match).not.toBeNull();
  });

  it("skips entries with no extractable patterns", () => {
    const patterns = [
      { line: "some general advice without quotes", patterns: [] },
    ];
    const match = checkDoNotRepeat("anything at all", patterns);
    expect(match).toBeNull();
  });
});
