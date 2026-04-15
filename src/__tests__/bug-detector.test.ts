import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectBugFix, autoLogBug } from "../plugin/context/bug-detector.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-bug-det-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

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

  it("autoLogBug sets fix to 'unknown', not the summary", () => {
    const result = detectBugFix("src/foo.ts", "TypeError: Cannot read properties of undefined (reading 'foo')\n");
    expect(result.detected).toBe(true);

    autoLogBug(tmpDir, "src/foo.ts", result);

    const buglog = JSON.parse(fs.readFileSync(path.join(tmpDir, "buglog.json"), "utf-8"));
    expect(buglog.bugs).toHaveLength(1);
    expect(buglog.bugs[0].fix).toBe("unknown");
  });
});
