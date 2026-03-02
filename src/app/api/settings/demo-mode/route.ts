import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/auth/server";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const DemoModePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    prompt_seen: z.boolean().optional(),
  })
  .refine((value) => value.enabled !== undefined || value.prompt_seen !== undefined, {
    message: "At least one field must be provided",
  });

export async function GET() {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const userId = auth.user?.id;

    if (!userId) {
      return apiSuccess(
        {
          data: {
            enabled: true,
            prompt_seen: true,
          },
        },
        200,
        requestId
      );
    }

    const { data, error } = await auth.supabase
      .from("users")
      .select("use_demo_data, demo_mode_prompt_seen")
      .eq("id", userId)
      .single();

    if (error) throw error;

    return apiSuccess(
      {
        data: {
          enabled: Boolean(data?.use_demo_data),
          prompt_seen: Boolean(data?.demo_mode_prompt_seen),
        },
      },
      200,
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId, "Demo mode settings GET error");
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const auth = await requireApiContext();
    if (!auth.ok) return auth.response;
    const userId = auth.user?.id;
    if (!userId) {
      return apiSuccess(
        {
          data: {
            enabled: true,
            prompt_seen: true,
          },
        },
        200,
        requestId
      );
    }

    const payload = DemoModePatchSchema.parse(await req.json());

    const updates: Record<string, unknown> = {};
    if (payload.enabled !== undefined) updates.use_demo_data = payload.enabled;
    if (payload.prompt_seen !== undefined) updates.demo_mode_prompt_seen = payload.prompt_seen;

    const { data, error } = await auth.supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("use_demo_data, demo_mode_prompt_seen")
      .single();

    if (error) throw error;

    return apiSuccess(
      {
        data: {
          enabled: Boolean(data?.use_demo_data),
          prompt_seen: Boolean(data?.demo_mode_prompt_seen),
        },
      },
      200,
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId, "Demo mode settings PATCH error");
  }
}
