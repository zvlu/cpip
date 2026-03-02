import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { calculateSimilarityScore, generateOutreachSnippet } from "@/lib/lookalikeDiscovery";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const LookalikeQuerySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, user } = auth;
    const { searchParams } = new URL(req.url);
    const { creator_id, campaign_id } = LookalikeQuerySchema.parse({
      creator_id: searchParams.get("creator_id"),
      campaign_id: searchParams.get("campaign_id"),
    });
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("lookalike-discovery", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 20,
    });
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);

    // Fetch seed creator
    const { data: seedCreator, error: seedError } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creator_id)
      .eq("org_id", orgId)
      .single();

    if (seedError || !seedCreator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    // Fetch seed creator metrics
    const { data: seedMetrics, error: seedMetricsError } = await supabase
      .from("performance_scores")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .order("score_date", { ascending: false })
      .limit(1)
      .single();

    // Fetch all other creators in the campaign
    const { data: campaignCreators, error: campaignError } = await supabase
      .from("campaign_creators")
      .select("creator_id, creators(*)")
      .eq("campaign_id", campaign_id)
      .neq("creator_id", creator_id);

    if (campaignError) {
      throw campaignError;
    }

    if (!campaignCreators || campaignCreators.length === 0) {
      return apiSuccess({
        seed_creator: {
          id: seedCreator.id,
          username: seedCreator.tiktok_username,
        },
        similar_creators: [],
        discovery_insights: ["No other creators in this campaign to compare against"],
      }, 200, requestId);
    }

    // Calculate similarity scores for all candidates
    const similarityScores = await Promise.all(
      campaignCreators.map(async (cc: any) => {
        const candidate = cc.creators;
        const { data: candidateMetrics } = await supabase
          .from("performance_scores")
          .select("*")
          .eq("creator_id", candidate.id)
          .eq("campaign_id", campaign_id)
          .order("score_date", { ascending: false })
          .limit(1)
          .single();

        const { data: topPost } = await supabase
          .from("posts")
          .select("*")
          .eq("creator_id", candidate.id)
          .eq("campaign_id", campaign_id)
          .order("views", { ascending: false })
          .limit(1)
          .single();

        const match = calculateSimilarityScore(
          seedCreator,
          candidate,
          seedMetrics,
          candidateMetrics
        );

        return {
          ...match,
          outreach_snippet: generateOutreachSnippet(
            candidate,
            topPost,
            seedCreator.tiktok_username
          ),
        };
      })
    );

    // Sort by similarity score and return top 10
    const topMatches = similarityScores
      .filter((m) => m.similarity_score >= 50) // Only show meaningful matches
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 10);

    // Generate insights
    const insights = generateDiscoveryInsights(topMatches, seedCreator);

    return apiSuccess({
      seed_creator: {
        id: seedCreator.id,
        username: seedCreator.tiktok_username,
      },
      similar_creators: topMatches,
      discovery_insights: insights,
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Lookalike discovery API error");
  }
}

function generateDiscoveryInsights(matches: any[], seedCreator: any): string[] {
  const insights: string[] = [];

  if (matches.length === 0) {
    insights.push("No similar creators found in this campaign");
    return insights;
  }

  const avgSimilarity = matches.reduce((sum, m) => sum + m.similarity_score, 0) / matches.length;
  insights.push(`Found ${matches.length} similar creators with avg similarity of ${Math.round(avgSimilarity)}%`);

  const avgFollowers = matches.reduce((sum, m) => sum + m.follower_count, 0) / matches.length;
  insights.push(`Average follower count: ${(avgFollowers / 1000).toFixed(0)}K`);

  const topMatch = matches[0];
  insights.push(`Top match: @${topMatch.tiktok_username} (${topMatch.similarity_score}% similarity)`);

  return insights;
}
