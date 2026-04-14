import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { readJSON, writeJSON } from "../core/utils/fs-safe.js";
import { DesignQCEngine } from "../core/designqc/designqc-engine.js";
import type { DesignQCOptions } from "../core/designqc/designqc-types.js";

interface OwlConfig {
  openowl: {
    designqc: {
      enabled: boolean;
      viewports: Array<{ name: string; width: number; height: number }>;
      max_screenshots: number;
      chrome_path: string | null;
    };
  };
}

export async function designqcCommand(
  target?: string,
  opts?: { url?: string; routes?: string[]; quality?: string; maxWidth?: string; desktopOnly?: boolean }
): Promise<void> {
  const projectRoot = findProjectRoot();
  const owlDir = path.join(projectRoot, ".owl");

  if (!fs.existsSync(owlDir)) {
    console.log("OpenOwl not initialized. Run: openowl init");
    return;
  }

  const config = readJSON<OwlConfig>(path.join(owlDir, "config.json"), {
    openowl: {
      designqc: {
        enabled: true,
        viewports: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 375, height: 812 },
        ],
        max_screenshots: 6,
        chrome_path: null,
      },
    },
  });

  const cfg = config.openowl.designqc;

  const viewports = opts?.desktopOnly
    ? cfg.viewports.filter((v) => v.name === "desktop")
    : cfg.viewports;

  const options: DesignQCOptions = {
    targetFile: target,
    devServerUrl: opts?.url,
    routes: opts?.routes,
    viewports,
    maxScreenshots: cfg.max_screenshots,
    chromePath: cfg.chrome_path ?? undefined,
    quality: parseInt(opts?.quality ?? "70", 10),
    maxWidth: parseInt(opts?.maxWidth ?? "1200", 10),
  };

  console.log("OpenOwl Design QC");
  console.log("==================\n");

  const engine = new DesignQCEngine(owlDir, projectRoot, options);
  const result = await engine.capture();

  if (result.screenshots.length > 0) {
    const reportPath = path.join(owlDir, "designqc-report.json");
    const existing = readJSON<Record<string, unknown> | null>(reportPath, null);
    const report = {
      ...(existing ?? {}),
      captured_at: new Date().toISOString(),
      captures: result.screenshots.map((s) => ({
        file: path.basename(s.path),
        route: s.route,
        viewport: s.viewport.name,
        size_kb: Math.round(fs.statSync(s.path).size / 1024),
      })),
      total_size_kb: result.totalSizeKB,
      estimated_tokens: result.estimatedTokens,
    };
    writeJSON(reportPath, report);
  }
}
