import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { scanCommand } from "./scan.js";
import { dashboardCommand } from "./dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("openowl")
    .description("Project intelligence and learning memory middleware for OpenCode")
    .version(getVersion());

  program
    .command("init")
    .description("Initialize .owl/ in current project and install OpenCode plugin")
    .action(initCommand);

  program
    .command("status")
    .description("Show plugin status, last session stats, file integrity")
    .action(statusCommand);

  program
    .command("scan")
    .description("Force full anatomy rescan")
    .option("--check", "Verify anatomy.md matches filesystem (no changes)")
    .action(scanCommand);

  program
    .command("dashboard")
    .description("Open browser to dashboard")
    .action(dashboardCommand);

  const daemon = program
    .command("daemon")
    .description("Daemon management");

  daemon
    .command("start")
    .description("Start daemon via pm2")
    .action(async () => {
      const { daemonStart } = await import("./daemon-cmd.js");
      daemonStart();
    });

  daemon
    .command("stop")
    .description("Stop daemon")
    .action(async () => {
      const { daemonStop } = await import("./daemon-cmd.js");
      daemonStop();
    });

  daemon
    .command("restart")
    .description("Restart daemon")
    .action(async () => {
      const { daemonRestart } = await import("./daemon-cmd.js");
      daemonRestart();
    });

  daemon
    .command("logs")
    .description("Show last 50 lines of daemon log")
    .action(async () => {
      const { daemonLogs } = await import("./daemon-cmd.js");
      daemonLogs();
    });

  const cron = program
    .command("cron")
    .description("Cron task management");

  cron
    .command("list")
    .description("Show all cron tasks with next run times")
    .action(async () => {
      const { cronList } = await import("./cron-cmd.js");
      cronList();
    });

  cron
    .command("run <id>")
    .description("Manually trigger a cron task (requires running daemon)")
    .action(async (id: string) => {
      const { cronRun } = await import("./cron-cmd.js");
      await cronRun(id);
    });

  cron
    .command("retry <id>")
    .description("Retry a dead-lettered task (requires running daemon)")
    .action(async (id: string) => {
      const { cronRetry } = await import("./cron-cmd.js");
      cronRetry(id);
    });

  program
    .command("update")
    .description("Update all registered OpenOwl projects to latest version")
    .option("--dry-run", "Show what would be updated without making changes")
    .option("--project <name>", "Update only a specific project (partial name match)")
    .option("--list", "List all registered projects")
    .action(async (opts: { dryRun?: boolean; project?: string; list?: boolean }) => {
      const { updateCommand, listProjects } = await import("./update.js");
      if (opts.list) {
        listProjects();
      } else {
        await updateCommand(opts);
      }
    });

  program
    .command("restore [backup]")
    .description("Restore .owl from a backup (run in project dir). Without args, lists available backups.")
    .action(async (backup?: string) => {
      const { restoreCommand } = await import("./update.js");
      restoreCommand(backup);
    });

  program
    .command("designqc [target]")
    .description("Capture full-page screenshots for design evaluation")
    .option("--url <url>", "Dev server URL (auto-starts server if omitted)")
    .option("--routes <routes...>", "Specific routes to check")
    .option("--quality <n>", "JPEG quality 1-100 (lower = fewer tokens)", "70")
    .option("--max-width <n>", "Max capture width in px", "1200")
    .option("--desktop-only", "Skip mobile viewport captures")
    .action(async (target: string | undefined, opts: { url?: string; routes?: string[]; quality?: string; maxWidth?: string; desktopOnly?: boolean }) => {
      const { designqcCommand } = await import("./designqc-cmd.js");
      await designqcCommand(target, opts);
    });

  const bug = program
    .command("bug")
    .description("Bug memory management");

  bug
    .command("search <term>")
    .description("Search buglog for matching entries")
    .action(async (term: string) => {
      const { bugSearch } = await import("./bug-cmd.js");
      bugSearch(term);
    });

  return program;
}
