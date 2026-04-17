import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { findProjectRoot } from "../../core/scanner/project-root.js";
import { readJSON, writeJSON } from "../../core/utils/fs-safe.js";
import { Logger } from "../../core/utils/logger.js";
import { validateConfig, sanitizeConfig } from "../../core/utils/config.js";
import { CronEngine } from "./cron-engine.js";
import { startFileWatcher } from "./file-watcher.js";
import { getHealth } from "./health.js";

const projectRoot = process.env.OPENOWL_PROJECT_ROOT || findProjectRoot();
const owlDir = path.join(projectRoot, ".owl");

interface OwlConfig {
  openowl: {
    daemon: { log_level: string };
    dashboard: { enabled: boolean; port: number };
    cron: { enabled: boolean; heartbeat_interval_minutes: number };
  };
}

const rawConfig = readJSON<any>(path.join(owlDir, "config.json"), {
  openowl: {
    daemon: { log_level: "info" },
    dashboard: { enabled: true, port: 18791 },
    cron: { enabled: true, heartbeat_interval_minutes: 30 },
  },
});

const configWarnings = validateConfig(rawConfig as any);
for (const w of configWarnings) {
  console.error(`[OpenOwl] Config warning: ${w.path} — ${w.message}`);
}
const config = sanitizeConfig(rawConfig) as OwlConfig;

const logger = new Logger(
  path.join(owlDir, "daemon.log"),
  config.openowl.daemon.log_level as "debug" | "info" | "warn" | "error"
);

const startTime = Date.now();
const wsClients = new Set<WebSocket>();

const daemonToken = crypto.randomBytes(32).toString("hex");
const tokenPath = path.join(owlDir, "daemon-token");
try {
  fs.writeFileSync(tokenPath, daemonToken, "utf-8");
} catch (err) {
  console.error("[OpenOwl] Warning: could not write daemon-token:", err);
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${daemonToken}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const app = express();
app.use(express.json());

const dashboardDir = path.resolve(__dirname, "..", "..", "..", "dist", "dashboard");
if (fs.existsSync(dashboardDir)) {
  app.use(express.static(dashboardDir));
}

function detectProjectMeta(): { name: string; description: string } {
  let name = path.basename(projectRoot);
  let description = "";

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    if (pkg.name) name = pkg.name;
    if (pkg.description) description = pkg.description;
  } catch {}

  if (name === path.basename(projectRoot)) {
    try {
      const cargo = fs.readFileSync(path.join(projectRoot, "Cargo.toml"), "utf-8");
      const nameMatch = cargo.match(/^name\s*=\s*"([^"]+)"/m);
      if (nameMatch) name = nameMatch[1];
    } catch {}
  }

  if (!description) {
    try {
      const cerebrum = fs.readFileSync(path.join(owlDir, "cerebrum.md"), "utf-8");
      const descMatch = cerebrum.match(/\*\*Project:\*\*\s*(.+)/);
      if (descMatch) description = descMatch[1].trim();
    } catch {}
  }

  if (!description) {
    for (const readme of ["README.md", "readme.md", "README.rst"]) {
      try {
        const content = fs.readFileSync(path.join(projectRoot, readme), "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!") && !trimmed.startsWith("=") && !trimmed.startsWith("-") && !trimmed.startsWith("<") && !trimmed.startsWith("[") && !trimmed.startsWith("```") && trimmed.length > 10) {
            description = trimmed.length > 200 ? trimmed.slice(0, 200) + "..." : trimmed;
            break;
          }
        }
        if (description) break;
      } catch {}
    }
  }

  return { name, description };
}

const projectMeta = detectProjectMeta();

let actualPort = config.openowl.dashboard.port;

app.get("/api/health", (_req, res) => {
  const health = getHealth(owlDir, startTime);
  res.json({ ...health, port: actualPort });
});

app.get("/api/project", requireAuth, (_req, res) => {
  res.json({
    name: projectMeta.name,
    description: projectMeta.description,
    root: projectRoot,
  });
});

app.get("/api/files", requireAuth, (_req, res) => {
  const files: Record<string, string> = {};
  const owlFiles = [
    "OWL.md", "identity.md", "cerebrum.md", "memory.md", "anatomy.md",
    "config.json", "token-ledger.json", "buglog.json",
    "cron-manifest.json", "cron-state.json",
  ];
  for (const file of owlFiles) {
    try {
      files[file] = fs.readFileSync(path.join(owlDir, file), "utf-8");
    } catch {
      files[file] = "";
    }
  }
  res.json(files);
});

app.post("/api/cron/run/:taskId", requireAuth, (req, res) => {
  const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
  if (!cronEngine) {
    res.status(503).json({ error: "Cron engine not running" });
    return;
  }
  cronEngine.runTask(taskId).then(() => {
    res.json({ status: "ok", task_id: taskId });
  }).catch((err) => {
    res.status(500).json({ error: String(err) });
  });
});

app.get("/{*path}", (_req, res) => {
  const reqPath = typeof (_req.params as any).path === "string" ? (_req.params as any).path as string : "index.html";
  const safePath = reqPath.replace(/\.\./g, "");
  const filePath = path.join(dashboardDir, safePath);
  if (!filePath.startsWith(dashboardDir)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    const indexPath = path.join(dashboardDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "Dashboard not built." });
    }
  }
});

const basePort = config.openowl.dashboard.port;
const MAX_PORT_ATTEMPTS = 10;

function tryListen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, "127.0.0.1", () => {
      resolve(port);
    });
    srv.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(err);
      } else {
        reject(err);
      }
    });
    (srv as any).__isServer = true;
  });
}

let server: any = null;
let wss: WebSocketServer;
let fileWatcher: ReturnType<typeof startFileWatcher>;

function setupWebSocket(): void {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${actualPort}`);
    const token = url.searchParams.get("token");
    if (token !== daemonToken) {
      ws.close(4001, "Unauthorized");
      return;
    }

    wsClients.add(ws);
    logger.info("WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; task_id?: string };
        handleDashboardCommand(msg);
      } catch {
        logger.warn("Invalid WebSocket message received");
      }
    });

    ws.on("close", () => {
      wsClients.delete(ws);
    });

    broadcast({ type: "daemon_started", timestamp: new Date().toISOString() });
  });
}

async function startServer(): Promise<void> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const tryPort = basePort + attempt;
    try {
      const resolvedPort = await tryListen(tryPort);
      actualPort = resolvedPort;

      const portPath = path.join(owlDir, "_daemon-port");
      try {
        fs.writeFileSync(portPath, String(actualPort), "utf-8");
      } catch {}

      server = app as any;
      wss = new WebSocketServer({ server, path: "/ws" });
      setupWebSocket();
      logger.info(`OpenOwl dashboard server listening on port ${actualPort}${attempt > 0 ? ` (auto-selected, base was ${basePort})` : ""}`);
      return;
    } catch (err: any) {
      if (err.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS - 1) {
        logger.warn(`Port ${tryPort} in use, trying ${tryPort + 1}...`);
        continue;
      }
      logger.error(`Failed to bind to any port from ${basePort} to ${basePort + MAX_PORT_ATTEMPTS - 1}`);
      process.exit(1);
    }
  }
}

await startServer();

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        wsClients.delete(client);
      }
    }
  }
}

function handleDashboardCommand(msg: { type: string; task_id?: string }): void {
  switch (msg.type) {
    case "trigger_task":
      if (msg.task_id && cronEngine) {
        cronEngine.runTask(msg.task_id).catch((err) => {
          logger.error(`Manual task trigger failed: ${err}`);
        });
      }
      break;
    case "retry_dead_letter":
      if (msg.task_id) {
        const statePath = path.join(owlDir, "cron-state.json");
        const state = readJSON<{ dead_letter_queue: Array<{ task_id: string }> }>(statePath, {
          dead_letter_queue: [],
        });
        state.dead_letter_queue = state.dead_letter_queue.filter(
          (d) => d.task_id !== msg.task_id
        );
        writeJSON(statePath, state);
      }
      break;
    case "force_scan":
      if (cronEngine) {
        cronEngine.runTask("anatomy-rescan").catch((err) => {
          logger.error(`Force scan failed: ${err}`);
        });
      }
      break;
    case "request_full_state":
      try {
        const files: Record<string, string> = {};
        const owlFiles = [
          "OWL.md", "identity.md", "cerebrum.md", "memory.md", "anatomy.md",
          "config.json", "token-ledger.json", "buglog.json",
          "cron-manifest.json", "cron-state.json",
        ];
        for (const file of owlFiles) {
          try {
            files[file] = fs.readFileSync(path.join(owlDir, file), "utf-8");
          } catch {
            files[file] = "";
          }
        }
        broadcast({ type: "full_state", files, timestamp: new Date().toISOString() });
      } catch (err) {
        logger.error(`Full state request failed: ${err}`);
      }
      break;
  }
}

let cronEngine: CronEngine | null = null;
if (config.openowl.cron.enabled) {
  cronEngine = new CronEngine(owlDir, projectRoot, logger, broadcast);
  cronEngine.start();
}

fileWatcher = startFileWatcher(owlDir, logger, broadcast);

const heartbeatInterval = Math.max(1, (config.openowl.cron.heartbeat_interval_minutes || 30)) * 60 * 1000;
const heartbeatPath = path.join(owlDir, "_heartbeat");
const heartbeatTimer = setInterval(() => {
  try {
    fs.writeFileSync(heartbeatPath, new Date().toISOString(), "utf-8");
  } catch (err) {
    logger.warn(`Failed to write heartbeat: ${err}`);
  }
  broadcast({ type: "health", status: "healthy", uptime: Math.floor((Date.now() - startTime) / 1000) });
}, heartbeatInterval);

const cronStatePath = path.join(owlDir, "cron-state.json");
const cronState = readJSON<Record<string, unknown>>(cronStatePath, {});
cronState.engine_status = "running";
cronState.last_heartbeat = new Date().toISOString();
writeJSON(cronStatePath, cronState);
try {
  fs.writeFileSync(heartbeatPath, new Date().toISOString(), "utf-8");
} catch {}

logger.info("OpenOwl daemon started");

function shutdown(): void {
  logger.info("Daemon shutting down...");
  broadcast({ type: "daemon_stopping", timestamp: new Date().toISOString() });

  clearInterval(heartbeatTimer);
  if (cronEngine) cronEngine.stop();

  if (fileWatcher) {
    fileWatcher.close().catch(() => {});
  }

  const state = readJSON<Record<string, unknown>>(cronStatePath, {});
  state.engine_status = "stopped";
  writeJSON(cronStatePath, state);

  wss.close(() => {
    for (const client of wsClients) {
      client.close();
    }
    wsClients.clear();

    server.close(() => {
      logger.info("Daemon stopped");
      process.exit(0);
    });
  });

  setTimeout(() => process.exit(0), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
