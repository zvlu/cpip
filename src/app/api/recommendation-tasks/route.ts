import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertCampaignOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const TaskQuerySchema = z.object({
  campaign_id: z.string().uuid().optional(),
});

const TaskCreateSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  recommendation_id: z.string().min(2).max(200),
  action: z.enum(["scale", "watch", "pause", "investigate"]),
  priority: z.enum(["high", "medium", "low"]),
  title: z.string().min(3).max(300),
  reason: z.string().max(2000).optional(),
  owner: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
  due_date: z.string().date().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const { campaign_id } = TaskQuerySchema.parse({
      campaign_id: searchParams.get("campaign_id") || undefined,
    });

    if (campaign_id) {
      await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);
    }

    let query = supabase
      .from("recommendation_tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (campaign_id) {
      query = query.eq("campaign_id", campaign_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return apiSuccess({ data: data || [] }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Recommendation tasks GET error");
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, isDemoMode, user } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);

    const payload = TaskCreateSchema.parse(await req.json());
    if (payload.campaign_id) {
      await assertCampaignOwnedByOrg(supabase, payload.campaign_id, orgId);
    }

    const { data, error } = await supabase
      .from("recommendation_tasks")
      .insert({
        org_id: orgId,
        campaign_id: payload.campaign_id || null,
        recommendation_id: payload.recommendation_id,
        action: payload.action,
        priority: payload.priority,
        title: payload.title,
        reason: payload.reason || null,
        owner: payload.owner || null,
        notes: payload.notes || null,
        due_date: payload.due_date || null,
        created_by: user?.id || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return apiSuccess({ data }, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Recommendation tasks POST error");
  }
}
