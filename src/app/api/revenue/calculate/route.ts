import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const RevenueCalculateBodySchema = z.object({
  campaign_id: z.string().uuid(),
  creator_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, user, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const { campaign_id, creator_id } = RevenueCalculateBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("revenue-calculate", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 10,
    });
    await assertCampaignOwnedByOrg(supabase, campaign_id, orgId);
    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (campaignError || !campaign) throw campaignError ?? new Error("Campaign not found");

    let query = supabase.from("posts").select("*").eq("campaign_id", campaign_id);
    if (creator_id) query = query.eq("creator_id", creator_id);
    const { data: posts, error: postsError } = await query;

    if (postsError) {
      throw postsError;
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ estimates: [], total_estimated_revenue: 0, post_count: 0 });
    }

    const estimates = posts.map((post) => ({
      post_id: post.id,
      campaign_id,
      views: post.views || 0,
      ctr: campaign.default_ctr,
      cvr: campaign.default_cvr,
      aov: campaign.aov,
      commission_rate: campaign.commission_rate,
    }));

    const { data, error } = await supabase.from("revenue_estimates").upsert(estimates, { onConflict: "post_id,campaign_id" }).select();
    if (error) throw error;

    const totalRevenue = data?.reduce((s, e) => s + Number(e.estimated_revenue || 0), 0) || 0;
    return apiSuccess({
      estimates: data || [],
      total_estimated_revenue: totalRevenue,
      post_count: data?.length || 0,
    }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Revenue calculate API error");
  }
}
