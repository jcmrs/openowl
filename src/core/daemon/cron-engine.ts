import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import cron from "node-cron";
import { readJSON, writeJSON, readText, writeText } from "../../core/utils/fs-safe.js";
import { scanProject } from "../../core/scanner/anatomy-scanner.js";
import { detectWaste } from "../../core/tracker/waste-detector.js";
import type { Logger } from "../../core/utils/logger.js";

interface CronAction {
  type: string;
  params?: Record<string, unknown>;
}

interface CronTask {
  id: string;
  name: string;
  schedule: string;
  description: string;
  action: CronAction;
  retry: { max_attempts: number; backoff: string; base_delay_seconds: number };
  failsafe: { on_failure: string; dead_letter?: boolean; alert_after_consecutive_failures?: number };
  enabled: boolean;
}

interface CronManifest {
  version: number;
  tasks: CronTask[];
}

interface ExecutionEntry {
  task_id: string;
  status: "success" | "failed";
  timestamp: string;
  duration_ms: number;
  error?: string;
}

interface CronState {
  last_heartbeat: string | null;
  engine_status: string;
  execution_log: ExecutionEntry[];
  dead_letter_queue: Array<{ task_id: string; error: string; timestamp: string; attempts: number }>;
  upcoming: unknown[];
}

export class CronEngine {
  private owlDir: string;
  private projectRoot: string;
  private logger: Logger;
  private broadcast: (msg: unknown) => void;
  private scheduledTasks: cron.ScheduledTask[] = [];
  private failureCounts = new Map<string, number>();

  constructor(
    owlDir: string,
    projectRoot: string,
    logger: Logger,
    broadcast: (msg: unknown) => void
  ) {
    this.owlDir = owlDir;
    this.projectRoot = projectRoot;
    this.logger = logger;
    this.broadcast = broadcast;
  }

  start(): void {
    const manifest = this.readManifest();
    for (const task of manifest.tasks) {
      if (!task.enabled) continue;
      if (!cron.validate(task.schedule)) {
        this.logger.warn(`Invalid cron schedule for ${task.id}: ${task.schedule}`);
        continue;
      }
      const scheduled = cron.schedule(task.schedule, () => {
        this.executeTask(task).catch((err) => {
          this.logger.error(`Task ${task.id} failed: ${err}`);
        });
      });
      this.scheduledTasks.push(scheduled);
      this.logger.info(`Scheduled task: ${task.name} (${task.schedule})`);
    }
  }

  stop(): void {
    for (const task of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks = [];
  }

  async runTask(taskId: string): Promise<void> {
    const manifest = this.readManifest();
    const task = manifest.tasks.find((t) => t.id === taskId);
    if (!task) {
      this.logger.warn(`Task not found: ${taskId}`);
      return;
    }
    await this.executeTask(task);
  }

  private readManifest(): CronManifest {
    return readJSON<CronManifest>(
      path.join(this.owlDir, "cron-manifest.json"),
      { version: 1, tasks: [] }
    );
  }

  private readState(): CronState {
    return readJSON<CronState>(
      path.join(this.owlDir, "cron-state.json"),
      { last_heartbeat: null, engine_status: "running", execution_log: [], dead_letter_queue: [], upcoming: [] }
    );
  }

  private writeState(state: CronState): void {
    writeJSON(path.join(this.owlDir, "cron-state.json"), state);
  }

  private async executeTask(task: CronTask): Promise<void> {
    const startTime = Date.now();
    this.logger.info(`Executing task: ${task.name}`);

    const sessionGuardedActions = new Set(["scan_project", "consolidate_memory"]);
    if (sessionGuardedActions.has(task.action.type)) {
      const sessionPath = path.join(this.owlDir, "_session.json");
      if (fs.existsSync(sessionPath)) {
        this.logger.info(`Skipping ${task.name}: active session in progress`);
        return;
      }
    }

    try {
      await this.runAction(task.action);
      const duration = Date.now() - startTime;

      const state = this.readState();
      state.execution_log.push({
        task_id: task.id,
        status: "success",
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      });
      if (state.execution_log.length > 100) {
        state.execution_log = state.execution_log.slice(-100);
      }
      this.writeState(state);

      this.failureCounts.set(task.id, 0);
      this.broadcast({
        type: "cron_executed",
        task_id: task.id,
        status: "success",
        duration_ms: duration,
      });
      this.logger.info(`Task ${task.name} completed in ${duration}ms`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - startTime;
      const failures = (this.failureCounts.get(task.id) ?? 0) + 1;
      this.failureCounts.set(task.id, failures);

      this.logger.error(`Task ${task.name} failed (attempt ${failures}): ${errorMsg}`);

      if (failures < task.retry.max_attempts) {
        const delay = this.calculateDelay(task.retry.backoff, task.retry.base_delay_seconds, failures);
        this.logger.info(`Retrying ${task.name} in ${delay}ms`);
        setTimeout(() => {
          this.executeTask(task).catch(() => {});
        }, delay);
      } else {
        const state = this.readState();
        state.execution_log.push({
          task_id: task.id,
          status: "failed",
          timestamp: new Date().toISOString(),
          duration_ms: duration,
          error: errorMsg,
        });

        if (task.failsafe.dead_letter) {
          state.dead_letter_queue.push({
            task_id: task.id,
            error: errorMsg,
            timestamp: new Date().toISOString(),
            attempts: failures,
          });
        }

        this.writeState(state);
        this.failureCounts.set(task.id, 0);
      }

      this.broadcast({
        type: "cron_executed",
        task_id: task.id,
        status: "failed",
        duration_ms: duration,
      });
    }
  }

  private calculateDelay(backoff: string, baseSec: number, attempt: number): number {
    const baseMs = baseSec * 1000;
    switch (backoff) {
      case "exponential":
        return baseMs * Math.pow(2, attempt - 1);
      case "linear":
        return baseMs * attempt;
      default:
        return 0;
    }
  }

  private async runAction(action: CronAction): Promise<void> {
    switch (action.type) {
      case "scan_project":
        scanProject(this.owlDir, this.projectRoot);
        break;

      case "consolidate_memory":
        this.consolidateMemory(action.params?.older_than_days as number ?? 7);
        break;

      case "generate_token_report":
        this.generateTokenReport();
        break;

      case "check_cerebrum_staleness":
        this.checkCerebrumStaleness(action.params?.max_age_days as number ?? 14);
        break;

      case "ai_task":
        await this.runAiTask(action.params as { prompt: string; context_files: string[] });
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private consolidateMemory(olderThanDays: number): void {
    const memoryPath = path.join(this.owlDir, "memory.md");
    const content = readText(memoryPath);
    if (!content) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const lines = content.split("\n");
    const result: string[] = [];
    let inOldSession = false;
    let oldSessionLines: string[] = [];
    let currentSessionDate: Date | null = null;

    for (const line of lines) {
      const sessionMatch = line.match(/^## Session: (\d{4}-\d{2}-\d{2})/);
      if (sessionMatch) {
        if (inOldSession && oldSessionLines.length > 0) {
          const actionCount = oldSessionLines.filter((l) => l.startsWith("|") && !l.startsWith("|--") && !l.startsWith("| Time")).length;
          result.push(`> Consolidated session (${actionCount} actions)`);
          result.push("");
        }

        currentSessionDate = new Date(sessionMatch[1]);
        if (currentSessionDate < cutoff) {
          inOldSession = true;
          oldSessionLines = [];
          result.push(line);
        } else {
          inOldSession = false;
          result.push(line);
        }
        continue;
      }

      if (inOldSession) {
        oldSessionLines.push(line);
      } else {
        result.push(line);
      }
    }

    if (inOldSession && oldSessionLines.length > 0) {
      const actionCount = oldSessionLines.filter((l) => l.startsWith("|") && !l.startsWith("|--") && !l.startsWith("| Time")).length;
      result.push(`> Consolidated session (${actionCount} actions)`);
      result.push("");
    }

    writeText(memoryPath, result.join("\n"));
  }

  private generateTokenReport(): void {
    const flags = detectWaste(this.owlDir);
    const ledgerPath = path.join(this.owlDir, "token-ledger.json");
    const ledger = readJSON<Record<string, unknown>>(ledgerPath, {});
    (ledger as { waste_flags: unknown[] }).waste_flags = flags;
    (ledger as { optimization_report: { last_generated: string; patterns: unknown[] } }).optimization_report = {
      last_generated: new Date().toISOString(),
      patterns: flags.map((f) => f.pattern),
    };
    writeJSON(ledgerPath, ledger);
  }

  private checkCerebrumStaleness(maxAgeDays: number): void {
    const cerebrumPath = path.join(this.owlDir, "cerebrum.md");
    if (!fs.existsSync(cerebrumPath)) return;

    const stat = fs.statSync(cerebrumPath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays > maxAgeDays) {
      this.logger.warn(
        `Cerebrum is ${Math.round(ageDays)} days old (max ${maxAgeDays}). ` +
        `Consider reviewing and updating .owl/cerebrum.md with recent learnings.`
      );
      this.broadcast({
        type: "cerebrum_stale",
        age_days: Math.round(ageDays),
        max_age_days: maxAgeDays,
      });
    }
  }

  private hasOpencode(): boolean {
    try {
      const cmd = process.platform === "win32" ? "where opencode" : "which opencode";
      execSync(cmd, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private async runAiTask(params: { prompt: string; context_files: string[] }): Promise<void> {
    if (!this.hasOpencode()) {
      throw new Error("OpenCode CLI not found. Install it or add it to PATH.");
    }

    const contextParts: string[] = [];
    for (const file of params.context_files) {
      const filePath = path.join(this.projectRoot, file);
      try {
        contextParts.push(`--- ${file} ---\n${fs.readFileSync(filePath, "utf-8")}`);
      } catch {
        contextParts.push(`--- ${file} --- (not found)`);
      }
    }

    const fullPrompt = `${params.prompt}\n\n---\nContext:\n${contextParts.join("\n\n")}`;

    try {
      const tmpDir = path.join(this.owlDir, "_tmp");
      fs.mkdirSync(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `prompt-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, fullPrompt, "utf-8");

      const promptFlag = `--prompt-file "${tmpFile}"`;
      const cmd = `opencode -p --output-format text ${promptFlag}`;

      const proc = spawnSync(cmd, {
        timeout: 120000,
        encoding: "utf-8",
        cwd: this.projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        windowsHide: true,
      });

      try { fs.unlinkSync(tmpFile); } catch {}

      if (proc.error) {
        throw proc.error;
      }

      if (proc.status !== 0) {
        const stderr = proc.stderr?.trim();
        const stdout = proc.stdout?.trim();
        const errMsg = stderr || stdout || "Unknown error";
        throw new Error(`Exit code ${proc.status}: ${errMsg}`);
      }

      let result = (proc.stdout || "").replace(/\r\n/g, "\n").trim();

      const fenceMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
      if (fenceMatch) {
        result = fenceMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(result);
        writeJSON(path.join(this.owlDir, "suggestions.json"), {
          generated_at: new Date().toISOString(),
          ...parsed,
        });
      } catch {
        const cerebrumMarkers = ["## User Preferences", "## Key Learnings", "## Do-Not-Repeat", "# Cerebrum"];
        const markerCount = cerebrumMarkers.filter((m) => result.includes(m)).length;
        if (markerCount >= 2) {
          const stagingPath = path.join(this.owlDir, "_tmp", `cerebrum-update-${Date.now()}.md`);
          writeText(stagingPath, result);
          this.logger.warn(`AI cerebrum update written to staging: ${stagingPath}. Review before applying.`);
          this.broadcast({ type: "cerebrum_update_staged", path: stagingPath });
        }
      }
    } catch (err) {
      throw new Error(`opencode -p failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
