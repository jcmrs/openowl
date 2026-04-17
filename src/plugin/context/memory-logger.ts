import * as path from "node:path";
import { readText, writeText } from "../../core/utils/fs-safe.js";

const MAX_MEMORY_LINES = 200;

const TABLE_HEADER = "| Time | Action | Files | Outcome | Tokens |\n|------|--------|-------|---------|--------|";

export function logToMemory(
  owlDir: string,
  action: string,
  files: string | string[],
  outcome: string,
  tokens: number
): void {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fileList = typeof files === "string" ? files : files.join(", ");
  const newLine = `\n| ${timeStr} | ${action} | ${fileList} | ${outcome} | ~${tokens} |\n`;

  const memoryPath = path.join(owlDir, "memory.md");
  let content = readText(memoryPath) || "";

  if (!content.includes("| Time | Action |")) {
    if (content.trim().length > 0) {
      content += "\n";
    }
    content += TABLE_HEADER;
  }

  content += newLine;

  const lines = content.split("\n");
  if (lines.length > MAX_MEMORY_LINES) {
    const markerIdx = lines.findIndex((l) => l.startsWith("> Chronological"));
    const headerEnd = markerIdx >= 0 ? markerIdx + 1 : 0;

    if (headerEnd === 0) {
      const excess = lines.length - MAX_MEMORY_LINES;
      content = lines.slice(excess).join("\n");
    } else {
      const trimmed = lines.slice(headerEnd, lines.length - (MAX_MEMORY_LINES - headerEnd));
      content = lines.slice(0, headerEnd).join("\n") + "\n> ... " + trimmed.length + " older entries consolidated ...\n\n" + lines.slice(lines.length - (MAX_MEMORY_LINES - headerEnd)).join("\n");
    }
  }

  writeText(memoryPath, content);
}
