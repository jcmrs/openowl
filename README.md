# OpenOwl

Project intelligence, token tracking, and learning memory middleware for [OpenCode](https://opencode.ai).

Adapted from [OpenWolf](https://github.com/cytostack/openwolf) with all Claude-specific coupling replaced by OpenCode-native equivalents.

## Features

- **System Prompt Injection** — automatically injects DNR entries, conventions, file index, and bug data into every turn via the `chat.system.transform` hook
- **Anatomy Scanner** — indexes every file with LLM-powered or heuristic descriptions and token estimates
- **Cerebrum** — cross-session learning memory (preferences, learnings, do-not-repeat)
- **Memory Log** — chronological action log per session
- **Bug Log** — structured bug database with similarity matching
- **Token Tracker** — estimates and tracks token usage across sessions
- **Context Guards** — warns about re-reads, anatomy misses, do-not-repeat violations, known bugs
- **Daemon** — background cron tasks (anatomy rescan, cerebrum staleness, memory consolidation, token reports)
- **Dashboard** — React-based web UI for project metrics

## Install

```bash
npm install opencode-owl
npx openowl init
```

This creates `.owl/` with configuration, installs `opencode-owl` as a project dependency, installs the OpenCode plugin, and updates `AGENTS.md`.

After `init`, restart OpenCode to activate the plugin.

## CLI Commands

All commands use `npx openowl` (local install) or `openowl` (global install):

| Command | Description |
|---------|-------------|
| `npx openowl init` | Initialize OpenOwl in current project |
| `npx openowl doctor` | Health check: verify plugin, config, data freshness |
| `npx openowl status` | Show project status and session stats |
| `npx openowl scan` | Rescan project anatomy |
| `npx openowl daemon start` | Start the background daemon (requires pm2) |
| `npx openowl daemon stop` | Stop the daemon |
| `npx openowl daemon status` | Show daemon status |
| `npx openowl daemon restart` | Restart the daemon |
| `npx openowl daemon logs` | Show daemon log output |
| `npx openowl bug search <query>` | Search the bug log |
| `npx openowl cron list` | List cron tasks |
| `npx openowl cron run <task-id>` | Run a cron task manually |

## Configuration

Config lives in `.owl/config.json`. Key settings:

```json
{
  "openowl": {
    "injection": {
      "enabled": true,
      "max_tokens": 2500,
      "include_project": true,
      "include_dnr": true,
      "include_conventions": true,
      "include_anatomy": true,
      "include_bugs": true
    },
    "anatomy": {
      "auto_scan_on_init": true,
      "rescan_interval_hours": 6,
      "max_description_length": 100,
      "max_files": 500,
      "llm_descriptions": "auto"
    },
    "token_audit": {
      "model": "",
      "chars_per_token_code": 3.0,
      "chars_per_token_prose": 3.8,
      "chars_per_token_mixed": 3.4
    },
    "dashboard": { "enabled": true, "port": 18791 }
  }
}
```

### Injection Settings

The `injection` section controls what gets injected into the system prompt each turn:

- `max_tokens` — maximum tokens for the injection block (500–10000, default 2500)
- `include_*` — toggle individual sections on/off
- `enabled: false` — disable injection entirely

### Port Auto-Selection

If the configured dashboard port (default 18791) is in use, the daemon automatically tries ports up to +10. The actual port is written to `.owl/_daemon-port`. The CLI reads this file to find the daemon.

### .owl/ File Ownership

| File | Written by | Purpose |
|------|-----------|---------|
| `_session.json` | Plugin (ephemeral) | Active session state |
| `_heartbeat` | Daemon | Heartbeat timestamp |
| `_daemon-port` | Daemon | Actual bound port |
| `daemon-token` | Daemon | Dashboard auth token |
| `daemon.log` | Daemon | Structured log |
| `memory.md` | Plugin | Session action log |
| `cerebrum.md` | Plugin + model | Learning memory |
| `anatomy.md` | Plugin + daemon | File index |
| `buglog.json` | Plugin | Bug database |
| `token-ledger.json` | Plugin + daemon | Token usage |
| `config.json` | CLI + plugin | Configuration |
| `cron-manifest.json` | CLI | Task definitions |
| `cron-state.json` | Daemon | Task execution state |

## Architecture

- **Plugin** (`src/plugin/`) — OpenCode plugin hooks for event monitoring and system prompt injection
- **Core** (`src/core/`) — scanners, trackers, daemon, buglog
- **CLI** (`src/cli/`) — Commander-based CLI
- **Dashboard** (`src/dashboard/`) — React + Vite + TailwindCSS web UI

## Requirements

- Node.js 20+
- OpenCode >= 1.4.1
- pm2 (`npm install -g pm2`) — required for daemon commands

## License

AGPL-3.0
