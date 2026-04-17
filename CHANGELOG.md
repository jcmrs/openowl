# Changelog

## 0.7.0 (2026-04-17)

### Remediation Program

This release is the result of a comprehensive 6-phase remediation program (Plan 011) that verified every feature at the use boundary and fixed fundamental issues discovered in v0.6.0.

#### Session Lifecycle (Phase 1)
- Removed broken `sessionActive` boolean flag. Session finalization now relies on `finalizeSession` idempotency — `session.created` fires once per OpenCode session while `session.status:idle` fires per prompt.
- Moved `recordWrite()` from `tool.execute.before` to `tool.execute.after` — writes are now recorded after the tool succeeds, preventing lost writes from premature session state deletion.
- Disabled bug auto-detection (was 100% false-positive rate on intentional edits).
- Removed `session.updated` auto-session-creation (was creating spurious sessions on title changes).

#### Data Integrity (Phase 2)
- Heartbeat writes to separate `.owl/_heartbeat` file instead of `cron-state.json` (was overwriting execution log on every tick).
- Cron tasks (`scan_project`, `consolidate_memory`) now skip when `_session.json` exists (active plugin session).
- All `memory.md` writes converted to atomic `writeText` (was `appendText`, vulnerable to partial writes during consolidation).
- `writeJSON` and `writeText` now verify content by reading back and comparing; retry once on mismatch.

#### Injection Block (Phase 3)
- Section-aware trimming: drops entire lowest-priority sections when over token budget instead of greedy line truncation.
- Contributing text participates in budget calculation (was appended after trimming, potentially exceeding budget).
- Cache key includes config JSON (config toggle changes no longer return stale cached data).
- Fixed cache collision bug: `invalidateInjectionCache()` exported and called in test `beforeEach`.

#### Buglog Guard (Phase 3)
- Removed bidirectional substring matching (was matching large files on common error words). Now unidirectional: file content must contain the error message.
- Score computed by match type: exact file path = 2.0, content substring = 1.0, sorted descending.
- Fixed path matching: compares basenames and path suffixes, not just exact equality (tool args provide absolute paths, buglog stores relative names).

#### Memory Logger (Phase 3)
- Table header (`| Time | Action | ... |`) auto-inserted when missing from `memory.md`.

#### Anatomy Scanner (Phase 3)
- Removed dead `hits`/`misses` counters from `serializeAnatomy()` output and signature.

#### Daemon Overhaul (Phase 4)
- File watcher (`startFileWatcher()`) now returns the chokidar instance and is closed properly on shutdown.
- Removed `awaitWriteFinish` (polling leak risk). Replaced with 500ms debounce for change events.
- Broadcast sends metadata only (path + timestamp) instead of full file content.
- Added `file_added` and `file_removed` WebSocket broadcasts.
- Excluded daemon-written files from watching (`_heartbeat`, `daemon-token`, `_session.json`, `cron-state.json`).
- Ordered shutdown: cron → file watcher → WebSocket server → HTTP server.
- Removed dead `daemon.port` config field (server always uses `dashboard.port`).
- Port auto-selection: tries basePort through basePort+10 on `EADDRINUSE`. Writes actual port to `.owl/_daemon-port`.
- CLI reads `_daemon-port` for `daemon stop`/`daemon restart` (finds actual port).

#### Packaging (Phase 5)
- README rewritten: all commands use `npx openowl`, removed dead config fields, added port auto-selection docs, added `.owl/` file ownership table.
- Init template no longer generates dead `daemon.port` config.
- AGENTS.md updated with verified feature status.

#### Bug Fixes
- Fix DNR guard not firing for edits matching cerebrum patterns — tool.before warning now correctly stored in `pendingWarnings` map and appended to tool output in tool.after.
- Fix buglog guard never matching — was comparing absolute tool paths against relative buglog filenames.

### Test Updates
- 179 tests pass across 31 files. No regressions from remediation program.

## 0.6.1 (2026-04-15)

### Bug Fixes
- Fix conventions section in injection: legacy branch iterated empty `conventionEntries` instead of `legacyEntries`, producing empty output. Parsed branch used `slice(0, 8)` (oldest) instead of `slice(-8)` (most recent).

## 0.6.0 (2026-04-15)

### Bug Detection Enhancement
- Added 13 structural-diff categories: error-handling, null-safety, guard-clause, wrong-value, wrong-reference, logic-fix, operator-fix, missing-import, return-value, async-fix, type-fix, style-fix, refactor. These compare old/new code structure to detect what changed, complementing the existing content-scan approach.
- Structural diff runs first for edits; content-scan used as fallback for fresh writes (no old content).
- Fix field now populated for structural detections (was always "unknown").
- File-type exclusions: test files, specs, markdown, and JSON are excluded from bug detection.
- Buglog guard now surfaces actual bug details (ID, error message, fix) — limited to 2 bugs instead of just a count.
- Dedup threshold lowered to 0.7 for same-file+same-category bugs.

### Session Resume
- Added `session.updated` event handler — creates OpenOwl session if `_session.json` is missing (handles OpenCode idle→resume→continue flow).
- Added `session.status` event handler alongside deprecated `session.idle` for forward compatibility.
- Session resume detection: existing `_session.json` now triggers "(resumed)" header instead of incrementing session counter.

### Injection Pipeline Polish
- Fixed `trimToTokenBudget`: all `## ` headings are now treated as header (not just the first), preventing mid-section truncation that produced malformed output.
- Removed dead `includeFilesPattern` from `RelevanceOptions` interface.
- Conventions section now takes most recent 8 entries (was first 8).
- Empty `.owl/` produces no injection block at all (footer removed when no content).
- Added mtime-based injection cache — reads files from disk only when mtimes change, with `invalidateInjectionCache()` export for external invalidation.

### Test Updates
- Updated `tool-before.test.ts` for new bug detail warning text format.
- 179 tests pass across 31 files.

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
