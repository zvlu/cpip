import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertCampaignOwnedByOrg } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import { buildWeeklyBriefPayload } from "@/lib/weeklyBrief";

export const dynamic = "force-dynamic";

const WeeklyBriefQuerySchema = z.object({
  campaign_id: z.union([z.string().uuid(), z.literal("default")]).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const parsed = WeeklyBriefQuerySchema.parse({
      campaign_id: searchParams.get("campaign_id") || undefined,
    });

    const campaignId = parsed.campaign_id && parsed.campaign_id !== "default" ? parsed.campaign_id : null;
    if (campaignId) {
      await assertCampaignOwnedByOrg(supabase, campaignId, orgId);
    }

    const payload = await buildWeeklyBriefPayload({
      supabase,
      orgId,
      campaignId,
    });

    return apiSuccess(
      {
        campaign_id: payload.campaign_id,
        ...payload.weekly_brief,
        action_recommendations: payload.action_recommendations,
      },
      200,
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId, "Weekly brief API error");
  }
}
