export function summarizeEdit(oldStr: string, newStr: string, filename: string): string {
  const oldLines = oldStr.split("\n").length;
  const newLines = newStr.split("\n").length;

  if (!newStr.trim()) return `removed ${oldLines} line(s)`;
  if (!oldStr.trim()) return `created (${newLines} lines)`;

  if (newStr.includes("catch") && !oldStr.includes("catch")) return "added error handling";
  if (newStr.includes("?.") && !oldStr.includes("?.")) return "added optional chaining";
  if (newStr.includes("??") && !oldStr.includes("??")) return "added nullish coalescing";

  const sizeRatio = newStr.length / oldStr.length;
  if (sizeRatio < 0.2) return `removed ${oldLines - newLines} line(s)`;

  const oldImports = (oldStr.match(/\bimport\b/g) || []).length;
  const newImports = (newStr.match(/\bimport\b/g) || []).length;
  if (newImports > oldImports) return `added ${newImports - oldImports} import(s)`;
  if (newImports < oldImports) return `removed ${oldImports - newImports} import(s)`;

  const oldStrMatches = [...oldStr.matchAll(/"([^"]{1,80})"/g)].map((m) => m[1]);
  const newStrMatches = [...newStr.matchAll(/"([^"]{1,80})"/g)].map((m) => m[1]);

  if (oldStrMatches.length > 0 && newStrMatches.length > 0) {
    const removed = oldStrMatches.filter((s) => !newStrMatches.includes(s));
    const added = newStrMatches.filter((s) => !oldStrMatches.includes(s));
    if (removed.length === 1 && added.length === 1 && removed[0].length < 60 && added[0].length < 60) {
      return `"${removed[0]}" \u2192 "${added[0]}"`;
    }
  }

  const oldNumMatches = [...oldStr.matchAll(/\b(\d+)\b/g)].map((m) => m[1]);
  const newNumMatches = [...newStr.matchAll(/\b(\d+)\b/g)].map((m) => m[1]);
  if (oldNumMatches.length > 0 && newNumMatches.length > 0) {
    const removed = oldNumMatches.filter((n) => !newNumMatches.includes(n));
    const added = newNumMatches.filter((n) => !oldNumMatches.includes(n));
    if (removed.length === 1 && added.length === 1) {
      return `"${removed[0]}" \u2192 "${added[0]}"`;
    }
  }

  if (oldLines <= 3 && newLines <= 3) return "inline fix";

  const oldCalls = extractCalls(oldStr);
  const newCalls = extractCalls(newStr);
  const removedCalls = oldCalls.filter((c) => !newCalls.includes(c));
  const addedCalls = newCalls.filter((c) => !oldCalls.includes(c));
  if (removedCalls.length === 1 && addedCalls.length === 1) {
    return `${removedCalls[0]}() \u2192 ${addedCalls[0]}()`;
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["css", "scss", "less"].includes(ext)) {
    const oldProps = extractCSSProps(oldStr);
    const newProps = extractCSSProps(newStr);
    const changed: string[] = [];
    for (const [prop, val] of newProps) {
      const oldVal = oldProps.get(prop);
      if (oldVal !== undefined && oldVal !== val) changed.push(prop);
    }
    if (changed.length > 0 && changed.length <= 4) return `CSS: ${changed.join(", ")}`;
  }

  const ifCount = (s: string) => (s.match(/\bif\s*\(/g) || []).length;
  if (newStr.includes("if(") && ifCount(newStr) > ifCount(oldStr)) {
    const diff = ifCount(newStr) - ifCount(oldStr);
    if (diff <= 3) return `added ${diff} condition(s)`;
  }

  const fnMatch = newStr.match(/(?:function|const|let|var)\s+(\w+)\s*[=(]/);
  if (fnMatch && !oldStr.includes(fnMatch[1])) return `modified ${fnMatch[1]}()`;

  const methodMatch = newStr.match(/(\w+)\s*\([^)]*\)\s*\{/);
  if (methodMatch && !oldStr.includes(methodMatch[1])) return `modified ${methodMatch[1]}()`;

  const lineDiff = newLines - oldLines;
  if (Math.abs(lineDiff) > 3) {
    return lineDiff > 0 ? `expanded (+${lineDiff} lines)` : `reduced (${lineDiff} lines)`;
  }

  return `${oldLines}\u2192${newLines} lines`;
}

function extractCalls(code: string): string[] {
  const calls = code.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
  const keywords = new Set(["if", "for", "while", "switch", "catch", "return", "function", "const", "let", "var", "import", "export", "class", "new", "throw", "typeof", "instanceof", "await", "async", "yield", "delete", "void"]);
  const cleaned = calls.map((c) => c.replace(/\s*\($/, ""));
  return [...new Set(cleaned)].filter((c) => !keywords.has(c));
}

function extractCSSProps(code: string): Map<string, string> {
  const props = new Map<string, string>();
  const re = /([a-zA-Z-]+)\s*:\s*([^;{}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    props.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return props;
}
