import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const creator_id = searchParams.get("creator_id");
    const campaign_id = searchParams.get("campaign_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Require at least one filter to prevent fetching all posts
    if (!creator_id && !campaign_id) {
      return NextResponse.json(
        { error: "Either creator_id or campaign_id is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("posts")
      .select("*, revenue_estimates(*)")
      .order("posted_at", { ascending: false })
      .limit(limit);

    if (creator_id) query = query.eq("creator_id", creator_id);
    if (campaign_id) query = query.eq("campaign_id", campaign_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Posts API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
