import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { analyzeContentHooks } from "@/lib/hookAnalysis";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const CreativeAuditQuerySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const { creator_id, campaign_id } = CreativeAuditQuerySchema.parse({
      creator_id: searchParams.get("creator_id"),
      campaign_id: searchParams.get("campaign_id"),
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);

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
      throw postsError;
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

    return apiSuccess(response, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Creative audit API error");
  }
}
