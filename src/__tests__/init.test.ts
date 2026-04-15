import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
vi.mock("../cli/registry.js", () => ({ registerProject: vi.fn() }));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-init-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { generatePluginContent, generateAgentsMdSnippet } from "../cli/shared.js";

describe("init helpers", () => {
  it("generatePluginContent returns valid plugin code with OpenOwlPlugin", () => {
    const content = generatePluginContent();
    expect(content).toContain("OpenOwlPlugin");
    expect(content).toContain("@opencode-ai/plugin");
    expect(content).toContain("export default plugin");
  });

  it("generateAgentsMdSnippet returns valid snippet with .owl references", () => {
    const content = generateAgentsMdSnippet();
    expect(content).toContain("OpenOwl");
    expect(content).toContain(".owl/cerebrum.md");
    expect(content).toContain(".owl/anatomy.md");
    expect(content).toContain(".owl/buglog.json");
    expect(content).toContain(".owl/config.json");
  });

  it("generatePluginContent contains import and default export structure", () => {
    const content = generatePluginContent();
    expect(content).toContain('import type { Plugin }');
    expect(content).toContain('import { OpenOwlPlugin } from "openowl"');
    expect(content).toContain("export default plugin");
    expect(content).toContain("async (ctx)");
  });

  it("generateAgentsMdSnippet contains tagged entry format", () => {
    const content = generateAgentsMdSnippet();
    expect(content).toContain("[scope]");
    expect(content).toContain("YYYY-MM-DD");
    expect(content).toContain("concise description");
  });

  it("initCommand creates .owl directory and cerebrum.md with detected framework", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "test-init-project",
      description: "Test project for init",
      dependencies: { next: "^14.0.0", react: "^18.0.0" },
      devDependencies: { vitest: "^1.0.0" },
    }));
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "lockfile v1\n");
    fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });

    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      const { initCommand } = await import("../cli/init.js");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await initCommand();

      const owlDir = path.join(tmpDir, ".owl");
      expect(fs.existsSync(owlDir)).toBe(true);
      expect(fs.existsSync(path.join(owlDir, "cerebrum.md"))).toBe(true);
      expect(fs.existsSync(path.join(owlDir, "config.json"))).toBe(true);
      expect(fs.existsSync(path.join(owlDir, "identity.md"))).toBe(true);
      expect(fs.existsSync(path.join(owlDir, "anatomy.md"))).toBe(true);
      expect(fs.existsSync(path.join(owlDir, "buglog.json"))).toBe(true);

      const cerebrum = fs.readFileSync(path.join(owlDir, "cerebrum.md"), "utf-8");
      expect(cerebrum).toContain("Next.js");
      expect(cerebrum).toContain("Vitest");
      expect(cerebrum).toContain("pnpm");

      logSpy.mockRestore();
      errorSpy.mockRestore();
    } finally {
      process.chdir(origCwd);
    }
  }, 15000);
});
