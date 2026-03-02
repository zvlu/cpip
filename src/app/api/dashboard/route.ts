import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

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

    const [creatorsRes, topRes, postsRes, revRes, alertsRes, tierRes] = await Promise.all([
      supabase.from("creators").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "active"),
      supabase
        .from("performance_scores")
        .select("*, creators(tiktok_username, display_name, avatar_url)")
        .eq("campaign_id", campaign_id || "")
        .eq("score_date", today)
        .order("overall_score", { ascending: false })
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
    ]);

    // Log any errors for debugging
    const errors = [creatorsRes.error, topRes.error, postsRes.error, revRes.error, alertsRes.error, tierRes.error].filter(Boolean);
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

    return apiSuccess({
      total_creators: creatorsRes.count || 0,
      total_estimated_revenue: totalRevenue,
      top_performers: topRes.data || [],
      recent_top_posts: postsRes.data || [],
      unread_alerts: alertsRes.data || [],
      tier_distribution: tierDist,
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Dashboard API error");
  }
}
