import * as path from "node:path";
import { logBug } from "../../core/buglog/bug-tracker.js";
import { appendCerebrumEntry } from "./cerebrum-logger.js";

const COMMENT_OR_STRING_RE = /\/\/[^\n]*$|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/gm;

function stripCommentsAndStrings(content: string): string {
  return content.replace(COMMENT_OR_STRING_RE, " /* stripped */ ");
}

const CATCH_CLAUSE_RE = /\bcatch\s*\(\s*(?:\w+\s*:\s*)?(?:TypeError|ReferenceError|RangeError|SyntaxError|Error)\b/g;

function isInCatchOrThrow(content: string, matchIndex: number): boolean {
  const preceding = content.slice(Math.max(0, matchIndex - 80), matchIndex);
  if (/\bcatch\s*\(/.test(preceding)) return true;
  if (/\bthrow\s+new\s+/.test(preceding)) return true;
  if (/\binstanceof\s+(?:TypeError|ReferenceError|RangeError|SyntaxError|Error)\b/.test(preceding)) return true;
  if (/\b:\s*(?:TypeError|ReferenceError|RangeError|SyntaxError|Error)\s*\)/.test(preceding)) return true;
  return false;
}

const BUG_FIX_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
  tags: string[];
}> = [
  {
    category: "import_fix",
    patterns: [
      /Cannot\s+find\s+module\s+['"][^'"]*['"]/i,
      /Module\s+not\s+found:\s+['"][^'"]*['"]/i,
      /declare\s+module\s+['"][^'"]*['"]/i,
    ],
    tags: ["import", "module", "dependency"],
  },
  {
    category: "runtime_error",
    patterns: [
      /TypeError:\s+(?!instance)/m,
      /ReferenceError:\s+/m,
      /RangeError:\s+/m,
      /cannot\s+read\s+properties?\s+of\s+(undefined|null)/i,
      /\.is\s+not\s+a\s+function\b/,
    ],
    tags: ["runtime", "error"],
  },
  {
    category: "type_error",
    patterns: [
      /Type\s+error['":]\s+.*?(?:does not exist|is not assignable|is not compatible)/i,
      /Property\s+'[^']+'\s+does\s+not\s+exist\s+on\s+type/i,
      /Argument\s+of\s+type\s+['"].*?['"]\s+is\s+not\s+assignable/i,
      /TS\d{4}:\s+/,
    ],
    tags: ["type", "typescript"],
  },
  {
    category: "syntax_error",
    patterns: [
      /SyntaxError:\s+/m,
      /Unexpected\s+token\s+['"].+?['"]/,
    ],
    tags: ["syntax"],
  },
  {
    category: "null_undefined",
    patterns: [
      /undefined\s+is\s+not\s+(an\s+object|iterable|function)/i,
      /null\s+reference/i,
      /Cannot\s+read\s+properties?\s+of\s+null/i,
    ],
    tags: ["null", "undefined"],
  },
  {
    category: "async_promise",
    patterns: [
      /UnhandledPromiseRejection/i,
    ],
    tags: ["async", "promise"],
  },
];

export function detectBugFix(
  filePath: string,
  content: string,
  oldContent?: string
): { detected: boolean; category: string; tags: string[]; summary: string } {
  const cleaned = stripCommentsAndStrings(content);
  const hasCatchClause = CATCH_CLAUSE_RE.test(cleaned);
  const oldCleaned = oldContent ? stripCommentsAndStrings(oldContent) : "";

  for (const { category, patterns, tags } of BUG_FIX_PATTERNS) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(cleaned);
      if (match) {
        if (hasCatchClause && isInCatchOrThrow(cleaned, match.index)) {
          continue;
        }
        if (oldCleaned) {
          pattern.lastIndex = 0;
          if (pattern.test(oldCleaned)) {
            continue;
          }
        }
        const fixSummary = oldContent
          ? `Changed content in ${filePath} (matched ${category} pattern)`
          : `Fixed ${category} issue in ${filePath}`;

        return {
          detected: true,
          category,
          tags,
          summary: fixSummary,
        };
      }
    }
  }

  return { detected: false, category: "", tags: [], summary: "" };
}

export function autoLogBug(
  owlDir: string,
  filePath: string,
  result: { detected: boolean; category: string; tags: string[]; summary: string },
  session?: { auto_bug_log_count: number }
): void {
  if (!result.detected) return;

  logBug(owlDir, {
    error_message: result.summary,
    file: filePath,
    root_cause: `Auto-detected ${result.category} pattern`,
    fix: "unknown",
    tags: result.tags,
  });

  if (session && session.auto_bug_log_count < 3) {
    appendCerebrumEntry(owlDir, "key-learnings", "auto", `Bug pattern detected in ${path.basename(filePath)}: ${result.category}. Logged to buglog.`);
    session.auto_bug_log_count++;
  }
}
