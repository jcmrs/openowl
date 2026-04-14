import * as path from "node:path";
import { parseAnatomy } from "../../core/scanner/anatomy-scanner.js";
import { readText } from "../../core/utils/fs-safe.js";

export interface AnatomyCheckResult {
  isOwlFile: boolean;
  alreadyRead: boolean;
  anatomyHit: boolean;
  description: string;
  tokenEstimate: number;
}

export function checkAnatomy(
  owlDir: string,
  projectRoot: string,
  filePath: string,
  priorReads: Set<string>
): AnatomyCheckResult {
  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.includes("/.owl/") || normalized.startsWith(".owl/")) {
    return { isOwlFile: true, alreadyRead: false, anatomyHit: false, description: "", tokenEstimate: 0 };
  }

  const alreadyRead = priorReads.has(normalized);
  if (alreadyRead) {
    return { isOwlFile: false, alreadyRead: true, anatomyHit: false, description: "", tokenEstimate: 0 };
  }

  try {
    const content = readText(path.join(owlDir, "anatomy.md"));
    const sections = parseAnatomy(content);

    const relPath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    const dir = path.dirname(relPath);
    const fileName = path.basename(relPath);
    const sectionKey = dir === "." ? "./" : dir + "/";

    const entries = sections.get(sectionKey);
    if (!entries) {
      return { isOwlFile: false, alreadyRead: false, anatomyHit: false, description: "", tokenEstimate: 0 };
    }

    const entry = entries.find((e) => e.file === fileName);
    if (entry) {
      return {
        isOwlFile: false,
        alreadyRead: false,
        anatomyHit: true,
        description: entry.description,
        tokenEstimate: entry.tokens,
      };
    }
  } catch (err) {
    console.error("[OpenOwl] Error parsing anatomy.md:", err);
  }

  return { isOwlFile: false, alreadyRead: false, anatomyHit: false, description: "", tokenEstimate: 0 };
}
