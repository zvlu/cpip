import { buildActionRecommendations, buildWeeklyBrief } from "@/lib/dashboardInsights";

type GenericSupabaseClient = {
  from: (table: string) => any;
};

export async function resolveCampaignForBrief(params: {
  supabase: GenericSupabaseClient;
  orgId: string;
  campaignId?: string | null;
}): Promise<string | null> {
  const { supabase, orgId, campaignId } = params;
  if (campaignId) {
    const { data: explicitCampaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .single();
    return explicitCampaign?.id ?? null;
  }

  const { data: fallbackCampaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return fallbackCampaign?.id ?? null;
}

export async function buildWeeklyBriefPayload(params: {
  supabase: GenericSupabaseClient;
  orgId: string;
  campaignId?: string | null;
}) {
  const { supabase, orgId } = params;
  const resolvedCampaignId = await resolveCampaignForBrief({
    supabase,
    orgId,
    campaignId: params.campaignId || null,
  });
  const today = new Date().toISOString().split("T")[0];

  const [creatorsRes, topRes, bottomRes, revRes, alertsRes] = await Promise.all([
    supabase.from("creators").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "active"),
    supabase
      .from("performance_scores")
      .select("id, overall_score, creators(tiktok_username, display_name)")
      .eq("campaign_id", resolvedCampaignId || "")
      .eq("score_date", today)
      .order("overall_score", { ascending: false })
      .limit(5),
    supabase
      .from("performance_scores")
      .select("id, overall_score, creators(tiktok_username, display_name)")
      .eq("campaign_id", resolvedCampaignId || "")
      .eq("score_date", today)
      .order("overall_score", { ascending: true })
      .limit(5),
    supabase.from("revenue_estimates").select("estimated_revenue").eq("campaign_id", resolvedCampaignId || ""),
    supabase.from("alerts").select("id, type, severity, title").eq("org_id", orgId).eq("read", false).limit(50),
  ]);

  const totalRevenue = revRes.data?.reduce((sum: number, row: any) => sum + Number(row.estimated_revenue || 0), 0) || 0;
  const topPerformers = topRes.data || [];
  const bottomPerformers = bottomRes.data || [];
  const unreadAlerts = alertsRes.data || [];

  const weeklyBrief = buildWeeklyBrief({
    totalCreators: creatorsRes.count || 0,
    totalEstimatedRevenue: totalRevenue,
    unreadAlerts,
    topPerformers,
    bottomPerformers,
  });
  const actionRecommendations = buildActionRecommendations({
    topPerformers,
    bottomPerformers,
    unreadAlerts,
  });

  return {
    campaign_id: resolvedCampaignId,
    weekly_brief: weeklyBrief,
    action_recommendations: actionRecommendations,
  };
}
