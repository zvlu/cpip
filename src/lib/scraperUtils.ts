import { z } from "zod";

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 700;
export const DEFAULT_RETRY_MAX_JITTER_MS = 500;

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxJitterMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
};

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<{ value: T; attempts: number }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_RETRY_ATTEMPTS);
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
  const maxJitterMs = Math.max(0, options.maxJitterMs ?? DEFAULT_RETRY_MAX_JITTER_MS);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await task();
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxAttempts && (options.shouldRetry ? options.shouldRetry(error) : true);
      if (!canRetry) {
        break;
      }
      const delayMs = Math.round(baseDelayMs * attempt + Math.random() * maxJitterMs);
      options.onRetry?.(attempt, error, delayMs);
      await wait(delayMs);
    }
  }

  throw lastError;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseCount(input: string | null | undefined): number {
  const value = String(input || "0")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  if (!value) return 0;
  if (value.endsWith("K")) return Math.round(parseFloat(value) * 1_000) || 0;
  if (value.endsWith("M")) return Math.round(parseFloat(value) * 1_000_000) || 0;
  if (value.endsWith("B")) return Math.round(parseFloat(value) * 1_000_000_000) || 0;
  return Math.max(0, parseInt(value, 10) || 0);
}

export function normalizeTikTokUrl(href: string): string {
  const value = href.startsWith("http") ? href : `https://www.tiktok.com${href}`;
  return value.split("?")[0];
}

export function extractTikTokPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(\d{6,25})/i);
  return match?.[1] ?? null;
}

export function sanitizeHashtag(tag: string): string {
  return tag.replace(/^#/, "").replace(/[^\w]/g, "").trim().toLowerCase();
}

export const ScrapedPostSchema = z.object({
  id: z.string().min(3),
  url: z.string().url().includes("tiktok.com"),
  caption: z.string().max(5000),
  hashtags: z.array(z.string().min(1).max(64)).max(100),
  views: z.number().int().min(0).max(2_000_000_000),
  likes: z.number().int().min(0).max(2_000_000_000),
  comments: z.number().int().min(0).max(2_000_000_000),
  shares: z.number().int().min(0).max(2_000_000_000),
  saves: z.number().int().min(0).max(2_000_000_000),
  duration: z.number().int().min(0).max(60_000),
  posted_at: z.string().datetime().nullable(),
  has_product_link: z.boolean(),
});

export type ScrapedPost = z.infer<typeof ScrapedPostSchema>;
