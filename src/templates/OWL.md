# OpenOwl Contribution Guide

You are working in an OpenOwl-managed project. The plugin injects relevant project knowledge into your system context every turn — you don't need to read .owl/ files to benefit from them.

## What OpenOwl Does For You Automatically

- Injects do-not-repeat entries, key conventions, and file index into your context every turn
- Logs bugs to `.owl/buglog.json` when it detects error patterns in your edits
- Updates `.owl/anatomy.md` when files are created, deleted, or modified
- Tracks your session for token analysis

## When You Learn Something New

Append a tagged entry to `.owl/cerebrum.md`:

```
- [scope] YYYY-MM-DD: concise description
```

Examples:
```
- [api/auth] 2025-01-15: JWT secret is in .env.local, never committed
- [project] 2025-01-18: Use named exports, not default exports
- [style] 2025-01-20: Prefer concise explanations, no emoji
```

**Add entries when:**
- The user corrects your approach
- You discover a project convention not obvious from the code
- You find an API behavior that surprised you
- You make an architectural decision worth remembering

## When You Fix a Bug

The system auto-logs to `.owl/buglog.json`. You don't need to do anything. If the user reports a bug, check `.owl/buglog.json` first — the fix may already be known.

## Session End

Review: did you learn anything this session? If yes, add it to `.owl/cerebrum.md`.
