import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("creators").select("*").eq("id", params.id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Creator detail API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
