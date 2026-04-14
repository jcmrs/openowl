import type { InjectionConfig } from "./build-context.js";

export interface InjectionState {
  lastBuilt: string;
  lastModified: number;
  error: string | null;
}

export function validateInjectionConfig(config: Record<string, unknown>): { config: InjectionConfig; warnings: string[] } {
  const warnings: string[] = [];
  const injection = (config.injection ?? {}) as Record<string, unknown>;

  const result: InjectionConfig = {
    enabled: typeof injection.enabled === "boolean" ? injection.enabled : true,
    max_tokens: typeof injection.max_tokens === "number" ? injection.max_tokens : 2500,
    include_project: typeof injection.include_project === "boolean" ? injection.include_project : true,
    include_dnr: typeof injection.include_dnr === "boolean" ? injection.include_dnr : true,
    include_conventions: typeof injection.include_conventions === "boolean" ? injection.include_conventions : true,
    include_anatomy: typeof injection.include_anatomy === "boolean" ? injection.include_anatomy : true,
    include_bugs: typeof injection.include_bugs === "boolean" ? injection.include_bugs : true,
  };

  if (result.max_tokens < 500) {
    warnings.push("injection.max_tokens is very low (< 500). Consider increasing.");
    result.max_tokens = 500;
  }
  if (result.max_tokens > 10000) {
    warnings.push("injection.max_tokens is very high (> 10000). This may impact performance.");
    result.max_tokens = 10000;
  }

  return { config: result, warnings };
}
