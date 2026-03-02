import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_CAMPAIGN_ID = "default";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const campaign_id = searchParams.get("campaign_id") || DEMO_CAMPAIGN_ID;

    if (!campaign_id) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    const org_id = DEMO_ORG_ID;
    const today = new Date().toISOString().split("T")[0];

    const [creatorsRes, topRes, postsRes, revRes, alertsRes, tierRes] = await Promise.all([
      supabase.from("creators").select("id", { count: "exact" }).eq("org_id", org_id).eq("status", "active"),
      supabase
        .from("performance_scores")
        .select("*, creators(tiktok_username, display_name, avatar_url)")
        .eq("campaign_id", campaign_id)
        .eq("score_date", today)
        .order("overall_score", { ascending: false })
        .limit(10),
      supabase
        .from("posts")
        .select("*, creators(tiktok_username, display_name)")
        .eq("campaign_id", campaign_id)
        .gte("posted_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("views", { ascending: false })
        .limit(20),
      supabase.from("revenue_estimates").select("estimated_revenue").eq("campaign_id", campaign_id),
      supabase.from("alerts").select("*").eq("org_id", org_id).eq("read", false).order("created_at", { ascending: false }).limit(10),
      supabase.from("performance_scores").select("tier").eq("campaign_id", campaign_id).eq("score_date", today),
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

    return NextResponse.json({
      total_creators: creatorsRes.count || 0,
      total_estimated_revenue: totalRevenue,
      top_performers: topRes.data || [],
      recent_top_posts: postsRes.data || [],
      unread_alerts: alertsRes.data || [],
      tier_distribution: tierDist,
    });
  } catch (error: any) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
