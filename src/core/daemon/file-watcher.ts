import * as path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import type { Logger } from "../../core/utils/logger.js";

const DEBOUNCE_MS = 500;
const daemonFiles = new Set([
  "_heartbeat",
  "daemon-token",
  "_session.json",
  "cron-state.json",
  "daemon.log",
]);

export function startFileWatcher(
  owlDir: string,
  logger: Logger,
  broadcast: (msg: unknown) => void
): FSWatcher {
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  const watcher = watch(owlDir, {
    ignoreInitial: true,
    ignored: [
      "**/*.tmp",
      "**/daemon.log",
      "**/_heartbeat",
      "**/daemon-token",
      "**/_session.json",
    ],
    persistent: true,
  });

  watcher.on("change", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    const fileName = path.basename(filePath as string);
    logger.debug(`File changed: ${relativePath}`);

    if (daemonFiles.has(fileName)) return;

    const existing = debounceTimers.get(relativePath);
    if (existing) clearTimeout(existing);

    debounceTimers.set(relativePath, setTimeout(() => {
      debounceTimers.delete(relativePath);
      broadcast({
        type: "file_changed",
        file: relativePath,
        timestamp: new Date().toISOString(),
      });
    }, DEBOUNCE_MS));

    if (fileName === "config.json") {
      logger.info("Config changed - restart daemon to apply");
    }

    if (fileName === "cron-manifest.json") {
      logger.info("Cron manifest changed - restart daemon to apply");
    }
  });

  watcher.on("add", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    const fileName = path.basename(filePath as string);
    logger.debug(`File added: ${relativePath}`);

    if (daemonFiles.has(fileName)) return;

    broadcast({
      type: "file_added",
      file: relativePath,
      timestamp: new Date().toISOString(),
    });
  });

  watcher.on("unlink", (filePath) => {
    const relativePath = path.relative(owlDir, filePath as string);
    const fileName = path.basename(filePath as string);
    logger.debug(`File removed: ${relativePath}`);

    if (daemonFiles.has(fileName)) return;

    broadcast({
      type: "file_removed",
      file: relativePath,
      timestamp: new Date().toISOString(),
    });
  });

  logger.info("File watcher started on .owl/");
  return watcher;
}
