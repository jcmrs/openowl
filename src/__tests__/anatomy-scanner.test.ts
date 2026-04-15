import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { serializeAnatomy } from "../core/scanner/anatomy-scanner.js";

describe("serializeAnatomy with directory summaries", () => {
  it("includes directory summaries when provided", () => {
    const sections = new Map<string, any[]>([
      ["src/", [
        { file: "index.ts", description: "Entry point", tokens: 100 },
        { file: "utils.ts", description: "Utility functions", tokens: 200 },
      ]],
      ["src/auth/", [
        { file: "login.ts", description: "Login handler", tokens: 300 },
      ]],
    ]);

    const dirSummaries = new Map<string, any>([
      ["src/", { summary: "Main source directory — core application logic", method: "llm" }],
      ["src/auth/", { summary: "Authentication and authorization module", method: "llm" }],
    ]);

    const result = serializeAnatomy(sections, {
      lastScanned: "2025-01-01T00:00:00Z",
      fileCount: 3,
      hits: 0,
      misses: 0,
    }, dirSummaries);

    expect(result).toContain("Main source directory");
    expect(result).toContain("Authentication and authorization module");
    expect(result).toContain("`src/index.ts`");
    expect(result).toContain("`src/auth/login.ts`");
  });

  it("omits empty directory summaries", () => {
    const sections = new Map<string, any[]>([
      ["src/", [
        { file: "index.ts", description: "Entry point", tokens: 100 },
      ]],
    ]);

    const dirSummaries = new Map<string, any>([
      ["src/", { summary: "", method: "heuristic" }],
    ]);

    const result = serializeAnatomy(sections, {
      lastScanned: "2025-01-01T00:00:00Z",
      fileCount: 1,
      hits: 0,
      misses: 0,
    }, dirSummaries);

    const lines = result.split("\n");
    const srcHeadingIdx = lines.indexOf("## src/");
    const nextNonEmpty = lines.slice(srcHeadingIdx + 1).find((l: string) => l.trim());
    expect(nextNonEmpty).toMatch(/^- `/);
  });

  it("works without dirSummaries parameter", () => {
    const sections = new Map<string, any[]>([
      ["src/", [
        { file: "index.ts", description: "Entry point", tokens: 100 },
      ]],
    ]);

    const result = serializeAnatomy(sections, {
      lastScanned: "2025-01-01T00:00:00Z",
      fileCount: 1,
      hits: 0,
      misses: 0,
    });

    expect(result).toContain("`src/index.ts`");
    expect(result).toContain("Entry point");
  });

  it("sorts directories alphabetically", () => {
    const sections = new Map<string, any[]>([
      ["z-last/", [{ file: "z.ts", description: "last", tokens: 10 }]],
      ["a-first/", [{ file: "a.ts", description: "first", tokens: 10 }]],
      ["m-middle/", [{ file: "m.ts", description: "middle", tokens: 10 }]],
    ]);

    const result = serializeAnatomy(sections, {
      lastScanned: "2025-01-01T00:00:00Z",
      fileCount: 3,
      hits: 0,
      misses: 0,
    });

    const aIdx = result.indexOf("## a-first/");
    const mIdx = result.indexOf("## m-middle/");
    const zIdx = result.indexOf("## z-last/");
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it("sorts files within directories alphabetically", () => {
    const sections = new Map<string, any[]>([
      ["src/", [
        { file: "zebra.ts", description: "last", tokens: 10 },
        { file: "apple.ts", description: "first", tokens: 10 },
      ]],
    ]);

    const result = serializeAnatomy(sections, {
      lastScanned: "2025-01-01T00:00:00Z",
      fileCount: 2,
      hits: 0,
      misses: 0,
    });

    const appleIdx = result.indexOf("`src/apple.ts`");
    const zebraIdx = result.indexOf("`src/zebra.ts`");
    expect(appleIdx).toBeLessThan(zebraIdx);
  });
});
