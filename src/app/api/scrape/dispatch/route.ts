import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { claimQueuedScrapeJobs, completeScrapeJob, rescheduleScrapeJob } from "@/lib/scrapeJobs";
import { executeScrapePipeline } from "@/lib/scrapePipeline";
import { getRequestId, handleApiError } from "@/lib/api/response";

const DispatchBodySchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const secretHeader = req.headers.get("x-scrape-dispatch-secret");
    const expectedSecret = process.env.SCRAPE_DISPATCH_SECRET;
    if (!expectedSecret || !secretHeader || secretHeader !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { limit = 3 } = DispatchBodySchema.parse(await req.json().catch(() => ({})));
    const service = getServiceClient();
    const claimed = await claimQueuedScrapeJobs({ supabase: service as any, limit });
    const results: Array<Record<string, unknown>> = [];

    for (const { job, lockToken } of claimed) {
      try {
        if (!job.campaign_id) {
          throw new Error("Scrape job is missing campaign_id");
        }
        const { data: creator, error: creatorError } = await service
          .from("creators")
          .select("id, tiktok_username, display_name, follower_count")
          .eq("id", job.creator_id)
          .single();
        if (creatorError || !creator) {
          throw creatorError || new Error("Creator not found for scrape job");
        }
        const pipeline = await executeScrapePipeline({
          supabase: service as any,
          orgId: job.org_id,
          creatorId: job.creator_id,
          campaignId: job.campaign_id,
          creator,
          requestId: job.request_id || requestId,
          scrapeJobId: job.id,
        });
        await completeScrapeJob({
          supabase: service as any,
          jobId: job.id,
          lockToken,
          status: pipeline.status === "success" ? "completed" : "partial",
          result: {
            scraped: pipeline.scraped,
            posts_found: pipeline.postsFound,
            stage_failures: pipeline.stageFailures,
            stage_timings_ms: pipeline.stageTimingsMs,
            scraper_meta: pipeline.scrapeMeta,
          },
        });
        results.push({ job_id: job.id, status: pipeline.status, scraped: pipeline.scraped });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown worker error";
        await rescheduleScrapeJob({
          supabase: service as any,
          jobId: job.id,
          lockToken,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          errorMessage: message,
        });
        results.push({ job_id: job.id, status: "retrying_or_failed", error: message });
      }
    }

    return NextResponse.json({ data: results, request_id: requestId }, { status: 200 });
  } catch (error) {
    return handleApiError(error, requestId, "Scrape dispatch API error");
  }
}
