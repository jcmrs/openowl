import * as fs from "node:fs";
import * as path from "node:path";

interface DoNotRepeatEntry {
  line: string;
  patterns: string[];
}

export function extractDoNotRepeatPatterns(owlDir: string): DoNotRepeatEntry[] {
  const entries: DoNotRepeatEntry[] = [];
  try {
    const content = fs.readFileSync(path.join(owlDir, "cerebrum.md"), "utf-8");
    const lines = content.split("\n");
    let inDNR = false;

    for (const line of lines) {
      if (line.trim().toLowerCase() === "## do-not-repeat") {
        inDNR = true;
        continue;
      }
      if (line.startsWith("## ") && inDNR) {
        break;
      }
      if (inDNR && line.match(/^\s*-\s/) && line.length > 4) {
        const text = line.replace(/^\s*-\s+/, "").trim();
        const patterns = extractPatterns(text);
        entries.push({ line: text, patterns });
      }
    }
  } catch (err) {
    console.error("[OpenOwl] Failed to read/parse cerebrum.md for DNR patterns:", err);
  }
  return entries;
}

export function checkDoNotRepeat(content: string, patterns: DoNotRepeatEntry[], filePath?: string): DoNotRepeatEntry | null {
  if (patterns.length === 0) return null;

  const combined = filePath ? `${filePath} ${content}` : content;

  for (const entry of patterns) {
    if (entry.patterns.length === 0) continue;
    for (const pattern of entry.patterns) {
      try {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(combined)) {
          return entry;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function extractPatterns(text: string): string[] {
  const patterns: string[] = [];

  const quotedStrs = [...text.matchAll(/(["'`])(.*?)\1/g)].map((m) => m[2]);
  for (const s of quotedStrs) {
    const trimmed = s.trim();
    if (trimmed.length > 0 && trimmed.length < 80) {
      patterns.push(trimmed);
    }
  }

  const avoidPhrases = [
    /(?:never use|avoid|don't use|do not use|never call|never import|never access)\s+(\w+)/gi,
  ];
  for (const re of avoidPhrases) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const word = match[1];
      if (word && word.length > 1 && !patterns.includes(word)) {
        patterns.push(word);
      }
    }
  }

  return [...new Set(patterns)];
}
