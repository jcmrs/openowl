import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { getRegistryPath, readRegistry, registerProject, unregisterProject } from "../cli/registry.js";

describe("registry", () => {
  let registryDir: string;
  let origHome: string | undefined;

  beforeEach(() => {
    registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-reg-"));
    origHome = process.env.HOME;
    origHome = process.env.USERPROFILE;
    process.env.HOME = registryDir;
    process.env.USERPROFILE = registryDir;
  });

  afterEach(() => {
    fs.rmSync(registryDir, { recursive: true, force: true });
    if (origHome !== undefined) {
      process.env.HOME = origHome;
      process.env.USERPROFILE = origHome;
    } else {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
  });

  it("getRegistryPath returns path inside home dir", () => {
    const p = getRegistryPath();
    expect(p).toContain("registry.json");
    expect(p).toContain(".openowl");
  });

  it("readRegistry returns empty when no file exists", () => {
    const registry = readRegistry();
    expect(registry.version).toBe(1);
    expect(registry.projects).toHaveLength(0);
  });

  it("register adds project to registry file", () => {
    registerProject("/tmp/my-project", "my-project", "1.0.0");
    const registry = readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].name).toBe("my-project");
    expect(registry.projects[0].version).toBe("1.0.0");
    expect(registry.projects[0].root).toBe("/tmp/my-project");
  });

  it("unregister removes project from registry file", () => {
    registerProject("/tmp/my-project", "my-project", "1.0.0");
    unregisterProject("/tmp/my-project");
    const registry = readRegistry();
    expect(registry.projects).toHaveLength(0);
  });

  it("double register does not duplicate", () => {
    registerProject("/tmp/my-project", "my-project", "1.0.0");
    registerProject("/tmp/my-project", "my-project", "2.0.0");
    const registry = readRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0].version).toBe("2.0.0");
  });
});
