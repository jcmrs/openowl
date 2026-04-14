import * as path from "node:path";
import * as fs from "node:fs";
import { appendText, readText, writeText } from "../../core/utils/fs-safe.js";

const MAX_MEMORY_LINES = 200;

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
  content += newLine;

  const lines = content.split("\n");
  if (lines.length > MAX_MEMORY_LINES) {
    const headerEnd = lines.findIndex((l) => l.startsWith("> Chronological")) + 1;
    const trimmed = lines.slice(headerEnd, lines.length - (MAX_MEMORY_LINES - headerEnd));
    content = lines.slice(0, headerEnd).join("\n") + "\n> ... " + trimmed.length + " older entries consolidated ...\n\n" + lines.slice(lines.length - (MAX_MEMORY_LINES - headerEnd)).join("\n");
  }

  writeText(memoryPath, content);
}
