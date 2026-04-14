# OpenOwl Data Models

> Date: 2026-04-14
> Purpose: Define JSON schemas for all .owl/ data files

## 1. config.json

```json
{
  "$schema": "config-schema",
  "version": 1,
  "openowl": {
    "enabled": "boolean",
    "anatomy": {
      "auto_scan_on_init": "boolean (default: true)",
      "rescan_interval_hours": "number (default: 6)",
      "max_description_length": "number (default: 100)",
      "max_files": "number (default: 500)",
      "exclude_patterns": "string[] (default: [node_modules, .git, ...])"
    },
    "token_audit": {
      "enabled": "boolean (default: true)",
      "report_frequency": "'daily' | 'weekly' | 'monthly' (default: 'weekly')",
      "waste_threshold_percent": "number (default: 15)",
      "chars_per_token_code": "number (default: 3.0, GLM-5-Turbo calibrated)",
      "chars_per_token_prose": "number (default: 3.8)",
      "chars_per_token_mixed": "number (default: 3.4)"
    },
    "cron": {
      "enabled": "boolean (default: true)",
      "max_retry_attempts": "number (default: 3)",
      "dead_letter_enabled": "boolean (default: true)",
      "heartbeat_interval_minutes": "number (default: 30)",
      "ai_command": "string (default: 'opencode -p')"
    },
    "memory": {
      "consolidation_after_days": "number (default: 7)",
      "max_entries_before_consolidation": "number (default: 200)"
    },
    "cerebrum": {
      "max_tokens": "number (default: 2000)",
      "reflection_frequency": "'daily' | 'weekly' (default: 'weekly')"
    },
    "daemon": {
      "port": "number (default: 18790)",
      "log_level": "'debug' | 'info' | 'warn' | 'error' (default: 'info')"
    },
    "dashboard": {
      "enabled": "boolean (default: true)",
      "port": "number (default: 18791)"
    },
    "designqc": {
      "enabled": "boolean (default: true)",
      "viewports": "Array<{ name: string, width: number, height: number }>",
      "max_screenshots": "number (default: 6)",
      "chrome_path": "string | null"
    }
  }
}
```

## 2. token-ledger.json

```json
{
  "version": 1,
  "created_at": "ISO-8601 date",
  "lifetime": {
    "total_tokens_estimated": "number",
    "total_reads": "number",
    "total_writes": "number",
    "total_sessions": "number",
    "anatomy_hits": "number",
    "anatomy_misses": "number",
    "repeated_reads_blocked": "number",
    "estimated_savings_vs_bare_cli": "number"
  },
  "sessions": [
    {
      "session_id": "string",
      "started_at": "ISO-8601 date",
      "ended_at": "ISO-8601 date",
      "duration_minutes": "number",
      "reads": "number",
      "writes": "number",
      "tokens_read": "number",
      "tokens_written": "number",
      "anatomy_hits": "number",
      "anatomy_misses": "number",
      "repeated_reads_blocked": "number",
      "buglog_entries": "number",
      "cerebrum_updated": "boolean"
    }
  ],
  "daemon_usage": [],
  "waste_flags": [
    {
      "type": "'repeated_reads' | 'anatomy_sufficient' | 'memory_bloat' | 'cerebrum_stale' | 'anatomy_miss_rate'",
      "severity": "'low' | 'medium' | 'high'",
      "detail": "string",
      "detected_at": "ISO-8601 date"
    }
  ],
  "optimization_report": {
    "last_generated": "ISO-8601 date | null",
    "patterns": [
      {
        "pattern": "string",
        "count": "number",
        "suggestion": "string"
      }
    ]
  }
}
```

## 3. buglog.json

```json
{
  "version": 1,
  "bugs": [
    {
      "id": "string (format: bug-NNN)",
      "timestamp": "ISO-8601 date",
      "error_message": "string",
      "file": "string",
      "line": "number | undefined",
      "root_cause": "string",
      "fix": "string",
      "tags": "string[]",
      "related_bugs": "string[]",
      "occurrences": "number",
      "last_seen": "ISO-8601 date"
    }
  ]
}
```

## 4. cron-manifest.json

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "string",
      "name": "string",
      "schedule": "string (cron expression)",
      "description": "string",
      "action": {
        "type": "'scan_project' | 'consolidate_memory' | 'generate_token_report' | 'ai_task'",
        "params": "Record<string, unknown> | undefined"
      },
      "retry": {
        "max_attempts": "number",
        "backoff": "'exponential' | 'linear' | 'none'",
        "base_delay_seconds": "number"
      },
      "failsafe": {
        "on_failure": "'log_and_continue' | 'skip_and_retry_next_cycle'",
        "alert_after_consecutive_failures": "number",
        "dead_letter": "boolean"
      },
      "enabled": "boolean"
    }
  ]
}
```

## 5. cron-state.json

```json
{
  "last_heartbeat": "ISO-8601 date | null",
  "engine_status": "'initialized' | 'running' | 'paused' | 'error'",
  "execution_log": [
    {
      "task_id": "string",
      "status": "'success' | 'failure' | 'skipped'",
      "timestamp": "ISO-8601 date",
      "duration_ms": "number | undefined",
      "error": "string | undefined"
    }
  ],
  "dead_letter_queue": [
    {
      "task_id": "string",
      "error": "string",
      "timestamp": "ISO-8601 date",
      "attempt": "number"
    }
  ],
  "upcoming": [
    {
      "task_id": "string",
      "next_run": "ISO-8601 date"
    }
  ]
}
```

## 6. _session.json (ephemeral)

```json
{
  "session_id": "string",
  "started_at": "ISO-8601 date",
  "reads": [
    {
      "file_path": "string",
      "timestamp": "ISO-8601 date",
      "anatomy_hit": "boolean",
      "estimated_tokens": "number",
      "actual_tokens": "number | undefined"
    }
  ],
  "writes": [
    {
      "file_path": "string",
      "timestamp": "ISO-8601 date",
      "summary": "string",
      "estimated_tokens": "number",
      "is_bug_fix": "boolean"
    }
  ],
  "edits_by_file": {
    "file_path": "edit_count (number)"
  },
  "total_read_tokens": "number",
  "total_write_tokens": "number",
  "cerebrum_updated": "boolean",
  "buglog_entries": ["string (bug IDs)"]
}
```

## 7. anatomy.md Format

```markdown
# anatomy.md

> Auto-maintained by OpenOwl. Last scanned: {timestamp}
> Files: {count} | Estimated total: ~{tokens} tokens

## src/
- `file.ts` — {1-2 line description} (~{tokens} tokens)
- `another.ts` — {description} (~{tokens} tokens)

## src/components/
- `Button.tsx` — {description} (~{tokens} tokens)
```

## 8. cerebrum.md Format

```markdown
# Cerebrum

> OpenOwl's learning memory. Updated automatically.
> Last updated: {date}

## User Preferences
<!-- How the user likes things done -->

## Key Learnings
<!-- Project-specific conventions -->

## Do-Not-Repeat
<!-- Mistakes to avoid. Format: [YYYY-MM-DD] Description -->

## Decision Log
<!-- Significant technical decisions with rationale -->
```

## 9. memory.md Format

```markdown
# Memory

> Chronological action log. Auto-maintained by OpenOwl plugin and daemon.

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|---------|
| 14:30 | Session started | — | — | ~0 |
| 14:31 | edited auth flow | src/auth.ts | implemented JWT | ~1200 |
| 14:35 | fixed type error | src/types.ts | corrected User type | ~300 |
```
