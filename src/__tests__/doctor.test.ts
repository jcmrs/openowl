import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-doc-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { doctorCommand } from "../cli/doctor.js";

function writeOwlFile(name: string, content: string): void {
  const owlDir = path.join(tmpDir, ".owl");
  fs.mkdirSync(owlDir, { recursive: true });
  fs.writeFileSync(path.join(owlDir, name), content, "utf-8");
}

describe("doctorCommand", () => {
  it("prints not initialized when .owl/ is missing", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await doctorCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("not initialized"))).toBe(true);
  });

  it("passes all checks when all files present", async () => {
    const pluginDir = path.join(tmpDir, ".opencode", "plugins");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, "openowl.ts"), "// has experimental.chat.system.transform hook");
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# .owl/OWL.md reference");

    writeOwlFile("OWL.md", "# OWL");
    writeOwlFile("cerebrum.md", "## Key Learnings\n- [test] 2025-01-01: something");
    writeOwlFile("anatomy.md", `# anatomy.md\n\n> Auto-maintained by OpenOwl. Last scanned: ${new Date().toISOString()}\n\n## ./\n\n- \`index.ts\` — main (~100 tok)\n`);
    writeOwlFile("config.json", JSON.stringify({ version: 1, openowl: { injection: { enabled: true, max_tokens: 2500 } } }));
    writeOwlFile("buglog.json", JSON.stringify({ bugs: [] }));

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await doctorCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Core .owl/ files");
    expect(allOutput).toContain("OK");
  });

  it("fails config check when config.json is missing", async () => {
    writeOwlFile("OWL.md", "# OWL");
    writeOwlFile("cerebrum.md", "");
    writeOwlFile("anatomy.md", "");

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await doctorCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("XX");
    expect(allOutput).toContain("config.json");
  });

  it("warns about stale anatomy when scan date is old", async () => {
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    writeOwlFile("OWL.md", "# OWL");
    writeOwlFile("cerebrum.md", "");
    writeOwlFile("anatomy.md", `# anatomy.md\n\n> Auto-maintained by OpenOwl. Last scanned: ${oldDate}\n\n## ./\n\n- \`index.ts\` — main (~100 tok)\n`);
    writeOwlFile("config.json", JSON.stringify({ version: 1, openowl: { injection: { enabled: true, max_tokens: 2500 } } }));
    writeOwlFile("buglog.json", JSON.stringify({ bugs: [] }));

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await doctorCommand();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Anatomy freshness");
    expect(allOutput).toContain("!!");
    expect(allOutput).toContain("rescanning");
  });
});
