import * as path from "node:path";
import { updateAnatomyAfterWrite } from "../context/anatomy-updater.js";
import { logToMemory } from "../context/memory-logger.js";
import { estimateTokens } from "../context/token-tracker.js";
import { readSession, writeSession, resolveReadByCallID, recordWrite } from "../context/session-manager.js";
import { appendCerebrumEntry } from "../context/cerebrum-logger.js";
import { summarizeEdit } from "../context/edit-summarizer.js";

interface ToolAfterInput {
  tool: string;
  sessionID: string;
  callID: string;
  args: any;
}

interface ToolAfterOutput {
  title: string;
  output: string;
  metadata: any;
}

export async function handleToolAfter(
  owlDir: string,
  projectRoot: string,
  input: ToolAfterInput,
  output: ToolAfterOutput,
  warnings: string[]
): Promise<void> {
  const session = readSession(owlDir);
  if (!session) return;

  if (input.tool === "read") {
    const filePath = input.args?.filePath ?? "";
    if (!filePath) return;

    const outputContent = output?.output ?? "";
    if (outputContent) {
      const tokens = estimateTokens(outputContent, filePath);
      resolveReadByCallID(session, input.callID, filePath, tokens);
      writeSession(owlDir, session);
    }
    return;
  }

  if (input.tool === "write" || input.tool === "edit") {
    const filePath = input.args?.filePath ?? "";
    if (!filePath) return;

    try {
      updateAnatomyAfterWrite(owlDir, filePath, projectRoot);
    } catch (err) {
      console.error("[OpenOwl] Failed to update anatomy:", err);
    }

    const content = input.args?.content ?? input.args?.newString ?? "";
    const tokens = estimateTokens(content, filePath);
    const basename = path.basename(filePath);
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");

    let outcome: string;
    let action: string;
    if (input.tool === "edit") {
      const oldContent = input.args?.oldString ?? "";
      outcome = (oldContent && content) ? summarizeEdit(oldContent, content, basename) : "\u2014";
      action = `Edited ${basename}`;
    } else {
      outcome = `\u2014`;
      action = `Created ${basename}`;
    }

    logToMemory(owlDir, action, relativePath, outcome, tokens);

    recordWrite(session, filePath, `${input.tool} on ${path.basename(filePath)}`, tokens);
    writeSession(owlDir, session);

    const editCount = session.edits_by_file[filePath] ?? 0;
    if (editCount === 3 && !session.churn_warned_files.includes(filePath)) {
      warnings.push(`MULTI-EDIT: ${filePath} has been edited ${editCount} times this session — this may indicate a bug`);
      appendCerebrumEntry(owlDir, "key-learnings", "auto", `${path.basename(filePath)} edited ${editCount} times this session — possible instability`);
      session.churn_warned_files.push(filePath);
      writeSession(owlDir, session);
    }
  }
}
