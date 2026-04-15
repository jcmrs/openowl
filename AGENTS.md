# OpenOwl

@.owl/OWL.md

This project uses OpenOwl for context management. Read and follow .owl/OWL.md every session. Check .owl/cerebrum.md before generating code in this project (OpenOwl's own dev memory, not auto-injected). Check .owl/anatomy.md before reading files in this project.

## Project Overview

OpenOwl is a TypeScript middleware providing project intelligence, token tracking, learning memory, bug logging, and automated maintenance for OpenCode. It is adapted from OpenWolf (cytostack/openwolf) with all Claude-specific coupling replaced by OpenCode-native equivalents.

## Project Documentation

### Architecture & Specs
- Architecture spec: @docs/specs/architecture.md
- Plugin API mapping: @docs/specs/plugin-api-mapping.md
- Data models: @docs/specs/data-models.md
- Template adaptations: @docs/specs/template-adaptations.md

### Research & Analysis
- OpenWolf full analysis: @docs/research/001-openwolf-full-analysis.md
- Premises validation: @docs/research/002-premises-validation.md
- Hooks comparison: @docs/research/003-hooks-comparison.md
- GLM-5-Turbo specs: @docs/research/004-glm5-turbo-specs.md
- Dependency map: @docs/research/005-dependency-map.md

### Architecture Decisions
- ADRs: @docs/decisions/ADRs.md

## OpenCode Documentation (local mirror)

- Index: @.opencode/docs/opencode/llms.txt
- Agents: @.opencode/docs/opencode/content/agents.md
- Tools: @.opencode/docs/opencode/content/tools.md
- SDK: @.opencode/docs/opencode/content/sdk.md
- Server: @.opencode/docs/opencode/content/server.md
- Config: @.opencode/docs/opencode/content/config.md
- Rules: @.opencode/docs/opencode/content/rules.md
- Permissions: @.opencode/docs/opencode/content/permissions.md
- MCP: @.opencode/docs/opencode/content/mcp-servers.md

## Upstream Source References

- OpenWolf reference implementation: UPSTREAM/openwolf/
- OpenCode CLI source: UPSTREAM/opencode/
- OpenCode SDK types: UPSTREAM/opencode-sdk-js/

## Key Conventions

- Data directory: `.owl/` (not `.wolf/`)
- Plugin file: `.opencode/plugins/openowl.ts`
- Config: `.owl/config.json`
- Token estimation: configurable ratios in config.json (defaults: code 3.0, prose 3.8, mixed 3.4)
- All Claude references replaced with OpenCode equivalents
- OpenCode plugin events are observational (cannot block tool execution)

## Known Limitations (deferred from audit)

- **E2E-26: Plugin load failures are invisible to the model.** OpenCode does not expose plugin apply errors to the LLM. The model sees no output if the plugin fails to load. This is an OpenCode platform limitation, not fixable from the plugin side.
- **E2E-28: `client.app.log()` is invisible to the model.** Writes to server-side structured logging only, never shown to the LLM. Workaround: all model-visible warnings are routed through `tool.execute.after` output mutation instead.
- **GAP-02: Anatomy does not track file deletions.** `updateAnatomyAfterWrite` only handles creates/updates. No delete handler exists. When files are deleted, stale entries remain in anatomy.md until the next full `openowl scan`.
- **GAP-05: Relevance selection sorts by size, not context.** `selectRelevantEntries` in `relevance.ts` sorts file entries by token count (largest first), not by contextual relevance to the current task. This is working as designed — true contextual ranking would require LLM involvement.

## Open Challenges

- **Dashboard (`src/dashboard/`)**: The React dashboard compiles and ships but has not been audited or polished. It provides read-only views of anatomy, cerebrum, buglog, memory, and token usage. Status: functional but not validated against real `.owl/` data. Needs a dedicated audit pass.
