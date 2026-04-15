import { describe, it, expect } from "vitest";
import { detectBugFix } from "../plugin/context/bug-detector.js";

describe("bug-detector", () => {
  it("detects TypeError pattern in new content", () => {
    const content = `
TypeError: Cannot read properties of undefined (reading 'foo')
    at Object.<anonymous> (src/foo.ts:5:10)
`;
    const result = detectBugFix("src/foo.ts", content);
    expect(result.detected).toBe(true);
    expect(result.category).toBe("runtime_error");
  });

  it("skips if pattern already exists in oldContent", () => {
    const oldContent = `
// TypeError: Cannot read properties of null (reading 'x')
`;
    const newContent = oldContent + "\nconst y = 1;\n";

    const result = detectBugFix("src/foo.ts", newContent, oldContent);
    expect(result.detected).toBe(false);
  });

  it("D-11: skips if match is inside a catch/throw context", () => {
    const content = `
try {
  doSomething();
} catch (e: TypeError) {
  console.error(e);
  throw new TypeError("rethrown");
}
`;
    const result = detectBugFix("src/handler.ts", content);
    expect(result.detected).toBe(false);
  });

  it("returns detected:false for benign content", () => {
    const content = `
function add(a: number, b: number): number {
  return a + b;
}
`;
    const result = detectBugFix("src/math.ts", content);
    expect(result.detected).toBe(false);
  });
});
