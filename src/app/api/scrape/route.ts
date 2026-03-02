import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { scrapeTikTokPosts } from "@/lib/scraper";
import { calculateCreatorScore } from "@/lib/scoring";
import { estimateRevenue } from "@/lib/revenue";

const DEMO_CAMPAIGN_ID = "default";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { creator_id } = await req.json();

    const { data: creator } = await supabase.from("creators").select("*").eq("id", creator_id).single();
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const start = Date.now();
    try {
      const posts = await scrapeTikTokPosts(creator.tiktok_username);
      const records = posts.map((p: any) => ({
        creator_id,
        campaign_id: DEMO_CAMPAIGN_ID,
        tiktok_post_id: p.id,
        url: p.url,
        caption: p.caption,
        hashtags: p.hashtags,
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
        duration_seconds: p.duration,
        posted_at: p.posted_at,
        has_product_link: p.has_product_link,
        scraped_at: new Date().toISOString(),
      }));

      const { data: insertedPosts } = await supabase.from("posts").upsert(records, { onConflict: "tiktok_post_id" }).select();

      // Auto-calculate revenue for new posts
      if (insertedPosts && insertedPosts.length > 0) {
        try {
          const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", DEMO_CAMPAIGN_ID).single();

          if (campaign) {
            const revenueEstimates = insertedPosts.map((post: any) => ({
              post_id: post.id,
              campaign_id: DEMO_CAMPAIGN_ID,
              views: post.views,
              ctr: campaign.default_ctr,
              cvr: campaign.default_cvr,
              aov: campaign.aov,
              commission_rate: campaign.commission_rate,
            }));

            await supabase.from("revenue_estimates").upsert(revenueEstimates, { onConflict: "post_id,campaign_id" }).select();
          }
        } catch (err: any) {
          console.error("Revenue calculation failed:", err);
        }
      }

      // Auto-calculate score for creator
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: creatorPosts } = await supabase
          .from("posts")
          .select("*, revenue_estimates(*)")
          .eq("creator_id", creator_id)
          .eq("campaign_id", DEMO_CAMPAIGN_ID)
          .gte("posted_at", thirtyDaysAgo)
          .order("posted_at", { ascending: false });

        const { data: prevScore } = await supabase
          .from("performance_scores")
          .select("*")
          .eq("creator_id", creator_id)
          .eq("campaign_id", DEMO_CAMPAIGN_ID)
          .order("score_date", { ascending: false })
          .limit(1)
          .single();

        const score = calculateCreatorScore(creatorPosts || [], prevScore, creator);
        await supabase
          .from("performance_scores")
          .upsert({ ...score, creator_id, campaign_id: DEMO_CAMPAIGN_ID }, { onConflict: "creator_id,campaign_id,score_date" })
          .select();
      } catch (err: any) {
        console.error("Score calculation failed:", err);
      }

      await supabase.from("scrape_log").insert({
        creator_id,
        status: "success",
        posts_found: posts.length,
        duration_ms: Date.now() - start,
      });

      return NextResponse.json({ scraped: insertedPosts?.length || 0 });
    } catch (err: any) {
      await supabase.from("scrape_log").insert({
        creator_id,
        status: "failed",
        error_message: err.message,
        duration_ms: Date.now() - start,
      });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Scrape API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
