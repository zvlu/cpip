import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { scrapeTikTokPosts } from "@/lib/scraper";
import { calculateCreatorScore } from "@/lib/scoring";
import { analyzePostSemantics, buildCreatorSemanticProfile, type SemanticPostResult } from "@/lib/semanticAnalysis";
import { maybeCreateScoreAlerts, maybeCreateViralPostAlert } from "@/lib/alerts";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const ScrapeBodySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.union([z.string().uuid(), z.literal("default")]).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, user, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const { creator_id, campaign_id } = ScrapeBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("scrape", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 5,
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    const { data: creator } = await supabase.from("creators").select("*").eq("id", creator_id).single();
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    let targetCampaignId: string | null = campaign_id ?? null;
    if (!targetCampaignId || targetCampaignId === "default") {
      const { data: fallbackCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      targetCampaignId = fallbackCampaign?.id ?? null;
    } else {
      await assertCampaignOwnedByOrg(supabase, targetCampaignId, orgId);
    }

    if (!targetCampaignId) {
      return NextResponse.json({ error: "No active campaign found for your organization" }, { status: 400 });
    }

    const start = Date.now();
    try {
      const posts = await scrapeTikTokPosts(creator.tiktok_username);
      const records = posts.map((p: any) => ({
        creator_id,
        campaign_id: targetCampaignId,
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
          const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", targetCampaignId).single();

          if (campaign) {
            const revenueEstimates = insertedPosts.map((post: any) => ({
              post_id: post.id,
              campaign_id: targetCampaignId,
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

      if (insertedPosts && insertedPosts.length > 0) {
        try {
          await Promise.all(
            insertedPosts.map((post: any) =>
              maybeCreateViralPostAlert({
                supabase,
                orgId,
                creatorId: creator_id,
                creatorName: creator.display_name || creator.tiktok_username,
                campaignId: targetCampaignId!,
                postId: post.id,
                postViews: Number(post.views || 0),
                postUrl: post.url || null,
              })
            )
          );
        } catch (err: any) {
          console.error("Viral alert generation failed:", err);
        }
      }

      // Auto-run semantic analysis and update creator semantic profile
      if (insertedPosts && insertedPosts.length > 0) {
        try {
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
          }> = [];

          for (const post of insertedPosts) {
            const semantic = await analyzePostSemantics({
              caption: post.caption || "",
              hashtags: post.hashtags || [],
              views: post.views || 0,
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
              has_product_link: Boolean(post.has_product_link),
            });

            semanticRows.push({
              post_id: post.id,
              creator_id,
              campaign_id: targetCampaignId,
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
              analyzed_at: new Date().toISOString(),
            });
          }

          if (semanticRows.length > 0) {
            const { data: semanticData, error: semanticError } = await supabase
              .from("post_semantic_features")
              .upsert(semanticRows, { onConflict: "post_id" })
              .select();

            if (!semanticError && semanticData) {
              const { data: campaign } = await supabase
                .from("campaigns")
                .select("name, product_name")
                .eq("id", targetCampaignId)
                .single();

              const profile = buildCreatorSemanticProfile(semanticData as SemanticPostResult[], campaign || undefined);
              await supabase.from("creator_semantic_profiles").upsert(
                {
                  creator_id,
                  campaign_id: targetCampaignId,
                  top_topics: profile.top_topics,
                  content_consistency: profile.content_consistency,
                  average_sentiment: profile.average_sentiment,
                  audience_demographic_match: profile.audience_demographic_match,
                  recommendations: profile.recommendations,
                  metadata: profile.metadata,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "creator_id,campaign_id" }
              );
            }
          }
        } catch (err: any) {
          console.error("Semantic analysis failed:", err);
        }
      }

      // Auto-calculate score for creator
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: creatorPosts } = await supabase
          .from("posts")
          .select("*, revenue_estimates(*)")
          .eq("creator_id", creator_id)
          .eq("campaign_id", targetCampaignId)
          .gte("posted_at", thirtyDaysAgo)
          .order("posted_at", { ascending: false });

        const { data: prevScore } = await supabase
          .from("performance_scores")
          .select("*")
          .eq("creator_id", creator_id)
          .eq("campaign_id", targetCampaignId)
          .order("score_date", { ascending: false })
          .limit(1)
          .single();

        const score = calculateCreatorScore(creatorPosts || [], prevScore, creator);
        await supabase
          .from("performance_scores")
          .upsert({ ...score, creator_id, campaign_id: targetCampaignId }, { onConflict: "creator_id,campaign_id,score_date" })
          .select();

        await maybeCreateScoreAlerts({
          supabase,
          orgId,
          creatorId: creator_id,
          creatorName: creator.display_name || creator.tiktok_username,
          campaignId: targetCampaignId,
          previousOverallScore:
            prevScore && prevScore.overall_score !== null && prevScore.overall_score !== undefined
              ? Number(prevScore.overall_score)
              : null,
          currentOverallScore: Number(score.overall_score || 0),
          latestPostAt:
            creatorPosts && creatorPosts.length > 0 && creatorPosts[0].posted_at
              ? String(creatorPosts[0].posted_at)
              : null,
        });
      } catch (err: any) {
        console.error("Score calculation failed:", err);
      }

      await supabase.from("scrape_log").insert({
        creator_id,
        status: "success",
        posts_found: posts.length,
        duration_ms: Date.now() - start,
      });

      return apiSuccess({ scraped: insertedPosts?.length || 0 }, 200, requestId);
    } catch (err: any) {
      await supabase.from("scrape_log").insert({
        creator_id,
        status: "failed",
        error_message: err.message,
        duration_ms: Date.now() - start,
      });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error, requestId, "Scrape API error");
  }
}
