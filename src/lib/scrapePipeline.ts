import { analyzePostSemantics, buildCreatorSemanticProfile, type SemanticPostResult } from "@/lib/semanticAnalysis";
import { maybeCreateScoreAlerts, maybeCreateViralPostAlert } from "@/lib/alerts";
import { calculateCreatorScore } from "@/lib/scoring";
import { scrapeTikTokPostsWithMeta } from "@/lib/scraper";

type SupabaseLike = {
  from: (table: string) => any;
};

type CreatorRow = {
  id: string;
  tiktok_username: string;
  display_name?: string | null;
  follower_count?: number | null;
};

type StageFailure = {
  stage: string;
  message: string;
};

export type ScrapePipelineResult = {
  status: "success" | "partial" | "failed";
  scraped: number;
  postsFound: number;
  stageTimingsMs: Record<string, number>;
  stageFailures: StageFailure[];
  scrapeMeta: Record<string, unknown>;
};

export async function executeScrapePipeline(params: {
  supabase: SupabaseLike;
  orgId: string;
  creatorId: string;
  campaignId: string;
  creator: CreatorRow;
  requestId: string;
  scrapeJobId?: string | null;
}): Promise<ScrapePipelineResult> {
  const { supabase, orgId, creatorId, campaignId, creator, requestId, scrapeJobId } = params;
  const startedAt = Date.now();
  const stageTimingsMs: Record<string, number> = {};
  const stageFailures: StageFailure[] = [];
  let postsFound = 0;
  let insertedPosts: any[] = [];
  let scrapeMeta: Record<string, unknown> = {};

  const timeStage = async <T>(stage: string, fn: () => Promise<T>, required = false): Promise<T | null> => {
    const stageStart = Date.now();
    try {
      const result = await fn();
      stageTimingsMs[stage] = Date.now() - stageStart;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stage failure";
      stageTimingsMs[stage] = Date.now() - stageStart;
      stageFailures.push({ stage, message });
      console.error("[scrape-pipeline] stage failed", {
        request_id: requestId,
        creator_id: creatorId,
        campaign_id: campaignId,
        scrape_job_id: scrapeJobId || null,
        stage,
        message,
      });
      if (required) throw error;
      return null;
    }
  };

  try {
    const scrapeResult = await timeStage(
      "scrape_fetch",
      () => scrapeTikTokPostsWithMeta(creator.tiktok_username),
      true
    );
    postsFound = scrapeResult?.posts.length || 0;
    scrapeMeta = scrapeResult?.meta || {};

    const records =
      scrapeResult?.posts.map((post) => ({
        creator_id: creatorId,
        campaign_id: campaignId,
        tiktok_post_id: post.id,
        url: post.url,
        caption: post.caption,
        hashtags: post.hashtags,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        duration_seconds: post.duration,
        posted_at: post.posted_at,
        has_product_link: post.has_product_link,
        scraped_at: new Date().toISOString(),
      })) || [];

    const postUpsertResult = await timeStage(
      "persist_posts",
      async () => {
        if (!records.length) return [];
        const { data, error } = await supabase
          .from("posts")
          .upsert(records, { onConflict: "tiktok_post_id" })
          .select();
        if (error) throw error;
        return data || [];
      },
      true
    );
    insertedPosts = postUpsertResult || [];

    if (insertedPosts.length > 0) {
      await timeStage("revenue_estimates", async () => {
        const { data: campaign, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();
        if (campaignError) throw campaignError;
        if (!campaign) return;
        const rows = insertedPosts.map((post: any) => ({
          post_id: post.id,
          campaign_id: campaignId,
          views: post.views,
          ctr: campaign.default_ctr,
          cvr: campaign.default_cvr,
          aov: campaign.aov,
          commission_rate: campaign.commission_rate,
        }));
        if (!rows.length) return;
        const { error } = await supabase.from("revenue_estimates").upsert(rows, { onConflict: "post_id,campaign_id" });
        if (error) throw error;
      });

      await timeStage("alerts_viral", async () => {
        await Promise.all(
          insertedPosts.map((post: any) =>
            maybeCreateViralPostAlert({
              supabase: supabase as any,
              orgId,
              creatorId,
              creatorName: creator.display_name || creator.tiktok_username,
              campaignId,
              postId: post.id,
              postViews: Number(post.views || 0),
              postUrl: post.url || null,
            })
          )
        );
      });

      await timeStage("semantic_analysis", async () => {
        const semanticRows = await mapWithConcurrency(insertedPosts, 3, async (post: any) => {
          const semantic = await analyzePostSemantics({
            caption: post.caption || "",
            hashtags: post.hashtags || [],
            views: post.views || 0,
            likes: post.likes || 0,
            comments: post.comments || 0,
            shares: post.shares || 0,
            has_product_link: Boolean(post.has_product_link),
          });
          return {
            post_id: post.id,
            creator_id: creatorId,
            campaign_id: campaignId,
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
          };
        });

        if (!semanticRows.length) return;
        const { data: semanticData, error: semanticError } = await supabase
          .from("post_semantic_features")
          .upsert(semanticRows, { onConflict: "post_id" })
          .select();
        if (semanticError) throw semanticError;

        const { data: campaign, error: campaignError } = await supabase
          .from("campaigns")
          .select("name, product_name")
          .eq("id", campaignId)
          .single();
        if (campaignError) throw campaignError;

        const profile = buildCreatorSemanticProfile((semanticData || []) as SemanticPostResult[], campaign || undefined);
        const { error: profileError } = await supabase.from("creator_semantic_profiles").upsert(
          {
            creator_id: creatorId,
            campaign_id: campaignId,
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
        if (profileError) throw profileError;
      });

      await timeStage("score_recompute", async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: creatorPosts, error: postsError } = await supabase
          .from("posts")
          .select("*, revenue_estimates(*)")
          .eq("creator_id", creatorId)
          .eq("campaign_id", campaignId)
          .gte("posted_at", thirtyDaysAgo)
          .order("posted_at", { ascending: false });
        if (postsError) throw postsError;

        const { data: prevScore, error: prevError } = await supabase
          .from("performance_scores")
          .select("*")
          .eq("creator_id", creatorId)
          .eq("campaign_id", campaignId)
          .order("score_date", { ascending: false })
          .limit(1)
          .single();
        if (prevError && prevError.code !== "PGRST116") throw prevError;

        const score = calculateCreatorScore(creatorPosts || [], prevScore || null, {
          follower_count: Number(creator.follower_count || 0),
        });
        const { error: scoreError } = await supabase
          .from("performance_scores")
          .upsert({ ...score, creator_id: creatorId, campaign_id: campaignId }, { onConflict: "creator_id,campaign_id,score_date" });
        if (scoreError) throw scoreError;

        await maybeCreateScoreAlerts({
          supabase: supabase as any,
          orgId,
          creatorId,
          creatorName: creator.display_name || creator.tiktok_username,
          campaignId,
          previousOverallScore:
            prevScore && prevScore.overall_score !== null && prevScore.overall_score !== undefined
              ? Number(prevScore.overall_score)
              : null,
          currentOverallScore: Number(score.overall_score || 0),
          latestPostAt: creatorPosts && creatorPosts.length > 0 && creatorPosts[0].posted_at ? String(creatorPosts[0].posted_at) : null,
        });
      });
    }

    const status = stageFailures.length > 0 ? "partial" : "success";
    await supabase.from("scrape_log").insert({
      creator_id: creatorId,
      org_id: orgId,
      campaign_id: campaignId,
      scrape_job_id: scrapeJobId || null,
      request_id: requestId,
      status,
      posts_found: postsFound,
      duration_ms: Date.now() - startedAt,
      error_message: stageFailures.map((failure) => `${failure.stage}: ${failure.message}`).slice(0, 3).join(" | ") || null,
      details: {
        stage_timings_ms: stageTimingsMs,
        stage_failures: stageFailures,
        scraper_meta: scrapeMeta,
      },
    });

    return {
      status,
      scraped: insertedPosts.length,
      postsFound,
      stageTimingsMs,
      stageFailures,
      scrapeMeta,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scrape failure";
    await supabase.from("scrape_log").insert({
      creator_id: creatorId,
      org_id: orgId,
      campaign_id: campaignId,
      scrape_job_id: scrapeJobId || null,
      request_id: requestId,
      status: "failed",
      posts_found: postsFound,
      duration_ms: Date.now() - startedAt,
      error_message: message,
      details: {
        stage_timings_ms: stageTimingsMs,
        stage_failures: stageFailures,
        scraper_meta: scrapeMeta,
      },
    });
    throw error;
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const workers = Math.max(1, Math.min(concurrency, items.length));
  const queue = items.map((item, index) => ({ item, index }));
  const results = new Array<R>(items.length);

  await Promise.all(
    Array.from({ length: workers }).map(async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        results[next.index] = await mapper(next.item, next.index);
      }
    })
  );

  return results;
}
