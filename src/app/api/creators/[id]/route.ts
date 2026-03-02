import { requireApiContext } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const { supabase, orgId } = auth;
    const parsedId = z.string().uuid().parse(params.id);
    const { data, error } = await supabase.from("creators").select("*").eq("id", parsedId).eq("org_id", orgId).single();
    if (error) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    return apiSuccess({ data }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Creator detail API error");
  }
}
