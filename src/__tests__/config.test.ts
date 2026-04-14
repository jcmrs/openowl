import { describe, it, expect } from "vitest";
import { validateConfig, sanitizeConfig } from "../core/utils/config.js";

describe("config validation", () => {
  it("returns no warnings for valid config", () => {
    const config = {
      version: 1,
      openowl: {
        daemon: { port: 18790, log_level: "info" },
        dashboard: { enabled: true, port: 18791 },
        cron: { enabled: true, heartbeat_interval_minutes: 30 },
      },
    };
    expect(validateConfig(config as any)).toHaveLength(0);
  });

  it("warns about invalid port", () => {
    const config = {
      version: 1,
      openowl: {
        daemon: { port: 99999, log_level: "info" },
        dashboard: { enabled: true, port: 18791 },
        cron: { enabled: true, heartbeat_interval_minutes: 30 },
      },
    };
    const warnings = validateConfig(config as any);
    expect(warnings.some((w: any) => w.path.includes("daemon.port"))).toBe(true);
  });

  it("warns about invalid token ratio", () => {
    const config = {
      version: 1,
      openowl: {
        token_audit: { chars_per_token_code: -1 },
      },
    };
    const warnings = validateConfig(config as any);
    expect(warnings.some((w: any) => w.path.includes("chars_per_token_code"))).toBe(true);
  });

  it("warns about invalid heartbeat interval", () => {
    const config = {
      version: 1,
      openowl: {
        cron: { heartbeat_interval_minutes: 0 },
      },
    };
    const warnings = validateConfig(config as any);
    expect(warnings.some((w: any) => w.path.includes("heartbeat"))).toBe(true);
  });

  it("sanitizes invalid port to default", () => {
    const config = {
      version: 1,
      openowl: {
        daemon: { port: -1, log_level: "info" },
        dashboard: { enabled: true, port: 99999 },
        cron: { enabled: true, heartbeat_interval_minutes: 0 },
      },
    };
    const sanitized = sanitizeConfig(config as any);
    expect(sanitized.openowl.daemon.port).toBe(18790);
    expect(sanitized.openowl.dashboard.port).toBe(18791);
    expect(sanitized.openowl.cron.heartbeat_interval_minutes).toBe(30);
  });
});
