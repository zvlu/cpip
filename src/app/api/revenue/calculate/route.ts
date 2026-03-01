import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { campaign_id, creator_id } = await req.json();

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    let query = supabase.from("posts").select("*").eq("campaign_id", campaign_id);
    if (creator_id) query = query.eq("creator_id", creator_id);
    const { data: posts } = await query;
    if (!posts?.length) return NextResponse.json({ estimates: [], total: 0 });

    const estimates = posts.map((post) => ({
      post_id: post.id,
      campaign_id,
      views: post.views,
      ctr: campaign.default_ctr,
      cvr: campaign.default_cvr,
      aov: campaign.aov,
      commission_rate: campaign.commission_rate,
    }));

    const { data, error } = await supabase.from("revenue_estimates").upsert(estimates, { onConflict: "post_id,campaign_id" }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const totalRevenue = data?.reduce((s, e) => s + Number(e.estimated_revenue), 0) || 0;
    return NextResponse.json({ estimates: data, total_estimated_revenue: totalRevenue, post_count: data?.length });
  } catch (error: any) {
    console.error("Revenue calculate API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
