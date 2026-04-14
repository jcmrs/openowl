# Architecture Decision Records

> Project: OpenOwl
> Format: Lightweight ADR (Context, Decision, Consequences)

---

## ADR-001: Hybrid Plugin + Daemon Architecture

**Date:** 2026-04-14
**Status:** Accepted

### Context
OpenCode plugins are observational (cannot block tool execution). We need both event integration (for read/write tracking) and persistent background services (cron, file watching, dashboard).

### Decision
Use a hybrid architecture: OpenCode plugin for event integration + standalone daemon for persistence.

### Consequences
- **Positive:** Plugin gets real-time event data; daemon provides reliable background services
- **Positive:** Dashboard works even when OpenCode is not running
- **Negative:** Two processes to manage instead of one
- **Negative:** Plugin and daemon must coordinate via shared .owl/ files

---

## ADR-002: TypeScript as Implementation Language

**Date:** 2026-04-14
**Status:** Accepted

### Context
OpenCode plugins must be JavaScript/TypeScript. The reference implementation (OpenWolf) is TypeScript. We want maximum code reuse.

### Decision
Use TypeScript (ESM, Node.js 20+) for all components.

### Consequences
- **Positive:** Direct reuse of ~55% of OpenWolf code (REUSABLE components)
- **Positive:** Type safety with @opencode-ai/plugin types
- **Positive:** Familiar toolchain (npm/pnpm, tsconfig, eslint)
- **Negative:** Cannot leverage Go/Rust performance for scanner/watcher

---

## ADR-003: Separate OWL.md + AGENTS.md Reference

**Date:** 2026-04-14
**Status:** Accepted

### Context
OpenCode uses AGENTS.md for project instructions. We need to inject OpenOwl's operating protocol. Options: (a) inject directly into AGENTS.md, (b) separate OWL.md with AGENTS.md reference, (c) plugin-only context injection.

### Decision
Create a separate `.owl/OWL.md` for the full operating protocol, and reference it from AGENTS.md via `@.owl/OWL.md`.

### Consequences
- **Positive:** Clean separation — OpenOwl files stay in .owl/, user's AGENTS.md stays clean
- **Positive:** No conflicts with existing AGENTS.md content
- **Positive:** OWL.md can be version-controlled independently
- **Negative:** One extra file read at session start (minimal cost)

---

## ADR-004: GLM-5-Turbo Calibrated Token Estimation

**Date:** 2026-04-14
**Status:** Accepted

### Context
OpenWolf uses chars/3.5 (code) and chars/4.0 (prose), calibrated for Claude's tokenizer. GLM-5-Turbo uses a different tokenizer (GLM family, BPE-based with MoE architecture).

### Decision
- Default to chars/3.0 (code), chars/3.8 (prose), chars/3.4 (mixed) for GLM-5-Turbo
- Make all ratios configurable in config.json
- Document that these are approximate (±15-20% accuracy)

### Consequences
- **Positive:** Better accuracy for GLM-5-Turbo
- **Positive:** Users can calibrate for their specific model/workload
- **Negative:** Initial ratios are estimates — need empirical validation
- **Mitigation:** Add a calibration command (`openowl calibrate`) in a future version

---

## ADR-005: .owl/ Directory (not .wolf/)

**Date:** 2026-04-14
**Status:** Accepted

### Context
OpenWolf uses `.wolf/` for its data directory. We are building a separate project, not a fork.

### Decision
Use `.owl/` as the data directory name.

### Consequences
- **Positive:** Clear brand identity (Owl = wisdom, night vision)
- **Positive:** No conflict with OpenWolf installations
- **Positive:** .owl/ is short and memorable
- **Negative:** Users cannot migrate directly from OpenWolf (by design)

---

## ADR-006: Advisory-Only Guards (No Blocking)

**Date:** 2026-04-14
**Status:** Accepted

### Context
Claude Code hooks can block tool execution via PreToolUse. OpenCode plugins are observational only — they cannot block.

### Decision
All guard functions (anatomy guard, cerebrum guard, buglog guard) are advisory only. They use `client.tui.showToast()` to warn the user, but cannot prevent the action.

### Consequences
- **Positive:** Simpler implementation (no decision/output protocol)
- **Positive:** Less intrusive — user retains full control
- **Negative:** Lower enforcement (AI may ignore warnings)
- **Mitigation:** Daemon can provide stronger enforcement via file watching if needed in future
- **Mitigation:** AGENTS.md rules provide soft enforcement via OpenCode's rules system

---

## ADR-007: Full Feature Parity with OpenWolf v1.0.4

**Date:** 2026-04-14
**Status:** Accepted

### Context
We need to decide scope for v1. Options: (a) core only, (b) core + daemon, (c) full parity.

### Decision
Target full feature parity with OpenWolf v1.0.4, implemented in 5 phases:
1. Core library (scanner, tracker, buglog, utils)
2. Plugin integration
3. CLI commands
4. Daemon + dashboard
5. Advanced features (Design QC, Reframe, AI tasks)

### Consequences
- **Positive:** Complete feature set from day one
- **Positive:** Direct comparison with OpenWolf possible
- **Negative:** Longer initial development time
- **Mitigation:** Phased implementation allows incremental delivery
