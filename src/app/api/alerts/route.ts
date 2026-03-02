import { requireApiContext } from "@/lib/auth/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { assertDemoModeWritable } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const AlertPatchSchema = z.object({
  id: z.string().uuid(),
  read: z.boolean(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;

    const { searchParams } = new URL(req.url);
    const includeRead = searchParams.get("include_read") === "true";
    let query = supabase
      .from("alerts")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!includeRead) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Alerts GET error");
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, isDemoMode } = auth;
    assertDemoModeWritable(isDemoMode);
    const { id, read } = AlertPatchSchema.parse(await req.json());
    
    const { data, error } = await supabase.from("alerts").update({ read }).eq("id", id).eq("org_id", orgId).select().single();
    if (error) throw error;
    return apiSuccess({ success: true, data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Alerts PATCH error");
  }
}
