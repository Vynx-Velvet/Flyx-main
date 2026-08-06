import { describe, it, expect } from "vitest";
import { validateEnv } from "./env";

describe("validateEnv", () => {
  const validEnv = {
    TMDB_API_KEY: "test-tmdb-key-12345",
    JWT_SECRET: "a-very-long-secret-key-that-meets-the-32-char-minimum",
    NODE_ENV: "development" as const,
  };

  it("passes with valid required variables", () => {
    const env = validateEnv(validEnv);
    expect(env.TMDB_API_KEY).toBe("test-tmdb-key-12345");
    expect(env.JWT_SECRET).toBe(validEnv.JWT_SECRET);
    expect(env.NODE_ENV).toBe("development");
  });

  it("defaults NODE_ENV to development", () => {
    const env = validateEnv({
      TMDB_API_KEY: "key",
      JWT_SECRET: "a-very-long-secret-that-meets-the-minimum-length-ok",
    });
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws on missing TMDB_API_KEY", () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        TMDB_API_KEY: "",
      }),
    ).toThrow();
  });

  it("throws on short JWT_SECRET", () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        JWT_SECRET: "too-short",
      }),
    ).toThrow();
  });

  it("transforms feature flag strings to booleans", () => {
    const env = validateEnv({
      ...validEnv,
      ENABLE_ANALYTICS: "true",
      ENABLE_SYNC: "false",
    });
    expect(env.ENABLE_ANALYTICS).toBe(true);
    expect(env.ENABLE_SYNC).toBe(false);
  });

  it("defaults feature flags when absent", () => {
    const env = validateEnv(validEnv);
    expect(env.ENABLE_ANALYTICS).toBe(false);
    expect(env.ENABLE_SYNC).toBe(true);
  });

  it("accepts optional variables when provided", () => {
    const env = validateEnv({
      ...validEnv,
      STRIPE_SECRET_KEY: "sk_test_123",
      DISCORD_BOT_TOKEN: "bot-token",
    });
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_123");
    expect(env.DISCORD_BOT_TOKEN).toBe("bot-token");
  });
});
