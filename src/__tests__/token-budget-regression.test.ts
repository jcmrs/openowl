import { describe, it, expect } from "vitest";
import { validateInjectionConfig } from "../plugin/injection/token-budget.js";

describe("token-budget D-01 regression", () => {
  it("returns explicit values when enabled:false and max_tokens:500", () => {
    const { config, warnings } = validateInjectionConfig({ enabled: false, max_tokens: 500 });
    expect(config.enabled).toBe(false);
    expect(config.max_tokens).toBe(500);
    expect(warnings).toHaveLength(0);
  });

  it("returns explicit values when enabled:true and max_tokens:8000", () => {
    const { config, warnings } = validateInjectionConfig({ enabled: true, max_tokens: 8000 });
    expect(config.enabled).toBe(true);
    expect(config.max_tokens).toBe(8000);
    expect(warnings).toHaveLength(0);
  });

  it("returns all defaults for empty object", () => {
    const { config, warnings } = validateInjectionConfig({});
    expect(config.enabled).toBe(true);
    expect(config.max_tokens).toBe(2500);
    expect(config.include_project).toBe(true);
    expect(config.include_dnr).toBe(true);
    expect(config.include_conventions).toBe(true);
    expect(config.include_anatomy).toBe(true);
    expect(config.include_bugs).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("throws on null input (null is not handled)", () => {
    expect(() => validateInjectionConfig(null as any)).toThrow();
  });

  it("clamps max_tokens to 500 with warning when below minimum", () => {
    const { config, warnings } = validateInjectionConfig({ max_tokens: 100 });
    expect(config.max_tokens).toBe(500);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("very low");
  });

  it("clamps max_tokens to 10000 with warning when above maximum", () => {
    const { config, warnings } = validateInjectionConfig({ max_tokens: 20000 });
    expect(config.max_tokens).toBe(10000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("very high");
  });
});
