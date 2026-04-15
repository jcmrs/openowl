import type { InjectionConfig } from "./build-context.js";

interface InjectionState {
  lastBuilt: string;
  lastModified: number;
  error: string | null;
}

export function validateInjectionConfig(config: Record<string, unknown>): { config: InjectionConfig; warnings: string[] } {
  const warnings: string[] = [];

  const result: InjectionConfig = {
    enabled: typeof config.enabled === "boolean" ? config.enabled : true,
    max_tokens: typeof config.max_tokens === "number" ? config.max_tokens : 2500,
    include_project: typeof config.include_project === "boolean" ? config.include_project : true,
    include_dnr: typeof config.include_dnr === "boolean" ? config.include_dnr : true,
    include_conventions: typeof config.include_conventions === "boolean" ? config.include_conventions : true,
    include_anatomy: typeof config.include_anatomy === "boolean" ? config.include_anatomy : true,
    include_bugs: typeof config.include_bugs === "boolean" ? config.include_bugs : true,
  };

  if (!isFinite(result.max_tokens) || isNaN(result.max_tokens)) {
    warnings.push("CONFIG: injection.max_tokens is not a valid number. Defaulting to 2500.");
    result.max_tokens = 2500;
  }

  if (result.max_tokens < 500) {
    warnings.push("CONFIG: injection.max_tokens is very low (< 500). Consider increasing.");
    result.max_tokens = 500;
  }
  if (result.max_tokens > 10000) {
    warnings.push("CONFIG: injection.max_tokens is very high (> 10000). This may impact performance.");
    result.max_tokens = 10000;
  }

  return { config: result, warnings };
}
