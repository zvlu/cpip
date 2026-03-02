import { ApiHttpError } from "@/lib/api/response";
import type { createServerClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerClient>;

export async function assertCampaignOwnedByOrg(
  supabase: SupabaseClient,
  campaignId: string,
  orgId: string
) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .single();

  if (error || !data) {
    throw new ApiHttpError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
  }
}

export async function assertCreatorOwnedByOrg(
  supabase: SupabaseClient,
  creatorId: string,
  orgId: string
) {
  const { data, error } = await supabase
    .from("creators")
    .select("id")
    .eq("id", creatorId)
    .eq("org_id", orgId)
    .single();

  if (error || !data) {
    throw new ApiHttpError(404, "CREATOR_NOT_FOUND", "Creator not found");
  }
}

export function assertElevatedRole(role: "owner" | "admin" | "member") {
  if (role !== "owner" && role !== "admin") {
    throw new ApiHttpError(403, "FORBIDDEN", "Admin or owner role required");
  }
}

export function assertDemoModeWritable(isDemoMode: boolean) {
  if (isDemoMode) {
    throw new ApiHttpError(403, "DEMO_MODE_READ_ONLY", "Demo data mode is read-only. Switch off demo mode to make changes.");
  }
}
