export interface RelevanceOptions {
  maxFileEntries: number;
  includeFilesPattern?: RegExp;
}

export interface RelevanceResult {
  directorySummaries: string[];
  fileEntries: string[];
}

export function selectRelevantEntries(
  anatomyContent: string,
  options: RelevanceOptions = { maxFileEntries: 15 }
): RelevanceResult {
  if (!anatomyContent || anatomyContent.includes("Pending initial scan")) {
    return { directorySummaries: [], fileEntries: [] };
  }

  const lines = anatomyContent.split("\n");
  const directorySummaries: string[] = [];
  const allFileEntries: Array<{ line: string; tokens: number; dir: string }> = [];
  let currentDir = "";
  let dirSummaryLines: string[] = [];

  for (const line of lines) {
    const dirMatch = line.match(/^##\s+(.+)/);
    if (dirMatch) {
      if (currentDir && dirSummaryLines.length > 0) {
        const summary = dirSummaryLines.join(" ").trim();
        if (summary) {
          directorySummaries.push(`**${currentDir}** — ${summary}`);
        }
      }
      currentDir = dirMatch[1].replace(/`/g, "").trim();
      dirSummaryLines = [];
      continue;
    }

    if (!currentDir) continue;

    const fileMatch = line.match(/^- `([^`]+)`(?:\s+—\s+(.+?))?\s*\(~(\d+)\s+tok\)$/);
    if (fileMatch) {
      const tokens = parseInt(fileMatch[3], 10);
      allFileEntries.push({ line, tokens, dir: currentDir });
    } else if (line.trim() && !line.startsWith("-") && !line.startsWith(">") && !line.startsWith("#")) {
      dirSummaryLines.push(line.trim());
    }
  }

  if (currentDir && dirSummaryLines.length > 0) {
    const summary = dirSummaryLines.join(" ").trim();
    if (summary) {
      directorySummaries.push(`**${currentDir}** — ${summary}`);
    }
  }

  allFileEntries.sort((a, b) => b.tokens - a.tokens);
  const selectedFileEntries = allFileEntries
    .slice(0, options.maxFileEntries)
    .map((e) => e.line);

  return { directorySummaries, fileEntries: selectedFileEntries };
}

export function selectRelevantBugs(
  buglogContent: string,
  relevantFiles: string[]
): string[] {
  if (!buglogContent) return [];

  try {
    const data = JSON.parse(buglogContent);
    const bugs = data.bugs ?? [];
    const openBugs = bugs.filter((b: any) => !b.fix || b.fix === "unknown");

    if (openBugs.length === 0) return [];

    const relevantSet = new Set(relevantFiles);
    const matched = openBugs.filter((b: any) => relevantSet.has(b.file));

    const display = matched.length > 0 ? matched : openBugs.slice(0, 3);
    return display.slice(0, 5).map((b: any) => {
      let entry = `- [${b.id}] ${b.file}: ${b.error_message.slice(0, 80)}`;
      if (b.occurrences > 1) entry += ` (${b.occurrences}x)`;
      return entry;
    });
  } catch {
    return [];
  }
}
