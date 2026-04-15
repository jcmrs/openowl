import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export function readJSON<T = unknown>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error(`[OpenOwl] Warning: failed to read ${path.basename(filePath)}: ${err.message}`);
    }
    return fallback;
  }
}

export function writeJSON(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error(`[OpenOwl] Warning: atomic write failed for ${path.basename(filePath)}: ${err}`);
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8"); } catch (writeErr) {
      console.error(`[OpenOwl] Error: direct write also failed: ${writeErr}`);
    }
    try { fs.unlinkSync(tmp); } catch {}
  }
}

export function readText(filePath: string, fallback: string = ""): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error(`[OpenOwl] Warning: failed to read ${path.basename(filePath)}: ${err.message}`);
    }
    return fallback;
  }
}

export function writeText(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, content, "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error(`[OpenOwl] Warning: atomic write failed for ${path.basename(filePath)}: ${err}`);
    try { fs.writeFileSync(filePath, content, "utf-8"); } catch (writeErr) {
      console.error(`[OpenOwl] Error: direct write also failed: ${writeErr}`);
    }
    try { fs.unlinkSync(tmp); } catch {}
  }
}

export function appendText(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  try {
    fs.appendFileSync(filePath, content, "utf-8");
  } catch (err) {
    console.error(`[OpenOwl] Error: failed to append to ${path.basename(filePath)}: ${err}`);
  }
}
