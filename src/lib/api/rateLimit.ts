import { ApiHttpError } from "@/lib/api/response";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function enforceRateLimit(
  key: string,
  opts: { windowMs: number; maxRequests: number }
) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, {
      count: 1,
      resetAt: now + opts.windowMs,
    });
    return;
  }

  if (existing.count >= opts.maxRequests) {
    throw new ApiHttpError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }

  existing.count += 1;
  buckets.set(key, existing);
}

export function buildRateLimitKey(route: string, identity: string) {
  return `${route}:${identity}`;
}
