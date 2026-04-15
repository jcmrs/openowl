import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-plugin-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const HOOK_KEYS = [
  "experimental.chat.system.transform",
  "event",
  "tool.execute.before",
  "tool.execute.after",
  "experimental.session.compacting",
];

async function invokePlugin(dir: string) {
  const { OpenOwlPlugin } = await import("../plugin/index.js");
  const mockCtx = {
    directory: dir,
    client: {
      app: {
        log: async () => {},
      },
    },
  };
  return OpenOwlPlugin(mockCtx as any);
}

describe("plugin-index", () => {
  it("default export has id 'openowl' and server function", async () => {
    const mod = await import("../plugin/index.js");
    expect(mod.default.id).toBe("openowl");
    expect(typeof mod.default.server).toBe("function");
  });

  it("returned hooks contain all 5 expected keys", async () => {
    const hooks = await invokePlugin(tmpDir);
    for (const key of HOOK_KEYS) {
      expect(hooks).toHaveProperty(key);
      expect(typeof (hooks as any)[key]).toBe("function");
    }
  });

  it("when .owl/ does not exist, all hooks are no-ops and do not throw", async () => {
    const hooks = await invokePlugin(tmpDir);

    for (const key of HOOK_KEYS) {
      const hook = (hooks as any)[key];
      let threw = false;
      try {
        if (key === "event") {
          await hook({ event: { type: "session.created", properties: { info: { id: "x" } } } });
        } else if (key === "experimental.session.compacting") {
          await hook({ sessionID: "x" }, { system: [] });
        } else {
          await hook({}, { system: [] });
        }
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    }
  });

  it("when injection enabled, transform hook pushes to output.system", async () => {
    const owlDir = path.join(tmpDir, ".owl");
    fs.mkdirSync(owlDir, { recursive: true });
    fs.writeFileSync(
      path.join(owlDir, "config.json"),
      JSON.stringify({ openowl: { injection: { enabled: true } } })
    );

    const hooks = await invokePlugin(tmpDir);
    const output = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]({} as any, output);

    expect(output.system.length).toBeGreaterThanOrEqual(1);
    expect(output.system[0]).toContain("<owl-context>");
  });

  it("when injection disabled, transform hook does not push", async () => {
    const owlDir = path.join(tmpDir, ".owl");
    fs.mkdirSync(owlDir, { recursive: true });
    fs.writeFileSync(
      path.join(owlDir, "config.json"),
      JSON.stringify({ openowl: { injection: { enabled: false } } })
    );

    const hooks = await invokePlugin(tmpDir);
    const output = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]({} as any, output);

    expect(output.system).toHaveLength(0);
  });
});
