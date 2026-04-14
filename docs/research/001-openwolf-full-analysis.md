# OpenWolf Full Architecture Analysis

> Repository: https://github.com/cytostack/openwolf
> Version: 1.0.4
> License: AGPL-3.0
> Language: TypeScript (ESM, Node.js 20+)
> Analysis Date: 2026-04-14

## 1. Overview

OpenWolf is a "token-conscious AI brain for Claude Code projects." It provides project intelligence, cross-session memory, token tracking, bug logging, and automated maintenance through Claude Code's hooks system. It operates as middleware between Claude Code and the user's project.

## 2. Directory Structure

```
openwolf/
├── src/
│   ├── hooks/           # 6 Claude Code hook scripts + shared utilities
│   ├── scanner/         # Project file scanner and description extractor
│   ├── tracker/         # Token estimation and waste detection
│   ├── daemon/          # Background daemon with cron, file watching, dashboard API
│   ├── buglog/          # Bug tracking with similarity search
│   ├── designqc/        # Screenshot-based UI design evaluation
│   ├── templates/       # .wolf/ directory template files
│   ├── cli/             # CLI commands (init, scan, status, daemon, cron, bug, designqc, update)
│   ├── dashboard/       # React + Vite + TailwindCSS web dashboard
│   └── utils/           # Shared utilities (fs-safe, logger, paths, platform)
├── package.json
├── tsconfig.json
└── README.md
```

## 3. Hook Layer (src/hooks/)

### 3.1 Hook Registration (src/cli/init.ts)

OpenWolf registers 6 hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/session-start.js\"", "timeout": 5 }] }],
    "PreToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/pre-read.js\"", "timeout": 5 }] },
      { "matcher": "Write|Edit|MultiEdit", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/pre-write.js\"", "timeout": 5 }] }
    ],
    "PostToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/post-read.js\"", "timeout": 5 }] },
      { "matcher": "Write|Edit|MultiEdit", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/post-write.js\"", "timeout": 10 }] }
    ],
    "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.wolf/hooks/stop.js\"", "timeout": 10 }] }]
  }
}
```

### 3.2 session-start.js

**Purpose:** Initialize session state, check data freshness.

**Atomic operations:**
1. Read stdin JSON (Claude Code provides session context)
2. Clean `.wolf/*.tmp` files from previous crashed sessions
3. Create `.wolf/_session.json` with: session_id, started_at, reads: [], writes: [], edits_by_file: {}
4. Append session header to `memory.md`: `| HH:MM | Session started | — | — | ~0 |`
5. Check cerebrum freshness: warn if < 3 entries or > 3 days old
6. Check if buglog is empty (warn if so)
7. Increment `total_sessions` in `token-ledger.json`

### 3.3 pre-read.js

**Purpose:** Prevent unnecessary file reads via anatomy lookup.

**Atomic operations:**
1. Read stdin JSON → extract `tool_input.file_path`
2. Skip if file is in `.wolf/` directory (system files)
3. Check `_session.json` for prior read of same file
4. If prior read: emit warning to stderr "ALREADY READ: {file} in this session"
5. If not: lookup file in `anatomy.md` via parseAnatomy()
6. If found: emit info to stderr with description + token estimate (anatomy HIT)
7. If not found: emit warning to stderr (anatomy MISS)
8. Log read in `_session.json` with file_path, timestamp, anatomy_hit, token_estimate

### 3.4 post-read.js

**Purpose:** Track actual token usage from file reads.

**Atomic operations:**
1. Read stdin JSON → extract `tool_output.content` (full file content)
2. Estimate tokens using estimateTokens(content, filePath) from shared.js
3. Update `_session.json` read entry with actual_tokens, content_length
4. Increment session read token counter

### 3.5 pre-write.js

**Purpose:** Check cerebrum Do-Not-Repeat and buglog before writes.

**Atomic operations:**
1. Read stdin JSON → extract tool_input (content, old_string, new_string for edits)
2. Parse `cerebrum.md` → extract `## Do-Not-Repeat` entries
3. For each DNR entry: check if the write content matches the anti-pattern
4. Parse `buglog.json` → search for bugs in the same file
5. For matching bugs (≥3 meaningful words overlap in error_message): warn to stderr
6. Output decision to stdout (always "approve" — advisory only)

### 3.6 post-write.js

**Purpose:** Update anatomy, memory, buglog after writes.

**Atomic operations:**
1. Read stdin JSON → extract tool_input (file_path, content or old_string/new_string)
2. Update `anatomy.md`: extract description from content, upsert entry
3. Append to `memory.md`: `| HH:MM | edited {file} | {file} | {summary} | ~{tokens} |`
4. Track edit in `_session.json` edits_by_file counter
5. If ≥3 edits on same file: warn on stderr (likely a bug)
6. Auto-detect bug fix patterns (13 categories):
   - import/module/dependency fixes
   - runtime errors
   - type errors
   - syntax errors
   - build failures
   - lint failures
   - test failures
   - logic errors
   - null/undefined fixes
   - async/promise fixes
   - configuration fixes
   - API changes
   - security fixes
7. If bug fix detected: auto-log to `buglog.json` with structured entry

### 3.7 stop.js

**Purpose:** Session cleanup and finalization.

**Atomic operations:**
1. Read `_session.json`
2. Check for missing buglogs (files with ≥3 edits but no buglog entry)
3. Check cerebrum freshness (remind if not updated this session)
4. Calculate session totals: reads, writes, tokens
5. Build session entry for `token-ledger.json`
6. Calculate savings: estimated_savings = (repeated_reads_blocked * avg_file_tokens) - overhead
7. Update `token-ledger.json`: add session to sessions array, update lifetime totals
8. Append session summary to `memory.md`

### 3.8 shared.js

**Purpose:** Shared utilities for all hooks.

**Key functions:**
- `readJSON(path, fallback)` — Read JSON file with fallback
- `writeJSON(path, data)` — Write JSON atomically (tmp + rename)
- `readText(path)` — Read text file
- `writeText(path, content)` — Write text file
- `readStdin()` — Read and parse JSON from stdin
- `parseAnatomy(content)` — Parse anatomy.md into Map<section, entries[]>
- `serializeAnatomy(map)` — Serialize map back to markdown
- `extractDescription(content, filePath, maxLen)` — Generate file description
- `estimateTokens(content, filePath)` — Estimate token count (chars/3.5 code, chars/4.0 prose)
- `normalizePath(path)` — Normalize file paths
- `getWolfDir()` — Resolve .wolf/ directory
- `getSessionPath()` — Resolve _session.json path

## 4. Scanner Layer (src/scanner/)

### 4.1 anatomy-scanner.ts

**Purpose:** Walk project directory, build file index, write anatomy.md.

**Atomic operations:**
1. Read config.json for exclude_patterns and max_files
2. Walk project directory recursively (respecting .gitignore)
3. For each file: extract description using description-extractor.ts
4. Estimate token count per file
5. Group files by directory section
6. Serialize to markdown format
7. Write to `.wolf/anatomy.md`

**Output format:**
```markdown
# anatomy.md
> Auto-maintained by OpenWolf. Last scanned: {timestamp}
> Files: {count} | Estimated total: ~{tokens} tokens

## src/
- `file.ts` — {description} (~{tokens} tokens)
...
```

### 4.2 description-extractor.ts

**Purpose:** Generate 1-2 line descriptions for files in 25+ languages.

**Supported languages:** JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, C#, Ruby, Swift, Dart, PHP, Elixir, Scala, C, C++, Haskell, Lua, R, Shell/Bash, SQL, YAML, JSON, TOML, Vue, Svelte, JSX/TSX

**Extraction strategies:**
- Class/function/type/interface declarations
- Export statements
- Package/module metadata
- JSDoc/docstring comments
- Route definitions
- Configuration schemas

**Approximately 1000 lines of language-specific parsing logic.**

### 4.3 project-root.ts

**Purpose:** Find project root directory.

**Markers checked:** .git, package.json, Cargo.toml, pyproject.toml, go.mod, Gemfile, pom.xml, build.gradle, .hg, .svn, Makefile, CMakeLists.txt

## 5. Tracker Layer (src/tracker/)

### 5.1 token-estimator.ts

**Token estimation ratios:**
- Code (.ts, .js, .py, .go, .rs, etc.): chars / 3.5
- Prose (.md, .txt, .rst, .doc): chars / 4.0
- Mixed/unknown: chars / 3.75

### 5.2 token-ledger.ts

**Lifetime stats tracked:**
- total_tokens_estimated
- total_reads
- total_writes
- total_sessions
- anatomy_hits
- anatomy_misses
- repeated_reads_blocked
- estimated_savings_vs_bare_cli

### 5.3 waste-detector.ts

**5 waste patterns:**
1. Repeated reads of same file within session
2. Reads where anatomy.md description would suffice
3. Memory.md bloat (>200 entries without consolidation)
4. Cerebrum.md stale (>3 days without update)
5. Anatomy.md miss rate (>30% of reads not in anatomy)

## 6. Daemon Layer (src/daemon/)

### 6.1 wolf-daemon.ts

**Components:**
- Express HTTP server (port 18790 by default)
- WebSocket server for real-time updates
- CronEngine for scheduled tasks
- FileWatcher for .owl/ directory changes
- Health check endpoint

### 6.2 cron-engine.ts

**Default cron tasks:**
| Task | Schedule | Description |
|------|----------|-------------|
| anatomy-rescan | 0 */6 * * * | Full anatomy rescan |
| memory-consolidation | 0 2 * * * | Compress entries older than 7 days |
| token-audit | 0 0 * * 1 | Weekly waste pattern detection |
| cerebrum-reflection | 0 3 * * 0 | Weekly AI review of cerebrum.md |
| project-suggestions | 0 4 * * 1 | Weekly AI improvement suggestions |

**Features:**
- Exponential backoff retry
- Dead letter queue for failed tasks
- Heartbeat monitoring
- AI task execution via `claude -p --output-format text`

### 6.3 file-watcher.ts

**Uses:** chokidar
**Watches:** .wolf/ directory recursively
**Broadcasts:** Changes via WebSocket to dashboard clients

### 6.4 health.ts

**Status levels:** healthy, degraded, unhealthy
**Checks:** File integrity, daemon uptime, cron heartbeat recency

## 7. Buglog Layer (src/buglog/)

### 7.1 bug-tracker.ts

**CRUD operations:**
- `readBugLog(wolfDir)` — Read buglog.json
- `logBug(wolfDir, bug)` — Add new bug (with near-duplicate detection)
- `findSimilarBugs(wolfDir, errorMessage)` — Jaccard similarity search
- `searchBugs(wolfDir, term)` — Full-text search across all fields

**Bug entry schema:**
```json
{
  "id": "bug-001",
  "timestamp": "ISO date",
  "error_message": "exact error or user complaint",
  "file": "file that was fixed",
  "line": 42,
  "root_cause": "why it broke",
  "fix": "what you changed to fix it",
  "tags": ["relevant", "keywords"],
  "related_bugs": [],
  "occurrences": 1,
  "last_seen": "ISO date"
}
```

**Similarity detection:** Jaccard word overlap + substring matching. Threshold: 0.8 for near-duplicate (increment occurrences instead of new entry).

## 8. Design QC Layer (src/designqc/)

### 8.1 designqc-engine.ts

**Purpose:** Capture screenshots of web app for AI design evaluation.

**Workflow:**
1. Detect running dev server (ports 3000, 3001, 5173, 5174, 4321, 8080, 8000, 4200)
2. If no server running, start from package.json scripts
3. Launch headless Chrome via puppeteer-core
4. Capture sectioned screenshots (top, section2, ..., bottom) per route
5. Save as JPEG (quality 70, max width 1200px) to .wolf/designqc-captures/
6. Log capture to memory.md

### 8.2 designqc-capture.ts

**Route detection:** Scans pages/, app/, src/pages/, src/app/ for route files
**Chrome detection:** Platform-specific (Windows: Program Files, Mac: /Applications, Linux: which)
**Sectioned capture:** Full page divided into viewport-height sections (max 8 per page)

### 8.3 designqc-types.ts

**Default viewports:**
- Desktop: 1440×900
- Mobile: 375×812

## 9. Template Files (src/templates/)

| File | Purpose | Updated on Upgrade? |
|------|---------|---------------------|
| OPENWOLF.md | Operating protocol (instructions for Claude) | Yes (always overwrite) |
| config.json | Configuration with defaults | Yes |
| reframe-frameworks.md | UI framework knowledge base | Yes |
| identity.md | AI identity and constraints | No (create if missing) |
| cerebrum.md | Learning memory sections | No |
| memory.md | Chronological action log | No |
| anatomy.md | Project structure index | No |
| token-ledger.json | Token tracking data | No |
| buglog.json | Bug tracking data | No |
| cron-manifest.json | Scheduled task definitions | No |
| cron-state.json | Cron execution state | No |
| claude-md-snippet.md | Snippet for CLAUDE.md | N/A (reference only) |
| claude-rules-openwolf.md | Claude rules file | N/A (reference only) |

## 10. CLI Commands (src/cli/)

| Command | Purpose |
|---------|---------|
| `openwolf init` | Initialize .wolf/, register hooks, seed data, scan anatomy |
| `openwolf scan [--check]` | Force anatomy rescan or verify consistency |
| `openwolf status` | Show daemon health, file integrity, token stats |
| `openwolf dashboard` | Open web dashboard in browser |
| `openwolf daemon start/stop/restart/logs` | Manage daemon via pm2 |
| `openwolf cron list/run/retry` | Manage cron tasks |
| `openwolf bug search <term>` | Search buglog |
| `openwolf designqc [target]` | Capture screenshots |
| `openwolf update [--dry-run] [--project]` | Update all registered projects |
| `openwolf restore [backup]` | Restore .wolf/ from backup |

## 11. Claude Code Coupling Points

| Coupling | Location | Detail |
|----------|----------|--------|
| Hook event names | init.ts HOOK_SETTINGS | SessionStart, PreToolUse, PostToolUse, Stop |
| Hook matchers | init.ts | "Read", "Write\|Edit\|MultiEdit" |
| Stdin JSON schema | All hooks | tool_input.file_path, tool_output.content, tool_name |
| Environment variable | hooks/shared.ts | $CLAUDE_PROJECT_DIR |
| Settings file | init.ts | .claude/settings.json hooks format |
| Rules file | init.ts | .claude/rules/openwolf.md (Claude rules format with frontmatter) |
| CLAUDE.md | init.ts | Appends OpenWolf reference snippet |
| AI task execution | cron-engine.ts | claude -p --output-format text command |
| Template content | templates/OPENWOLF.md | "Claude" referenced throughout |

## 12. Dashboard (src/dashboard/app/)

**Stack:** React + Vite + TailwindCSS

**10 Panels:**
1. ProjectOverview — Project info, daemon status, quick stats
2. TokenUsage — Lifetime/session token graphs, waste detection
3. AnatomyBrowser — Browse/search anatomy.md entries
4. CerebrumViewer — View/edit cerebrum.md sections
5. MemoryViewer — Browse/search memory.md entries
6. BugLog — Search/filter bug entries, similarity graph
7. CronStatus — Task list, execution log, dead letter queue
8. DesignQC — Screenshot gallery, evaluation results
9. AISuggestions — Weekly AI-generated improvement suggestions
10. ActivityTimeline — Real-time session activity via WebSocket

**Communication:** WebSocket client connects to daemon for live updates.
