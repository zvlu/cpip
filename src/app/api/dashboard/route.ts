import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import { buildActionRecommendations, buildWeeklyBrief } from "@/lib/dashboardInsights";

export const dynamic = "force-dynamic";

const DashboardQuerySchema = z.object({
  campaign_id: z.union([z.string().uuid(), z.literal("default")]).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const parsed = DashboardQuerySchema.parse({
      campaign_id: searchParams.get("campaign_id") || undefined,
    });
    let campaign_id = parsed.campaign_id ?? null;

    if (!campaign_id || campaign_id === "default") {
      const { data: fallbackCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      campaign_id = fallbackCampaign?.id ?? null;
    } else {
      await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);
    }

    const today = new Date().toISOString().split("T")[0];

    const [creatorsRes, topRes, bottomRes, postsRes, revRes, alertsRes, tierRes, tasksRes] = await Promise.all([
      supabase.from("creators").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "active"),
      supabase
        .from("performance_scores")
        .select("*, creators(tiktok_username, display_name, avatar_url)")
        .eq("campaign_id", campaign_id || "")
        .eq("score_date", today)
        .order("overall_score", { ascending: false })
        .limit(10),
      supabase
        .from("performance_scores")
        .select("*, creators(tiktok_username, display_name, avatar_url)")
        .eq("campaign_id", campaign_id || "")
        .eq("score_date", today)
        .order("overall_score", { ascending: true })
        .limit(10),
      supabase
        .from("posts")
        .select("*, creators(tiktok_username, display_name)")
        .eq("campaign_id", campaign_id || "")
        .gte("posted_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("views", { ascending: false })
        .limit(20),
      supabase.from("revenue_estimates").select("estimated_revenue").eq("campaign_id", campaign_id || ""),
      supabase.from("alerts").select("*").eq("org_id", orgId).eq("read", false).order("created_at", { ascending: false }).limit(10),
      supabase.from("performance_scores").select("tier").eq("campaign_id", campaign_id || "").eq("score_date", today),
      supabase
        .from("recommendation_tasks")
        .select("*")
        .eq("org_id", orgId)
        .eq("campaign_id", campaign_id || "")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Log any errors for debugging
    const errors = [creatorsRes.error, topRes.error, bottomRes.error, postsRes.error, revRes.error, alertsRes.error, tierRes.error, tasksRes.error].filter(Boolean);
    if (errors.length > 0) {
      console.warn("Dashboard query warnings:", errors);
    }

    const totalRevenue = revRes.data?.reduce((s, r) => s + Number(r.estimated_revenue), 0) || 0;
    const tierDist = (tierRes.data || []).reduce(
      (a: any, s: any) => {
        a[s.tier] = (a[s.tier] || 0) + 1;
        return a;
      },
      {}
    );
    const topPerformers = topRes.data || [];
    const bottomPerformers = bottomRes.data || [];
    const unreadAlerts = alertsRes.data || [];

    const actionRecommendations = buildActionRecommendations({
      topPerformers,
      bottomPerformers,
      unreadAlerts,
    });
    const weeklyBrief = buildWeeklyBrief({
      totalCreators: creatorsRes.count || 0,
      totalEstimatedRevenue: totalRevenue,
      unreadAlerts,
      topPerformers,
      bottomPerformers,
    });

    return apiSuccess({
      total_creators: creatorsRes.count || 0,
      total_estimated_revenue: totalRevenue,
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      recent_top_posts: postsRes.data || [],
      unread_alerts: unreadAlerts,
      tier_distribution: tierDist,
      action_recommendations: actionRecommendations,
      weekly_brief: weeklyBrief,
      recommendation_tasks: tasksRes.data || [],
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Dashboard API error");
  }
}
