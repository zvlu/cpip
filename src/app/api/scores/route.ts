import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const ScoresQuerySchema = z.object({
  creator_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase } = auth;
    const { searchParams } = new URL(req.url);
    const { creator_id, campaign_id } = ScoresQuerySchema.parse({
      creator_id: searchParams.get("creator_id") || undefined,
      campaign_id: searchParams.get("campaign_id") || undefined,
    });

    if (creator_id) {
      await assertCreatorOwnedByOrg(supabase, creator_id, auth.orgId);
    }
    if (campaign_id) {
      await assertCampaignOwnedByOrg(supabase, campaign_id, auth.orgId);
    }

    let query = supabase.from("performance_scores").select("*").order("score_date", { ascending: false }).limit(30);
    if (creator_id) query = query.eq("creator_id", creator_id);
    if (campaign_id) query = query.eq("campaign_id", campaign_id);

    const { data, error } = await query;
    if (error) throw error;
    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Scores API error");
  }
}
