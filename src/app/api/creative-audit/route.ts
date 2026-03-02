import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { analyzeContentHooks } from "@/lib/hookAnalysis";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const creator_id = searchParams.get("creator_id");
    const campaign_id = searchParams.get("campaign_id");

    if (!creator_id || !campaign_id) {
      return NextResponse.json(
        { error: "creator_id and campaign_id are required" },
        { status: 400 }
      );
    }

    // Fetch posts from last 90 days for comprehensive analysis
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .gte("posted_at", ninetyDaysAgo)
      .order("posted_at", { ascending: false });

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: "No posts found for analysis" },
        { status: 400 }
      );
    }

    // Analyze content hooks
    const audit = analyzeContentHooks(posts);

    // Transform for response
    const response = {
      creator_id,
      campaign_id,
      hook_strength: audit.hookStrength,
      content_diversity: audit.contentDiversity,
      best_performing_style: audit.bestPerformingStyle,
      top_content_styles: audit.topContentStyles.map((style) => ({
        style: style.style,
        average_views: Math.round(style.averageViews),
        average_engagement_rate: style.averageEngagementRate,
        post_count: style.postCount,
        top_post_views: style.topPerformingPost?.views || 0,
      })),
      recommendations: audit.recommendations,
      analyzed_posts: posts.length,
      analysis_date: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Creative audit API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
