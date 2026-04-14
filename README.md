# OpenOwl

Project intelligence, token tracking, and learning memory middleware for [OpenCode](https://opencode.ai).

Adapted from [OpenWolf](https://github.com/cytostack/openwolf) with all Claude-specific coupling replaced by OpenCode-native equivalents.

## Features

- **Anatomy Scanner** — indexes every file with descriptions and token estimates
- **Cerebrum** — cross-session learning memory (preferences, learnings, do-not-repeat)
- **Memory Log** — chronological action log per session
- **Bug Log** — structured bug database with similarity matching
- **Token Tracker** — estimates and tracks token usage across sessions
- **Context Guards** — warns about re-reads, anatomy misses, do-not-repeat violations
- **Daemon** — background cron tasks (anatomy rescan, memory consolidation, token reports)
- **Dashboard** — React-based web UI for project metrics
- **Design QC** — screenshot capture and visual evaluation

## Install

```bash
npm install openowl
npx openowl init
```

This creates `.owl/` with configuration, installs the OpenCode plugin, and updates `AGENTS.md`.

## CLI Commands

| Command | Description |
|---------|-------------|
| `openowl init` | Initialize OpenOwl in current project |
| `openowl status` | Show project status and session stats |
| `openowl scan` | Rescan project anatomy |
| `openowl daemon start` | Start the background daemon |
| `openowl daemon stop` | Stop the daemon |
| `openowl daemon restart` | Restart the daemon |
| `openowl daemon logs` | Show daemon log output |
| `openowl dashboard` | Launch the web dashboard |
| `openowl bug search <query>` | Search the bug log |
| `openowl cron list` | List cron tasks |
| `openowl cron run <task-id>` | Run a cron task manually |
| `openowl cron retry <task-id>` | Retry a failed cron task |
| `openowl designqc` | Capture screenshots for design review |
| `openowl update` | Update OpenOwl to latest version |
| `openowl restore` | Restore .owl/ from backup |

## Configuration

Config lives in `.owl/config.json`. Key settings:

```json
{
  "openowl": {
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

## Architecture

- **Plugin** (`src/plugin/`) — OpenCode plugin hooks for event monitoring
- **Core** (`src/core/`) — scanners, trackers, daemon, buglog
- **CLI** (`src/cli/`) — Commander-based CLI
- **Dashboard** (`src/dashboard/`) — React + Vite + TailwindCSS web UI

## License

AGPL-3.0
