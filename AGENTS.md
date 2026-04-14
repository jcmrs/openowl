# OpenOwl

@.owl/OWL.md

This project uses OpenOwl for context management. Read and follow .owl/OWL.md every session. Check .owl/cerebrum.md before generating code. Check .owl/anatomy.md before reading files.

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
