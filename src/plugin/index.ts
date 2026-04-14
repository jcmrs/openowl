import type { Plugin } from "@opencode-ai/plugin";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { getOwlDir } from "../core/utils/paths.js";
import { handleToolBefore } from "./events/tool-before.js";
import { handleToolAfter } from "./events/tool-after.js";
import { handleSessionCreated } from "./events/session-created.js";
import { handleSessionCompacted } from "./events/session-compacted.js";
import { finalizeSession } from "./context/session-manager.js";

export const OpenOwlPlugin: Plugin = async (ctx) => {
  const projectRoot = ctx.directory ?? findProjectRoot();
  const owlDir = getOwlDir(projectRoot);

  async function logWarnings(warnings: string[]): Promise<void> {
    if (warnings.length === 0) return;
    try {
      await ctx.client.app.log({
        body: {
          level: "warn",
          message: warnings.join("\n"),
          service: "openowl",
          extra: { timestamp: new Date().toISOString() },
        },
      });
    } catch {
      for (const w of warnings) console.warn(`[OpenOwl] ${w}`);
    }
  }

  return {
    event: async ({ event }) => {
      const warnings: string[] = [];
      try {
        const e = event as any;
        const type: string = e?.type ?? "";

        switch (type) {
          case "session.created": {
            const sessionId = e?.properties?.info?.id ?? "unknown";
            await handleSessionCreated(owlDir, sessionId, warnings);
            break;
          }
          case "session.idle": {
            const sessionId = e?.properties?.sessionID ?? "unknown";
            try {
              finalizeSession(owlDir);
            } catch (err) {
              console.error("[OpenOwl] Error finalizing session:", err);
            }
            break;
          }
          case "file.edited": {
            break;
          }
        }
      } catch (err) {
        console.error("[OpenOwl] Error in event handler:", err);
      }
      await logWarnings(warnings);
    },

    "tool.execute.before": async (input, output) => {
      const warnings: string[] = [];
      try {
        await handleToolBefore(owlDir, projectRoot, input, output, warnings);
      } catch (err) {
        console.error("[OpenOwl] Error in tool.execute.before:", err);
      }
      await logWarnings(warnings);
    },

    "tool.execute.after": async (input, output) => {
      const warnings: string[] = [];
      try {
        await handleToolAfter(owlDir, projectRoot, input, output, warnings);
      } catch (err) {
        console.error("[OpenOwl] Error in tool.execute.after:", err);
      }
      await logWarnings(warnings);
    },

    "experimental.session.compacting": async (input, output) => {
      try {
        await handleSessionCompacted(owlDir, input.sessionID, output);
      } catch (err) {
        console.error("[OpenOwl] Error in session.compacting:", err);
      }
    },
  };
};
