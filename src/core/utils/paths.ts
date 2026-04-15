import * as path from "node:path";
import * as fs from "node:fs";

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function getOwlDir(from?: string): string {
  const base = from ?? process.cwd();
  return path.join(base, ".owl");
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
