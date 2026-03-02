import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000010";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: orgError } = await supabase.from("organizations").upsert(
    {
      id: DEMO_ORG_ID,
      name: "CreatorPulse Demo Org",
      slug: "creatorpulse-demo",
      plan: "pro",
      settings: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (orgError) throw orgError;

  const { error: campaignError } = await supabase.from("campaigns").upsert(
    {
      id: DEMO_CAMPAIGN_ID,
      org_id: DEMO_ORG_ID,
      name: "Spring Creator Push",
      product_name: "Glow Serum",
      aov: 49,
      commission_rate: 0.15,
      default_ctr: 0.023,
      default_cvr: 0.031,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (campaignError) throw campaignError;

  const creators = [
    {
      id: "00000000-0000-0000-0000-000000000101",
      org_id: DEMO_ORG_ID,
      tiktok_username: "jenselter",
      display_name: "Jen Selter",
      follower_count: 2300000,
      category: "Fitness",
      tags: ["fitness", "health", "lifestyle"],
      status: "active",
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000102",
      org_id: DEMO_ORG_ID,
      tiktok_username: "haytayfitness",
      display_name: "Haley Taylor",
      follower_count: 562600,
      category: "Fitness",
      tags: ["fitness", "workout", "wellness"],
      status: "active",
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-0000-0000-000000000103",
      org_id: DEMO_ORG_ID,
      tiktok_username: "xoxoemira",
      display_name: "Emira",
      follower_count: 1400000,
      category: "Lifestyle",
      tags: ["lifestyle", "fashion", "nyc"],
      status: "active",
      updated_at: new Date().toISOString(),
    },
  ];

  const { error: creatorsError } = await supabase.from("creators").upsert(creators, { onConflict: "id" });
  if (creatorsError) throw creatorsError;

  const { error: campaignCreatorsError } = await supabase.from("campaign_creators").upsert(
    creators.map((creator) => ({
      campaign_id: DEMO_CAMPAIGN_ID,
      creator_id: creator.id,
    })),
    { onConflict: "campaign_id,creator_id" }
  );
  if (campaignCreatorsError) throw campaignCreatorsError;

  const today = new Date().toISOString().slice(0, 10);
  const { error: scoresError } = await supabase.from("performance_scores").upsert(
    [
      {
        creator_id: creators[0].id,
        campaign_id: DEMO_CAMPAIGN_ID,
        score_date: today,
        engagement_score: 84,
        consistency_score: 77,
        revenue_score: 81,
        growth_score: 73,
        reach_score: 79,
        overall_score: 79,
        metadata: {},
      },
      {
        creator_id: creators[1].id,
        campaign_id: DEMO_CAMPAIGN_ID,
        score_date: today,
        engagement_score: 72,
        consistency_score: 69,
        revenue_score: 64,
        growth_score: 66,
        reach_score: 68,
        overall_score: 68,
        metadata: {},
      },
      {
        creator_id: creators[2].id,
        campaign_id: DEMO_CAMPAIGN_ID,
        score_date: today,
        engagement_score: 59,
        consistency_score: 63,
        revenue_score: 58,
        growth_score: 55,
        reach_score: 62,
        overall_score: 59,
        metadata: {},
      },
    ],
    { onConflict: "creator_id,campaign_id,score_date" }
  );
  if (scoresError) throw scoresError;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .upsert(
      [
        {
          creator_id: creators[0].id,
          campaign_id: DEMO_CAMPAIGN_ID,
          tiktok_post_id: "demo-post-101",
          url: "https://www.tiktok.com/@jenselter/video/demo-post-101",
          caption: "Core and glute circuit for busy mornings. Save this routine.",
          hashtags: ["fitness", "workout", "routine"],
          views: 65400,
          likes: 5410,
          comments: 312,
          shares: 244,
          saves: 503,
          duration_seconds: 34,
          posted_at: yesterday,
          has_product_link: true,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          creator_id: creators[1].id,
          campaign_id: DEMO_CAMPAIGN_ID,
          tiktok_post_id: "demo-post-102",
          url: "https://www.tiktok.com/@haytayfitness/video/demo-post-102",
          caption: "A quick full-body strength session with minimal equipment.",
          hashtags: ["fitness", "strength", "gym"],
          views: 48220,
          likes: 3874,
          comments: 188,
          shares: 121,
          saves: 240,
          duration_seconds: 49,
          posted_at: yesterday,
          has_product_link: true,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "tiktok_post_id" }
    )
    .select("id, views");
  if (postsError) throw postsError;

  if (posts && posts.length > 0) {
    const { error: revenueError } = await supabase.from("revenue_estimates").upsert(
      posts.map((post) => ({
        post_id: post.id,
        campaign_id: DEMO_CAMPAIGN_ID,
        views: post.views,
        ctr: 0.023,
        cvr: 0.031,
        aov: 49,
        commission_rate: 0.15,
      })),
      { onConflict: "post_id,campaign_id" }
    );
    if (revenueError) throw revenueError;
  }

  console.log("Demo data seeded successfully.");
}

main().catch((error) => {
  console.error("Failed to seed demo data:", error);
  process.exit(1);
});
