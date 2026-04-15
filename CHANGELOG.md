# Changelog

## 0.5.0 (2026-04-15)

### Critical Fixes
- Fix daemon crash on startup: `__dirname` was undefined in ESM scope in `owl-daemon.ts`. The daemon has never successfully started — this unblocks all daemon features (cron engine, file watcher, dashboard).
- Fix `require()` calls in ESM modules: replaced 4 bare `require()` calls with proper ESM imports in `build-context.ts`, `init.ts`, `dashboard.ts`, and `anatomy-scanner.ts`.
- Fix Logger ENOENT on first run: `rotateIfNeeded()` now checks `isFile()` before checking size, preventing crash when `daemon.log` doesn't exist yet.
- Unify cron manifest task IDs between `init.ts` and `cron-manifest.json` template. Init now creates all 5 tasks with correct IDs matching the template.

### Features
- Edit summarization: new `edit-summarizer.ts` produces human-readable descriptions of what changed (e.g., "added error handling", `"3000" → "5000"`, "modified handleSubmit()"). Memory.md now shows these instead of generic "written".
- Session headers in memory.md: sessions are now visually separated with `## Session: YYYY-MM-DD HH:MM` headers.
- Create vs edit distinction: memory.md shows "Created X" for new files, "Edited X" for modifications.
- Relative paths in memory.md: file paths are now relative to project root instead of absolute.

### Improvements
- Cerebrum deduplication: `appendCerebrumEntry()` now checks the last 5 entries in the target section and skips if a duplicate already exists (normalized text comparison).
- Multi-edit churn fires only once per file per session (was firing on every edit ≥ 3).
- DNR violation warnings no longer auto-log to cerebrum (breaks feedback loop).
- Bug detection auto-logging to cerebrum rate-limited to 3 per session.
- Session summaries to cerebrum skipped for single-file sessions (low-information).
- Cron AI task writes cerebrum updates to a staging file instead of destructively overwriting cerebrum.md.

### DNR Algorithm Overhaul
- Replaced Jaccard similarity matching with quoted-string extraction + "never use/avoid X" phrase extraction + whole-word case-insensitive regex matching. More precise, lower false-positive rate.
- DNR violations no longer auto-logged to cerebrum (eliminates recursive noise loop).

### Test Updates
- Updated `tool-after.test.ts` for new "Created" action string.
- Updated `tool-after.test.ts` for new `churn_warned_files` session field.
- Rewrote `cerebrum-guard.test.ts` with 7 tests covering quoted-string matching, word-boundary behavior, case-insensitivity, and no-pattern entries.

## 0.4.4 (2026-04-15)

### Features
- Auto-logging to cerebrum.md — insights now flow back mechanically without relying on model compliance:
  - Bug detection auto-logs to Key Learnings section
  - DNR violation attempts auto-log to Do-Not-Repeat section
  - Multi-edit detection (3+ edits to same file) auto-logs to Key Learnings
  - Session end with writes auto-logs a file summary to Key Learnings
- New `cerebrum-logger.ts` utility with `appendCerebrumEntry(owlDir, section, scope, text)`

## 0.4.3 (2026-04-15)

### Bug Fixes
- Fix AGENTS.md duplication: rewritten section boundary detection to use line-by-line parsing instead of regex. The previous regex only matched the `# OpenOwl` header line, leaving duplicated `## ` sub-sections intact on each re-init. Now correctly finds the full OpenOwl section (from `# OpenOwl` to the next top-level heading or EOF) and replaces it entirely.

## 0.4.2 (2026-04-15)

### Bug Fixes
- Fix AGENTS.md duplication on re-init: `openowl init` now strips ALL existing OpenOwl sections before inserting the fresh snippet, preventing accumulation of duplicate content on repeated runs

## 0.4.1 (2026-04-15)

### Features
- Close the learning loop: injection block now includes a `## Contributing` section prompting the model to record insights to `.owl/cerebrum.md` every turn
- Session compaction hook now prompts the model to reflect on learnings before continuing
- Every 10th write/edit appends a cerebrum nudge reminder to tool output

### Bug Fixes
- Fix CHANGELOG dates for v0.2.0–v0.3.3 (all were 2026-04-15, not 04-14)
- Fix memory.md session-end row column count (now 5 columns, matching session-start and memory-logger)
- Truncation marker now uses XML comment inside owl-context
- session-created.ts error logging now passes full error object for stack traces
- Config warnings now use `CONFIG:` tag prefix for consistency

### Documentation
- Document all deferred items (E2E-26, E2E-28, GAP-02, GAP-05) in AGENTS.md
- Document Dashboard as open challenge in AGENTS.md
- Add OpenWolf attribution to LICENSE per AGPL-3.0 Sections 4 and 5
- Backfill CHANGELOG for v0.2.0–v0.3.3 from git history

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
