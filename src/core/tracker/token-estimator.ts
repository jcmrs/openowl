import * as path from "node:path";

const CODE_EXTS = new Set([
  ".ts", ".js", ".tsx", ".jsx", ".py", ".rs", ".go", ".java",
  ".c", ".cpp", ".h", ".css", ".scss", ".sql", ".sh", ".yaml",
  ".yml", ".json", ".toml", ".xml",
]);

const PROSE_EXTS = new Set([".md", ".txt", ".rst", ".adoc"]);

export type ContentType = "code" | "prose" | "mixed";

export function detectContentType(filePath: string): ContentType {
  const ext = path.extname(filePath).toLowerCase();
  if (CODE_EXTS.has(ext)) return "code";
  if (PROSE_EXTS.has(ext)) return "prose";
  return "mixed";
}

export function estimateTokens(
  text: string,
  type: ContentType = "mixed",
  ratios?: { code: number; prose: number; mixed: number }
): number {
  const codeRatio = ratios?.code ?? 3.0;
  const proseRatio = ratios?.prose ?? 3.8;
  const mixedRatio = ratios?.mixed ?? 3.4;
  const ratio = type === "code" ? codeRatio : type === "prose" ? proseRatio : mixedRatio;
  return Math.ceil(text.length / ratio);
}

export function estimateTokensForFile(
  text: string,
  filePath: string,
  ratios?: { code: number; prose: number; mixed: number }
): number {
  return estimateTokens(text, detectContentType(filePath), ratios);
}
