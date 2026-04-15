# Changelog

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
- `openowl init` now installs openowl as a project dependency

### Breaking Changes
- None (initial release)

### Dependencies
- Runtime: commander (only required dependency)
- Optional: chokidar, express, node-cron, ws (daemon/dashboard only)
- DesignQC feature deferred to future version
