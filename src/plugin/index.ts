import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { findProjectRoot } from "../core/scanner/project-root.js";
import { getOwlDir } from "../core/utils/paths.js";
import { readJSON } from "../core/utils/fs-safe.js";
import { handleToolBefore } from "./events/tool-before.js";
import { handleToolAfter } from "./events/tool-after.js";
import { handleSessionCreated } from "./events/session-created.js";
import { handleSessionCompacted } from "./events/session-compacted.js";
import { finalizeSession } from "./context/session-manager.js";
import { buildInjectionContext } from "./injection/build-context.js";
import { validateInjectionConfig } from "./injection/token-budget.js";

export const OpenOwlPlugin: Plugin = async (ctx) => {
  const projectRoot = ctx.directory ?? findProjectRoot();
  const owlDir = getOwlDir(projectRoot);
  const owlReady = fs.existsSync(owlDir);

  let injectionConfig: ReturnType<typeof validateInjectionConfig>["config"];
  if (owlReady) {
    const fullConfig = readJSON<Record<string, unknown>>(path.join(owlDir, "config.json"), {});
    const owlConfig = (fullConfig.openowl ?? {}) as Record<string, unknown>;
    const { config, warnings: configWarnings } = validateInjectionConfig(
      (owlConfig.injection ?? {}) as Record<string, unknown>
    );
    injectionConfig = config;
    for (const w of configWarnings) {
      console.warn(`[OpenOwl] ${w}`);
    }
  } else {
    console.warn(`[OpenOwl] .owl/ directory not found at ${owlDir}. File-based features disabled.`);
    injectionConfig = { enabled: true, max_tokens: 2500, include_project: true, include_dnr: true, include_conventions: true, include_anatomy: true, include_bugs: true };
  }

  async function logWarnings(warnings: string[]): Promise<void> {
    if (warnings.length === 0) return;
    try {
      await (ctx.client.app as any).log({
        level: "warn",
        message: warnings.join("\n"),
        service: "openowl",
        extra: { timestamp: new Date().toISOString() },
      });
    } catch {
      for (const w of warnings) console.warn(`[OpenOwl] ${w}`);
    }
  }

  return {
    "experimental.chat.system.transform": async (input, output) => {
      if (!injectionConfig.enabled || !owlReady) return;
      try {
        const block = buildInjectionContext(owlDir, projectRoot, injectionConfig);
        if (block) {
          output.system.push(block);
        }
      } catch (err) {
        console.error("[OpenOwl] System prompt injection failed:", err);
      }
    },

    event: async ({ event }) => {
      if (!owlReady) return;
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
            try {
              finalizeSession(owlDir);
            } catch (err) {
              console.error("[OpenOwl] Error finalizing session:", err);
            }
            break;
          }
        }
      } catch (err) {
        console.error("[OpenOwl] Error in event handler:", err);
      }
      await logWarnings(warnings);
    },

    "tool.execute.before": async (input, output) => {
      if (!owlReady) return;
      const warnings: string[] = [];
      try {
        await handleToolBefore(owlDir, projectRoot, input, output, warnings);
      } catch (err) {
        console.error("[OpenOwl] Error in tool.execute.before:", err);
      }
      await logWarnings(warnings);
    },

    "tool.execute.after": async (input, output) => {
      if (!owlReady) return;
      const warnings: string[] = [];
      try {
        await handleToolAfter(owlDir, projectRoot, input, output, warnings);
      } catch (err) {
        console.error("[OpenOwl] Error in tool.execute.after:", err);
      }

      if (warnings.length > 0 && typeof output.output === "string") {
        const prefix = "\n\n[OpenOwl] ";
        const warningText = warnings.map((w) => `${prefix}${w}`).join("\n");
        output.output = output.output + warningText;
      }

      await logWarnings(warnings);
    },

    "experimental.session.compacting": async (input, output) => {
      if (!owlReady) return;
      try {
        await handleSessionCompacted(owlDir, input.sessionID, output);
      } catch (err) {
        console.error("[OpenOwl] Error in session.compacting:", err);
      }
    },
  };
};

export default {
  id: "openowl" as const,
  server: OpenOwlPlugin,
};
