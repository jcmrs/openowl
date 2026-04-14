# Template Adaptations: Claude → OpenCode

> Date: 2026-04-14
> Purpose: Document every change needed in template files

## 1. OPENWOLF.md → OWL.md

### Changes Required
- Remove all "Claude" references → "OpenCode" or model-agnostic
- Remove CLAUDE.md references → AGENTS.md references
- Remove .claude/ references → .opencode/ references
- Remove claude-rules references → plugin handles rules
- Remove "claude -p" references → "opencode -p"
- Remove "Claude Code" → "OpenCode"
- Keep all operating protocol logic (file navigation, code generation, after actions, token discipline)
- Keep bug logging protocol (model-agnostic)
- Keep design QC protocol (model-agnostic)
- Keep reframe protocol (model-agnostic)
- Update session end protocol

### Specific Replacements
| OpenWolf Text | OpenOwl Text |
|---------------|--------------|
| "Claude" (when referring to the AI) | "the AI" or "OpenCode" |
| "Claude Code" | "OpenCode" |
| "CLAUDE.md" | "AGENTS.md" |
| ".claude/settings.json" | ".opencode/plugins/openowl.ts" |
| ".claude/rules/openwolf.md" | ".opencode/plugins/openowl.ts" |
| ".wolf/" | ".owl/" |
| "claude -p" | "opencode -p" |
| "openwolf" (command) | "openowl" (command) |
| "OpenWolf" (name) | "OpenOwl" (name) |

## 2. claude-md-snippet.md → agents-md-snippet.md

### OpenWolf Version
```markdown
# OpenWolf
@.wolf/OPENWOLF.md
This project uses OpenWolf for context management.
```

### OpenOwl Version
```markdown
# OpenOwl
@.owl/OWL.md
This project uses OpenOwl for context management. Read and follow .owl/OWL.md every session.
```

## 3. claude-rules-openwolf.md → REMOVED

This file is not needed for OpenCode. The plugin handles rule enforcement natively via event subscriptions.

## 4. config.json Changes

| Field | OpenWolf Value | OpenOwl Value | Reason |
|-------|---------------|---------------|--------|
| chars_per_token_code | 3.5 | 3.0 | GLM-5-Turbo tokenizer calibration |
| chars_per_token_prose | 4.0 | 3.8 | GLM-5-Turbo tokenizer calibration |
| (new) chars_per_token_mixed | N/A | 3.4 | New field for mixed content |
| use_claude_p | true | (removed) | Claude-specific |
| api_key_env | null | (removed) | Claude-specific |
| (new) ai_command | N/A | "opencode -p" | OpenCode CLI for AI tasks |

## 5. cron-manifest.json Changes

AI task actions that used `claude -p` must be updated to use `opencode -p`:

```json
{
  "action": {
    "type": "ai_task",
    "params": {
      "prompt": "...",
      "context_files": [".owl/cerebrum.md"]
    }
  }
}
```

The cron engine will execute this via the configured `ai_command` in config.json.

## 6. identity.md Changes

Minimal changes:
- Replace "Wolf" default name with project-specific name (same as OpenWolf)
- No Claude references in this file

## 7. cerebrum.md Changes

No content changes needed. The template is model-agnostic.

## 8. memory.md Changes

No content changes needed. The template is model-agnostic.

## 9. anatomy.md Changes

No content changes needed. The template is model-agnostic.

## 10. reframe-frameworks.md Changes

No content changes needed. The framework knowledge base is model-agnostic.
