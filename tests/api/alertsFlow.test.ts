import { describe, expect, it } from "vitest";
import { maybeCreateScoreAlerts, maybeCreateViralPostAlert } from "../../src/lib/alerts";

type AlertRow = {
  id: string;
  org_id: string;
  creator_id?: string | null;
  type: string;
  severity: string;
  title: string;
  created_at: string;
};

class AlertsQueryBuilder {
  data: Array<{ id: string }> = [];
  error: unknown = null;
  private filters: Record<string, unknown> = {};
  private sinceIso: string | null = null;

  constructor(private readonly alerts: AlertRow[]) {}

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  gte(column: string, value: string) {
    if (column === "created_at") this.sinceIso = value;
    return this;
  }

  limit(_value: number) {
    const sinceMs = this.sinceIso ? new Date(this.sinceIso).getTime() : 0;

    this.data = this.alerts
      .filter((row) => {
        const createdAtMs = new Date(row.created_at).getTime();
        if (sinceMs && createdAtMs < sinceMs) return false;

        for (const [key, val] of Object.entries(this.filters)) {
          if ((row as Record<string, unknown>)[key] !== val) return false;
        }
        return true;
      })
      .slice(0, 1)
      .map((row) => ({ id: row.id }));

    return this;
  }
}

class FakeSupabase {
  alerts: AlertRow[] = [];
  inserts: Array<Record<string, unknown>> = [];

  from(table: string) {
    if (table !== "alerts") {
      throw new Error(`Unexpected table in fake client: ${table}`);
    }

    return {
      select: () => new AlertsQueryBuilder(this.alerts),
      insert: async (payload: Record<string, unknown>) => {
        this.inserts.push(payload);
        this.alerts.push({
          id: `inserted-${this.alerts.length + 1}`,
          org_id: String(payload.org_id),
          creator_id: (payload.creator_id as string | null | undefined) ?? null,
          type: String(payload.type),
          severity: String(payload.severity),
          title: String(payload.title),
          created_at: new Date().toISOString(),
        });
        return { error: null };
      },
    };
  }
}

describe("alerts flow helper", () => {
  it("creates a score_drop alert for significant negative delta", async () => {
    const supabase = new FakeSupabase();

    await maybeCreateScoreAlerts({
      supabase: supabase as any,
      orgId: "org-1",
      creatorId: "creator-1",
      creatorName: "Alice",
      campaignId: "campaign-1",
      previousOverallScore: 78,
      currentOverallScore: 61,
      latestPostAt: new Date().toISOString(),
    });

    expect(supabase.inserts).toHaveLength(1);
    expect(supabase.inserts[0]?.type).toBe("score_drop");
  });

  it("does not create score delta alerts when change is below threshold", async () => {
    const supabase = new FakeSupabase();

    await maybeCreateScoreAlerts({
      supabase: supabase as any,
      orgId: "org-1",
      creatorId: "creator-1",
      creatorName: "Alice",
      campaignId: "campaign-1",
      previousOverallScore: 70,
      currentOverallScore: 76,
      latestPostAt: new Date().toISOString(),
    });

    expect(supabase.inserts).toHaveLength(0);
  });

  it("dedupes a repeat score_drop alert inside the dedupe window", async () => {
    const supabase = new FakeSupabase();
    supabase.alerts.push({
      id: "existing-1",
      org_id: "org-1",
      creator_id: "creator-1",
      type: "score_drop",
      severity: "warning",
      title: "Alice score dropped",
      created_at: new Date().toISOString(),
    });

    await maybeCreateScoreAlerts({
      supabase: supabase as any,
      orgId: "org-1",
      creatorId: "creator-1",
      creatorName: "Alice",
      campaignId: "campaign-1",
      previousOverallScore: 80,
      currentOverallScore: 65,
      latestPostAt: new Date().toISOString(),
    });

    expect(supabase.inserts).toHaveLength(0);
  });

  it("creates a viral_post alert above threshold", async () => {
    const supabase = new FakeSupabase();

    await maybeCreateViralPostAlert({
      supabase: supabase as any,
      orgId: "org-1",
      creatorId: "creator-2",
      creatorName: "Bob",
      campaignId: "campaign-1",
      postId: "post-1",
      postViews: 150_000,
      postUrl: "https://example.com/post/1",
    });

    expect(supabase.inserts).toHaveLength(1);
    expect(supabase.inserts[0]?.type).toBe("viral_post");
  });

  it("does not create viral_post alert below threshold", async () => {
    const supabase = new FakeSupabase();

    await maybeCreateViralPostAlert({
      supabase: supabase as any,
      orgId: "org-1",
      creatorId: "creator-2",
      creatorName: "Bob",
      campaignId: "campaign-1",
      postId: "post-1",
      postViews: 25_000,
      postUrl: "https://example.com/post/1",
    });

    expect(supabase.inserts).toHaveLength(0);
  });
});
