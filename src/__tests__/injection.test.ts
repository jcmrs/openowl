import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-inj-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { buildInjectionContext, invalidateInjectionCache } from "../plugin/injection/build-context.js";

function writeOwlFile(name: string, content: string): void {
  fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
}

describe("buildInjectionContext", () => {
  beforeEach(() => {
    invalidateInjectionCache();
  });

  it("returns empty string when disabled", () => {
    writeOwlFile("cerebrum.md", "## Do-Not-Repeat\n- test entry");
    const result = buildInjectionContext(tmpDir, tmpDir, { enabled: false });
    expect(result).toBe("");
  });

  it("builds project section from package.json", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "test-project",
      description: "A test project",
    }));
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: true,
      include_dnr: false,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).toContain("## Project: test-project");
    expect(result).toContain("A test project");
    expect(result).toContain("<owl-context>");
    expect(result).toContain("</owl-context>");
  });

  it("builds DNR section from tagged cerebrum", () => {
    writeOwlFile("cerebrum.md", `## Do-Not-Repeat
- [react/hooks] 2025-01-15: Use useReducer not useState
- [api/auth] 2025-01-18: Don't catch errors silently
- [general] 2025-01-20: Always validate inputs`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: true,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).toContain("## Do-Not-Repeat");
    expect(result).toContain("[react/hooks] 2025-01-15");
    expect(result).toContain("[api/auth] 2025-01-18");
    expect(result).toContain("[general] 2025-01-20");
  });

  it("builds DNR section from legacy cerebrum format", () => {
    writeOwlFile("cerebrum.md", `## Do-Not-Repeat
- Never use var, always use const
- Don't mutate props directly
- Always handle promise rejections`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: true,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).toContain("## Do-Not-Repeat");
    expect(result).toContain("Never use var");
    expect(result).toContain("Don't mutate props");
  });

  it("builds conventions section from tagged cerebrum", () => {
    writeOwlFile("cerebrum.md", `## Key Learnings
- [project] Tests go in __tests__/
- [style] Use named exports
- [project] Use pnpm not npm`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: true,
      include_anatomy: false,
      include_bugs: false,
    });
    expect(result).toContain("## Key Conventions");
    expect(result).toContain("[project]");
  });

  it("builds anatomy section from populated anatomy", () => {
    writeOwlFile("anatomy.md", `# anatomy.md

## src/
Root source directory

## src/auth/
Authentication module — JWT, OAuth2, session management

- \`jwt.ts\` — JWT token validation and refresh (~450 tok)
- \`oauth.ts\` — OAuth2 provider integration (~380 tok)

## src/components/
UI component library

- \`Button.tsx\` — Reusable button component (~120 tok)`);
    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      include_project: false,
      include_dnr: false,
      include_conventions: false,
      include_anatomy: true,
      include_bugs: false,
    });
    expect(result).toContain("## File Index");
    expect(result).toContain("**src/auth/**");
    expect(result).toContain("Authentication module");
    expect(result).toContain("`jwt.ts`");
  });

  it("returns empty anatomy when pending scan", () => {
    writeOwlFile("anatomy.md", "# anatomy.md\n\n> Pending initial scan.\n");
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

  it("builds bugs section from buglog", () => {
    writeOwlFile("buglog.json", JSON.stringify({
      version: 1,
      bugs: [
        { id: "bug-1", error_message: "Cannot find module foo", file: "src/index.ts", fix: "", tags: ["import"], occurrences: 3 },
        { id: "bug-2", error_message: "Type mismatch on auth", file: "src/auth.ts", fix: "Fix type", tags: ["type"], occurrences: 1 },
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
    expect(result).toContain("## Active Bugs");
    expect(result).toContain("[bug-1]");
    expect(result).toContain("(3x)");
  });

  it("respects token budget by trimming", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "x".repeat(1000),
      description: "y".repeat(1000),
    }));
    writeOwlFile("cerebrum.md", "## Do-Not-Repeat\n" + "- [z] ".repeat(500) + ": test\n");
    writeOwlFile("anatomy.md", "## src/\n" + "- `a.ts` — desc (~10 tok)\n".repeat(200));

    const result = buildInjectionContext(tmpDir, tmpDir, {
      enabled: true,
      max_tokens: 200,
      include_project: false,
      include_dnr: true,
      include_conventions: false,
      include_anatomy: false,
      include_bugs: false,
    });
    const estimatedTokens = Math.ceil(result.length / 3.5);
    expect(estimatedTokens).toBeLessThanOrEqual(250);
    expect(result).toContain("truncated for token budget");
  });

  it("handles missing files gracefully", () => {
    const result = buildInjectionContext(tmpDir, tmpDir);
    expect(result).toContain("<owl-context>");
    expect(result).toContain("</owl-context>");
  });
});
