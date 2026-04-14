import * as fs from "node:fs";
import * as path from "node:path";
import { watch } from "chokidar";
import type { Logger } from "../../core/utils/logger.js";

export function startFileWatcher(
  owlDir: string,
  logger: Logger,
  broadcast: (msg: unknown) => void
): void {
  const watcher = watch(owlDir, {
    ignoreInitial: true,
    ignored: [
      "**/*.tmp",
      "**/daemon.log",
    ],
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on("change", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    const fileName = path.basename(filePath as string);
    logger.debug(`File changed: ${relativePath}`);

    try {
      const content = fs.readFileSync(filePath as string, "utf-8");
      broadcast({
        type: "file_changed",
        file: relativePath,
        content,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    if (fileName === "config.json") {
      logger.info("Config changed - restart daemon to apply");
    }

    if (fileName === "cron-manifest.json") {
      logger.info("Cron manifest changed - restart daemon to apply");
    }
  });

  watcher.on("add", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    logger.debug(`File added: ${relativePath}`);
  });

  watcher.on("unlink", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    logger.debug(`File removed: ${relativePath}`);
  });

  logger.info("File watcher started on .owl/");
}
