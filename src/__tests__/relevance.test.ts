import { describe, it, expect } from "vitest";
import { selectRelevantEntries } from "../plugin/injection/relevance.js";

describe("selectRelevantEntries", () => {
  const anatomyContent = `# anatomy.md

## src/
Main source directory — core application logic

- \`index.ts\` — Application entry point (~150 tok)
- \`utils.ts\` — Utility functions (~80 tok)
- \`config.ts\` — Configuration loader (~200 tok)

## src/auth/
Authentication and authorization module

- \`login.ts\` — Login handler (~350 tok)
- \`oauth.ts\` — OAuth2 provider (~280 tok)
- \`session.ts\` — Session management (~120 tok)

## src/components/
Shared UI component library

- \`Button.tsx\` — Reusable button (~90 tok)
- \`Modal.tsx\` — Modal dialog (~180 tok)
- \`Input.tsx\` — Form input (~60 tok)`;

  it("extracts directory summaries", () => {
    const result = selectRelevantEntries(anatomyContent);
    expect(result.directorySummaries).toHaveLength(3);
    expect(result.directorySummaries[0]).toContain("Main source directory");
    expect(result.directorySummaries[1]).toContain("Authentication and authorization");
    expect(result.directorySummaries[2]).toContain("Shared UI component library");
  });

  it("selects files sorted by token count (highest first)", () => {
    const result = selectRelevantEntries(anatomyContent, { maxFileEntries: 3 });
    expect(result.fileEntries).toHaveLength(3);
    expect(result.fileEntries[0]).toContain("login.ts");
    expect(result.fileEntries[1]).toContain("oauth.ts");
    expect(result.fileEntries[2]).toContain("config.ts");
  });

  it("respects maxFileEntries limit", () => {
    const result = selectRelevantEntries(anatomyContent, { maxFileEntries: 2 });
    expect(result.fileEntries).toHaveLength(2);
  });

  it("returns empty for pending scan content", () => {
    const result = selectRelevantEntries("# anatomy.md\n\n> Pending initial scan.\n");
    expect(result.directorySummaries).toHaveLength(0);
    expect(result.fileEntries).toHaveLength(0);
  });

  it("returns empty for empty content", () => {
    const result = selectRelevantEntries("");
    expect(result.directorySummaries).toHaveLength(0);
    expect(result.fileEntries).toHaveLength(0);
  });

  it("returns empty for null/undefined", () => {
    const result = selectRelevantEntries(null as any);
    expect(result.directorySummaries).toHaveLength(0);
    expect(result.fileEntries).toHaveLength(0);
  });

  it("handles directories without summaries", () => {
    const content = `# anatomy.md

## src/
- \`a.ts\` — desc (~100 tok)
- \`b.ts\` — desc (~50 tok)`;

    const result = selectRelevantEntries(content);
    expect(result.directorySummaries).toHaveLength(0);
    expect(result.fileEntries).toHaveLength(2);
  });

  it("filters out metadata lines from summaries", () => {
    const content = `# anatomy.md

## src/
> Auto-maintained
Core module

- \`a.ts\` — desc (~100 tok)`;

    const result = selectRelevantEntries(content);
    expect(result.directorySummaries).toHaveLength(1);
    expect(result.directorySummaries[0]).toContain("Core module");
  });
});
