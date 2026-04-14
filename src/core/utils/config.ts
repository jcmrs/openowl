export interface OwlConfig {
  version: number;
  openowl: {
    enabled?: boolean;
    anatomy?: {
      auto_scan_on_init?: boolean;
      rescan_interval_hours?: number;
      max_description_length?: number;
      max_files?: number;
      exclude_patterns?: string[];
    };
    token_audit?: {
      enabled?: boolean;
      report_frequency?: string;
      waste_threshold_percent?: number;
      model?: string;
      chars_per_token_code?: number;
      chars_per_token_prose?: number;
      chars_per_token_mixed?: number;
    };
    cron?: {
      enabled?: boolean;
      max_retry_attempts?: number;
      dead_letter_enabled?: boolean;
      heartbeat_interval_minutes?: number;
      ai_command?: string;
    };
    memory?: {
      consolidation_after_days?: number;
      max_entries_before_consolidation?: number;
    };
    cerebrum?: {
      max_tokens?: number;
      reflection_frequency?: string;
    };
    daemon?: {
      port?: number;
      log_level?: string;
    };
    dashboard?: {
      enabled?: boolean;
      port?: number;
    };
    designqc?: {
      enabled?: boolean;
      viewports?: Array<{ name: string; width: number; height: number }>;
      max_screenshots?: number;
      chrome_path?: string | null;
    };
  };
}

export interface ConfigWarning {
  path: string;
  message: string;
}

export function validateConfig(config: OwlConfig): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const owl = config.openowl;

  if (!owl) {
    warnings.push({ path: "openowl", message: "Missing openowl section" });
    return warnings;
  }

  if (owl.daemon?.port !== undefined) {
    if (typeof owl.daemon.port !== "number" || owl.daemon.port < 1 || owl.daemon.port > 65535) {
      warnings.push({ path: "openowl.daemon.port", message: `Invalid port: ${owl.daemon.port} (must be 1-65535)` });
    }
  }

  if (owl.dashboard?.port !== undefined) {
    if (typeof owl.dashboard.port !== "number" || owl.dashboard.port < 1 || owl.dashboard.port > 65535) {
      warnings.push({ path: "openowl.dashboard.port", message: `Invalid port: ${owl.dashboard.port} (must be 1-65535)` });
    }
  }

  const tokenAudit = owl.token_audit;
  if (tokenAudit) {
    if (tokenAudit.chars_per_token_code !== undefined && (tokenAudit.chars_per_token_code <= 0 || !isFinite(tokenAudit.chars_per_token_code))) {
      warnings.push({ path: "openowl.token_audit.chars_per_token_code", message: `Invalid ratio: ${tokenAudit.chars_per_token_code} (must be > 0)` });
    }
    if (tokenAudit.chars_per_token_prose !== undefined && (tokenAudit.chars_per_token_prose <= 0 || !isFinite(tokenAudit.chars_per_token_prose))) {
      warnings.push({ path: "openowl.token_audit.chars_per_token_prose", message: `Invalid ratio: ${tokenAudit.chars_per_token_prose} (must be > 0)` });
    }
  }

  if (owl.cron?.heartbeat_interval_minutes !== undefined) {
    if (typeof owl.cron.heartbeat_interval_minutes !== "number" || owl.cron.heartbeat_interval_minutes < 1) {
      warnings.push({ path: "openowl.cron.heartbeat_interval_minutes", message: `Invalid interval: ${owl.cron.heartbeat_interval_minutes} (must be >= 1)` });
    }
  }

  if (owl.anatomy?.max_files !== undefined) {
    if (typeof owl.anatomy.max_files !== "number" || owl.anatomy.max_files < 1) {
      warnings.push({ path: "openowl.anatomy.max_files", message: `Invalid max_files: ${owl.anatomy.max_files} (must be >= 1)` });
    }
  }

  if (owl.designqc?.max_screenshots !== undefined) {
    if (typeof owl.designqc.max_screenshots !== "number" || owl.designqc.max_screenshots < 1 || owl.designqc.max_screenshots > 20) {
      warnings.push({ path: "openowl.designqc.max_screenshots", message: `Invalid max_screenshots: ${owl.designqc.max_screenshots} (must be 1-20)` });
    }
  }

  return warnings;
}

export function sanitizeConfig(config: OwlConfig): OwlConfig {
  const owl = config.openowl;

  if (owl.daemon?.port !== undefined && (owl.daemon.port < 1 || owl.daemon.port > 65535 || !isFinite(owl.daemon.port))) {
    owl.daemon.port = 18790;
  }

  if (owl.dashboard?.port !== undefined && (owl.dashboard.port < 1 || owl.dashboard.port > 65535 || !isFinite(owl.dashboard.port))) {
    owl.dashboard.port = 18791;
  }

  if (owl.cron?.heartbeat_interval_minutes !== undefined && (owl.cron.heartbeat_interval_minutes < 1 || !isFinite(owl.cron.heartbeat_interval_minutes))) {
    owl.cron.heartbeat_interval_minutes = 30;
  }

  return config;
}
