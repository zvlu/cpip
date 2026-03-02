import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/api/rateLimit";

type SignUpPayload = {
  email?: string;
  password?: string;
};

const ENABLE_PUBLIC_SIGNUP = process.env.ENABLE_PUBLIC_SIGNUP === "true";
const SIGNUP_WINDOW_MS = Number(process.env.PUBLIC_SIGNUP_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const SIGNUP_MAX_REQUESTS = Number(process.env.PUBLIC_SIGNUP_RATE_LIMIT_MAX_REQUESTS || 5);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  if (!ENABLE_PUBLIC_SIGNUP) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "unknown";
  try {
    enforceRateLimit(
      buildRateLimitKey("auth-sign-up", clientIp),
      { windowMs: SIGNUP_WINDOW_MS, maxRequests: SIGNUP_MAX_REQUESTS }
    );
  } catch {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let payload: SignUpPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() || "";
  const password = payload.password || "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
