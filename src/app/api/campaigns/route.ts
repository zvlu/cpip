import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  product_name: z.string().optional(),
  aov: z.number().default(45.0),
  commission_rate: z.number().default(0.15),
  default_ctr: z.number().default(0.02),
  default_cvr: z.number().default(0.03),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const org_id = searchParams.get("org_id") || DEMO_ORG_ID;

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", org_id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Campaigns GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const parsed = CreateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        org_id: DEMO_ORG_ID,
        name: parsed.data.name,
        product_name: parsed.data.product_name || null,
        aov: parsed.data.aov,
        commission_rate: parsed.data.commission_rate,
        default_ctr: parsed.data.default_ctr,
        default_cvr: parsed.data.default_cvr,
        status: "active",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Campaigns POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
