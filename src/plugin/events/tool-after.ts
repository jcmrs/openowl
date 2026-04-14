import * as path from "node:path";
import { updateAnatomyAfterWrite } from "../context/anatomy-updater.js";
import { logToMemory } from "../context/memory-logger.js";
import { estimateTokens } from "../context/token-tracker.js";
import { detectBugFix, autoLogBug } from "../context/bug-detector.js";
import { readSession, writeSession, resolveReadByCallID } from "../context/session-manager.js";

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
    const filePath = input.args?.path ?? input.args?.file_path ?? "";
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
    const filePath = input.args?.path ?? input.args?.file_path ?? "";
    if (!filePath) return;

    try {
      updateAnatomyAfterWrite(owlDir, filePath, projectRoot);
    } catch (err) {
      console.error("[OpenOwl] Failed to update anatomy:", err);
    }

    const content = input.args?.content ?? input.args?.new_string ?? "";
    const tokens = estimateTokens(content, filePath);
    const summary = path.basename(filePath);

    logToMemory(owlDir, `edited ${summary}`, filePath, "written", tokens);

    const editCount = session.edits_by_file[filePath] ?? 0;
    if (editCount >= 3) {
      warnings.push(`MULTI-EDIT: ${filePath} has been edited ${editCount} times this session — this may indicate a bug`);
    }

    const oldContent = input.args?.old_string ?? "";
    if (content) {
      const bugResult = detectBugFix(filePath, content, oldContent);
      if (bugResult.detected) {
        autoLogBug(owlDir, filePath, bugResult);
        warnings.push(`BUG DETECTED: ${bugResult.summary}`);
      }
    }
  }
}
