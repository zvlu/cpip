import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEMO_ORG_ID;
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return profile?.org_id ?? DEMO_ORG_ID;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaign_id");
    const today = new Date().toISOString().split("T")[0];

    const [creatorsRes, topRes, postsRes, revRes, alertsRes] = await Promise.all([
      supabase
        .from("creators")
        .select("id", { count: "exact" })
        .eq("org_id", orgId)
        .eq("status", "active"),
      supabase
        .from("performance_scores")
        .select("*, creators(tiktok_username, display_name)")
        .eq("score_date", today)
        .order("overall_score", { ascending: false })
        .limit(10),
      supabase
        .from("posts")
        .select("id, caption, views, likes, comments, shares, posted_at, creator_id, creators(tiktok_username, display_name)")
        .gte("posted_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("views", { ascending: false })
        .limit(20),
      supabase
        .from("revenue_estimates")
        .select("estimated_revenue, estimated_gmv"),
      supabase
        .from("alerts")
        .select("*")
        .eq("org_id", orgId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const totalRevenue = revRes.data?.reduce((s, r) => s + Number(r.estimated_revenue ?? 0), 0) ?? 0;
    const totalGmv = revRes.data?.reduce((s, r) => s + Number(r.estimated_gmv ?? 0), 0) ?? 0;

    // Build tier distribution from top performers
    const tierDist = (topRes.data ?? []).reduce<Record<string, number>>((a, s) => {
      const t = s.tier as string;
      if (t) a[t] = (a[t] ?? 0) + 1;
      return a;
    }, {});

    return NextResponse.json({
      total_creators: creatorsRes.count ?? 0,
      total_estimated_revenue: totalRevenue,
      total_gmv: totalGmv,
      top_performers: topRes.data ?? [],
      recent_top_posts: postsRes.data ?? [],
      unread_alerts: alertsRes.data ?? [],
      tier_distribution: tierDist,
    });
  } catch (error) {
    console.error("[v0] Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
