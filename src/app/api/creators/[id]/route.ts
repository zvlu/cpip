import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[v0] Creator detail error:", error);
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
}
