import type { Plugin } from "@opencode-ai/plugin";
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

let injectionAvailable: boolean | null = null;

export const OpenOwlPlugin: Plugin = async (ctx) => {
  const projectRoot = ctx.directory ?? findProjectRoot();
  const owlDir = getOwlDir(projectRoot);

  const fullConfig = readJSON<Record<string, unknown>>(path.join(owlDir, "config.json"), {});
  const owlConfig = (fullConfig.openowl ?? {}) as Record<string, unknown>;
  const { config: injectionConfig, warnings: configWarnings } = validateInjectionConfig(
    (owlConfig.injection ?? {}) as Record<string, unknown>
  );

  for (const w of configWarnings) {
    console.warn(`[OpenOwl] ${w}`);
  }

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

  function handleSystemTransform(
    input: { sessionID?: string; model: any },
    output: { system: string[] }
  ): void {
    if (!injectionConfig.enabled) return;
    if (injectionAvailable === false) return;

    try {
      const block = buildInjectionContext(owlDir, projectRoot, injectionConfig);
      if (block) {
        output.system.push(block);
        if (injectionAvailable === null) {
          injectionAvailable = true;
          console.log("[OpenOwl] System prompt injection active");
        }
      }
    } catch (err) {
      if (injectionAvailable === null) {
        console.error("[OpenOwl] System prompt injection failed, falling back to file-based:", err);
        injectionAvailable = false;
      }
    }
  }

  return {
    "experimental.chat.system.transform": async (input, output) => {
      handleSystemTransform(input, output);
    },

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

      if (warnings.length > 0 && typeof output.output === "string") {
        const prefix = "\n\n[OpenOwl] ";
        const warningText = warnings.map((w) => `${prefix}${w}`).join("\n");
        output.output = output.output + warningText;
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

import * as path from "node:path";
