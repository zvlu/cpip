import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

const CreatorSchema = z.object({
  tiktok_username: z.string().min(1).max(50),
  display_name: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign_id: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "25");

    const query = supabase
      .from("creators")
      .select(
        `*, latest_score:performance_scores(overall_score, tier, engagement_score, revenue_score, consistency_score, score_date)`
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], total: count, page, limit });
  } catch (error) {
    console.error("[v0] Creators GET error:", error);
    return NextResponse.json({ data: [], error: "Failed to load creators" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const parsed = CreatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    let orgId = DEMO_ORG_ID;
    if (user) {
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
      orgId = profile?.org_id ?? DEMO_ORG_ID;
    }

    const { data, error } = await supabase
      .from("creators")
      .insert({ ...parsed.data, org_id: orgId })
      .select()
      .single();
    if (error) throw error;

    if (parsed.data.campaign_id) {
      await supabase.from("campaign_creators").insert({
        campaign_id: parsed.data.campaign_id,
        creator_id: data.id,
      });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("[v0] Creators POST error:", error);
    return NextResponse.json({ error: "Failed to create creator" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("creators")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[v0] Creators PATCH error:", error);
    return NextResponse.json({ error: "Failed to update creator" }, { status: 500 });
  }
}
