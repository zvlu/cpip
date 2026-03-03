import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import {
  extractTikTokPostIdFromUrl,
  normalizeTikTokUrl,
  parseCount,
  sanitizeHashtag,
  ScrapedPostSchema,
  type ScrapedPost,
  wait,
  withRetry,
} from "@/lib/scraperUtils";

type ScrapeMeta = {
  attemptsByStage: Record<string, number>;
  candidateCount: number;
  droppedInvalidCount: number;
  blockedDetected: boolean;
  timingsMs: {
    collect: number;
    enrich: number;
    total: number;
  };
};

export type ScrapeRunResult = {
  posts: ScrapedPost[];
  meta: ScrapeMeta;
};

const POST_ITEM_SELECTORS = ['[data-e2e="user-post-item"]', '[data-e2e="user-post-item-list"] [data-e2e="user-post-item"]', 'a[href*="/video/"]'];
const VIEW_SELECTORS = ['[data-e2e="video-views"]', '[data-e2e="video-view-count"]', '[data-e2e="browse-video-views"]'];
const CAPTION_SELECTORS = ['[data-e2e="browse-video-desc"]', '[data-e2e="new-desc-span"]', 'h1[data-e2e="video-desc"]'];
const LIKE_SELECTORS = ['[data-e2e="like-count"]', '[data-e2e="browse-like-count"]'];
const COMMENT_SELECTORS = ['[data-e2e="comment-count"]', '[data-e2e="browse-comment-count"]'];
const SHARE_SELECTORS = ['[data-e2e="share-count"]', '[data-e2e="browse-share-count"]'];
const PRODUCT_SELECTORS = ['[data-e2e="product-anchor"]', '[data-e2e="video-shopping-anchor"]', 'a[href*="shop"]'];

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SCRAPER_RETRY_ATTEMPTS = intEnv("SCRAPER_RETRY_ATTEMPTS", 3);
const SCRAPER_RETRY_BASE_DELAY_MS = intEnv("SCRAPER_RETRY_BASE_DELAY_MS", 600);
const SCRAPER_MAX_SCROLL_ATTEMPTS = intEnv("SCRAPER_MAX_SCROLL_ATTEMPTS", 10);
const SCRAPER_SCROLL_WAIT_MS = intEnv("SCRAPER_SCROLL_WAIT_MS", 1_600);
const SCRAPER_PROFILE_TIMEOUT_MS = intEnv("SCRAPER_PROFILE_TIMEOUT_MS", 30_000);
const SCRAPER_SELECTOR_TIMEOUT_MS = intEnv("SCRAPER_SELECTOR_TIMEOUT_MS", 15_000);
const SCRAPER_DETAIL_TIMEOUT_MS = intEnv("SCRAPER_DETAIL_TIMEOUT_MS", 22_000);
const SCRAPER_DETAIL_CONCURRENCY = intEnv("SCRAPER_DETAIL_CONCURRENCY", 4);
const SCRAPER_MIN_DETAIL_DELAY_MS = intEnv("SCRAPER_MIN_DETAIL_DELAY_MS", 700);
const SCRAPER_MAX_DETAIL_JITTER_MS = intEnv("SCRAPER_MAX_DETAIL_JITTER_MS", 1400);

export async function scrapeTikTokPosts(username: string, maxPosts = 30): Promise<ScrapedPost[]> {
  const result = await scrapeTikTokPostsWithMeta(username, maxPosts);
  return result.posts;
}

export async function scrapeTikTokPostsWithMeta(username: string, maxPosts = 30): Promise<ScrapeRunResult> {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const attemptsByStage: Record<string, number> = {};
  const startTotal = Date.now();
  let blockedDetected = false;
  let droppedInvalidCount = 0;
  let candidateCount = 0;
  let collectDuration = 0;
  let enrichDuration = 0;

  const trackAttempts = (stage: string, attempts: number) => {
    attemptsByStage[stage] = Math.max(attemptsByStage[stage] || 0, attempts);
  };

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    try {
      const profilePage = await context.newPage();
      const startCollect = Date.now();
      try {
        const profileAttempt = await withRetry(
          () =>
            profilePage.goto(`https://www.tiktok.com/@${username}`, {
              waitUntil: "domcontentloaded",
              timeout: SCRAPER_PROFILE_TIMEOUT_MS,
            }),
          {
            maxAttempts: SCRAPER_RETRY_ATTEMPTS,
            baseDelayMs: SCRAPER_RETRY_BASE_DELAY_MS,
            onRetry: (attempt) => console.warn("[scraper] profile page retry", { username, attempt }),
          }
        );
        trackAttempts("profile_goto", profileAttempt.attempts);

        const selector = await waitForPostSelector(profilePage);
        trackAttempts("post_selector_wait", selector.attempts);
        blockedDetected = blockedDetected || (await detectBlockedState(profilePage));
        if (blockedDetected) {
          throw new Error("TikTok blocked or challenge page detected");
        }

        await autoScrollForPosts(profilePage, selector.value, maxPosts);
        const candidates = await collectPostCandidates(profilePage, selector.value, maxPosts);
        candidateCount = candidates.length;
        collectDuration = Date.now() - startCollect;

        const startEnrich = Date.now();
        const enriched = await enrichPosts(context, candidates, attemptsByStage);
        enrichDuration = Date.now() - startEnrich;

        const validated: ScrapedPost[] = [];
        for (const post of enriched) {
          const parsed = ScrapedPostSchema.safeParse(post);
          if (!parsed.success) {
            droppedInvalidCount += 1;
            continue;
          }
          validated.push(parsed.data);
        }

        return {
          posts: validated,
          meta: {
            attemptsByStage,
            candidateCount,
            droppedInvalidCount,
            blockedDetected,
            timingsMs: {
              collect: collectDuration,
              enrich: enrichDuration,
              total: Date.now() - startTotal,
            },
          },
        };
      } finally {
        await profilePage.close().catch(() => undefined);
      }
    } finally {
      await context.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function waitForPostSelector(page: Page): Promise<{ value: string; attempts: number }> {
  return withRetry(
    async () => {
      for (const selector of POST_ITEM_SELECTORS) {
        const count = await page.locator(selector).count();
        if (count > 0) return selector;
      }
      await page.waitForSelector(POST_ITEM_SELECTORS[0], { timeout: SCRAPER_SELECTOR_TIMEOUT_MS });
      return POST_ITEM_SELECTORS[0];
    },
    {
      maxAttempts: SCRAPER_RETRY_ATTEMPTS,
      baseDelayMs: SCRAPER_RETRY_BASE_DELAY_MS,
    }
  );
}

async function detectBlockedState(page: Page): Promise<boolean> {
  const title = (await page.title().catch(() => "")).toLowerCase();
  if (title.includes("captcha") || title.includes("verify") || title.includes("blocked")) return true;
  const bodyText = await page
    .evaluate(() => (document.body?.innerText || "").slice(0, 2500))
    .catch(() => "");
  const lowerBody = bodyText.toLowerCase();
  return lowerBody.includes("captcha") || lowerBody.includes("verify you are human") || lowerBody.includes("access denied");
}

async function autoScrollForPosts(page: Page, selector: string, maxPosts: number): Promise<void> {
  let previousHeight = 0;
  let attempts = 0;
  while (attempts < SCRAPER_MAX_SCROLL_ATTEMPTS) {
    const currentCount = await page.locator(selector).count();
    if (currentCount >= maxPosts) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(SCRAPER_SCROLL_WAIT_MS);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    attempts += 1;
  }
}

type CandidatePost = Omit<ScrapedPost, "caption" | "hashtags" | "likes" | "comments" | "shares" | "has_product_link"> & {
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  has_product_link: boolean;
};

async function collectPostCandidates(page: Page, selector: string, maxPosts: number): Promise<CandidatePost[]> {
  const links = await page.locator(selector).all();
  const uniqueById = new Map<string, CandidatePost>();

  for (const node of links) {
    try {
      const href =
        (await node.getAttribute("href")) ||
        (await node.locator("a").first().getAttribute("href").catch(() => null)) ||
        (await node.locator('a[href*="/video/"]').first().getAttribute("href").catch(() => null));
      if (!href) continue;
      const url = normalizeTikTokUrl(href);
      const id = extractTikTokPostIdFromUrl(url);
      if (!id) continue;

      let viewText = "0";
      for (const viewSelector of VIEW_SELECTORS) {
        const maybe = await node.locator(viewSelector).first().textContent().catch(() => null);
        if (maybe) {
          viewText = maybe;
          break;
        }
      }

      uniqueById.set(id, {
        id,
        url,
        caption: "",
        hashtags: [],
        views: parseCount(viewText),
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        duration: 0,
        posted_at: null,
        has_product_link: false,
      });
      if (uniqueById.size >= maxPosts) break;
    } catch {
      continue;
    }
  }

  return [...uniqueById.values()].slice(0, maxPosts);
}

async function enrichPosts(context: BrowserContext, posts: CandidatePost[], attemptsByStage: Record<string, number>): Promise<CandidatePost[]> {
  const workers = Math.max(1, Math.min(SCRAPER_DETAIL_CONCURRENCY, posts.length || 1));
  const queue = [...posts];
  const output: CandidatePost[] = [];

  await Promise.all(
    Array.from({ length: workers }).map(async () => {
      while (queue.length > 0) {
        const post = queue.shift();
        if (!post) break;
        const enriched = await enrichSinglePost(context, post, attemptsByStage);
        output.push(enriched);
        await wait(SCRAPER_MIN_DETAIL_DELAY_MS + Math.random() * SCRAPER_MAX_DETAIL_JITTER_MS);
      }
    })
  );

  return output;
}

async function enrichSinglePost(
  context: BrowserContext,
  post: CandidatePost,
  attemptsByStage: Record<string, number>
): Promise<CandidatePost> {
  const page = await context.newPage();
  try {
    const detailAttempt = await withRetry(
      async () => {
        await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: SCRAPER_DETAIL_TIMEOUT_MS });
        if (await detectBlockedState(page)) {
          throw new Error("Blocked while loading post details");
        }
        return true;
      },
      { maxAttempts: SCRAPER_RETRY_ATTEMPTS, baseDelayMs: SCRAPER_RETRY_BASE_DELAY_MS }
    );
    attemptsByStage.detail_goto = Math.max(attemptsByStage.detail_goto || 0, detailAttempt.attempts);

    const caption = await readFirstText(page, CAPTION_SELECTORS);
    const likes = await readFirstText(page, LIKE_SELECTORS);
    const comments = await readFirstText(page, COMMENT_SELECTORS);
    const shares = await readFirstText(page, SHARE_SELECTORS);
    const hasProduct = await readAnySelector(page, PRODUCT_SELECTORS);
    const postedAt = await readPostedAt(page);

    return {
      ...post,
      caption,
      hashtags: (caption.match(/#\w+/g) || []).map(sanitizeHashtag).filter(Boolean),
      likes: parseCount(likes),
      comments: parseCount(comments),
      shares: parseCount(shares),
      has_product_link: hasProduct,
      posted_at: postedAt,
    };
  } catch {
    return post;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function readFirstText(page: Page, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    const value = await page.locator(selector).first().textContent().catch(() => null);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function readAnySelector(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count > 0) return true;
  }
  return false;
}

async function readPostedAt(page: Page): Promise<string | null> {
  const timeTagValue = await page.locator("time").first().getAttribute("datetime").catch(() => null);
  if (timeTagValue) {
    const ts = new Date(timeTagValue);
    if (!Number.isNaN(ts.getTime())) return ts.toISOString();
  }

  const scriptDate = await page
    .evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script")).map((script) => script.textContent || "");
      for (const source of scripts) {
        const match = source.match(/"createTime"\s*:\s*"?(\d{10})"?/);
        if (match?.[1]) {
          const value = Number.parseInt(match[1], 10);
          if (Number.isFinite(value) && value > 0) return new Date(value * 1000).toISOString();
        }
      }
      return null;
    })
    .catch(() => null);
  return scriptDate || null;
}
