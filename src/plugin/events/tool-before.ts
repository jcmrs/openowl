import * as path from "node:path";
import { checkAnatomy } from "../context/anatomy-guard.js";
import { checkBuglog } from "../context/buglog-guard.js";
import { extractDoNotRepeatPatterns, checkDoNotRepeat } from "../context/cerebrum-guard.js";
import { initSession, readSession, recordRead, recordWrite, writeSession } from "../context/session-manager.js";
import { estimateTokens } from "../context/token-tracker.js";

interface ToolBeforeInput {
  tool: string;
  sessionID: string;
  callID: string;
}

interface ToolBeforeOutput {
  args: any;
}

export async function handleToolBefore(
  owlDir: string,
  projectRoot: string,
  input: ToolBeforeInput,
  output: ToolBeforeOutput,
  warnings: string[]
): Promise<void> {
  const session = readSession(owlDir);
  if (!session) {
    initSession(owlDir, input.sessionID);
    return;
  }

  const args = output?.args ?? {};

  if (input.tool === "read") {
    const filePath = args?.filePath ?? "";
    if (!filePath) return;

    const result = checkAnatomy(owlDir, projectRoot, filePath, new Set(session.reads.map((r) => r.file_path)));

    if (result.isOwlFile) return;

    if (result.alreadyRead) {
      warnings.push(`ALREADY READ: ${filePath} was read earlier this session`);
      return;
    }

    recordRead(session, filePath, result.anatomyHit, result.tokenEstimate, input.callID);
    writeSession(owlDir, session);
    return;
  }

  if (input.tool === "write" || input.tool === "edit") {
    const filePath = args?.filePath ?? "";
    const content = args?.content ?? args?.newString ?? "";

    if (!filePath) return;

    const bugCheck = checkBuglog(owlDir, filePath);
    if (bugCheck.similarBugs.length > 0) {
      warnings.push(`BUGLOG: ${bugCheck.similarBugs.length} similar bug(s) on record for ${filePath}`);
    }

    const dnrPatterns = extractDoNotRepeatPatterns(owlDir);
    if (dnrPatterns.length > 0) {
      const match = checkDoNotRepeat(content, dnrPatterns, filePath);
      if (match) {
        warnings.push(`CEREBRUM DNR: This change may repeat a known mistake: "${match.line}"`);
      }
    }

    const estimatedTokens = estimateTokens(content, filePath);
    recordWrite(session, filePath, `${input.tool} on ${path.basename(filePath)}`, estimatedTokens);
    writeSession(owlDir, session);
  }
}
