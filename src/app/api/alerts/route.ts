import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let orgId = DEMO_ORG_ID;
    if (user) {
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
      orgId = profile?.org_id ?? DEMO_ORG_ID;
    }

    const { data, error } = await supabase
      .from("alerts")
      .select("*, creators(display_name, tiktok_username)")
      .eq("org_id", orgId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("[v0] Alerts GET error:", error);
    return NextResponse.json({ data: [], error: "Failed to load alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { id, read } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase.from("alerts").update({ read }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Alerts PATCH error:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
