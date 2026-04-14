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

This project uses OpenOwl for project intelligence. The OpenOwl plugin injects relevant project knowledge (conventions, do-not-repeat entries, file index) into your system context automatically every turn. You don't need to read .owl/ files to benefit from them.

## What OpenOwl Provides (automatic)

- **Do-Not-Repeat entries**: Past mistakes injected into context to prevent recurrence
- **Key Conventions**: Project-specific patterns and preferences
- **File Index**: Directory summaries and file descriptions for efficient navigation

## How You Contribute

When you learn something new about the project (a convention, a user preference, a gotcha), append a tagged entry to \`.owl/cerebrum.md\`:
\`\`\`
- [scope] YYYY-MM-DD: concise description
\`\`\`

## .owl/ File Reference

- \`.owl/cerebrum.md\` — cross-session learning memory (read to WRITE new entries, not for consumption)
- \`.owl/anatomy.md\` — file index with descriptions (auto-updated, readable on demand)
- \`.owl/buglog.json\` — bug database (auto-populated, check before debugging)
- \`.owl/config.json\` — OpenOwl configuration
`;
}
