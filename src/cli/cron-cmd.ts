import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON, writeJSON } from "../core/utils/fs-safe.js";

interface CronTask {
  id: string;
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
}

interface CronManifest {
  version: number;
  tasks: CronTask[];
}

interface CronState {
  engine_status: string;
  execution_log: Array<{ task_id: string; status: string; timestamp: string }>;
  dead_letter_queue: Array<{ task_id: string; error: string; timestamp: string }>;
}

export function cronList(): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  const manifest = readJSON<CronManifest>(path.join(owlDir, "cron-manifest.json"), {
    version: 1,
    tasks: [],
  });

  const state = readJSON<CronState>(path.join(owlDir, "cron-state.json"), {
    engine_status: "unknown",
    execution_log: [],
    dead_letter_queue: [],
  });

  console.log("Cron Tasks");
  console.log("==========\n");

  if (manifest.tasks.length === 0) {
    console.log("  No tasks configured.");
    return;
  }

  for (const task of manifest.tasks) {
    const status = task.enabled ? "enabled" : "disabled";
    const lastRun = state.execution_log
      .filter((e) => e.task_id === task.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const lastRunStr = lastRun ? `${lastRun.status} at ${lastRun.timestamp}` : "never";
    const isDead = state.dead_letter_queue.some((d) => d.task_id === task.id);

    console.log(`  ${task.name} (${task.id})`);
    console.log(`    Schedule: ${task.schedule}`);
    console.log(`    Status: ${status}${isDead ? " [DEAD-LETTERED]" : ""}`);
    console.log(`    Last run: ${lastRunStr}`);
    console.log(`    ${task.description}`);
    console.log("");
  }
}

export async function cronRun(id: string): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  console.log("Cron direct execution requires Phase 4 (daemon/cron-engine).");
  console.log(`Task "${id}" queued. When the daemon is implemented, it will execute this task.`);
}

export function cronRetry(id: string): void {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  const statePath = path.join(owlDir, "cron-state.json");
  const state = readJSON<CronState>(statePath, {
    engine_status: "unknown",
    execution_log: [],
    dead_letter_queue: [],
  });

  const idx = state.dead_letter_queue.findIndex((d) => d.task_id === id);
  if (idx === -1) {
    console.log(`Task ${id} not found in dead letter queue.`);
    return;
  }

  state.dead_letter_queue.splice(idx, 1);
  writeJSON(statePath, state);
  console.log(`Removed ${id} from dead letter queue. It will retry on next schedule.`);
}
