import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

function normalizeText(raw: string): string {
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return raw.replace(/\r\n/g, "\n");
}

export function readJSON<T = unknown>(filePath: string, fallback: T): T {
  try {
    const raw = normalizeText(fs.readFileSync(filePath, "utf-8"));
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
  const serialized = JSON.stringify(data, null, 2);
  const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, serialized, "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error(`[OpenOwl] Warning: atomic write failed for ${path.basename(filePath)}: ${err}`);
    try { fs.writeFileSync(filePath, serialized, "utf-8"); } catch (writeErr) {
      console.error(`[OpenOwl] Error: direct write also failed: ${writeErr}`);
    }
    try { fs.unlinkSync(tmp); } catch {}
    return;
  }
  verifyWrite(filePath, serialized);
}

export function readText(filePath: string, fallback: string = ""): string {
  try {
    return normalizeText(fs.readFileSync(filePath, "utf-8"));
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
    return;
  }
  verifyWrite(filePath, content);
}

function verifyWrite(filePath: string, expected: string): void {
  try {
    const actual = normalizeText(fs.readFileSync(filePath, "utf-8"));
    if (actual !== expected.replace(/\r\n/g, "\n")) {
      console.error(`[OpenOwl] Write verification failed for ${path.basename(filePath)}. Retrying.`);
      const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
      try {
        fs.writeFileSync(tmp, expected, "utf-8");
        fs.renameSync(tmp, filePath);
      } catch (retryErr) {
        console.error(`[OpenOwl] Write retry also failed for ${path.basename(filePath)}: ${retryErr}`);
        try { fs.unlinkSync(tmp); } catch {}
      }
    }
  } catch {
    // Verification read failed — file may not exist yet in edge cases, not critical
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
