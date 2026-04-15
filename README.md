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
- **Context Guards** — warns about re-reads, anatomy misses, do-not-repeat violations
- **Daemon** — background cron tasks (anatomy rescan, cerebrum staleness, memory consolidation, token reports)
- **Dashboard** — React-based web UI for project metrics

## Install

```bash
npm install openowl
npx openowl init
```

This creates `.owl/` with configuration, installs `openowl` as a project dependency, installs the OpenCode plugin, and updates `AGENTS.md`.

## CLI Commands

| Command | Description |
|---------|-------------|
| `openowl init` | Initialize OpenOwl in current project |
| `openowl doctor` | Health check: verify plugin, config, data freshness |
| `openowl status` | Show project status and session stats |
| `openowl scan` | Rescan project anatomy |
| `openowl daemon start` | Start the background daemon (requires pm2) |
| `openowl daemon stop` | Stop the daemon |
| `openowl daemon restart` | Restart the daemon |
| `openowl daemon logs` | Show daemon log output |
| `openowl dashboard` | Launch the web dashboard |
| `openowl bug search <query>` | Search the bug log |
| `openowl cron list` | List cron tasks |
| `openowl cron run <task-id>` | Run a cron task manually |
| `openowl cron retry <task-id>` | Retry a failed cron task |
| `openowl update` | Update OpenOwl to latest version |
| `openowl restore` | Restore .owl/ from backup |

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
    "daemon": { "port": 18790 },
    "dashboard": { "enabled": true, "port": 18791 }
  }
}
```

### Injection Settings

The `injection` section controls what gets injected into the system prompt each turn:

- `max_tokens` — maximum tokens for the injection block (500–10000, default 2500)
- `include_*` — toggle individual sections on/off
- `enabled: false` — disable injection entirely

## Architecture

- **Plugin** (`src/plugin/`) — OpenCode plugin hooks for event monitoring and system prompt injection
- **Core** (`src/core/`) — scanners, trackers, daemon, buglog
- **CLI** (`src/cli/`) — Commander-based CLI
- **Dashboard** (`src/dashboard/`) — React + Vite + TailwindCSS web UI

## Requirements

- Node.js 20+
- OpenCode >= 1.4.1

## License

AGPL-3.0
