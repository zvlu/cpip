import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCampaignOwnedByOrg, assertDemoModeWritable, assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const CreatorSchema = z.object({
  tiktok_username: z.string().min(1).max(50),
  display_name: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign_id: z.string().uuid().optional(),
});

const CreatorQuerySchema = z.object({
  campaign_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const CreatorPatchSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().max(255).optional(),
  category: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "blacklisted"]).optional(),
  notes: z.string().max(2000).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(3000).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const { searchParams } = new URL(req.url);
    const parsedQuery = CreatorQuerySchema.parse({
      campaign_id: searchParams.get("campaign_id") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });
    const { campaign_id, page, limit } = parsedQuery;

    let query = supabase
      .from("creators")
      .select(
        `*, latest_score:performance_scores(overall_score, tier, engagement_score, revenue_score, consistency_score, score_date), post_count:posts(count), campaign_creators(campaign_id)`,
        { count: "exact" }
      )
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (campaign_id) query = query.eq("campaign_creators.campaign_id", campaign_id);

    const { data, error, count } = await query;
    if (error) throw error;
    return apiSuccess({ data, total: count, page, limit }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Creators GET error");
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId, role, isDemoMode } = auth;
    assertElevatedRole(role);
    assertDemoModeWritable(isDemoMode);
    const body = await req.json();
    const parsed = CreatorSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.campaign_id) {
      await assertCampaignOwnedByOrg(supabase, parsed.data.campaign_id, orgId);
    }

    const { data, error } = await supabase
      .from("creators")
      .insert({ ...parsed.data, org_id: orgId })
      .select()
      .single();
    if (error) throw error;

    if (parsed.data.campaign_id) {
      await supabase.from("campaign_creators").insert({ campaign_id: parsed.data.campaign_id, creator_id: data.id });
    }
    return apiSuccess({ data }, 201, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Creators POST error");
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
    const body = await req.json();
    const { id, ...updates } = CreatorPatchSchema.parse(body);

    const { data, error } = await supabase
      .from("creators")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Creators PATCH error");
  }
}
