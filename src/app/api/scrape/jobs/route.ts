import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const JobQuerySchema = z.object({
  status: z.enum(["queued", "running", "completed", "partial", "failed", "cancelled"]).optional(),
  creator_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role } = auth;
    assertElevatedRole(role);

    const { searchParams } = new URL(req.url);
    const { status, creator_id, limit } = JobQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      creator_id: searchParams.get("creator_id") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    let query = supabase
      .from("scrape_jobs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (creator_id) query = query.eq("creator_id", creator_id);

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ data: data || [] }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Scrape jobs GET error");
  }
}
