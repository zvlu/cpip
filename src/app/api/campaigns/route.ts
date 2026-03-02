import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { getRequestId, handleApiError, apiSuccess } from "@/lib/api/response";

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  product_name: z.string().optional(),
  aov: z.number().default(45.0),
  commission_rate: z.number().default(0.15),
  default_ctr: z.number().default(0.02),
  default_cvr: z.number().default(0.03),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Campaigns GET error");
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const body = await req.json();
    const parsed = CreateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        org_id: orgId,
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

    if (error) throw error;
    return apiSuccess({ data }, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Campaigns POST error");
  }
}
