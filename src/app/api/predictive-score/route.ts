import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { calculatePredictiveROIScore, assignTierByPredictiveScore } from "@/lib/predictiveScore";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { creator_id, campaign_id } = await req.json();

    if (!creator_id || !campaign_id) {
      return NextResponse.json(
        { error: "creator_id and campaign_id are required" },
        { status: 400 }
      );
    }

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

    // Audience demographic match (simplified - would need campaign target data)
    const audienceDemographicMatch = Math.min(100, 50 + Math.random() * 40); // Placeholder

    // Content consistency (simplified - would analyze hashtags, themes, etc.)
    const contentConsistency = Math.min(100, 60 + Math.random() * 30); // Placeholder

    // Average sentiment (simplified - would use NLP)
    const averageSentiment = Math.min(100, 65 + Math.random() * 25); // Placeholder

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      predictiveScore,
      tier,
      data: data?.[0],
    });
  } catch (error: any) {
    console.error("Predictive score API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const { data, error } = await supabase
      .from("predictive_scores")
      .select("*")
      .eq("creator_id", creator_id)
      .eq("campaign_id", campaign_id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Predictive score not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Predictive score GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
