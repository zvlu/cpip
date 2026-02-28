import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreatorSchema = z.object({
  tiktok_username: z.string().min(1).max(50),
  display_name: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign_id: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const campaign_id = searchParams.get("campaign_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  let query = supabase
    .from("creators")
    .select(`*, latest_score:performance_scores(overall_score, tier, engagement_score, revenue_score, consistency_score, score_date), post_count:posts(count), campaign_creators(campaign_id)`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (campaign_id) query = query.eq("campaign_creators.campaign_id", campaign_id);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();
  const parsed = CreatorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.user?.id).single();

  const { data, error } = await supabase.from("creators").insert({ ...parsed.data, org_id: profile?.org_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.campaign_id) {
    await supabase.from("campaign_creators").insert({ campaign_id: parsed.data.campaign_id, creator_id: data.id });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase.from("creators").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
