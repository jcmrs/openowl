import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import { OpenOwlPlugin } from "opencode-owl";

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
- **Token tracking**: Session reads/writes tracked in \`.owl/token-ledger.json\`

## How You Contribute

When you learn something new about the project (a convention, a user preference, a gotcha), append a tagged entry to \`.owl/cerebrum.md\`:
\`\`\`
- [scope] YYYY-MM-DD: concise description
\`\`\`

Do-Not-Repeat entries go in the \`## Do-Not-Repeat\` section (at the bottom of cerebrum.md):
\`\`\`
- [scope] YYYY-MM-DD: Never do X because Y
\`\`\`

## Daemon (optional, requires pm2)

The OpenOwl daemon handles background tasks (cron jobs, file watching, dashboard). Manage it via:
\`\`\`
npx openowl daemon start   # start via pm2 (requires: npm install -g pm2)
npx openowl daemon stop    # stop
npx openowl daemon status  # show status
npx openowl daemon logs    # show recent logs
\`\`\`

## .owl/ File Reference

- \`.owl/cerebrum.md\` — cross-session learning memory (read to WRITE new entries, not for consumption)
- \`.owl/anatomy.md\` — file index with descriptions (auto-updated, readable on demand)
- \`.owl/buglog.json\` — bug database (auto-populated, check before debugging)
- \`.owl/config.json\` — OpenOwl configuration
- \`.owl/memory.md\` — chronological action log (auto-populated)
- \`.owl/token-ledger.json\` — token usage tracking across sessions
`;
}
