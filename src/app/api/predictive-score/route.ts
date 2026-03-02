import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { calculatePredictiveROIScore, assignTierByPredictiveScore } from "@/lib/predictiveScore";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg, assertDemoModeWritable } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const PredictiveScoreBodySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

const PredictiveScoreQuerySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, user, isDemoMode } = auth;
    assertDemoModeWritable(isDemoMode);
    const { creator_id, campaign_id } = PredictiveScoreBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("predictive-score", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 20,
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);

    // Fetch creator data
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creator_id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Fetch posts from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .gte("posted_at", thirtyDaysAgo);

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: "No posts found for this creator in the last 30 days" },
        { status: 400 }
      );
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, product_name")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const { data: semanticProfile } = await supabase
      .from("creator_semantic_profiles")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .single();

    // Calculate metrics
    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalEngagement = posts.reduce((sum, p) => sum + ((p.likes || 0) + (p.comments || 0) + (p.shares || 0)), 0);
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
    const averageViews = totalViews / posts.length;
    const viralPostCount = posts.filter((p) => (p.views || 0) > 100000).length;

    // Estimate audience growth (simplified - would need historical data for accuracy)
    const followerGrowthRate = creator.follower_count > 0 ? Math.min(5, (creator.follower_count / 1000) * 0.1) : 0;

    // Post frequency
    const postFrequency = posts.length / 4.3; // Approximate weeks in 30 days

    // Use semantic profile when available, otherwise deterministic fallback from post text.
    const textBlob = posts
      .map((p) => `${(p.caption || "").toLowerCase()} ${(Array.isArray(p.hashtags) ? p.hashtags.join(" ") : "")}`)
      .join(" ");

    const positiveWords = ["love", "amazing", "great", "best", "awesome", "perfect", "recommend"];
    const negativeWords = ["hate", "bad", "worst", "awful", "disappointed", "boring", "scam"];
    const positiveHits = positiveWords.reduce((sum, word) => sum + (textBlob.includes(word) ? 1 : 0), 0);
    const negativeHits = negativeWords.reduce((sum, word) => sum + (textBlob.includes(word) ? 1 : 0), 0);

    const averageSentiment = semanticProfile?.average_sentiment ?? Math.max(0, Math.min(100, 50 + positiveHits * 8 - negativeHits * 10));
    const contentConsistency =
      semanticProfile?.content_consistency ??
      (() => {
        const hashtagCounts: Record<string, number> = {};
        for (const post of posts) {
          const tags = Array.isArray(post.hashtags) ? post.hashtags : [];
          for (const tag of tags.slice(0, 5)) {
            const key = String(tag).toLowerCase();
            hashtagCounts[key] = (hashtagCounts[key] || 0) + 1;
          }
        }
        const counts = Object.values(hashtagCounts);
        if (!counts.length) return 45;
        const maxCount = Math.max(...counts);
        const total = counts.reduce((sum, n) => sum + n, 0);
        const dominantShare = total > 0 ? maxCount / total : 0;
        return Math.max(0, Math.min(100, 20 + dominantShare * 80));
      })();

    const audienceDemographicMatch =
      semanticProfile?.audience_demographic_match ??
      (() => {
        const ctx = `${campaign?.name || ""} ${campaign?.product_name || ""}`.toLowerCase();
        if (!ctx.trim()) return 55;
        const topicHints = ["beauty", "fashion", "fitness", "food", "tech", "lifestyle", "travel", "finance"];
        const overlap = topicHints.filter((hint) => textBlob.includes(hint) && ctx.includes(hint)).length;
        return Math.max(0, Math.min(100, 45 + overlap * 15));
      })();

    // Calculate predictive score
    const scoreInput = {
      engagementRate,
      averageViews,
      followerGrowthRate,
      postFrequency,
      audienceDemographicMatch,
      contentConsistency,
      viralPostCount,
      totalPosts: posts.length,
      averageSentiment,
    };

    const predictiveScore = calculatePredictiveROIScore(scoreInput);
    const tier = assignTierByPredictiveScore(predictiveScore.overallROIScore);

    // Save to database
    const { data, error } = await supabase
      .from("predictive_scores")
      .upsert(
        {
          creator_id,
          campaign_id,
          conversion_probability: predictiveScore.conversionProbability,
          viral_potential: predictiveScore.viralPotential,
          overall_roi_score: predictiveScore.overallROIScore,
          tier,
          recommendations: predictiveScore.recommendations,
          risk_factors: predictiveScore.riskFactors,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "creator_id,campaign_id" }
      )
      .select();

    if (error) {
      throw error;
    }

    return apiSuccess({
      success: true,
      predictiveScore,
      tier,
      data: data?.[0],
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Predictive score POST error");
  }
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const { creator_id, campaign_id } = PredictiveScoreQuerySchema.parse({
      creator_id: searchParams.get("creator_id"),
      campaign_id: searchParams.get("campaign_id"),
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);

    const { data, error } = await supabase
      .from("predictive_scores")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Predictive score not found" }, { status: 404 });
    }

    return apiSuccess(data, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Predictive score GET error");
  }
}
