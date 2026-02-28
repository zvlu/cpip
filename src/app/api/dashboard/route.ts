import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const campaign_id = searchParams.get("campaign_id");
  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.user?.id).single();
  const org_id = profile?.org_id;
  const today = new Date().toISOString().split("T")[0];

  const [creatorsRes, topRes, postsRes, revRes, alertsRes, tierRes] = await Promise.all([
    supabase.from("creators").select("id", { count: "exact" }).eq("org_id", org_id!).eq("status", "active"),
    supabase.from("performance_scores").select("*, creators(tiktok_username, display_name, avatar_url)").eq("campaign_id", campaign_id!).eq("score_date", today).order("overall_score", { ascending: false }).limit(10),
    supabase.from("posts").select("*, creators(tiktok_username, display_name)").eq("campaign_id", campaign_id!).gte("posted_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("views", { ascending: false }).limit(20),
    supabase.from("revenue_estimates").select("estimated_revenue").eq("campaign_id", campaign_id!),
    supabase.from("alerts").select("*").eq("org_id", org_id!).eq("read", false).order("created_at", { ascending: false }).limit(10),
    supabase.from("performance_scores").select("tier").eq("campaign_id", campaign_id!).eq("score_date", today),
  ]);

  const totalRevenue = revRes.data?.reduce((s, r) => s + Number(r.estimated_revenue), 0) || 0;
  const tierDist = (tierRes.data || []).reduce((a: any, s: any) => { a[s.tier] = (a[s.tier] || 0) + 1; return a; }, {});

  return NextResponse.json({
    total_creators: creatorsRes.count || 0,
    total_estimated_revenue: totalRevenue,
    top_performers: topRes.data || [],
    recent_top_posts: postsRes.data || [],
    unread_alerts: alertsRes.data || [],
    tier_distribution: tierDist,
  });
}
