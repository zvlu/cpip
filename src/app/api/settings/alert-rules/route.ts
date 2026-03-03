import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import { DEFAULT_ALERT_RULES, sanitizeAlertRules } from "@/lib/alertRules";

const AlertRulesPatchSchema = z.object({
  score_drop_threshold: z.number().min(1).max(100).optional(),
  score_rise_threshold: z.number().min(1).max(100).optional(),
  inactive_days_threshold: z.number().min(1).max(120).optional(),
  anomaly_delta_threshold: z.number().min(5).max(100).optional(),
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
    const alertRules = sanitizeAlertRules(settings.alert_rules || DEFAULT_ALERT_RULES);

    return apiSuccess({ data: alertRules }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Alert rules GET error");
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

    const payload = AlertRulesPatchSchema.parse(await req.json());
    const { data: orgRow, error: orgError } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    if (orgError) throw orgError;
    const currentSettings =
      orgRow && typeof orgRow.settings === "object" && orgRow.settings
        ? (orgRow.settings as Record<string, unknown>)
        : {};

    const currentRules = sanitizeAlertRules(currentSettings.alert_rules || DEFAULT_ALERT_RULES);
    const nextRules = sanitizeAlertRules({
      ...currentRules,
      ...payload,
    });

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...currentSettings,
          alert_rules: nextRules,
        },
      })
      .eq("id", orgId);
    if (updateError) throw updateError;

    return apiSuccess({ data: nextRules }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Alert rules PATCH error");
  }
}
