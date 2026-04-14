import { describe, it, expect } from "vitest";
import { extractDoNotRepeatPatterns, checkDoNotRepeat } from "../plugin/context/cerebrum-guard.js";

describe("cerebrum-guard", () => {
  it("extracts patterns from Do-Not-Repeat section", () => {
    const patterns = extractDoNotRepeatPatterns("tests/fixtures");
    // Should not throw, returns empty array for nonexistent file
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("returns null when no patterns match", () => {
    const match = checkDoNotRepeat("some random content that has nothing to do with anything", []);
    expect(match).toBeNull();
  });

  it("requires minimum 3 matching tokens and threshold > 0.6", () => {
    const patterns = [
      { line: "use const not var", pattern: "use const not var" },
    ];
    // "const x = 1" — only 1 matching token — should NOT match
    const match1 = checkDoNotRepeat("const x = 1;", patterns);
    expect(match1).toBeNull();

    // Short pattern diluted by many unique tokens in content — should NOT match (Jaccard < 0.6)
    const match2 = checkDoNotRepeat("You should always use const not var in this project", patterns);
    expect(match2).toBeNull();

    // High-density match — should match
    const patterns2 = [
      { line: "always use const not var never let", pattern: "always use const not var never let" },
    ];
    const match3 = checkDoNotRepeat("Please always use const not var never let in this code", patterns2);
    expect(match3).not.toBeNull();
  });
});
