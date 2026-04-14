import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateHeuristicDescription } from "../core/scanner/description-generator.js";

describe("generateHeuristicDescription", () => {
  it("extracts exports from TypeScript", () => {
    const content = `import express from "express";

export function createUser(req: Request, res: Response) {
  return res.send("ok");
}

export class UserService {
  private users: Map<string, User>;
  constructor() {
    this.users = new Map();
  }
  async findUser(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}`;
    const result = generateHeuristicDescription(content, "/project/src/service.ts");
    expect(result).toContain("exports");
    expect(result).toContain("createUser");
  });

  it("extracts imports", () => {
    const content = `import { z } from "zod";
import { prisma } from "./db.js";

const schema = z.object({ name: z.string() });`;
    const result = generateHeuristicDescription(content, "/project/src/schema.ts");
    expect(result).toContain("imports from");
  });

  it("detects default export", () => {
    const content = `export default function App() {
  return <div>Hello</div>;
}`;
    const result = generateHeuristicDescription(content, "/project/src/App.tsx");
    expect(result).toContain("default export");
  });

  it("falls back to extension-based description", () => {
    const content = `some random text without exports or imports`;
    const result = generateHeuristicDescription(content, "/project/src/random.ts");
    expect(result).toBe("TypeScript module");
  });

  it("falls back to filename for unknown extensions", () => {
    const content = `random content`;
    const result = generateHeuristicDescription(content, "/project/src/data.xyz");
    expect(result).toBe("data.xyz");
  });

  it("handles empty content", () => {
    const result = generateHeuristicDescription("", "/project/src/empty.ts");
    expect(result).toBe("TypeScript module");
  });

  it("detects React component by extension", () => {
    const content = `some content`;
    const result = generateHeuristicDescription(content, "/project/src/Button.tsx");
    expect(result).toBe("React component");
  });

  it("skips comment-only lines", () => {
    const content = `// This is a comment
/* Multi-line
   comment */
// Another comment
export function real() {}`;
    const result = generateHeuristicDescription(content, "/project/src/real.ts");
    expect(result).toContain("exports real");
  });

  it("caps exports list to 3", () => {
    const content = `export function a() {}
export function b() {}
export function c() {}
export function d() {}`;
    const result = generateHeuristicDescription(content, "/project/src/many.ts");
    expect(result).toContain("a, b, c");
    expect(result).not.toContain("d");
  });
});
