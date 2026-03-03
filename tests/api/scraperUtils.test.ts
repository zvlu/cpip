import { describe, expect, it } from "vitest";
import {
  extractTikTokPostIdFromUrl,
  normalizeTikTokUrl,
  parseCount,
  ScrapedPostSchema,
  withRetry,
} from "@/lib/scraperUtils";

describe("scraper utils", () => {
  it("parses compact metric suffixes", () => {
    expect(parseCount("1.2K")).toBe(1200);
    expect(parseCount("3M")).toBe(3_000_000);
    expect(parseCount("4.1B")).toBe(4_100_000_000);
    expect(parseCount("12,345")).toBe(12345);
  });

  it("normalizes href and extracts numeric TikTok post id", () => {
    const url = normalizeTikTokUrl("/@creator/video/7444212123412341234?is_from_webapp=1");
    expect(url).toBe("https://www.tiktok.com/@creator/video/7444212123412341234");
    expect(extractTikTokPostIdFromUrl(url)).toBe("7444212123412341234");
  });

  it("validates shaped scrape output", () => {
    const parsed = ScrapedPostSchema.safeParse({
      id: "7444212123412341234",
      url: "https://www.tiktok.com/@creator/video/7444212123412341234",
      caption: "test caption",
      hashtags: ["beauty", "routine"],
      views: 1000,
      likes: 100,
      comments: 10,
      shares: 5,
      saves: 0,
      duration: 20,
      posted_at: "2026-01-01T00:00:00.000Z",
      has_product_link: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("retries transient failures with bounded attempts", async () => {
    let runCount = 0;
    const result = await withRetry(
      async () => {
        runCount += 1;
        if (runCount < 3) throw new Error("temporary");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, maxJitterMs: 0 }
    );
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
  });
});
