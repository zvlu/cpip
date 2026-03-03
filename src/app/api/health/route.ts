import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { requireApiContext } from "@/lib/auth/server";
import { z } from "zod";
import { getRequestId, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const HealthQuerySchema = z.object({
  mode: z.enum(["liveness", "readiness"]).default("readiness"),
});

export async function GET(req: Request) {
  const requestId = getRequestId();
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const { mode } = HealthQuerySchema.parse({
    mode: searchParams.get("mode") || undefined,
  });

  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());

  if (mode === "liveness") {
    return NextResponse.json(
      {
        status: "ok",
        mode: "liveness",
        request_id: requestId,
        timestamp,
        uptime_seconds: uptimeSeconds,
      },
      { status: 200 }
    );
  }

  const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
  const envHealthy = missingEnv.length === 0;

  let dbHealthy = false;
  let dbError: string | null = null;

  if (envHealthy) {
    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("campaigns").select("id").limit(1);
      dbHealthy = !error;
      dbError = error?.message || null;
    } catch (error) {
      const fallback = handleApiError(error, requestId, "Health database check");
      dbHealthy = false;
      dbError = ((await fallback.json()) as any)?.error?.message || "Database check failed";
    }
  } else {
    dbError = "Skipped because required environment variables are missing";
  }

  const healthy = envHealthy && dbHealthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      mode: "readiness",
      request_id: requestId,
      timestamp,
      uptime_seconds: uptimeSeconds,
      checks: {
        environment: {
          healthy: envHealthy,
          missing: missingEnv,
        },
        database: {
          healthy: dbHealthy,
          error: dbError,
        },
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
