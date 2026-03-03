import { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/auth/server";
import { assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role } = auth;
    assertElevatedRole(role);

    const { data, error } = await supabase
      .from("scrape_jobs")
      .select("*")
      .eq("id", context.params.id)
      .eq("org_id", orgId)
      .single();
    if (error) throw error;

    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Scrape job GET error");
  }
}
