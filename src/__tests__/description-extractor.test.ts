import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-desc-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { extractDescription, capDescription } from "../core/scanner/description-extractor.js";

function writeTmpFile(filename: string, content: string): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("extractDescription", () => {
  it("extracts from TypeScript file with JSDoc comment", () => {
    const filePath = writeTmpFile("service.ts", `/**
 * Handles user authentication and session management
 * @module auth
 */
export function login() {}
`);
    const result = extractDescription(filePath);
    expect(result.toLowerCase()).toContain("handles user authentication");
  });

  it("extracts from TypeScript file with no comments via exports", () => {
    const filePath = writeTmpFile("utils.ts", `import { z } from "zod";

export function parseInput(input: string) {
  return JSON.parse(input);
}

export function formatDate(d: Date) {
  return d.toISOString();
}
`);
    const result = extractDescription(filePath);
    expect(result).toContain("Exports");
    expect(result).toContain("parseInput");
  });

  it("extracts from Python file with docstring", () => {
    const filePath = writeTmpFile("models.py", `"""Database models for the application."""

class User:
    pass
`);
    const result = extractDescription(filePath);
    expect(result).toContain("Database models");
  });

  it("extracts from Go file with package comment", () => {
    const filePath = writeTmpFile("server.go", `// Package main provides the HTTP server for the application
package main

import "fmt"

func main() {
    fmt.Println("hello")
}
`);
    const result = extractDescription(filePath);
    expect(result).toContain("HTTP server");
  });

  it("extracts from Rust file with doc comment", () => {
    const filePath = writeTmpFile("lib.rs", `//! Core library for data processing

/// Parses the input string into tokens
pub fn parse(input: &str) -> Vec<&str> {
    input.split(' ').collect()
}
`);
    const result = extractDescription(filePath);
    expect(result).toContain("Core library");
  });

  it("returns empty string for empty file", () => {
    const filePath = writeTmpFile("empty.ts", "");
    const result = extractDescription(filePath);
    expect(result).toBe("");
  });

  it("returns empty string for non-existent file path", () => {
    const result = extractDescription(path.join(tmpDir, "does-not-exist.ts"));
    expect(result).toBe("");
  });

  it("returns empty string for binary-like extension", () => {
    const filePath = writeTmpFile("image.png", `\x89PNG\r\n\x1a\n\x00\x00\x00`);
    const result = extractDescription(filePath);
    expect(result).toBe("");
  });

  it("caps very long description to max length", () => {
    const longText = "A".repeat(300);
    const capped = capDescription(longText);
    expect(capped.length).toBeLessThanOrEqual(150);
    expect(capped).toBe("A".repeat(147) + "...");
  });

  it("returns empty string for file with only imports", () => {
    const filePath = writeTmpFile("imports.ts", `import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { User } from "./types.js";
`);
    const result = extractDescription(filePath);
    expect(result).toBe("");
  });
});
