import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { appendCerebrumEntry } from "../plugin/context/cerebrum-logger.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-cereb-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("cerebrum-logger", () => {
  it("appends entry to Key Learnings section", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n## Key Learnings\n\n## Do-Not-Repeat\n\n");

    appendCerebrumEntry(tmpDir, "key-learnings", "test", "Learned something new");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    expect(content).toContain("[test]");
    expect(content).toContain("Learned something new");
    expect(content).toMatch(/\[test\] \d{4}-\d{2}-\d{2}: Learned something new/);
  });

  it("appends entry to Do-Not-Repeat section", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n## Key Learnings\n\n## Do-Not-Repeat\n\n");

    appendCerebrumEntry(tmpDir, "do-not-repeat", "auto", "Never do X");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    const dnrIdx = content.indexOf("## Do-Not-Repeat");
    const entryIdx = content.indexOf("[auto]");
    expect(entryIdx).toBeGreaterThan(dnrIdx);
  });

  it("appends entry to Decision Log section", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n## Decision Log\n\n");

    appendCerebrumEntry(tmpDir, "decision-log", "arch", "Chose TypeScript");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    expect(content).toContain("[arch]");
    expect(content).toContain("Chose TypeScript");
  });

  it("creates section if missing", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n");

    appendCerebrumEntry(tmpDir, "key-learnings", "test", "New section created");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    expect(content).toContain("## Key Learnings");
    expect(content).toContain("New section created");
  });

  it("creates file if missing", () => {
    appendCerebrumEntry(tmpDir, "key-learnings", "test", "File auto-created");

    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    expect(fs.existsSync(cerebrumPath)).toBe(true);
    const content = fs.readFileSync(cerebrumPath, "utf-8");
    expect(content).toContain("File auto-created");
  });

  it("inserts before next section boundary", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n## Key Learnings\n\n## Do-Not-Repeat\n\n## User Preferences\n\n");

    appendCerebrumEntry(tmpDir, "key-learnings", "test", "Stayed in correct section");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    const dnrIdx = content.indexOf("## Do-Not-Repeat");
    const entryIdx = content.indexOf("Stayed in correct section");
    expect(entryIdx).toBeLessThan(dnrIdx);
  });

  it("handles multiple appends", () => {
    const cerebrumPath = path.join(tmpDir, "cerebrum.md");
    fs.writeFileSync(cerebrumPath, "# Cerebrum\n\n## Key Learnings\n\n");

    appendCerebrumEntry(tmpDir, "key-learnings", "a", "First");
    appendCerebrumEntry(tmpDir, "key-learnings", "b", "Second");
    appendCerebrumEntry(tmpDir, "key-learnings", "c", "Third");

    const content = fs.readFileSync(cerebrumPath, "utf-8");
    expect(content).toContain("[a]");
    expect(content).toContain("[b]");
    expect(content).toContain("[c]");
  });
});
