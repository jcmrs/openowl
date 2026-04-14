import { estimateTokensForFile } from "../../core/tracker/token-estimator.js";

export function estimateTokens(content: string, filePath: string): number {
  return estimateTokensForFile(content, filePath);
}
