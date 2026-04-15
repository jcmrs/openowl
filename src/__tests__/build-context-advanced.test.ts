import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-ctx-adv-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { buildInjectionContext } from "../plugin/injection/build-context.js";

function writeOwlFile(name: string, content: string): void {
  fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
}

describe("buildInjectionContext advanced edge cases", () => {
  it("extracts entries from legacy cerebrum format without [scope] tags", () => {
    writeOwlFile("cerebrum.md", `## Key Learnings
- Always use TypeScript strict mode
- Prefer named exports over default exports
- Never mutate function parameters

## User Preferences
- Keep functions under 30 lines
- Use early returns for guard clauses
`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: true,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).toContain("## Key Conventions");
    expect(result).toContain("Always use TypeScript strict mode");
    expect(result).toContain("Prefer named exports over default exports");
  });

  it("returns empty anatomy section for anatomy.md with only header", () => {
    writeOwlFile("anatomy.md", `# anatomy.md\n`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: false,
      include_anatomy: true,
      include_bugs: false,
    });
    expect(result).not.toContain("## File Index");
  });

  it("returns empty bugs section when all bugs are fixed", () => {
    writeOwlFile("buglog.json", JSON.stringify({
      version: 1,
      bugs: [
        { id: "bug-1", error_message: "Type mismatch", file: "src/a.ts", fix: "Added type cast", tags: ["type"], occurrences: 2 },
        { id: "bug-2", error_message: "Missing import", file: "src/b.ts", fix: "Added import statement", tags: ["import"], occurrences: 1 },
        { id: "bug-3", error_message: "Null reference", file: "src/c.ts", fix: "Added null check", tags: ["null"], occurrences: 5 },
      ],
    }));
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: true,
    });
    expect(result).not.toContain("## Active Bugs");
  });

  it("returns minimal output when all sections are disabled", () => {
    writeOwlFile("cerebrum.md", "## Do-Not-Repeat\n- [test] 2025-01-01: some entry");
    writeOwlFile("anatomy.md", "## src/\n- `a.ts` — desc (~10 tok)\n");
    writeOwlFile("buglog.json", JSON.stringify({
      version: 1,
      bugs: [{ id: "bug-1", error_message: "err", file: "f.ts", fix: "", tags: [], occurrences: 1 }],
    }));
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));

    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).not.toContain("## Project");
    expect(result).not.toContain("## Do-Not-Repeat");
    expect(result).not.toContain("## Key Conventions");
    expect(result).not.toContain("## File Index");
    expect(result).not.toContain("## Active Bugs");
  });
});
