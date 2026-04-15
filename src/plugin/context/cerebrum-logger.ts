import * as path from "node:path";
import { appendText, readText, writeText } from "../../core/utils/fs-safe.js";

type CerebrumSection = "key-learnings" | "do-not-repeat" | "decision-log";

const SECTION_HEADERS: Record<CerebrumSection, string> = {
  "key-learnings": "## Key Learnings",
  "do-not-repeat": "## Do-Not-Repeat",
  "decision-log": "## Decision Log",
};

export function appendCerebrumEntry(
  owlDir: string,
  section: CerebrumSection,
  scope: string,
  text: string
): void {
  const cerebrumPath = path.join(owlDir, "cerebrum.md");
  let content = readText(cerebrumPath) || "";

  const date = new Date().toISOString().slice(0, 10);
  const entry = `  - [${scope}] ${date}: ${text}`;

  const header = SECTION_HEADERS[section];
  const headerIdx = content.search(new RegExp(`^${escapeRegex(header)}$`, "im"));

  if (headerIdx === -1) {
    content += `\n${header}\n\n${entry}\n`;
  } else {
    const insertAfter = content.indexOf("\n", headerIdx);
    if (insertAfter === -1) {
      content += `\n${entry}\n`;
    } else {
      const nextSection = content.indexOf("\n## ", insertAfter + 1);
      if (nextSection === -1) {
        content = content.slice(0, insertAfter + 1) + `${entry}\n` + content.slice(insertAfter + 1);
      } else {
        content = content.slice(0, nextSection) + `${entry}\n` + content.slice(nextSection);
      }
    }
  }

  writeText(cerebrumPath, content);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
