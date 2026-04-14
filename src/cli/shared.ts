import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

export function findTemplatesDir(): string {
  const candidates = [
    path.resolve(__dirname, "..", "templates"),
    path.resolve(__dirname, "..", "..", "src", "templates"),
    path.resolve(__dirname, "..", "..", "..", "src", "templates"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export function generatePluginContent(): string {
  return `import type { Plugin } from "@opencode-ai/plugin";
import { OpenOwlPlugin } from "openowl";

const plugin: Plugin = async (ctx) => OpenOwlPlugin(ctx);
export default plugin;
`;
}

export function generateAgentsMdSnippet(): string {
  return `# OpenOwl

@.owl/OWL.md

This project uses OpenOwl for context management. Read and follow .owl/OWL.md every session. Check .owl/cerebrum.md before generating code. Check .owl/anatomy.md before reading files to avoid unnecessary reads.

## What is OpenOwl?

OpenOwl is a project intelligence middleware for OpenCode. It tracks token usage, maintains a learning memory (cerebrum), logs bugs, and enforces file navigation discipline. It runs as an OpenCode plugin (observational — it can log warnings but cannot block actions) plus an optional daemon for background tasks.

## Plugin vs Model Responsibility

The OpenOwl plugin monitors your actions and logs warnings when you deviate from best practices (e.g., re-reading files, ignoring anatomy.md). However, since OpenCode plugins are observational, **you** are responsible for actually following the rules in .owl/OWL.md. The plugin reminds; you comply.

## Quick Reference

- \`.owl/anatomy.md\` — file index with descriptions and token estimates
- \`.owl/cerebrum.md\` — learning memory (preferences, learnings, do-not-repeat)
- \`.owl/memory.md\` — chronological action log
- \`.owl/buglog.json\` — bug database for cross-session recall
- \`.owl/config.json\` — OpenOwl configuration`;
}
