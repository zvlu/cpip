import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getRequestId(): string {
  return randomUUID();
}

export function apiSuccess(payload: Record<string, unknown>, status = 200, requestId?: string) {
  return NextResponse.json(
    requestId ? { ...payload, request_id: requestId } : payload,
    { status }
  );
}

export function apiErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown
) {
  const body: Record<string, unknown> = {
    error: {
      code,
      message,
    },
  };

  if (requestId) body.request_id = requestId;
  if (details !== undefined) body.details = details;

  return NextResponse.json(body, { status });
}

export function handleApiError(error: unknown, requestId: string, context: string) {
  if (error instanceof ApiHttpError) {
    return apiErrorResponse(error.status, error.code, error.message, requestId);
  }

  if (error instanceof ZodError) {
    return apiErrorResponse(400, "VALIDATION_ERROR", "Invalid request payload", requestId, error.flatten());
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[${context}]`, { request_id: requestId, error: message });
  return apiErrorResponse(500, "INTERNAL_ERROR", "Request failed", requestId);
}
