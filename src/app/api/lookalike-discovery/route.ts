import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { calculateSimilarityScore, generateOutreachSnippet } from "@/lib/lookalikeDiscovery";

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

    // Fetch seed creator
    const { data: seedCreator, error: seedError } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creator_id)
      .single();

    if (seedError || !seedCreator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

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
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    if (!campaignCreators || campaignCreators.length === 0) {
      return NextResponse.json({
        seed_creator: {
          id: seedCreator.id,
          username: seedCreator.tiktok_username,
        },
        similar_creators: [],
        discovery_insights: ["No other creators in this campaign to compare against"],
      });
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

    return NextResponse.json({
      seed_creator: {
        id: seedCreator.id,
        username: seedCreator.tiktok_username,
      },
      similar_creators: topMatches,
      discovery_insights: insights,
    });
  } catch (error: any) {
    console.error("Lookalike discovery API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
