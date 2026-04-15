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

const EXCLUDED_PATTERNS = [
  /\.test\.ts$/, /\.spec\.ts$/, /\.test\.js$/, /\.spec\.js$/,
  /__tests__[/\\]/, /\.stories\.tsx?$/, /\.md$/, /\.json$/,
];

function isExcludedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return EXCLUDED_PATTERNS.some((p) => p.test(normalized));
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

interface StructuralFixResult {
  detected: boolean;
  category: string;
  tags: string[];
  summary: string;
  fixDescription: string;
}

function detectStructuralFix(oldStr: string, newStr: string, filename: string): StructuralFixResult {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (newStr.includes("catch") && !oldStr.includes("catch")) {
    return { detected: true, category: "error-handling", tags: ["auto-detected", "error-handling"], summary: `Added error handling in ${path.basename(filename)}`, fixDescription: "Added try/catch block" };
  }

  if ((newStr.includes("?.") && !oldStr.includes("?.")) || (newStr.includes("??") && !oldStr.includes("??"))) {
    return { detected: true, category: "null-safety", tags: ["auto-detected", "null-safety"], summary: `Added null safety in ${path.basename(filename)}`, fixDescription: "Added optional chaining or nullish coalescing" };
  }

  const oldGuardCount = (oldStr.match(/\bif\s*\([^)]*\)\s*(return|throw|continue|break)/g) || []).length;
  const newGuardCount = (newStr.match(/\bif\s*\([^)]*\)\s*(return|throw|continue|break)/g) || []).length;
  if (newGuardCount > oldGuardCount) {
    return { detected: true, category: "guard-clause", tags: ["auto-detected", "guard-clause"], summary: `Added guard clause in ${path.basename(filename)}`, fixDescription: `Added ${newGuardCount - oldGuardCount} guard clause(s)` };
  }

  const oldLines = oldStr.split("\n").length;
  const newLines = newStr.split("\n").length;
  if (oldLines <= 3 && newLines <= 3 && oldStr !== newStr) {
    const oldStrings = [...oldStr.matchAll(/"([^"]{1,60})"/g)].map((m) => m[1]);
    const newStrings = [...newStr.matchAll(/"([^"]{1,60})"/g)].map((m) => m[1]);
    if (oldStrings.length === 1 && newStrings.length === 1 && oldStrings[0] !== newStrings[0]) {
      return { detected: true, category: "wrong-value", tags: ["auto-detected", "wrong-value"], summary: `Fixed wrong value in ${path.basename(filename)}`, fixDescription: `Changed "${oldStrings[0]}" to "${newStrings[0]}"` };
    }

    const oldIds = [...oldStr.matchAll(/\b([a-zA-Z_]\w*)\b/g)].map((m) => m[1]);
    const newIds = [...newStr.matchAll(/\b([a-zA-Z_]\w*)\b/g)].map((m) => m[1]);
    const removed = oldIds.filter((id) => !newIds.includes(id));
    const added = newIds.filter((id) => !oldIds.includes(id));
    const keywords = new Set(["if", "for", "while", "const", "let", "var", "return", "true", "false", "null", "undefined"]);
    const sigRemoved = removed.filter((id) => !keywords.has(id));
    const sigAdded = added.filter((id) => !keywords.has(id));
    if (sigRemoved.length === 1 && sigAdded.length === 1) {
      return { detected: true, category: "wrong-reference", tags: ["auto-detected", "wrong-reference"], summary: `Fixed wrong reference in ${path.basename(filename)}`, fixDescription: `Changed ${sigRemoved[0]} to ${sigAdded[0]}` };
    }
  }

  const ifRe = /\bif\s*\(([^)]+)\)/g;
  const oldIfs = [...oldStr.matchAll(ifRe)].map((m) => m[1].trim());
  const newIfs = [...newStr.matchAll(ifRe)].map((m) => m[1].trim());
  if (oldIfs.length === newIfs.length && newIfs.length > 0) {
    const changedIdx = newIfs.findIndex((cond, i) => cond !== oldIfs[i]);
    if (changedIdx >= 0 && oldLines <= 5) {
      return { detected: true, category: "logic-fix", tags: ["auto-detected", "logic-fix"], summary: `Fixed logic in ${path.basename(filename)}`, fixDescription: `Changed condition in if-statement` };
    }
  }

  const operators = ["===", "!==", "==", "!=", ">=", "<=", ">", "<", "&&", "||", "??"];
  for (const op of operators) {
    if (oldStr.includes(op) && !newStr.includes(op)) {
      for (const replacement of operators) {
        if (replacement !== op && newStr.includes(replacement) && !oldStr.includes(replacement)) {
          return { detected: true, category: "operator-fix", tags: ["auto-detected", "operator-fix"], summary: `Fixed operator in ${path.basename(filename)}`, fixDescription: `Changed ${op} to ${replacement}` };
        }
      }
    }
  }

  const oldImportCount = (oldStr.match(/\bimport\b/g) || []).length;
  const newImportCount = (newStr.match(/\bimport\b/g) || []).length;
  if (newImportCount > oldImportCount && newLines - oldLines <= 3) {
    return { detected: true, category: "missing-import", tags: ["auto-detected", "missing-import"], summary: `Added missing import in ${path.basename(filename)}`, fixDescription: `Added ${newImportCount - oldImportCount} import(s)` };
  }

  const oldReturnRe = /\breturn\s+[^;]+/g;
  const newReturnRe = /\breturn\s+[^;]+/g;
  const oldReturns = [...oldStr.matchAll(oldReturnRe)].map((m) => m[0].trim());
  const newReturns = [...newStr.matchAll(newReturnRe)].map((m) => m[0].trim());
  if (oldReturns.length === newReturns.length && newReturns.length > 0) {
    const changedIdx = newReturns.findIndex((r, i) => r !== oldReturns[i]);
    if (changedIdx >= 0 && oldLines <= 5) {
      return { detected: true, category: "return-value", tags: ["auto-detected", "return-value"], summary: `Fixed return value in ${path.basename(filename)}`, fixDescription: "Changed return expression" };
    }
  }

  if ((newStr.includes("await ") && !oldStr.includes("await ")) || (newStr.includes("async ") && !oldStr.includes("async "))) {
    return { detected: true, category: "async-fix", tags: ["auto-detected", "async-fix"], summary: `Fixed async issue in ${path.basename(filename)}`, fixDescription: "Added async/await" };
  }

  if (["ts", "tsx"].includes(ext)) {
    const oldAsCount = (oldStr.match(/\bas\s+/g) || []).length;
    const newAsCount = (newStr.match(/\bas\s+/g) || []).length;
    if (newAsCount > oldAsCount) {
      return { detected: true, category: "type-fix", tags: ["auto-detected", "type-fix", ext], summary: `Fixed type issue in ${path.basename(filename)}`, fixDescription: "Added type assertion" };
    }
  }

  if (["css", "scss", "less", "vue", "tsx", "jsx"].includes(ext)) {
    const oldProps = new Map<string, string>();
    const newProps = new Map<string, string>();
    const propRe = /([a-zA-Z-]+)\s*:\s*([^;{}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(oldStr)) !== null) oldProps.set(m[1].trim().toLowerCase(), m[2].trim());
    while ((m = propRe.exec(newStr)) !== null) newProps.set(m[1].trim().toLowerCase(), m[2].trim());
    const changed: string[] = [];
    for (const [prop, val] of newProps) {
      if (oldProps.has(prop) && oldProps.get(prop) !== val) changed.push(prop);
    }
    if (changed.length > 0 && changed.length <= 4 && oldLines <= 3) {
      return { detected: true, category: "style-fix", tags: ["auto-detected", "style-fix", ext], summary: `Fixed CSS in ${path.basename(filename)}`, fixDescription: `Changed ${changed.join(", ")}` };
    }
  }

  if (Math.abs(newStr.length - oldStr.length) / oldStr.length > 0.3 && newLines < oldLines && oldLines - newLines >= 2) {
    return { detected: true, category: "refactor", tags: ["auto-detected", "refactor"], summary: `Refactored ${path.basename(filename)}`, fixDescription: `Reduced from ${oldLines} to ${newLines} lines` };
  }

  return { detected: false, category: "", tags: [], summary: "", fixDescription: "" };
}

export function detectBugFix(
  filePath: string,
  content: string,
  oldContent?: string
): { detected: boolean; category: string; tags: string[]; summary: string; fixDescription: string } {
  if (isExcludedFile(filePath)) {
    return { detected: false, category: "", tags: [], summary: "", fixDescription: "" };
  }

  if (oldContent && content && oldContent !== content) {
    const structural = detectStructuralFix(oldContent, content, filePath);
    if (structural.detected) {
      return structural;
    }
  }

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
          fixDescription: "unknown",
        };
      }
    }
  }

  return { detected: false, category: "", tags: [], summary: "", fixDescription: "" };
}

export function autoLogBug(
  owlDir: string,
  filePath: string,
  result: { detected: boolean; category: string; tags: string[]; summary: string; fixDescription: string },
  session?: { auto_bug_log_count: number }
): void {
  if (!result.detected) return;

  logBug(owlDir, {
    error_message: result.summary,
    file: filePath,
    root_cause: `Auto-detected ${result.category} pattern`,
    fix: result.fixDescription,
    tags: result.tags,
  });

  if (session && session.auto_bug_log_count < 3) {
    appendCerebrumEntry(owlDir, "key-learnings", "auto", `Bug pattern detected in ${path.basename(filePath)}: ${result.category}. Logged to buglog.`);
    session.auto_bug_log_count++;
  }
}
