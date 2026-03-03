import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const TaskUpdateSchema = z
  .object({
    status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(),
    owner: z.string().max(200).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    due_date: z.string().date().nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);

    const { id } = context.params;
    const payload = TaskUpdateSchema.parse(await req.json());
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.owner !== undefined) updates.owner = payload.owner;
    if (payload.notes !== undefined) updates.notes = payload.notes;
    if (payload.due_date !== undefined) updates.due_date = payload.due_date;

    const { data, error } = await supabase
      .from("recommendation_tasks")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .single();
    if (error) throw error;

    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Recommendation tasks PATCH error");
  }
}
