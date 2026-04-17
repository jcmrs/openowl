import * as fs from "node:fs";
import * as path from "node:path";
import { readJSON } from "../../core/utils/fs-safe.js";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime_seconds: number;
  last_heartbeat: string | null;
  tasks: number;
  dead_letters: number;
}

function readHeartbeat(owlDir: string): string | null {
  try {
    return fs.readFileSync(path.join(owlDir, "_heartbeat"), "utf-8").trim() || null;
  } catch {
    return null;
  }
}

export function getHealth(owlDir: string, startTime: number): HealthStatus {
  const heartbeat = readHeartbeat(owlDir);

  const cronState = readJSON<{
    last_heartbeat: string | null;
    dead_letter_queue: unknown[];
  }>(path.join(owlDir, "cron-state.json"), {
    last_heartbeat: null,
    dead_letter_queue: [],
  });

  const manifest = readJSON<{ tasks: unknown[] }>(
    path.join(owlDir, "cron-manifest.json"),
    { tasks: [] }
  );

  const deadLetterCount = cronState.dead_letter_queue.length;
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (deadLetterCount > 0) status = "degraded";
  if (deadLetterCount > 3) status = "unhealthy";

  return {
    status,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    last_heartbeat: heartbeat ?? cronState.last_heartbeat,
    tasks: manifest.tasks.length,
    dead_letters: deadLetterCount,
  };
}
