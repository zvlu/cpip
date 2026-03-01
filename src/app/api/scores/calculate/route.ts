import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { calculateCreatorScore } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { campaign_id, creator_id } = await req.json();

    let query = supabase.from("campaign_creators").select("creator_id, creators(*)").eq("campaign_id", campaign_id);
    if (creator_id) query = query.eq("creator_id", creator_id);
    const { data: cc } = await query;
    if (!cc?.length) return NextResponse.json({ error: "No creators found" }, { status: 404 });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const scores = [];

    for (const c of cc) {
      const { data: posts } = await supabase
        .from("posts")
        .select("*, revenue_estimates(*)")
        .eq("creator_id", c.creator_id)
        .eq("campaign_id", campaign_id)
        .gte("posted_at", thirtyDaysAgo)
        .order("posted_at", { ascending: false });
      const { data: prev } = await supabase
        .from("performance_scores")
        .select("*")
        .eq("creator_id", c.creator_id)
        .eq("campaign_id", campaign_id)
        .order("score_date", { ascending: false })
        .limit(1)
        .single();

      const score = calculateCreatorScore(posts || [], prev, c.creators as any);
      scores.push({ ...score, creator_id: c.creator_id, campaign_id });
    }

    const { data, error } = await supabase.from("performance_scores").upsert(scores, { onConflict: "creator_id,campaign_id,score_date" }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scores: data });
  } catch (error: any) {
    console.error("Scores calculate API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
