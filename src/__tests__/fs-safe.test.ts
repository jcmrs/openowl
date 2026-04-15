import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "owl-fs-safe-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import { readJSON, writeJSON, readText, writeText, appendText } from "../core/utils/fs-safe.js";

describe("fs-safe", () => {
  describe("readJSON", () => {
    it("returns parsed JSON from an existing file", () => {
      const filePath = path.join(tmpDir, "data.json");
      fs.writeFileSync(filePath, JSON.stringify({ a: 1, b: "hello" }));
      const result = readJSON(filePath, null);
      expect(result).toEqual({ a: 1, b: "hello" });
    });

    it("returns fallback when file does not exist", () => {
      const filePath = path.join(tmpDir, "missing.json");
      const result = readJSON(filePath, { default: true });
      expect(result).toEqual({ default: true });
    });
  });

  describe("readText", () => {
    it("returns file content from an existing file", () => {
      const filePath = path.join(tmpDir, "note.txt");
      fs.writeFileSync(filePath, "hello world");
      const result = readText(filePath);
      expect(result).toBe("hello world");
    });

    it("returns fallback when file does not exist", () => {
      const filePath = path.join(tmpDir, "missing.txt");
      const result = readText(filePath, "fallback-value");
      expect(result).toBe("fallback-value");
    });

    it("returns empty string as default fallback", () => {
      const filePath = path.join(tmpDir, "also-missing.txt");
      const result = readText(filePath);
      expect(result).toBe("");
    });
  });

  describe("writeJSON + readJSON round-trip", () => {
    it("round-trips data correctly", () => {
      const filePath = path.join(tmpDir, "roundtrip.json");
      const data = { name: "test", items: [1, 2, 3], nested: { a: true } };
      writeJSON(filePath, data);
      const result = readJSON(filePath, null);
      expect(result).toEqual(data);
    });

    it("creates intermediate directories", () => {
      const filePath = path.join(tmpDir, "sub", "dir", "deep.json");
      writeJSON(filePath, { ok: true });
      const result = readJSON(filePath, null);
      expect(result).toEqual({ ok: true });
    });
  });

  describe("writeText + readText round-trip", () => {
    it("round-trips text correctly", () => {
      const filePath = path.join(tmpDir, "text.txt");
      const content = "line one\nline two\nline three";
      writeText(filePath, content);
      const result = readText(filePath);
      expect(result).toBe(content);
    });

    it("creates intermediate directories", () => {
      const filePath = path.join(tmpDir, "a", "b", "file.md");
      writeText(filePath, "# Title");
      const result = readText(filePath);
      expect(result).toBe("# Title");
    });
  });

  describe("appendText", () => {
    it("appends to existing content", () => {
      const filePath = path.join(tmpDir, "log.txt");
      fs.writeFileSync(filePath, "first line\n");
      appendText(filePath, "second line\n");
      const result = readText(filePath);
      expect(result).toBe("first line\nsecond line\n");
    });

    it("creates file and intermediate directories if they do not exist", () => {
      const filePath = path.join(tmpDir, "newdir", "append.txt");
      appendText(filePath, "initial content");
      const result = readText(filePath);
      expect(result).toBe("initial content");
    });

    it("can append multiple times", () => {
      const filePath = path.join(tmpDir, "multi.txt");
      appendText(filePath, "a");
      appendText(filePath, "b");
      appendText(filePath, "c");
      expect(readText(filePath)).toBe("abc");
    });
  });
});
