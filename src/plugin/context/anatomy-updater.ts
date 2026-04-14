import { updateAnatomyEntry } from "../../core/scanner/anatomy-scanner.js";

export function updateAnatomyAfterWrite(
  owlDir: string,
  filePath: string,
  projectRoot: string
): void {
  try {
    updateAnatomyEntry(owlDir, filePath, projectRoot, "upsert");
  } catch (err) {
    console.error("[OpenOwl] Failed to update anatomy for", filePath, err);
  }
}
