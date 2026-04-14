# Claude Code Hooks vs OpenCode Plugin Events

> Analysis Date: 2026-04-14
> Purpose: Map Claude Code hook lifecycle to OpenCode plugin events for OpenOwl adaptation

## Claude Code Hooks (12 Events)

| Event | When | Can Block? | Common Uses |
|-------|------|------------|-------------|
| SessionStart | Session begins/resumes | No | Load context, set env vars |
| UserPromptSubmit | User hits enter | Yes | Context injection, validation |
| PreToolUse | Before tool runs | Yes | Security blocking, auto-approve |
| PermissionRequest | Permission dialog | Yes | Auto-approve/deny |
| PostToolUse | After tool succeeds | No | Auto-format, lint, log |
| PostToolUseFailure | After tool fails | No | Error handling |
| SubagentStart | Spawning subagent | No | Subagent initialization |
| SubagentStop | Subagent finishes | Yes | Subagent validation |
| Stop | Claude finishes responding | Yes | Task enforcement |
| PreCompact | Before compaction | No | Transcript backup |
| PostCompact | After compaction | No | Re-inject lost context |
| SessionEnd | Session terminates | No | Cleanup, logging |

**Input mechanism:** JSON via stdin
**Output mechanism:** JSON to stdout, warnings to stderr
**Hook types:** command, prompt, http

## OpenCode Plugin Events (30+)

### Tool Events
| Event | Maps To | Description |
|-------|---------|-------------|
| tool.execute.before | PreToolUse | Before any tool execution |
| tool.execute.after | PostToolUse | After tool execution |

### Session Events
| Event | Maps To | Description |
|-------|---------|-------------|
| session.created | SessionStart | New session created |
| session.compacted | PreCompact | Context compacted |
| session.deleted | SessionEnd | Session deleted |
| session.updated | — | Session metadata changed |
| session.idle | Stop | Session idle (closest to Stop) |
| session.error | PostToolUseFailure | Error in session |
| session.diff | — | File diff in session |
| session.status | — | Status change |

### File Events
| Event | Maps To | Description |
|-------|---------|-------------|
| file.edited | PostToolUse (Write/Edit) | File was edited |
| file.watcher.updated | — | File watcher detected change |

### Message Events
| Event | Description |
|-------|-------------|
| message.part.updated | Message part changed |
| message.part.removed | Message part removed |
| message.updated | Message updated |
| message.removed | Message removed |

### Other Events
| Event | Description |
|-------|-------------|
| command.executed | Slash command executed |
| lsp.client.diagnostics | LSP diagnostics received |
| lsp.updated | LSP state changed |
| permission.asked | Permission request |
| permission.replied | Permission response |
| server.connected | Server connected |
| todo.updated | Todo list changed |
| shell.env | Shell environment |
| tui.prompt.append | TUI prompt appended |
| tui.command.execute | TUI command executing |
| tui.toast.show | Toast notification |
| installation.updated | Installation updated |

**Plugin mechanism:** JavaScript/TypeScript function export
**Plugin API:** `{ project, client, $, directory, worktree }` parameters
**Can block:** No — events are observational only
**Feedback mechanism:** `client.tui.showToast()`, `client.app.log()`

## OpenWolf Hook → OpenOwl Event Mapping

| OpenWolf Hook | OpenOwl Plugin Event | Adaptation Notes |
|---------------|---------------------|------------------|
| session-start.js (SessionStart) | session.created | Plugin receives project context directly. No stdin parsing needed. |
| pre-read.js (PreToolUse[Read]) | tool.execute.before (filter: tool="read") | Cannot block. Use showToast() for warnings. |
| post-read.js (PostToolUse[Read]) | tool.execute.after (filter: tool="read") | Log token usage, update session state. |
| pre-write.js (PreToolUse[Write\|Edit]) | tool.execute.before (filter: tool="write" or "edit") | Cannot block. Use showToast() for cerebrum/buglog warnings. |
| post-write.js (PostToolUse[Write\|Edit]) | tool.execute.after (filter: tool="write" or "edit") | Update anatomy, memory, buglog. |
| stop.js (Stop) | session.idle | Session cleanup, finalization, ledger update. |

## Key Differences

1. **Blocking:** Claude Code hooks can block tool execution. OpenCode plugins cannot. OpenOwl must use advisory warnings (toasts) instead.
2. **Input parsing:** Claude hooks parse JSON from stdin. OpenCode plugins receive structured parameters from the plugin API.
3. **Output:** Claude hooks write JSON to stdout. OpenCode plugins use the client API (log, toast).
4. **Matcher:** Claude hooks use tool name matchers. OpenCode plugins filter events by checking tool name in event properties.
5. **Lifecycle:** Claude has explicit SessionStart/Stop. OpenCode has session.created/session.idle (which is not guaranteed to fire exactly at session end).
