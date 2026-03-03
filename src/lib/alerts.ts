import type { SupabaseClient } from "@supabase/supabase-js";

type AlertSeverity = "info" | "warning" | "critical";
type AlertType =
  | "score_drop"
  | "score_rise"
  | "viral_post"
  | "inactive"
  | "new_milestone"
  | "anomaly"
  | "campaign_target";

type AlertInsert = {
  org_id: string;
  creator_id?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
};

const ALERT_DEDUP_WINDOW_HOURS = 24;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDateAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

async function insertAlertWithDedup(
  supabase: SupabaseClient,
  alert: AlertInsert,
  dedupeWindowHours = ALERT_DEDUP_WINDOW_HOURS
): Promise<boolean> {
  const sinceIso = new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000).toISOString();

  let dedupeQuery = supabase
    .from("alerts")
    .select("id")
    .eq("org_id", alert.org_id)
    .eq("type", alert.type)
    .eq("title", alert.title)
    .gte("created_at", sinceIso)
    .limit(1);

  if (alert.creator_id) {
    dedupeQuery = dedupeQuery.eq("creator_id", alert.creator_id);
  }

  const { data: existing, error: dedupeError } = await dedupeQuery;
  if (dedupeError) {
    console.warn("Alert dedupe query failed:", dedupeError);
    return false;
  }

  if (existing && existing.length > 0) {
    return false;
  }

  const { error: insertError } = await supabase.from("alerts").insert(alert);
  if (insertError) {
    console.warn("Alert insert failed:", insertError);
    return false;
  }

  return true;
}

export async function maybeCreateScoreAlerts(params: {
  supabase: SupabaseClient;
  orgId: string;
  creatorId: string;
  creatorName?: string | null;
  campaignId: string;
  previousOverallScore?: number | null;
  currentOverallScore: number;
  latestPostAt?: string | null;
  inactiveDaysThreshold?: number;
  scoreDropThreshold?: number;
  scoreRiseThreshold?: number;
}) {
  const {
    supabase,
    orgId,
    creatorId,
    creatorName,
    campaignId,
    previousOverallScore,
    currentOverallScore,
    latestPostAt,
    inactiveDaysThreshold = 14,
    scoreDropThreshold = 10,
    scoreRiseThreshold = 10,
  } = params;

  const readableCreator = creatorName || "Creator";
  const inserts: AlertInsert[] = [];

  if (typeof previousOverallScore === "number" && Number.isFinite(previousOverallScore)) {
    const delta = round(currentOverallScore - previousOverallScore);

    if (delta <= -scoreDropThreshold) {
      inserts.push({
        org_id: orgId,
        creator_id: creatorId,
        type: "score_drop",
        severity: delta <= -20 ? "critical" : "warning",
        title: `${readableCreator} score dropped`,
        message: `Overall score moved from ${round(previousOverallScore)} to ${round(
          currentOverallScore
        )} (${delta}).`,
        data: {
          campaign_id: campaignId,
          previous_overall_score: round(previousOverallScore),
          current_overall_score: round(currentOverallScore),
          delta,
        },
      });
    } else if (delta >= scoreRiseThreshold) {
      inserts.push({
        org_id: orgId,
        creator_id: creatorId,
        type: "score_rise",
        severity: "info",
        title: `${readableCreator} score improved`,
        message: `Overall score increased from ${round(previousOverallScore)} to ${round(
          currentOverallScore
        )} (+${delta}).`,
        data: {
          campaign_id: campaignId,
          previous_overall_score: round(previousOverallScore),
          current_overall_score: round(currentOverallScore),
          delta,
        },
      });
    }
  }

  if (latestPostAt) {
    const lastPostTime = new Date(latestPostAt).getTime();
    if (!Number.isNaN(lastPostTime)) {
      const inactiveDays = Math.floor((Date.now() - lastPostTime) / (24 * 60 * 60 * 1000));
      if (inactiveDays >= inactiveDaysThreshold) {
        inserts.push({
          org_id: orgId,
          creator_id: creatorId,
          type: "inactive",
          severity: inactiveDays >= inactiveDaysThreshold * 2 ? "critical" : "warning",
          title: `${readableCreator} looks inactive`,
          message: `No new posts since ${formatDateAgo(inactiveDays)}.`,
          data: {
            campaign_id: campaignId,
            last_post_at: latestPostAt,
            inactive_days: inactiveDays,
          },
        });
      }
    }
  }

  await Promise.all(inserts.map((entry) => insertAlertWithDedup(supabase, entry)));
}

export async function maybeCreateMilestoneAndAnomalyAlerts(params: {
  supabase: SupabaseClient;
  orgId: string;
  creatorId: string;
  creatorName?: string | null;
  campaignId: string;
  previousOverallScore?: number | null;
  currentOverallScore: number;
  anomalyDeltaThreshold?: number;
}) {
  const {
    supabase,
    orgId,
    creatorId,
    creatorName,
    campaignId,
    previousOverallScore,
    currentOverallScore,
    anomalyDeltaThreshold = 25,
  } = params;

  const readableCreator = creatorName || "Creator";
  const inserts: AlertInsert[] = [];
  const current = round(currentOverallScore);

  if (typeof previousOverallScore === "number" && Number.isFinite(previousOverallScore)) {
    const previous = round(previousOverallScore);
    const delta = round(current - previous);

    if (previous < 80 && current >= 80) {
      inserts.push({
        org_id: orgId,
        creator_id: creatorId,
        type: "new_milestone",
        severity: "info",
        title: `${readableCreator} reached top-tier status`,
        message: `Overall score moved to ${current}, crossing the 80+ elite threshold.`,
        data: {
          campaign_id: campaignId,
          previous_overall_score: previous,
          current_overall_score: current,
          milestone: "tier_s",
        },
      });
    }

    if (Math.abs(delta) >= anomalyDeltaThreshold) {
      inserts.push({
        org_id: orgId,
        creator_id: creatorId,
        type: "anomaly",
        severity: Math.abs(delta) >= 35 ? "critical" : "warning",
        title: `${readableCreator} performance anomaly detected`,
        message: `Overall score changed by ${delta > 0 ? `+${delta}` : delta} in one cycle.`,
        data: {
          campaign_id: campaignId,
          previous_overall_score: previous,
          current_overall_score: current,
          delta,
        },
      });
    }
  }

  await Promise.all(inserts.map((entry) => insertAlertWithDedup(supabase, entry)));
}

export async function maybeCreateViralPostAlert(params: {
  supabase: SupabaseClient;
  orgId: string;
  creatorId: string;
  creatorName?: string | null;
  campaignId: string;
  postId: string;
  postViews: number;
  postUrl?: string | null;
  viralViewsThreshold?: number;
}) {
  const {
    supabase,
    orgId,
    creatorId,
    creatorName,
    campaignId,
    postId,
    postViews,
    postUrl,
    viralViewsThreshold = 100_000,
  } = params;

  if (!Number.isFinite(postViews) || postViews < viralViewsThreshold) {
    return;
  }

  await insertAlertWithDedup(supabase, {
    org_id: orgId,
    creator_id: creatorId,
    type: "viral_post",
    severity: postViews >= viralViewsThreshold * 3 ? "critical" : "warning",
    title: `${creatorName || "Creator"} has a viral post`,
    message: `A post crossed ${viralViewsThreshold.toLocaleString()} views (${Math.round(
      postViews
    ).toLocaleString()} views).`,
    data: {
      campaign_id: campaignId,
      post_id: postId,
      post_url: postUrl || null,
      views: Math.round(postViews),
      threshold: viralViewsThreshold,
    },
  });
}
