import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;
let projectRoot: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-anatomy-updater-"));
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "owl-proj-"));
  fs.mkdirSync(path.join(tmpDir, ".owl"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, ".owl", "anatomy.md"),
    "# anatomy.md\n\n> Auto-maintained by OpenOwl.\n"
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

import { updateAnatomyAfterWrite } from "../plugin/context/anatomy-updater.js";

describe("updateAnatomyAfterWrite", () => {
  it("does not throw when called with a new file path that does not exist on disk", () => {
    const filePath = path.join(projectRoot, "src", "new-file.ts");
    expect(() => updateAnatomyAfterWrite(path.join(tmpDir, ".owl"), filePath, projectRoot)).not.toThrow();
  });

  it("does not throw when called with an existing file on disk", () => {
    const filePath = path.join(projectRoot, "src", "existing.ts");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "export const x = 1;");
    expect(() => updateAnatomyAfterWrite(path.join(tmpDir, ".owl"), filePath, projectRoot)).not.toThrow();
  });

  it("does not throw with various tool args shapes (relative paths)", () => {
    expect(() =>
      updateAnatomyAfterWrite(path.join(tmpDir, ".owl"), "src/foo.ts", projectRoot)
    ).not.toThrow();

    expect(() =>
      updateAnatomyAfterWrite(path.join(tmpDir, ".owl"), "./src/bar.ts", projectRoot)
    ).not.toThrow();

    expect(() =>
      updateAnatomyAfterWrite(path.join(tmpDir, ".owl"), path.join(projectRoot, "baz.ts"), projectRoot)
    ).not.toThrow();
  });

  it("does not throw when .owl/anatomy.md does not exist", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-empty-"));
    try {
      expect(() =>
        updateAnatomyAfterWrite(emptyDir, path.join(projectRoot, "x.ts"), projectRoot)
      ).not.toThrow();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
