import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { writeJSON } from "../core/utils/fs-safe.js";

export interface RegisteredProject {
  root: string;
  name: string;
  registered_at: string;
  last_updated: string;
  version: string;
}

export interface Registry {
  version: number;
  projects: RegisteredProject[];
}

export function getRegistryDir(): string {
  return path.join(os.homedir(), ".openowl");
}

export function getRegistryPath(): string {
  return path.join(getRegistryDir(), "registry.json");
}

export function readRegistry(): Registry {
  const p = getRegistryPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as Registry;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return { version: 1, projects: [] };
    }
    console.error(`[OpenOwl] Warning: registry file corrupt or unreadable (${err.message}). Returning empty registry.`);
    return { version: 1, projects: [] };
  }
}

export function writeRegistry(registry: Registry): void {
  const dir = getRegistryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeJSON(getRegistryPath(), registry);
}

export function registerProject(projectRoot: string, name: string, version: string): void {
  const registry = readRegistry();
  const normalized = normalizePath(projectRoot);
  const now = new Date().toISOString();

  const existing = registry.projects.find(p => normalizePath(p.root) === normalized);
  if (existing) {
    existing.name = name;
    existing.last_updated = now;
    existing.version = version;
  } else {
    registry.projects.push({
      root: projectRoot,
      name,
      registered_at: now,
      last_updated: now,
      version,
    });
  }

  writeRegistry(registry);
}

export function unregisterProject(projectRoot: string): void {
  const registry = readRegistry();
  const normalized = normalizePath(projectRoot);
  registry.projects = registry.projects.filter(p => normalizePath(p.root) !== normalized);
  writeRegistry(registry);
}

export function getRegisteredProjects(validateExists: boolean = false): RegisteredProject[] {
  const registry = readRegistry();
  if (!validateExists) return registry.projects;

  const valid: RegisteredProject[] = [];
  const removed: string[] = [];

  for (const project of registry.projects) {
    const owlDir = path.join(project.root, ".owl");
    if (fs.existsSync(owlDir)) {
      valid.push(project);
    } else {
      removed.push(project.root);
    }
  }

  if (removed.length > 0) {
    registry.projects = valid;
    writeRegistry(registry);
  }

  return valid;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLocaleLowerCase("en");
}
