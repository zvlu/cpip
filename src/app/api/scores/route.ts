import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");
  const campaign_id = searchParams.get("campaign_id");

  let query = supabase.from("performance_scores").select("*").order("score_date", { ascending: false }).limit(30);
  if (creator_id) query = query.eq("creator_id", creator_id);
  if (campaign_id) query = query.eq("campaign_id", campaign_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
