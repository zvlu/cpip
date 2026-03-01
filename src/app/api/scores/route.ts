import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creator_id");
    const campaignId = searchParams.get("campaign_id");

    let query = supabase
      .from("performance_scores")
      .select("*")
      .order("score_date", { ascending: false })
      .limit(30);

    if (creatorId) query = query.eq("creator_id", creatorId);
    if (campaignId && campaignId !== "default") query = query.eq("campaign_id", campaignId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("[v0] Scores GET error:", error);
    return NextResponse.json({ data: [], error: "Failed to load scores" }, { status: 500 });
  }
}
