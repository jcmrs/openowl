import * as path from "node:path";
import * as fs from "node:fs";

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function getOwlDir(from?: string): string {
  const base = from ?? process.cwd();
  return path.join(base, ".owl");
}

export function resolveOwlFile(file: string, from?: string): string {
  return path.join(getOwlDir(from), file);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function relativeToCwd(filePath: string, cwd?: string): string {
  const base = cwd ?? process.cwd();
  const rel = path.relative(base, filePath);
  return normalizePath(rel);
}
