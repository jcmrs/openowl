import * as fs from "node:fs";
import * as path from "node:path";

interface DoNotRepeatEntry {
  line: string;
  pattern: string;
}

export function extractDoNotRepeatPatterns(owlDir: string): DoNotRepeatEntry[] {
  const entries: DoNotRepeatEntry[] = [];
  try {
    const content = fs.readFileSync(path.join(owlDir, "cerebrum.md"), "utf-8");
    const lines = content.split("\n");
    let inDNR = false;

    for (const line of lines) {
      if (line.trim() === "## Do-Not-Repeat") {
        inDNR = true;
        continue;
      }
      if (line.startsWith("## ") && inDNR) {
        break;
      }
      if (inDNR && line.startsWith("- ") && line.length > 4) {
        const text = line.slice(2).trim();
        entries.push({
          line: text,
          pattern: text.toLowerCase().replace(/\d+/g, "N").replace(/[^\w\s]/g, " ").trim(),
        });
      }
    }
  } catch {}
  return entries;
}

export function checkDoNotRepeat(content: string, patterns: DoNotRepeatEntry[]): DoNotRepeatEntry | null {
  if (patterns.length === 0) return null;

  const normalized = content.toLowerCase().replace(/\d+/g, "N").replace(/[^\w\s]/g, " ").trim();
  const contentTokens = new Set(normalized.split(/\s+/).filter((w) => w.length > 2));

  for (const entry of patterns) {
    const entryTokens = new Set(entry.pattern.split(/\s+/).filter((w) => w.length > 2));
    const intersection = new Set([...contentTokens].filter((x) => entryTokens.has(x)));
    const union = new Set([...contentTokens, ...entryTokens]);
    const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

    if (entryTokens.size >= 3 && jaccard > 0.6) {
      return entry;
    }
  }

  return null;
}
