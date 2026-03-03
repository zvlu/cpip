import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import {
  DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS,
  sanitizeWeeklyBriefDeliverySettings,
} from "@/lib/briefDelivery";

const BriefDeliveryPatchSchema = z.object({
  enabled: z.boolean().optional(),
  webhook_url: z.string().url().max(2000).or(z.literal("")).optional(),
  include_action_recommendations: z.boolean().optional(),
  payload_format: z.enum(["generic", "slack_blocks"]).optional(),
});

export async function GET() {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;

    const { data, error } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    if (error) throw error;

    const settings =
      data && typeof data.settings === "object" && data.settings ? (data.settings as Record<string, unknown>) : {};
    const briefDelivery = sanitizeWeeklyBriefDeliverySettings(
      settings.weekly_brief_delivery || DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS
    );
    return apiSuccess({ data: briefDelivery }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Brief delivery settings GET error");
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);

    const payload = BriefDeliveryPatchSchema.parse(await req.json());
    const { data: orgRow, error: orgError } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    if (orgError) throw orgError;

    const currentSettings =
      orgRow && typeof orgRow.settings === "object" && orgRow.settings
        ? (orgRow.settings as Record<string, unknown>)
        : {};
    const current = sanitizeWeeklyBriefDeliverySettings(
      currentSettings.weekly_brief_delivery || DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS
    );
    const next = sanitizeWeeklyBriefDeliverySettings({
      ...current,
      ...payload,
    });

    if (next.enabled && !next.webhook_url) {
      throw new Error("Webhook URL is required when weekly brief delivery is enabled.");
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...currentSettings,
          weekly_brief_delivery: next,
        },
      })
      .eq("id", orgId);
    if (updateError) throw updateError;

    return apiSuccess({ data: next }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Brief delivery settings PATCH error");
  }
}
