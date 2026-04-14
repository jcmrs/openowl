import * as fs from "node:fs";
import * as path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_LOG_SIZE = 5 * 1024 * 1024;
const MAX_LOG_FILES = 3;

export class Logger {
  private logFile: string | null;
  private level: LogLevel;

  constructor(logFile: string | null, level: LogLevel = "info") {
    this.logFile = logFile;
    this.level = level;
    if (logFile) {
      const dir = path.dirname(logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.rotateIfNeeded();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private format(level: LogLevel, message: string): string {
    const ts = new Date().toISOString();
    return `[${ts}] [${level.toUpperCase()}] ${message}`;
  }

  private rotateIfNeeded(): void {
    if (!this.logFile) return;
    try {
      const stat = fs.statSync(this.logFile);
      if (stat.size >= MAX_LOG_SIZE) {
        for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
          const src = i === 1 ? this.logFile : `${this.logFile}.${i - 1}`;
          const dst = `${this.logFile}.${i}`;
          if (fs.existsSync(src)) {
            fs.renameSync(src, dst);
          }
        }
        fs.writeFileSync(this.logFile, "", "utf-8");
      }
    } catch (err) {
      console.error("[OpenOwl] Log rotation failed:", err);
    }
  }

  private write(level: LogLevel, message: string): void {
    if (!this.shouldLog(level)) return;
    const line = this.format(level, message);
    if (level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, line + "\n", "utf-8");
      } catch (err) {
        console.error("[OpenOwl] Failed to write log:", err);
      }
    }
  }

  debug(msg: string): void { this.write("debug", msg); }
  info(msg: string): void { this.write("info", msg); }
  warn(msg: string): void { this.write("warn", msg); }
  error(msg: string): void { this.write("error", msg); }
}
