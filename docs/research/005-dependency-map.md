# Dependency Map: Claude-Specific vs Generalizable

> Analysis Date: 2026-04-14
> Purpose: Map every OpenWolf component to its Claude coupling level for OpenOwl porting

## Classification Legend

- **REUSABLE**: Can be ported directly with minimal changes
- **ADAPT**: Needs adaptation (logic same, interface different)
- **REWRITE**: Must be rewritten for OpenCode
- **NEW**: New development required

## Component-Level Map

### src/hooks/ → src/plugin/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| hooks/shared.js | Low | ADAPT | Remove stdin/stdout, use plugin API. Keep all utility functions. |
| hooks/session-start.js | Medium | REWRITE | session.created event. Remove stdin parsing, use plugin params. |
| hooks/pre-read.js | High | REWRITE | tool.execute.before. Cannot block. Use showToast for warnings. |
| hooks/post-read.js | Medium | REWRITE | tool.execute.after. Adapt token tracking. |
| hooks/pre-write.js | High | REWRITE | tool.execute.before. Cannot block. Advisory warnings only. |
| hooks/post-write.js | Medium | REWRITE | tool.execute.after. Keep anatomy/memory/buglog updates. |
| hooks/stop.js | Medium | REWRITE | session.idle event. Keep ledger/session summary logic. |

### src/scanner/ → src/core/scanner/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| scanner/anatomy-scanner.ts | None | REUSABLE | Zero Claude dependencies. Direct port. |
| scanner/description-extractor.ts | None | REUSABLE | Pure language parsing. Direct port. |
| scanner/project-root.ts | None | REUSABLE | Filesystem detection. Direct port. |

### src/tracker/ → src/core/tracker/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| tracker/token-estimator.ts | Low | ADAPT | Change ratios for GLM-5-Turbo. Make configurable. |
| tracker/token-ledger.ts | None | REUSABLE | Pure JSON read/write. Direct port. |
| tracker/waste-detector.ts | None | REUSABLE | Pure analysis logic. Direct port. |

### src/buglog/ → src/core/buglog/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| buglog/bug-tracker.ts | None | REUSABLE | Pure JSON + Jaccard. Direct port. |
| buglog/bug-matcher.ts | None | REUSABLE | Re-export only. Direct port. |

### src/daemon/ → src/core/daemon/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| daemon/wolf-daemon.ts | Low | ADAPT | Rename ports. Remove Claude-specific references. |
| daemon/cron-engine.ts | Medium | ADAPT | Replace `claude -p` with `opencode -p` or direct API. |
| daemon/file-watcher.ts | None | REUSABLE | Pure chokidar. Direct port. |
| daemon/health.ts | None | REUSABLE | Pure health checks. Direct port. |

### src/designqc/ → src/core/designqc/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| designqc/designqc-engine.ts | None | REUSABLE | Pure puppeteer + fs. Direct port. |
| designqc/designqc-capture.ts | None | REUSABLE | Platform detection + HTTP. Direct port. |
| designqc/designqc-types.ts | None | REUSABLE | TypeScript types. Direct port. |

### src/utils/ → src/core/utils/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| utils/fs-safe.ts | None | REUSABLE | Atomic writes. Direct port. |
| utils/logger.ts | None | REUSABLE | File + console logging. Direct port. |
| utils/paths.ts | Low | ADAPT | Change .wolf/ to .owl/. Update path helpers. |
| utils/platform.ts | None | REUSABLE | OS detection. Direct port. |

### src/templates/ → src/templates/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| templates/OPENWOLF.md | High | REWRITE | Remove all "Claude" references. Adapt for OpenCode + GLM-5-Turbo. |
| templates/claude-md-snippet.md | High | REWRITE | Create new agents-md-snippet.md for AGENTS.md. |
| templates/claude-rules-openwolf.md | High | REWRITE | Not needed — plugin handles rules natively. |
| templates/config.json | Low | ADAPT | Add opencode-specific settings. Change .wolf to .owl. |
| templates/identity.md | None | REUSABLE | Direct port. |
| templates/cerebrum.md | None | REUSABLE | Direct port. |
| templates/memory.md | None | REUSABLE | Direct port. |
| templates/anatomy.md | None | REUSABLE | Direct port. |
| templates/buglog.json | None | REUSABLE | Direct port. |
| templates/token-ledger.json | None | REUSABLE | Direct port. |
| templates/cron-manifest.json | Medium | ADAPT | Replace claude -p references with opencode -p. |
| templates/cron-state.json | None | REUSABLE | Direct port. |
| templates/reframe-frameworks.md | None | REUSABLE | Framework knowledge base. Direct port. |

### src/cli/ → src/cli/

| OpenWolf File | Coupling | Action | Notes |
|---------------|----------|--------|-------|
| cli/index.ts | Low | ADAPT | Rename commands from openwolf to openowl. |
| cli/init.ts | High | REWRITE | Replace Claude settings/rules with OpenCode plugin installation + AGENTS.md injection. |
| cli/scan.ts | Low | ADAPT | Change .wolf to .owl. |
| cli/status.ts | Low | ADAPT | Change .wolf to .owl. Remove Claude settings check. |
| cli/registry.ts | Low | ADAPT | Change ~/.openwolf to ~/.openowl. |
| cli/daemon-cmd.ts | None | REUSABLE | pm2 management. Direct port. |
| cli/dashboard.ts | None | REUSABLE | Browser launcher. Direct port. |
| cli/bug-cmd.ts | Low | ADAPT | Change .wolf to .owl. |
| cli/cron-cmd.ts | Low | ADAPT | Change .wolf to .owl. |
| cli/designqc-cmd.ts | None | REUSABLE | Direct port. |
| cli/update.ts | Low | ADAPT | Change registry paths. |

### src/dashboard/ → src/dashboard/

| OpenWolf Component | Coupling | Action | Notes |
|--------------------|----------|--------|-------|
| All React components | Low | ADAPT | Rename .wolf to .owl. Update branding. |

## Summary Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| REUSABLE (direct port) | 22 | 55% |
| ADAPT (modify) | 12 | 30% |
| REWRITE (new implementation) | 6 | 15% |
| NEW (new development) | 0 | 0% |
| **Total** | **40** | **100%** |

## Porting Priority Order

1. **Phase 1 (Core):** All REUSABLE components — scanner, tracker, buglog, utils, templates
2. **Phase 2 (Plugin):** All REWRITE components — plugin event handlers
3. **Phase 3 (CLI):** All ADAPT CLI components
4. **Phase 4 (Daemon):** Daemon adaptation + dashboard
5. **Phase 5 (Advanced):** Design QC, Reframe, AI tasks
