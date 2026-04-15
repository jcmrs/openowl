import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON } from "../core/utils/fs-safe.js";
import { isWindows } from "../core/utils/platform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDashboardPort(): number {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");
  const config = readJSON<{ openowl: { dashboard: { port: number } } }>(
    path.join(owlDir, "config.json"),
    { openowl: { dashboard: { port: 18791 } } }
  );
  return config.openowl.dashboard.port;
}

function getPm2Name(): string {
  const projectRoot = findProjectRoot();
  return `openowl-${path.basename(projectRoot)}`;
}

function hasPm2(): boolean {
  try {
    const cmd = isWindows() ? "where pm2" : "which pm2";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findPidOnPort(port: number): number | null {
  try {
    if (isWindows()) {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf-8" });
      for (const line of output.split("\n")) {
        if (line.includes(`:${port} `) && line.includes("LISTENING") || new RegExp(`:${port}\\s`).test(line) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid > 0) return pid;
        }
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
      const pid = parseInt(output.trim(), 10);
      if (pid > 0) return pid;
    }
  } catch {}
  return null;
}

function killPid(pid: number): boolean {
  try {
    if (isWindows()) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    return true;
  } catch {
    return false;
  }
}

export function daemonStart(): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  if (!hasPm2()) {
    console.log("pm2 not found. Install with: pnpm add -g pm2");
    return;
  }

  const name = getPm2Name();
  const daemonScript = path.resolve(__dirname, "..", "core", "daemon", "owl-daemon.js");

  if (!fs.existsSync(daemonScript)) {
    console.log("Daemon script not found. Run 'npm run build' first, then try again.");
    return;
  }

  try {
    execSync(`pm2 start "${daemonScript}" --name "${name}" --cwd "${projectRoot}"`, {
      stdio: "inherit",
      env: { ...process.env, OPENOWL_PROJECT_ROOT: projectRoot },
    });
    execSync("pm2 save", { stdio: "ignore" });
    console.log(`\n  Daemon started: ${name}`);
  } catch {
    console.error("Failed to start daemon.");
  }
}

export function daemonStop(): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  if (hasPm2()) {
    const name = getPm2Name();
    try {
      execSync(`pm2 stop "${name}"`, { stdio: "ignore" });
      console.log(`  Daemon stopped (PM2): ${name}`);
      return;
    } catch {}
  }

  const port = getDashboardPort();
  const pid = findPidOnPort(port);
  if (pid) {
    if (killPid(pid)) {
      console.log(`  Daemon stopped (PID ${pid} on port ${port})`);
    } else {
      console.error(`  Failed to kill process ${pid} on port ${port}.`);
    }
  } else {
    console.log(`  No daemon running on port ${port}.`);
  }
}

export function daemonRestart(): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  if (hasPm2()) {
    const name = getPm2Name();
    try {
      execSync(`pm2 restart "${name}"`, { stdio: "ignore" });
      console.log(`  Daemon restarted (PM2): ${name}`);
      return;
    } catch {}
  }

  const port = getDashboardPort();
  const pid = findPidOnPort(port);
  if (pid) {
    killPid(pid);
    console.log(`  Stopped old daemon (PID ${pid}).`);
  }
  console.log("  Use 'openowl daemon start' to restart.");
}

export function daemonLogs(): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  if (!hasPm2()) {
    console.log("pm2 not found.");
    return;
  }

  const name = getPm2Name();
  try {
    execSync(`pm2 logs "${name}" --lines 50 --nostream`, { stdio: "inherit" });
  } catch {
    console.error("Failed to get daemon logs.");
  }
}

export function daemonStatus(): void {
  if (!hasPm2()) {
    console.log("pm2 not found. Install with: npm install -g pm2");
    return;
  }

  const name = getPm2Name();
  try {
    const output = execSync(`pm2 show "${name}"`, { encoding: "utf-8" });
    console.log(output);
  } catch {
    console.log(`  Daemon '${name}' is not running.`);
    console.log("  Start it with: openowl daemon start");
  }
}
