import { getServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/auth/server";
import { getRequestId } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const requestId = getRequestId();

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("campaigns").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          connected: false,
          error: error.message,
          request_id: requestId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Supabase connection is healthy",
      request_id: requestId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        error: error?.message || "Unknown Supabase connection error",
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}
