import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { scanProject, buildAnatomy } from "../core/scanner/anatomy-scanner.js";

export async function scanCommand(options: { check?: boolean }): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  if (options.check) {
    const { content: newContent } = buildAnatomy(owlDir, projectRoot);

    const anatomyPath = path.join(owlDir, "anatomy.md");
    let existingContent = "";
    try {
      existingContent = fs.readFileSync(anatomyPath, "utf-8");
    } catch {}

    const stripTimestamp = (s: string): string =>
      s.replace(/^> Auto-maintained by OpenOwl\. Last scanned: .+$/m, "");

    if (stripTimestamp(existingContent) === stripTimestamp(newContent)) {
      console.log("Anatomy is up to date");
      return;
    } else {
      console.log("Anatomy is out of date. Run `openowl scan` to update.");
      process.exit(1);
    }
  }

  console.log("Scanning project...");
  const startTime = Date.now();
  const fileCount = scanProject(owlDir, projectRoot);
  const elapsed = Date.now() - startTime;
  console.log(`  Anatomy scan complete: ${fileCount} files indexed in ${elapsed}ms`);
}
