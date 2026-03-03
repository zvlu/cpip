import { randomUUID } from "crypto";

type SupabaseLike = {
  from: (table: string) => any;
};

export type ScrapeJobStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";

export type ScrapeJobRow = {
  id: string;
  org_id: string;
  creator_id: string;
  campaign_id: string | null;
  requested_by: string | null;
  request_id: string | null;
  status: ScrapeJobStatus;
  attempts: number;
  max_attempts: number;
  available_at: string;
  started_at: string | null;
  completed_at: string | null;
  lock_token: string | null;
  lock_expires_at: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function enqueueScrapeJob(params: {
  supabase: SupabaseLike;
  orgId: string;
  creatorId: string;
  campaignId: string;
  requestedBy?: string | null;
  requestId?: string | null;
  priority?: number;
}): Promise<{ job: ScrapeJobRow; deduped: boolean }> {
  const { supabase, orgId, creatorId, campaignId, requestedBy, requestId, priority = 100 } = params;

  const { data: existing } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("org_id", orgId)
    .eq("creator_id", creatorId)
    .eq("campaign_id", campaignId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { job: existing as ScrapeJobRow, deduped: true };
  }

  const { data, error } = await supabase
    .from("scrape_jobs")
    .insert({
      org_id: orgId,
      creator_id: creatorId,
      campaign_id: campaignId,
      requested_by: requestedBy || null,
      request_id: requestId || null,
      priority,
    })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Failed to enqueue scrape job");
  return { job: data as ScrapeJobRow, deduped: false };
}

export async function claimQueuedScrapeJobs(params: {
  supabase: SupabaseLike;
  limit: number;
  lockTtlMs?: number;
}): Promise<Array<{ job: ScrapeJobRow; lockToken: string }>> {
  const { supabase, limit, lockTtlMs = 5 * 60_000 } = params;
  const nowIso = new Date().toISOString();
  const { data: queued, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("available_at", nowIso)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const claimed: Array<{ job: ScrapeJobRow; lockToken: string }> = [];
  for (const job of (queued || []) as ScrapeJobRow[]) {
    const lockToken = randomUUID();
    const lockExpires = new Date(Date.now() + lockTtlMs).toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("scrape_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        lock_token: lockToken,
        lock_expires_at: lockExpires,
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) {
      claimed.push({ job: updated as ScrapeJobRow, lockToken });
    }
  }

  return claimed;
}

export async function completeScrapeJob(params: {
  supabase: SupabaseLike;
  jobId: string;
  lockToken: string;
  status: Extract<ScrapeJobStatus, "completed" | "partial" | "failed" | "cancelled">;
  result?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const { supabase, jobId, lockToken, status, result, errorMessage } = params;
  const { error } = await supabase
    .from("scrape_jobs")
    .update({
      status,
      result: result || {},
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
      lock_token: null,
      lock_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("lock_token", lockToken);
  if (error) throw error;
}

export async function rescheduleScrapeJob(params: {
  supabase: SupabaseLike;
  jobId: string;
  lockToken: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string;
}) {
  const { supabase, jobId, lockToken, attempts, maxAttempts, errorMessage } = params;
  if (attempts >= maxAttempts) {
    await completeScrapeJob({
      supabase,
      jobId,
      lockToken,
      status: "failed",
      errorMessage,
      result: { retried: attempts, exhausted: true },
    });
    return;
  }
  const retryDelayMs = Math.min(120_000, 2_000 * attempts + Math.floor(Math.random() * 2_000));
  const { error } = await supabase
    .from("scrape_jobs")
    .update({
      status: "queued",
      available_at: new Date(Date.now() + retryDelayMs).toISOString(),
      lock_token: null,
      lock_expires_at: null,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("lock_token", lockToken);
  if (error) throw error;
}
