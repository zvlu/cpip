import { scrapeTikTokPosts } from "../src/lib/scraper";

const username = process.argv[2];
if (!username) { console.error("Usage: npx tsx scraper/run.ts <username>"); process.exit(1); }

(async () => {
  console.log(`Scraping @${username}...`);
  const posts = await scrapeTikTokPosts(username);
  console.log(`Found ${posts.length} posts`);
  console.log(JSON.stringify(posts, null, 2));
})();
