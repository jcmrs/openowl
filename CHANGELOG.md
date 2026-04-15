# Changelog

## 0.4.0 (2026-04-15)

Comprehensive audit remediation — 208 findings across 5 audits (E2E, SILENT, PARSE, GAP, API), deduplicated to ~25 root causes and resolved in 7 batches.

### Bug Fixes
- BOM/CRLF normalization in `readText`/`readJSON` (unblocks ~12 downstream parsing issues on Windows)
- Fixed broken bug-to-injection pipeline: `autoLogBug` now sets `fix: "unknown"` instead of summary string, so auto-detected bugs are no longer filtered out by `buildBugsSection`
- Guard null `error_message`/`tags`/`root_cause`/`fix` fields in `searchBugs` and `buildBugsSection` against corrupt buglog entries
- `sanitizeConfig` no longer crashes when `config.openowl` is undefined
- Auto-init session on first tool call when `session.created` event was missed
- `initSession` now verifies `_session.json` was written successfully
- NaN/Infinity values for `max_tokens` now clamped to default (2500)
- Case-insensitive legacy section detection in `buildDNRSection` and `buildConventionsSection`
- Error logging in cerebrum-guard catch block (was silently swallowing errors)
- Warning text no longer appended to JSON tool output (prevents corrupting structured responses)
- memory.md session-end row now has correct 5-column format
- `session-created.ts` error logging now passes full error object for stack traces
- Config warnings now use `CONFIG:` tag prefix for consistency

### Features
- Integrated `checkBuglog` into `tool-before` — edits/writes to files with known bugs now emit a BUGLOG warning
- Token ratios from `config.json` now used in `trimToTokenBudget` instead of hardcoded value

### Cleanup
- Removed dead `selectRelevantBugs` function from `relevance.ts`
- Removed dead snake_case parameter fallbacks (`args.path`, `args.file_path`) from tool hooks
- Updated stale "Phase 4 not implemented" message in `daemon-cmd.ts`
- Replaced fake `estimated_savings_vs_bare_cli` (always 0) with honest note
- Clarified AGENTS.md to distinguish OpenOwl's own `.owl/` files (manual check) from consumer `.owl/` files (auto-injected)
- Removed internal docs (decisions, research, specs) from git tracking

### Breaking Changes
- Auto-detected bugs now have `fix: "unknown"` instead of `fix: <summary>`. Consumers filtering on `fix` field will see different behavior.
- Snake_case tool parameter fallbacks (`args.path`, `args.file_path`) removed. OpenCode tools use `filePath` (camelCase).

### Test Coverage
- 166 tests across 30 files (up from 163)
- New tests for BOM/CRLF normalization, sanitizeConfig null guard, autoLogBug fix field, null buglog fields, buglog integration in tool-before, session init verification, corrupted session handling

## 0.3.3 (2026-04-15)

### Bug Fixes
- Show full relative paths in anatomy.md file entries instead of bare filenames

## 0.3.2 (2026-04-15)

### Bug Fixes
- `openowl init` now always replaces the OpenOwl section in AGENTS.md, even if "OpenOwl" text already exists

## 0.3.1 (2026-04-15)

### Changes
- Removed debug logging, clean release

## 0.3.0 (2026-04-15)

### Features
- Added `openowl daemon status` subcommand
- Enhanced AGENTS.md template with full daemon management documentation

### Documentation
- Documented pm2 as a required dependency for daemon features

## 0.2.3 (2026-04-15)

### Bug Fixes
- Moved DNR section to end of cerebrum.md template so `echo >>` appends land in correct section
- Added file-based debug logging

## 0.2.2 (2026-04-15)

### Bug Fixes
- Added diagnostic logging for DNR warning pass-through debugging

## 0.2.1 (2026-04-15)

### Bug Fixes
- DNR checker now checks both file content and filename
- Cerebrum entry parser now handles indented entries (`^\s*-` pattern)

## 0.2.0 (2026-04-15)

### Bug Fixes
- Fixed critical tool parameter tracking — OpenCode uses camelCase (`filePath`) not snake_case
- Before-handler warnings stored by callID and replayed in `tool.execute.after` (model-visible)
- Status command now merges active session data from `_session.json`
- Cerebrum.md template DNR section moved to bottom
- Anatomy shows full relative paths instead of bare filenames
- `init` no longer skips AGENTS.md update when "OpenOwl" already present
- Added `daemon status` subcommand

## 0.1.0 (2025-04-14)

Initial release of OpenOwl, a project intelligence middleware for OpenCode.

### Features
- Anatomy scanner with LLM-powered and heuristic file descriptions
- System prompt injection via `chat.system.transform` hook (configurable)
- Do-not-repeat pattern detection with cerebrum guard
- Token estimation and session tracking
- Bug detection and structured buglog
- Memory logging with automatic consolidation
- Background daemon with cron tasks (anatomy rescan, cerebrum staleness, memory consolidation, token reports)
- Web dashboard (React + Vite + TailwindCSS)
- `openowl doctor` health check command
- Cross-platform CLI with package manager detection

### Bug Fixes
- Fixed injection config double-nested access (token-budget.ts)
- Fixed memory-logger corruption when marker absent
- Fixed session token counter going negative
- Fixed cerebrum DNR heading case sensitivity
- Fixed app.log SDK call signature
- Plugin gracefully handles missing `.owl/` directory
- `openowl init` now installs opencode-owl as a project dependency

### Dependencies
- Runtime: commander (only required dependency)
- Optional: chokidar, express, node-cron, ws (daemon/dashboard only)
- DesignQC feature deferred to future version
