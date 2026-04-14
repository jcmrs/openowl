# OpenOwl Plugin API Mapping

> Date: 2026-04-14
> Purpose: Define exact mapping from OpenWolf hooks to OpenCode plugin events

## 1. Plugin Entry Point

```typescript
// src/plugin/index.ts
import type { Plugin } from "@opencode-ai/plugin"

export const OpenOwlPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Event subscriptions
  }
}
```

## 2. Plugin Parameters

| Parameter | Type | Description | OpenWolf Equivalent |
|-----------|------|-------------|---------------------|
| project | Project object | Project metadata (root path, etc.) | $CLAUDE_PROJECT_DIR env var |
| client | Client object | API client (log, toast, session, file, event) | stdout/stderr JSON |
| $ | Utility | File operations, templating | shared.js utilities |
| directory | string | Plugin directory path | N/A |
| worktree | Worktree | Git worktree operations | N/A |

## 3. Event Mapping Table

| OpenWolf Hook | OpenCode Event | Filter | Handler |
|---------------|---------------|--------|---------|
| session-start.js | session.created | — | session-manager.init() |
| pre-read.js | tool.execute.before | tool === "read" | anatomy-guard.check() |
| post-read.js | tool.execute.after | tool === "read" | token-tracker.recordRead() |
| pre-write.js | tool.execute.before | tool === "write" \|\| tool === "edit" | cerebrum-guard.check() + buglog-guard.check() |
| post-write.js | tool.execute.after | tool === "write" \|\| tool === "edit" | anatomy-updater.update() + memory-logger.log() + bug-detector.detect() |
| stop.js | session.idle | — | session-manager.finalize() |
| (new) | session.compacted | — | context-reinject.reinject() |

## 4. Event Payload Structures

### tool.execute.before
```typescript
interface ToolBeforeEvent {
  type: "tool.execute.before"
  properties: {
    tool: string          // "read", "write", "edit", "bash", "grep", "glob"
    input: {
      file_path?: string  // for read/write/edit
      content?: string    // for write
      old_string?: string // for edit
      new_string?: string // for edit
      command?: string    // for bash
      pattern?: string    // for grep/glob
      // ... other tool-specific fields
    }
  }
}
```

### tool.execute.after
```typescript
interface ToolAfterEvent {
  type: "tool.execute.after"
  properties: {
    tool: string
    input: { /* same as before */ }
    output: {
      content?: string    // for read
      success?: boolean
      error?: string
      // ... other tool-specific fields
    }
  }
}
```

### session.created
```typescript
interface SessionCreatedEvent {
  type: "session.created"
  properties: {
    session: {
      id: string
      title?: string
      created_at: string
    }
  }
}
```

### session.idle
```typescript
interface SessionIdleEvent {
  type: "session.idle"
  properties: {
    session: {
      id: string
      idle_duration_ms: number
    }
  }
}
```

### session.compacted
```typescript
interface SessionCompactedEvent {
  type: "session.compacted"
  properties: {
    session: {
      id: string
      tokens_before: number
      tokens_after: number
    }
  }
}
```

**Note:** Exact payload structures need to be verified against UPSTREAM/opencode-sdk-js/src/ and UPSTREAM/opencode/packages/plugin/src/. The above is based on documentation and may need adjustment.

## 5. Feedback Mechanisms

| OpenWolf Mechanism | OpenCode Mechanism |
|-------------------|-------------------|
| stdout JSON → block | N/A (cannot block) |
| stderr text → warning | `client.tui.showToast({ body: { message, type: "warning" } })` |
| stdout JSON → approve | N/A (always approved) |
| N/A | `client.app.log({ body: { level, message, extra } })` |

## 6. Session State Management

OpenWolf uses `.wolf/_session.json` for ephemeral session state. OpenOwl will use the same pattern:

```typescript
interface SessionState {
  session_id: string
  started_at: string
  reads: Array<{
    file_path: string
    timestamp: string
    anatomy_hit: boolean
    estimated_tokens: number
    actual_tokens?: number
  }>
  writes: Array<{
    file_path: string
    timestamp: string
    summary: string
    estimated_tokens: number
    is_bug_fix: boolean
  }>
  edits_by_file: Record<string, number>
  total_read_tokens: number
  total_write_tokens: number
  cerebrum_updated: boolean
  buglog_entries: string[]
}
```
