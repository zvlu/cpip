import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("org_id", DEMO_ORG_ID)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Alerts API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { id, read } = await req.json();
    const { error } = await supabase.from("alerts").update({ read }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Alerts PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
