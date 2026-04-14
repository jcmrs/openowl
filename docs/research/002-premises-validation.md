# OpenWolf Premises Validation

> Analysis Date: 2026-04-14
> Purpose: Validate OpenWolf's baseline premises for adaptation to GLM-5-Turbo + OpenCode

## Original Premises

### P1: The LLM reads files blindly
**Statement:** Claude doesn't know file contents before opening them.
**Validation:** VALID — Universal across all LLM coding agents regardless of provider.
**Applicability to OpenOwl:** Fully applicable. GLM-5-Turbo has no pre-read file awareness.

### P2: Token waste from re-reads
**Statement:** Claude re-reads files it already read in the session.
**Validation:** VALID — Universal behavior. LLMs lack reliable "already read" state.
**Applicability to OpenOwl:** Fully applicable. Even with GLM-5-Turbo's larger context (202K tokens), repeated reads waste tokens and increase latency.

### P3: No cross-session memory
**Statement:** Claude starts fresh each session with no memory of prior interactions.
**Validation:** PARTIALLY VALID
- Claude Code: True. Each session starts with only CLAUDE.md + rules as context.
- OpenCode: Partially false. OpenCode has session persistence, AGENTS.md, and compaction. But the LLM itself still doesn't carry persistent learning memory.
**Applicability to OpenOwl:** The core premise holds (LLM needs external memory), but OpenOwl should integrate with AGENTS.md rather than creating a parallel mechanism. Cerebrum fills a gap that AGENTS.md doesn't cover: structured learning from interactions (preferences, do-not-repeat, key learnings).

### P4: Project map reduces reads
**Statement:** A file index with descriptions prevents unnecessary full file reads.
**Validation:** VALID — OpenWolf's own data shows ~71% of repeated reads are blocked by anatomy lookups.
**Applicability to OpenOwl:** Fully applicable. Description-extractor supports 25+ languages. This is one of the highest-value features.

### P5: Learning memory compounds
**Statement:** Recording corrections/preferences improves future sessions.
**Validation:** VALID but COMPLIANCE-DEPENDENT
- The AI must actually read and follow the memory (enforced via rules/hooks)
- The AI must actually write to the memory (enforced via operating protocol)
- Estimated compliance: 85-90% (some updates are missed, especially for subtle learnings)
**Applicability to OpenOwl:** Fully applicable. OpenCode plugin events can enforce reading; OWL.md operating protocol can enforce writing.

### P6: Token estimation via char ratio
**Statement:** chars/3.5 for code, chars/4.0 for prose provides reliable token estimates.
**Validation:** WEAK
- Tokenizers vary significantly between models
- Claude's tokenizer differs from GPT's tokenizer, which differs from GLM's tokenizer
- OpenWolf claims ~15% accuracy for these estimates
- The ratios are model-specific constants, not universal truths
**Applicability to OpenOwl:** Needs calibration for GLM-5-Turbo's specific tokenizer. The ratios are useful as rough heuristics but should be configurable and documented as approximate.

## New Premises (OpenOwl-Specific)

### P7: OpenCode has a plugin system (not hooks)
**Statement:** OpenCode uses JavaScript/TypeScript plugins with event subscriptions, not Claude Code's hooks system.
**Implication:** OpenOwl must be an OpenCode plugin, using `tool.execute.before/after`, `session.created`, `session.compacted`, etc.
**Key difference:** OpenCode plugins are observational — they cannot block tool execution. Claude Code hooks can block via PreToolUse.

### P8: OpenCode uses AGENTS.md (not CLAUDE.md)
**Statement:** OpenCode uses AGENTS.md for project-level instructions, injected at session start.
**Implication:** OpenOwl should reference OWL.md from AGENTS.md, not duplicate instructions.

### P9: GLM-5-Turbo supports thinking/reasoning mode
**Statement:** GLM-5-Turbo has a reasoning mode that could be leveraged for smarter analysis.
**Implication:** Pre-write checks could use reasoning mode for deeper pattern matching (e.g., checking if a code change matches known anti-patterns in cerebrum).

### P10: OpenCode has LSP integration
**Statement:** OpenCode can integrate with Language Server Protocol for real-time diagnostics.
**Implication:** Future enhancement: use LSP diagnostics to enrich anatomy.md entries with type information, error states, and symbol relationships.

### P11: OpenCode plugin events are observational
**Statement:** OpenCode plugins cannot block tool execution — they can only observe and advise.
**Implication:** All "guard" functions (pre-read, pre-write) become advisory. The daemon can provide stronger enforcement via file watching if needed.

## Token Economics Comparison

| Metric | Claude Opus 4.6 | GLM-5-Turbo | Ratio |
|--------|-----------------|-------------|-------|
| Input cost | $5/M tokens | $1.20/M tokens | 4.2x cheaper |
| Output cost | $25/M tokens | $4/M tokens | 6.25x cheaper |
| Context window | 200K tokens | 202,752 tokens | ~same |
| Max output | 32K tokens | 131,072 tokens | 4x larger |
| Architecture | Dense | 744B MoE (40B active) | Different tokenization |

**Conclusion:** Token savings are still valuable with GLM-5-Turbo (cost still scales with usage) but less urgent than with Claude. Context quality matters more than context quantity.
