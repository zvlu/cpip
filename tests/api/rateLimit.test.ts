import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/response";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";

describe("rate limit helper", () => {
  it("allows requests under max in the same window", () => {
    const key = buildRateLimitKey("test-route", `allow-${Date.now()}`);
    enforceRateLimit(key, { windowMs: 10_000, maxRequests: 2 });
    enforceRateLimit(key, { windowMs: 10_000, maxRequests: 2 });
  });

  it("throws ApiHttpError when max requests exceeded", () => {
    const key = buildRateLimitKey("test-route", `block-${Date.now()}`);
    enforceRateLimit(key, { windowMs: 10_000, maxRequests: 1 });
    expect(() => enforceRateLimit(key, { windowMs: 10_000, maxRequests: 1 })).toThrow(ApiHttpError);
  });
});
