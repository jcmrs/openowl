import * as fs from "node:fs";
import * as path from "node:path";
import * as net from "node:net";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON } from "../core/utils/fs-safe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OwlConfig {
  openowl: {
    dashboard: { port: number };
  };
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, "127.0.0.1");
  });
}

export async function dashboardCommand(): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  const config = readJSON<OwlConfig>(path.join(owlDir, "config.json"), {
    openowl: { dashboard: { port: 18791 } },
  });

  const port = config.openowl.dashboard.port;
  const url = `http://localhost:${port}`;

  const running = await isPortOpen(port);

  if (!running) {
    console.log("  Daemon not running. Starting dashboard server...");

    const daemonScript = path.resolve(__dirname, "..", "core", "daemon", "owl-daemon.js");
    if (!fs.existsSync(daemonScript)) {
      console.log("  Dashboard requires Phase 4 (daemon) which is not yet implemented.");
      console.log(`  When available, it will serve at ${url}`);
      return;
    }

    const { fork } = await import("node:child_process");
    const child = fork(daemonScript, [], {
      cwd: projectRoot,
      env: { ...process.env, OPENOWL_PROJECT_ROOT: projectRoot },
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    let ready = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (await isPortOpen(port)) {
        ready = true;
        break;
      }
    }

    if (!ready) {
      console.log(`  Server didn't start in time. Try manually: node "${daemonScript}"`);
      return;
    }

    console.log(`  Dashboard server running on port ${port}`);
  }

  console.log(`  Opening ${url}...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const open = require("open");
    await open(url);
  } catch {
    console.log(`  Could not open browser. Visit: ${url}`);
  }
}
