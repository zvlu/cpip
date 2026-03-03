import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertCreatorOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";
import { executeScrapePipeline } from "@/lib/scrapePipeline";
import { enqueueScrapeJob } from "@/lib/scrapeJobs";
import { acquireCreatorScrapeLock, releaseCreatorScrapeLock } from "@/lib/scrapeLocks";

const ScrapeBodySchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.union([z.string().uuid(), z.literal("default")]).optional(),
  wait_for_completion: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, user, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const { creator_id, campaign_id, wait_for_completion = false } = ScrapeBodySchema.parse(await req.json());
    const identity = user?.id ?? "guest";
    enforceRateLimit(buildRateLimitKey("scrape", `${orgId}:${identity}`), {
      windowMs: 60_000,
      maxRequests: 5,
    });
    await assertCreatorOwnedByOrg(supabase, creator_id, orgId);
    const { data: creator } = await supabase.from("creators").select("*").eq("id", creator_id).single();
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    let targetCampaignId: string | null = campaign_id ?? null;
    if (!targetCampaignId || targetCampaignId === "default") {
      const { data: fallbackCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      targetCampaignId = fallbackCampaign?.id ?? null;
    } else {
      await assertCampaignOwnedByOrg(supabase, targetCampaignId, orgId);
    }

    if (!targetCampaignId) {
      return NextResponse.json({ error: "No active campaign found for your organization" }, { status: 400 });
    }

    if (wait_for_completion) {
      const lockKey = buildRateLimitKey("scrape-lock", `${orgId}:${creator_id}:${targetCampaignId}`);
      if (!acquireCreatorScrapeLock(lockKey)) {
        return NextResponse.json({ error: "A scrape is already in progress for this creator." }, { status: 409 });
      }
      try {
        const result = await executeScrapePipeline({
          supabase,
          orgId,
          creatorId: creator_id,
          campaignId: targetCampaignId,
          creator,
          requestId,
        });
        return apiSuccess(
          {
            mode: "sync",
            status: result.status,
            scraped: result.scraped,
            posts_found: result.postsFound,
            stage_failures: result.stageFailures,
          },
          result.status === "partial" ? 207 : 200,
          requestId
        );
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      } finally {
        releaseCreatorScrapeLock(lockKey);
      }
    }

    const queued = await enqueueScrapeJob({
      supabase,
      orgId,
      creatorId: creator_id,
      campaignId: targetCampaignId,
      requestedBy: user?.id || null,
      requestId,
    });

    return apiSuccess(
      {
        mode: "async",
        status: queued.deduped ? "already_queued" : "queued",
        job_id: queued.job.id,
      },
      queued.deduped ? 200 : 202,
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId, "Scrape API error");
  }
}
