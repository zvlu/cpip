import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { calculateCreatorScore } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { campaign_id, creator_id } = await req.json();

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    let query = supabase.from("campaign_creators").select("creator_id, creators(*)").eq("campaign_id", campaign_id);
    if (creator_id) query = query.eq("creator_id", creator_id);
    const { data: cc, error: ccError } = await query;

    if (ccError) {
      return NextResponse.json({ error: ccError.message }, { status: 500 });
    }

    if (!cc || cc.length === 0) {
      return NextResponse.json({ error: "No creators found for this campaign", scores: [] }, { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const scores = [];

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

        const score = calculateCreatorScore(posts || [], prev || null, c.creators as any);
        scores.push({ ...score, creator_id: c.creator_id, campaign_id });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scores: data || [] });
  } catch (error: any) {
    console.error("Scores calculate API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
