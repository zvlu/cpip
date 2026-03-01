import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { scrapeTikTokPosts } from "@/lib/scraper";

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

      const { data } = await supabase.from("posts").upsert(records, { onConflict: "tiktok_post_id" }).select();
      await supabase.from("scrape_log").insert({ creator_id, status: "success", posts_found: posts.length, duration_ms: Date.now() - start });
      return NextResponse.json({ scraped: data?.length || 0 });
    } catch (err: any) {
      await supabase.from("scrape_log").insert({ creator_id, status: "failed", error_message: err.message, duration_ms: Date.now() - start });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Scrape API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
