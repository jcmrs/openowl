# OpenOwl Architecture Specification

> Version: 0.1.0-draft
> Date: 2026-04-14
> Status: Approved for implementation

## 1. Overview

OpenOwl is a TypeScript middleware for OpenCode + GLM-5-Turbo that provides project intelligence, token tracking, and learning memory through a hybrid architecture: an OpenCode plugin for event integration + a standalone daemon for persistence, cron scheduling, and a web dashboard.

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenCode TUI                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              OpenOwl Plugin                          │   │
│  │  ┌─ tool.execute.before ─┐  ┌─ tool.execute.after ─┐│   │
│  │  │ (read/write guards)   │  │ (anatomy update,      ││   │
│  │  │ anatomy lookup         │  │  memory log, buglog)  ││   │
│  │  │ cerebrum check         │  │  token tracking       ││   │
│  │  └───────────────────────┘  └──────────────────────┘│   │
│  │  ┌─ session.created ──┐  ┌─ session.compacted ───┐  │   │
│  │  │ (init session,     │  │ (context backup,      │  │   │
│  │  │  check freshness)   │  │  re-inject .owl/)     │  │   │
│  │  └────────────────────┘  └───────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                   ┌──────▼──────┐                            │
│                   │   .owl/     │                            │
│                   │  directory  │                            │
│                   └──────┬──────┘                            │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              OpenOwl Daemon (optional)               │   │
│  │  ┌─ Cron Engine ─┐  ┌─ File Watcher ─┐              │   │
│  │  │ anatomy rescan │  │ chokidar on    │              │   │
│  │  │ memory consol. │  │ .owl/ → WS    │              │   │
│  │  │ token audit    │  │ broadcast      │              │   │
│  │  │ AI reflection  │  └────────────────┘              │   │
│  │  └────────────────┘                                 │   │
│  │  ┌─ Express + WebSocket ─┐                          │   │
│  │  │ Dashboard API         │                          │   │
│  │  └───────────────────────┘                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              Web Dashboard (React + Vite)             │   │
│  │  Token Usage | Anatomy | Cerebrum | Memory | BugLog  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Directory Structure

```
openowl/
├── .opencode/
│   ├── plans/                          # OpenCode plan files
│   └── docs/
│       └── opencode/                   # Local OpenCode docs mirror
│
├── UPSTREAM/                           # Immutable upstream clones
│   ├── openwolf/                       # cytostack/openwolf reference
│   ├── opencode/                       # anomalyco/opencode source
│   └── opencode-sdk-js/                # anomalyco/opencode-sdk-js types
│
├── docs/                               # Project documentation
│   ├── research/                       # Research and analysis
│   ├── specs/                          # Specifications
│   └── decisions/                      # Architecture Decision Records
│
├── src/
│   ├── plugin/                         # OpenCode plugin (primary integration)
│   │   ├── index.ts                    # Plugin export
│   │   ├── events/                     # Event handlers
│   │   ├── context/                    # Business logic modules
│   │   └── utils/                      # Plugin utilities
│   ├── core/                           # Claude-independent core
│   │   ├── scanner/                    # File scanning and description extraction
│   │   ├── tracker/                    # Token estimation and tracking
│   │   ├── buglog/                     # Bug tracking with similarity search
│   │   ├── daemon/                     # Background daemon
│   │   ├── designqc/                   # Screenshot-based design evaluation
│   │   └── utils/                      # Shared utilities
│   ├── templates/                      # .owl/ directory templates
│   ├── cli/                            # CLI commands
│   └── dashboard/                      # Web dashboard (React + Vite)
│
├── AGENTS.md                           # OpenCode project instructions
├── package.json
├── tsconfig.json
└── LICENSE
```

## 4. Data Directory (.owl/)

```
.owl/
├── OWL.md                    # Operating protocol (read every session)
├── identity.md               # AI identity and constraints
├── cerebrum.md               # Learning memory (preferences, learnings, DNR)
├── memory.md                 # Chronological action log
├── anatomy.md                # Project structure index with descriptions
├── config.json               # Configuration
├── token-ledger.json         # Lifetime token tracking
├── buglog.json               # Bug tracking
├── cron-manifest.json        # Cron task definitions
├── cron-state.json           # Cron execution state
├── _session.json             # Current session state (ephemeral)
└── designqc-captures/        # Screenshot captures
```

## 5. Component Responsibilities

### 5.1 Plugin Layer (src/plugin/)

**Entry point:** `index.ts` — exports a `Plugin` function per OpenCode's plugin API.

**Event subscriptions:**
- `tool.execute.before` — Anatomy guard, cerebrum check, buglog check
- `tool.execute.after` — Anatomy update, memory log, buglog update, token tracking
- `session.created` — Session initialization, freshness checks
- `session.compacted` — Context re-injection
- `session.idle` — Session finalization, ledger update
- `file.edited` — Alternative write tracking

**Context modules (src/plugin/context/):**
- `anatomy-guard.ts` — Pre-read: check anatomy, warn on repeats
- `cerebrum-guard.ts` — Pre-write: check Do-Not-Repeat, preferences
- `buglog-guard.ts` — Pre-write: check known bugs for file
- `anatomy-updater.ts` — Post-write: update anatomy.md entry
- `memory-logger.ts` — Post-action: append to memory.md
- `token-tracker.ts` — Post-action: estimate & log tokens
- `bug-detector.ts` — Post-write: auto-detect bug fix patterns
- `session-manager.ts` — Session init, cleanup, ledger updates

### 5.2 Core Layer (src/core/)

All components are Claude-independent and can be tested standalone.

**Scanner:** Walks project directory, builds file index, extracts descriptions for 25+ languages.

**Tracker:** Token estimation (GLM-5-Turbo calibrated), lifetime ledger, waste pattern detection.

**Buglog:** CRUD operations, Jaccard similarity search, near-duplicate detection.

**Daemon:** Express + WebSocket server, cron scheduling with retry/backoff/dead-letter, file watching.

**DesignQC:** Headless Chrome screenshot capture, route detection, sectioned captures.

**Utils:** Atomic file writes, structured logging, path utilities, platform detection.

### 5.3 CLI Layer (src/cli/)

Commands: init, scan, status, dashboard, daemon, cron, bug, designqc, update.

### 5.4 Dashboard Layer (src/dashboard/)

React + Vite + TailwindCSS web dashboard with 10 panels and WebSocket real-time updates.

## 6. Data Flows

### 6.1 Session Start
```
session.created event
  → session-manager.init()
    → clean .owl/*.tmp files
    → create .owl/_session.json
    → append session header to memory.md
    → check cerebrum freshness
    → check buglog status
    → increment total_sessions in token-ledger.json
```

### 6.2 File Read
```
tool.execute.before (tool=read)
  → anatomy-guard.check(filePath)
    → skip if .owl/ file
    → check _session.json for prior read
    → lookup anatomy.md for description
    → showToast() warnings

tool.execute.after (tool=read)
  → token-tracker.estimate(content, filePath)
  → session-manager.recordRead(filePath, tokens)
```

### 6.3 File Write
```
tool.execute.before (tool=write|edit)
  → cerebrum-guard.check(content)
    → parse Do-Not-Repeat entries
    → showToast() if pattern match
  → buglog-guard.check(filePath, content)
    → search buglog for same-file bugs
    → showToast() if similar bug found

tool.execute.after (tool=write|edit)
  → anatomy-updater.update(filePath, content)
  → memory-logger.log(action, filePath, summary)
  → token-tracker.estimate(content, filePath)
  → bug-detector.detect(filePath, content, oldContent)
    → if bug fix pattern: log to buglog.json
```

### 6.4 Session End
```
session.idle event
  → session-manager.finalize()
    → read _session.json
    → check missing buglogs
    → check cerebrum freshness
    → calculate session totals
    → update token-ledger.json
    → append session summary to memory.md
    → clean _session.json
```

## 7. Configuration (config.json)

```json
{
  "version": 1,
  "openowl": {
    "enabled": true,
    "anatomy": {
      "auto_scan_on_init": true,
      "rescan_interval_hours": 6,
      "max_description_length": 100,
      "max_files": 500,
      "exclude_patterns": [
        "node_modules", ".git", "dist", "build", ".owl",
        ".next", ".nuxt", "coverage", "__pycache__", ".cache",
        "target", ".vscode", ".idea", ".turbo", ".vercel",
        ".netlify", ".output", "*.min.js", "*.min.css"
      ]
    },
    "token_audit": {
      "enabled": true,
      "report_frequency": "weekly",
      "waste_threshold_percent": 15,
      "chars_per_token_code": 3.0,
      "chars_per_token_prose": 3.8,
      "chars_per_token_mixed": 3.4
    },
    "cron": {
      "enabled": true,
      "max_retry_attempts": 3,
      "dead_letter_enabled": true,
      "heartbeat_interval_minutes": 30,
      "ai_command": "opencode -p"
    },
    "memory": {
      "consolidation_after_days": 7,
      "max_entries_before_consolidation": 200
    },
    "cerebrum": {
      "max_tokens": 2000,
      "reflection_frequency": "weekly"
    },
    "daemon": {
      "port": 18790,
      "log_level": "info"
    },
    "dashboard": {
      "enabled": true,
      "port": 18791
    },
    "designqc": {
      "enabled": true,
      "viewports": [
        { "name": "desktop", "width": 1440, "height": 900 },
        { "name": "mobile", "width": 375, "height": 812 }
      ],
      "max_screenshots": 6,
      "chrome_path": null
    }
  }
}
```
