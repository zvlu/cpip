import { NextRequest } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireApiContext } from "@/lib/auth/server";
import { assertCampaignOwnedByOrg, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import {
  DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS,
  sanitizeWeeklyBriefDeliverySettings,
} from "@/lib/briefDelivery";
import { buildWeeklyBriefPayload } from "@/lib/weeklyBrief";
import { formatWeeklyBriefMarkdown, formatWeeklyBriefSlackBlocks } from "@/lib/briefFormatters";

const DispatchBodySchema = z.object({
  campaign_id: z.string().uuid().or(z.literal("default")).optional(),
  all_orgs: z.boolean().optional(),
  dry_run: z.boolean().optional(),
});

type DispatchResult = {
  org_id: string;
  campaign_id: string | null;
  delivered: boolean;
  reason?: string;
  response_status?: number;
};

async function deliverToWebhook(params: {
  webhookUrl: string;
  orgId: string;
  campaignId: string | null;
  payload: Awaited<ReturnType<typeof buildWeeklyBriefPayload>>;
  includeActionRecommendations: boolean;
  payloadFormat: "generic" | "slack_blocks";
}): Promise<DispatchResult> {
  const { webhookUrl, orgId, campaignId, payload, includeActionRecommendations, payloadFormat } = params;
  const markdown = formatWeeklyBriefMarkdown({
    orgId,
    campaignId,
    weeklyBrief: payload.weekly_brief,
    actionRecommendations: payload.action_recommendations,
    includeActionRecommendations,
  });
  const slackPayload = formatWeeklyBriefSlackBlocks({
    campaignId,
    weeklyBrief: payload.weekly_brief,
    actionRecommendations: payload.action_recommendations,
    includeActionRecommendations,
  });

  const body =
    payloadFormat === "slack_blocks"
      ? slackPayload
      : {
          event: "weekly_brief",
          org_id: orgId,
          campaign_id: campaignId,
          generated_at: payload.weekly_brief.generated_at,
          weekly_brief: payload.weekly_brief,
          action_recommendations: includeActionRecommendations ? payload.action_recommendations : [],
          markdown,
          slack_blocks: slackPayload.blocks,
        };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    org_id: orgId,
    campaign_id: campaignId,
    delivered: response.ok,
    response_status: response.status,
    reason: response.ok ? undefined : "Webhook returned non-2xx status",
  };
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const body = DispatchBodySchema.parse(await req.json().catch(() => ({})));
    const secretHeader = req.headers.get("x-brief-dispatch-secret");
    const expectedSecret = process.env.BRIEF_DISPATCH_SECRET;
    const isSecretDispatch = Boolean(expectedSecret && secretHeader && secretHeader === expectedSecret);
    const service = getServiceClient();

    if (isSecretDispatch && body.all_orgs) {
      const { data: orgs, error: orgsError } = await service.from("organizations").select("id, settings");
      if (orgsError) throw orgsError;

      const results: DispatchResult[] = [];
      for (const org of orgs || []) {
        const settings =
          org && typeof org.settings === "object" && org.settings ? (org.settings as Record<string, unknown>) : {};
        const delivery = sanitizeWeeklyBriefDeliverySettings(
          settings.weekly_brief_delivery || DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS
        );
        if (!delivery.enabled || !delivery.webhook_url) {
          results.push({
            org_id: org.id,
            campaign_id: null,
            delivered: false,
            reason: "Delivery disabled or webhook not configured",
          });
          continue;
        }

        const payload = await buildWeeklyBriefPayload({
          supabase: service,
          orgId: org.id,
          campaignId: body.campaign_id && body.campaign_id !== "default" ? body.campaign_id : null,
        });
        if (!payload.campaign_id) {
          results.push({
            org_id: org.id,
            campaign_id: null,
            delivered: false,
            reason: "No active campaign found",
          });
          continue;
        }
        if (body.dry_run) {
          results.push({
            org_id: org.id,
            campaign_id: payload.campaign_id,
            delivered: true,
            reason: "Dry run",
          });
          continue;
        }

        results.push(
          await deliverToWebhook({
            webhookUrl: delivery.webhook_url,
            orgId: org.id,
            campaignId: payload.campaign_id,
            payload,
            includeActionRecommendations: delivery.include_action_recommendations,
            payloadFormat: delivery.payload_format,
          })
        );
      }

      return apiSuccess({ data: results }, 200, requestId);
    }

    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role } = auth;
    assertElevatedRole(role);

    const campaignId = body.campaign_id && body.campaign_id !== "default" ? body.campaign_id : null;
    if (campaignId) {
      await assertCampaignOwnedByOrg(supabase, campaignId, orgId);
    }

    const { data: orgRow, error: orgError } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    if (orgError) throw orgError;
    const currentSettings =
      orgRow && typeof orgRow.settings === "object" && orgRow.settings
        ? (orgRow.settings as Record<string, unknown>)
        : {};
    const delivery = sanitizeWeeklyBriefDeliverySettings(
      currentSettings.weekly_brief_delivery || DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS
    );
    if (!delivery.webhook_url) {
      return apiSuccess(
        {
          data: [
            {
              org_id: orgId,
              campaign_id: campaignId,
              delivered: false,
              reason: "No webhook configured",
            },
          ],
        },
        200,
        requestId
      );
    }

    const payload = await buildWeeklyBriefPayload({
      supabase,
      orgId,
      campaignId,
    });
    if (!payload.campaign_id) {
      return apiSuccess(
        {
          data: [
            {
              org_id: orgId,
              campaign_id: null,
              delivered: false,
              reason: "No active campaign found",
            },
          ],
        },
        200,
        requestId
      );
    }

    if (body.dry_run) {
      return apiSuccess(
        {
          data: [
            {
              org_id: orgId,
              campaign_id: payload.campaign_id,
              delivered: true,
              reason: "Dry run",
            },
          ],
        },
        200,
        requestId
      );
    }

    const result = await deliverToWebhook({
      webhookUrl: delivery.webhook_url,
      orgId,
      campaignId: payload.campaign_id,
      payload,
      includeActionRecommendations: delivery.include_action_recommendations,
      payloadFormat: delivery.payload_format,
    });
    return apiSuccess({ data: [result] }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Brief dispatch API error");
  }
}
