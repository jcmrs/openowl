import * as path from "node:path";
import { execSync } from "node:child_process";

export interface DescriptionResult {
  file: string;
  description: string;
  success: boolean;
  method: "llm" | "heuristic";
}

interface FileContext {
  filePath: string;
  content: string;
  relativePath: string;
}

export function generateDescriptions(
  files: FileContext[],
  projectRoot: string,
  batch: number = 20
): DescriptionResult[] {
  const results: DescriptionResult[] = [];

  if (files.length === 0) return results;

  if (!hasOpenCode()) {
    for (const f of files) {
      results.push({
        file: f.relativePath,
        description: generateHeuristicDescription(f.content, f.filePath),
        success: false,
        method: "heuristic",
      });
    }
    console.warn("[OpenOwl] opencode not available. Using heuristic descriptions.");
    return results;
  }

  for (let i = 0; i < files.length; i += batch) {
    const batchFiles = files.slice(i, i + batch);
    const batchDescriptions = generateLLMDescriptions(batchFiles, projectRoot);
    results.push(...batchDescriptions);
  }

  return results;
}

export function generateDirectorySummary(
  dirPath: string,
  files: FileContext[],
  projectRoot: string
): DescriptionResult {
  if (files.length === 0) {
    return { file: dirPath, description: "", success: false, method: "heuristic" };
  }

  if (!hasOpenCode()) {
    return {
      file: dirPath,
      description: `${files.length} files in directory`,
      success: false,
      method: "heuristic",
    };
  }

  const fileList = files.map((f) => `${f.relativePath} (${f.content.split("\n").length} lines)`).join("\n");
  const prompt = `Describe this directory in one concise line (what it contains, its role in the project). Be specific about the domain.\n\nDirectory: ${dirPath}\nFiles:\n${fileList}`;

  try {
    const output = execSync(
      `opencode -p --output-format text "${prompt.replace(/"/g, '\\"')}"`,
      { timeout: 30000, encoding: "utf-8", cwd: projectRoot }
    );
    const description = output.trim().split("\n")[0]?.trim() || "";
    if (description) {
      return { file: dirPath, description, success: true, method: "llm" };
    }
  } catch (err) {
    console.error(`[OpenOwl] LLM description failed for ${dirPath}:`, err);
  }

  return {
    file: dirPath,
    description: `${files.length} files in directory`,
    success: false,
    method: "heuristic",
  };
}

function hasOpenCode(): boolean {
  try {
    execSync("opencode --version", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function generateLLMDescriptions(files: FileContext[], projectRoot: string): DescriptionResult[] {
  const fileList = files.map((f) => {
    const lines = f.content.split("\n");
    const preview = lines.slice(0, 15).join("\n");
    return `${f.relativePath}:\n\`\`\`\n${preview}\n\`\`\`\n`;
  }).join("\n---\n");

  const prompt = `For each file below, write a ONE-LINE description of what the file does. Be specific about its role, the API it provides, or the data it manages. Format: filename — description.\n\n${fileList}\n\nRespond with one line per file, nothing else.`;

  try {
    const output = execSync(
      `opencode -p --output-format text "${prompt.replace(/"/g, '\\"')}"`,
      { timeout: 60000, encoding: "utf-8", cwd: projectRoot }
    );
    const lines = output.trim().split("\n").filter((l: string) => l.includes(" — ") || l.includes(": "));
    const results: DescriptionResult[] = [];

    for (const line of lines) {
      const match = line.match(/^[-*]?\s*`?([^`]+)`?\s*[—:]\s*(.+)/);
      if (match) {
        const file = match[1].trim();
        const description = match[2].trim();
        const fileEntry = files.find((f) => f.relativePath === file || f.filePath.endsWith(file));
        results.push({
          file: fileEntry?.relativePath ?? file,
          description: description.slice(0, 100),
          success: true,
          method: "llm",
        });
      }
    }

    if (results.length < files.length) {
      const described = new Set(results.map((r) => r.file));
      for (const f of files) {
        if (!described.has(f.relativePath)) {
          results.push({
            file: f.relativePath,
            description: generateHeuristicDescription(f.content, f.filePath),
            success: false,
            method: "heuristic",
          });
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[OpenOwl] LLM batch failed, falling back to heuristic:", err);
    return files.map((f) => ({
      file: f.relativePath,
      description: generateHeuristicDescription(f.content, f.filePath),
      success: false,
      method: "heuristic",
    }));
  }
}

export function generateHeuristicDescription(content: string, filePath: string): string {
  const lines = content.split("\n");
  const ext = path.extname(filePath).toLowerCase();

  const exports: string[] = [];
  const imports: string[] = [];
  let hasDefaultExport = false;

  for (const line of lines.slice(0, 50)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    const exportMatch = trimmed.match(/^export\s+(?:default\s+)?(?:function|class|const|let|type|interface|enum)\s+(\w+)/);
    if (exportMatch) {
      exports.push(exportMatch[1]);
      if (trimmed.includes("export default")) hasDefaultExport = true;
    }

    const importMatch = trimmed.match(/^import\s+.*(?:from\s+['"]([^'"]+)['"]|require\s*\(['"]([^'"]+)['"]\))/);
    if (importMatch) {
      const mod = (importMatch[1] || importMatch[2]).replace(/\/.*$/, "").replace(/\.js$/, "");
      if (mod) imports.push(mod);
    }
  }

  const parts: string[] = [];
  if (exports.length > 0) parts.push(`exports ${exports.slice(0, 3).join(", ")}`);
  if (hasDefaultExport) parts.push("default export");
  if (imports.length > 0) parts.push(`imports from ${imports.slice(0, 2).join(", ")}`);

  if (parts.length > 0) return parts.join("; ");

  const knownFiles: Record<string, string> = {
    ".ts": "TypeScript module",
    ".tsx": "React component",
    ".js": "JavaScript module",
    ".py": "Python module",
    ".rs": "Rust module",
    ".go": "Go module",
    ".java": "Java class",
    ".rb": "Ruby module",
    ".php": "PHP file",
    ".vue": "Vue component",
    ".svelte": "Svelte component",
    ".astro": "Astro page",
  };

  if (knownFiles[ext]) return knownFiles[ext];

  return path.basename(filePath);
}
