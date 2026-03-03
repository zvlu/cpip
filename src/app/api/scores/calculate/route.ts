import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { calculateCreatorScore } from "@/lib/scoring";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import { maybeCreateMilestoneAndAnomalyAlerts, maybeCreateScoreAlerts } from "@/lib/alerts";
import { DEFAULT_ALERT_RULES, sanitizeAlertRules } from "@/lib/alertRules";

const ScoresCalculateBodySchema = z.object({
  campaign_id: z.string().uuid(),
  creator_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, user, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const { campaign_id, creator_id } = ScoresCalculateBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("scores-calculate", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 10,
    });
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);
    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    const orgSettings =
      orgRow && typeof orgRow.settings === "object" && orgRow.settings
        ? (orgRow.settings as Record<string, unknown>)
        : {};
    const alertRules = sanitizeAlertRules(orgSettings.alert_rules || DEFAULT_ALERT_RULES);

    let query = supabase.from("campaign_creators").select("creator_id, creators(*)").eq("campaign_id", campaign_id);
    if (creator_id) query = query.eq("creator_id", creator_id);
    const { data: cc, error: ccError } = await query;

    if (ccError) {
      throw ccError;
    }

    if (!cc || cc.length === 0) {
      return NextResponse.json({ error: "No creators found for this campaign", scores: [] }, { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const scores = [];
    const alertCandidates: Array<{
      creatorId: string;
      creatorName: string | null;
      previousOverallScore: number | null;
      currentOverallScore: number;
      latestPostAt: string | null;
    }> = [];

    for (const c of cc) {
      try {
        const { data: posts, error: postsError } = await supabase
          .from("posts")
          .select("*, revenue_estimates(*)")
          .eq("creator_id", c.creator_id)
          .eq("campaign_id", campaign_id)
          .gte("posted_at", thirtyDaysAgo)
          .order("posted_at", { ascending: false });

        if (postsError) {
          console.warn(`Failed to fetch posts for creator ${c.creator_id}:`, postsError);
          continue;
        }

        const { data: prev, error: prevError } = await supabase
          .from("performance_scores")
          .select("*")
          .eq("creator_id", c.creator_id)
          .eq("campaign_id", campaign_id)
          .order("score_date", { ascending: false })
          .limit(1)
          .single();

        if (prevError && prevError.code !== "PGRST116") {
          console.warn(`Failed to fetch previous score for creator ${c.creator_id}:`, prevError);
        }

        const creatorProfile = Array.isArray(c.creators) ? c.creators[0] : c.creators;
        const score = calculateCreatorScore(posts || [], prev || null, creatorProfile as any);
        scores.push({ ...score, creator_id: c.creator_id, campaign_id });
        alertCandidates.push({
          creatorId: c.creator_id,
          creatorName: creatorProfile?.display_name || creatorProfile?.tiktok_username || null,
          previousOverallScore:
            prev && prev.overall_score !== null && prev.overall_score !== undefined
              ? Number(prev.overall_score)
              : null,
          currentOverallScore: Number(score.overall_score || 0),
          latestPostAt:
            posts && posts.length > 0 && posts[0].posted_at ? String(posts[0].posted_at) : null,
        });
      } catch (err: any) {
        console.error(`Error calculating score for creator ${c.creator_id}:`, err);
        continue;
      }
    }

    if (scores.length === 0) {
      return NextResponse.json({ error: "No scores could be calculated", scores: [] }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("performance_scores")
      .upsert(scores, { onConflict: "creator_id,campaign_id,score_date" })
      .select();

    if (error) throw error;

    await Promise.all(
      alertCandidates.map((candidate) =>
        maybeCreateScoreAlerts({
          supabase,
          orgId,
          creatorId: candidate.creatorId,
          creatorName: candidate.creatorName,
          campaignId: campaign_id,
          previousOverallScore: candidate.previousOverallScore,
          currentOverallScore: candidate.currentOverallScore,
          latestPostAt: candidate.latestPostAt,
          inactiveDaysThreshold: alertRules.inactive_days_threshold,
          scoreDropThreshold: alertRules.score_drop_threshold,
          scoreRiseThreshold: alertRules.score_rise_threshold,
        })
      )
    );
    await Promise.all(
      alertCandidates.map((candidate) =>
        maybeCreateMilestoneAndAnomalyAlerts({
          supabase,
          orgId,
          creatorId: candidate.creatorId,
          creatorName: candidate.creatorName,
          campaignId: campaign_id,
          previousOverallScore: candidate.previousOverallScore,
          currentOverallScore: candidate.currentOverallScore,
          anomalyDeltaThreshold: alertRules.anomaly_delta_threshold,
        })
      )
    );

    return apiSuccess({ scores: data || [] }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Scores calculate API error");
  }
}
