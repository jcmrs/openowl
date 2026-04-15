import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { logBug, findSimilarBugs, searchBugs } from "../core/buglog/bug-tracker.js";

describe("bug-tracker", () => {
  it("logs a bug and reads it back", () => {
    logBug(tmpDir, {
      error_message: "Cannot find module 'foo'",
      file: "src/index.ts",
      root_cause: "Missing dependency",
      fix: "npm install foo",
      tags: ["import", "module"],
    });

    const result = searchBugs(tmpDir, "Cannot find module");
    expect(result).toHaveLength(1);
    expect(result[0].error_message).toBe("Cannot find module 'foo'");
    expect(result[0].tags).toEqual(["import", "module"]);
  });

  it("generates monotonic IDs (not positional)", () => {
    logBug(tmpDir, {
      error_message: "bug one",
      file: "a.ts",
      root_cause: "r",
      fix: "f",
      tags: [],
    });
    logBug(tmpDir, {
      error_message: "bug two",
      file: "b.ts",
      root_cause: "r",
      fix: "f",
      tags: [],
    });

    const results = searchBugs(tmpDir, "bug");
    expect(results).toHaveLength(2);
    expect(results[0].id).not.toBe(results[1].id);
    expect(results[0].id).toMatch(/^bug-[a-z0-9]+-[a-f0-9]+$/);
  });

  it("finds similar bugs by Jaccard similarity", () => {
    logBug(tmpDir, {
      error_message: "TypeError: Cannot read properties of undefined",
      file: "src/app.ts",
      root_cause: "Null check missing",
      fix: "Add optional chaining",
      tags: ["runtime", "null"],
    });

    const similar = findSimilarBugs(tmpDir, "TypeError: Cannot read properties of undefined (reading 'name')");
    expect(similar.length).toBeGreaterThan(0);
    expect(similar[0].score).toBeGreaterThan(0.3);
  });

  it("searches across all fields", () => {
    logBug(tmpDir, {
      error_message: "Module not found",
      file: "src/index.ts",
      root_cause: "typo in import path",
      fix: "fix the import",
      tags: ["import", "typo"],
    });

    expect(searchBugs(tmpDir, "typo")).toHaveLength(1);
    expect(searchBugs(tmpDir, "import")).toHaveLength(1);
    expect(searchBugs(tmpDir, "nonexistent")).toHaveLength(0);
  });

  it("returns empty for nonexistent directory", () => {
    expect(searchBugs("/nonexistent/path", "anything")).toHaveLength(0);
  });

  it("searchBugs handles null error_message and tags", () => {
    const buglogPath = path.join(tmpDir, "buglog.json");
    fs.writeFileSync(buglogPath, JSON.stringify({
      version: 1,
      bugs: [
        { id: "bug-1", timestamp: "2026-01-01T00:00:00Z", error_message: null, file: "a.ts", root_cause: "r", fix: "f", tags: null, related_bugs: [], occurrences: 1, last_seen: "2026-01-01T00:00:00Z" },
        { id: "bug-2", timestamp: "2026-01-01T00:00:00Z", error_message: "real error", file: "b.ts", root_cause: null, fix: null, tags: ["tag1"], related_bugs: [], occurrences: 1, last_seen: "2026-01-01T00:00:00Z" },
      ],
    }));

    expect(() => searchBugs(tmpDir, "anything")).not.toThrow();
  });
});
