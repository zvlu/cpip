import { chromium } from "playwright";

export async function scrapeTikTokPosts(username: string, maxPosts = 30) {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto(`https://www.tiktok.com/@${username}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('[data-e2e="user-post-item"]', { timeout: 15000 });

    let prevHeight = 0, attempts = 0;
    while (attempts < 10) {
      const items = await page.$$('[data-e2e="user-post-item"]');
      if (items.length >= maxPosts) break;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const h = await page.evaluate(() => document.body.scrollHeight);
      if (h === prevHeight) break;
      prevHeight = h; attempts++;
    }

    const els = await page.$$('[data-e2e="user-post-item"]');
    const posts = [];
    for (const el of els.slice(0, maxPosts)) {
      try {
        const link = await el.$("a");
        const href = await link?.getAttribute("href");
        if (!href) continue;
        const viewText = await el.$eval('[data-e2e="video-views"]', (e) => e.textContent || "0").catch(() => "0");
        posts.push({ id: href.split("/").pop() || "", url: `https://www.tiktok.com${href}`, caption: "", hashtags: [] as string[], views: parseCount(viewText), likes: 0, comments: 0, shares: 0, saves: 0, duration: 0, posted_at: "", has_product_link: false });
      } catch { continue; }
    }

    // Enrich with detail pages
    const enriched = [];
    for (const post of posts) {
      try {
        const dp = await ctx.newPage();
        await dp.goto(post.url, { waitUntil: "networkidle", timeout: 20000 });
        const caption = await dp.$eval('[data-e2e="browse-video-desc"]', (e) => e.textContent || "").catch(() => "");
        const hashtags = caption.match(/#\w+/g) || [];
        const likes = await dp.$eval('[data-e2e="like-count"]', (e) => e.textContent || "0").catch(() => "0");
        const comments = await dp.$eval('[data-e2e="comment-count"]', (e) => e.textContent || "0").catch(() => "0");
        const shares = await dp.$eval('[data-e2e="share-count"]', (e) => e.textContent || "0").catch(() => "0");
        const hasProd = !!(await dp.$('[data-e2e="product-anchor"]').catch(() => null));
        enriched.push({ ...post, caption, hashtags: hashtags.map((h: string) => h.slice(1)), likes: parseCount(likes), comments: parseCount(comments), shares: parseCount(shares), has_product_link: hasProd });
        await dp.close();
        await page.waitForTimeout(1000 + Math.random() * 2000);
      } catch { enriched.push(post); }
    }
    return enriched;
  } finally { await browser.close(); }
}

function parseCount(t: string): number {
  t = t.trim().toUpperCase();
  if (t.endsWith("K")) return Math.round(parseFloat(t) * 1000);
  if (t.endsWith("M")) return Math.round(parseFloat(t) * 1000000);
  if (t.endsWith("B")) return Math.round(parseFloat(t) * 1000000000);
  return parseInt(t.replace(/,/g, "")) || 0;
}
