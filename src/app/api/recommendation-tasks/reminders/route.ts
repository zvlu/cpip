import { NextRequest } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireApiContext } from "@/lib/auth/server";
import { assertElevatedRole } from "@/lib/api/authorization";
import { apiSuccess, getRequestId, handleApiError } from "@/lib/api/response";

const ReminderBodySchema = z.object({
  all_orgs: z.boolean().optional(),
});

type TaskRow = {
  id: string;
  org_id: string;
  title: string;
  due_date: string | null;
  status: "open" | "in_progress" | "done" | "dismissed";
};

async function maybeCreateOverdueAlert(params: {
  service: ReturnType<typeof getServiceClient>;
  task: TaskRow;
}) {
  const { service, task } = params;
  if (!task.due_date) return false;
  const alertTitle = `Task overdue: ${task.title}`;

  const { data: existing } = await service
    .from("alerts")
    .select("id")
    .eq("org_id", task.org_id)
    .eq("type", "campaign_target")
    .eq("title", alertTitle)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  if (existing && existing.length > 0) return false;

  const { error } = await service.from("alerts").insert({
    org_id: task.org_id,
    type: "campaign_target",
    severity: "warning",
    title: alertTitle,
    message: `Recommendation task is overdue since ${task.due_date}.`,
    data: {
      task_id: task.id,
      due_date: task.due_date,
      status: task.status,
    },
  });
  return !error;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  try {
    const body = ReminderBodySchema.parse(await req.json().catch(() => ({})));
    const service = getServiceClient();
    const secretHeader = req.headers.get("x-brief-dispatch-secret");
    const expectedSecret = process.env.BRIEF_DISPATCH_SECRET;
    const isSecretDispatch = Boolean(expectedSecret && secretHeader && secretHeader === expectedSecret);

    let orgId: string | null = null;
    if (!isSecretDispatch || !body.all_orgs) {
      const auth = await requireApiContext();
      if (!auth.ok) return auth.response;
      assertElevatedRole(auth.role);
      orgId = auth.orgId;
    }

    const today = new Date().toISOString().slice(0, 10);
    let query = service
      .from("recommendation_tasks")
      .select("id, org_id, title, due_date, status")
      .in("status", ["open", "in_progress"])
      .lt("due_date", today)
      .limit(500);
    if (orgId) {
      query = query.eq("org_id", orgId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const overdue = (data || []) as TaskRow[];
    const results = await Promise.all(
      overdue.map(async (task) => ({
        task_id: task.id,
        org_id: task.org_id,
        alerted: await maybeCreateOverdueAlert({ service, task }),
      }))
    );

    return apiSuccess({ data: results }, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, "Recommendation task reminders API error");
  }
}
