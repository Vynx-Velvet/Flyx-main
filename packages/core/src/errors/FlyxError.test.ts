import { describe, it, expect } from "vitest";
import {
  FlyxError,
  ProviderError,
  AllProvidersFailedError,
  ProviderNotFoundError,
  ProviderDisabledError,
} from "./index";
import { ErrorCode } from "../types/error";

describe("FlyxError", () => {
  it("creates a base error with correct properties", () => {
    const err = new FlyxError("test message", ErrorCode.INTERNAL_ERROR, 500, false, {
      extra: "context",
    });

    expect(err.message).toBe("test message");
    expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(false);
    expect(err.details).toEqual({ extra: "context" });
    expect(err.name).toBe("FlyxError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FlyxError);
  });

  it("derives category from error code", () => {
    expect(new FlyxError("x", ErrorCode.PROVIDER_ERROR).category).toBe("provider");
    expect(new FlyxError("x", ErrorCode.NETWORK_ERROR).category).toBe("network");
    expect(new FlyxError("x", ErrorCode.EXTRACTION_FAILED).category).toBe("extraction");
    expect(new FlyxError("x", ErrorCode.VALIDATION_ERROR).category).toBe("validation");
    expect(new FlyxError("x", ErrorCode.UNAUTHORIZED).category).toBe("auth");
    expect(new FlyxError("x", ErrorCode.SYNC_FAILED).category).toBe("sync");
    expect(new FlyxError("x", ErrorCode.INTERNAL_ERROR).category).toBe("internal");
  });

  it("serialises to JSON-safe API response", () => {
    const err = new FlyxError("Not found", ErrorCode.PROVIDER_NOT_FOUND, 404, false);
    const json = err.toJSON();

    expect(json).toEqual({
      success: false,
      code: ErrorCode.PROVIDER_NOT_FOUND,
      message: "Not found",
      statusCode: 404,
      retryable: false,
    });
  });

  it("includes details in JSON when present", () => {
    const err = new FlyxError("x", ErrorCode.INTERNAL_ERROR, 500, false, { key: "val" });
    const json = err.toJSON();
    expect(json.details).toEqual({ key: "val" });
  });

  it("maintains instanceof checks across subclasses", () => {
    const providerErr = new ProviderError("failed", "vidsrc");
    expect(providerErr).toBeInstanceOf(FlyxError);
    expect(providerErr).toBeInstanceOf(ProviderError);
    expect(providerErr).toBeInstanceOf(Error);
  });
});

describe("ProviderError", () => {
  it("creates with provider name and defaults", () => {
    const err = new ProviderError("stream failed", "vidsrc");
    expect(err.message).toBe("stream failed");
    expect(err.provider).toBe("vidsrc");
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(err.statusCode).toBe(502);
    expect(err.retryable).toBe(true);
  });

  it("accepts custom code and status", () => {
    const err = new ProviderError("disabled", "vidsrc", ErrorCode.PROVIDER_DISABLED, 503, false);
    expect(err.code).toBe(ErrorCode.PROVIDER_DISABLED);
    expect(err.statusCode).toBe(503);
    expect(err.retryable).toBe(false);
  });
});

describe("AllProvidersFailedError", () => {
  it("aggregates multiple provider failures", () => {
    const attempts = [
      { provider: "vidsrc", error: "timeout" },
      { provider: "vidsrc", error: "no sources" },
    ];
    const err = new AllProvidersFailedError(attempts);

    expect(err.attempts).toEqual(attempts);
    expect(err.code).toBe(ErrorCode.ALL_PROVIDERS_FAILED);
    expect(err.message).toContain("vidsrc");
    expect(err.message).toContain("vidsrc");
  });

  it("handles empty attempts array", () => {
    const err = new AllProvidersFailedError([]);
    expect(err.message).toBe("No providers available for this content");
    expect(err.attempts).toEqual([]);
  });
});

describe("ProviderNotFoundError", () => {
  it("includes provider name in message", () => {
    const err = new ProviderNotFoundError("unknown-provider");
    expect(err.message).toContain("unknown-provider");
    expect(err.statusCode).toBe(404);
    expect(err.retryable).toBe(false);
    expect(err.details).toEqual({ providerName: "unknown-provider" });
  });
});

describe("ProviderDisabledError", () => {
   it("includes provider name and 503 status", () => {
    const err = new ProviderDisabledError("hianime");
    expect(err.message).toContain("hianime");
    expect(err.statusCode).toBe(503);
    expect(err.retryable).toBe(false);
  });
});
