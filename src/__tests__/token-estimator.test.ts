import { describe, it, expect } from "vitest";
import { estimateTokensForFile } from "../core/tracker/token-estimator.js";

describe("estimateTokensForFile", () => {
  it("estimates code files at code ratio (3.0)", () => {
    const content = "a".repeat(300);
    const tokens = estimateTokensForFile(content, "src/index.ts");
    expect(tokens).toBe(100);
  });

  it("estimates prose files at prose ratio (3.8)", () => {
    const content = "a".repeat(380);
    const tokens = estimateTokensForFile(content, "README.md");
    expect(tokens).toBe(100);
  });

  it("handles unknown extensions with mixed ratio", () => {
    const content = "a".repeat(340);
    const tokens = estimateTokensForFile(content, "data.xyz");
    expect(tokens).toBe(100);
  });

  it("returns 0 for empty content", () => {
    expect(estimateTokensForFile("", "foo.ts")).toBe(0);
  });

  it("rounds up partial tokens", () => {
    const tokens = estimateTokensForFile("ab", "foo.ts");
    expect(tokens).toBe(1);
  });
});
