import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { analyzePostSemantics, buildCreatorSemanticProfile, type SemanticPostResult } from "@/lib/semanticAnalysis";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const SemanticAnalyzeBodySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, user, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const { creator_id, campaign_id } = SemanticAnalyzeBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("semantic-analyze", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 10,
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .order("posted_at", { ascending: false })
      .limit(100);

    if (postsError) {
      throw postsError;
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: "No posts found for this creator/campaign" }, { status: 404 });
    }

    const semanticRows: Array<{
      post_id: string;
      creator_id: string;
      campaign_id: string;
      topic_labels: string[];
      hook_type: string;
      cta_strength: number;
      sentiment_score: number;
      brand_safety_score: number;
      audience_intent: string;
      semantic_summary: string;
      model_provider: string;
      model_name: string;
      confidence: number;
      raw_response: Record<string, unknown>;
      analyzed_at: string;
      updated_at: string;
    }> = [];

    for (const post of posts) {
      const semantic = await analyzePostSemantics({
        caption: post.caption || "",
        hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        has_product_link: Boolean(post.has_product_link),
      });

      const now = new Date().toISOString();
      semanticRows.push({
        post_id: post.id,
        creator_id,
        campaign_id,
        topic_labels: semantic.topic_labels,
        hook_type: semantic.hook_type,
        cta_strength: semantic.cta_strength,
        sentiment_score: semantic.sentiment_score,
        brand_safety_score: semantic.brand_safety_score,
        audience_intent: semantic.audience_intent,
        semantic_summary: semantic.semantic_summary,
        model_provider: semantic.model_provider,
        model_name: semantic.model_name,
        confidence: semantic.confidence,
        raw_response: semantic.raw_response,
        analyzed_at: now,
        updated_at: now,
      });
    }

    const { data: semanticData, error: upsertError } = await supabase
      .from("post_semantic_features")
      .upsert(semanticRows, { onConflict: "post_id" })
      .select();

    if (upsertError) {
      throw upsertError;
    }

    const { data: campaignMeta } = await supabase
      .from("campaigns")
      .select("name, product_name")
      .eq("id", campaign_id)
      .single();

    const profile = buildCreatorSemanticProfile((semanticData || []) as SemanticPostResult[], campaignMeta || undefined);
    const { error: profileError } = await supabase.from("creator_semantic_profiles").upsert(
      {
        creator_id,
        campaign_id,
        top_topics: profile.top_topics,
        content_consistency: profile.content_consistency,
        average_sentiment: profile.average_sentiment,
        audience_demographic_match: profile.audience_demographic_match,
        recommendations: profile.recommendations,
        metadata: profile.metadata,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id,campaign_id" }
    );

    if (profileError) {
      throw profileError;
    }

    return apiSuccess({
      success: true,
      analyzed_posts: semanticData?.length || 0,
      profile,
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Semantic analyze API error");
  }
}
