import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient, getServiceClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const GUEST_MODE_ENABLED = process.env.ALLOW_GUEST_MODE === "true" && !IS_PRODUCTION;

type AuthorizedApiContext = {
  ok: true;
  supabase: ReturnType<typeof createServerClient> | ReturnType<typeof getServiceClient>;
  user: User | null;
  orgId: string;
  role: "owner" | "admin" | "member";
  isDemoMode: boolean;
};

type UnauthorizedApiContext = {
  ok: false;
  response: NextResponse;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function ensureUserMembership(user: User): Promise<{ orgId: string; role: "owner" | "admin" | "member" }> {
  const service = getServiceClient();
  const baseName = user.email?.split("@")[0] || "workspace";
  const orgName = `${baseName}'s Workspace`;
  const slugBase = slugify(baseName) || "workspace";
  const slug = `${slugBase}-${user.id.slice(0, 8)}`;

  let orgId: string | null = null;

  const { data: existingOrg, error: existingOrgError } = await service
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingOrgError) {
    throw existingOrgError;
  }

  if (existingOrg?.id) {
    orgId = existingOrg.id;
  } else {
    const { data: createdOrg, error: orgError } = await service
      .from("organizations")
      .insert({
        name: orgName,
        slug,
      })
      .select("id")
      .single();

    if (orgError || !createdOrg?.id) {
      throw orgError || new Error("Failed to provision organization");
    }

    orgId = createdOrg.id;
  }

  const { error: userUpsertError } = await service.from("users").upsert(
    {
      id: user.id,
      org_id: orgId,
      email: user.email || `${user.id}@local.invalid`,
      role: "owner",
      use_demo_data: false,
      demo_mode_prompt_seen: false,
    },
    { onConflict: "id" }
  );

  if (userUpsertError) {
    throw userUpsertError;
  }

  if (!orgId) {
    throw new Error("Failed to resolve organization id");
  }

  return { orgId, role: "owner" };
}

export async function requireApiContext(): Promise<AuthorizedApiContext | UnauthorizedApiContext> {
  const supabase = createServerClient();
  const service = getServiceClient();

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  let user = cookieUser;
  let useServiceClientForData = false;

  if (!user) {
    const authorizationHeader = (await headers()).get("authorization") || "";
    const bearerTokenMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerTokenMatch?.[1];

    if (bearerToken) {
      const {
        data: { user: bearerUser },
      } = await service.auth.getUser(bearerToken);

      if (bearerUser) {
        user = bearerUser;
        useServiceClientForData = true;
      }
    }
  }

  if (!user) {
    if (GUEST_MODE_ENABLED) {
      return {
        ok: true,
        supabase: service,
        user: null,
        orgId: DEMO_ORG_ID,
        role: "owner",
        isDemoMode: true,
      };
    }

    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const membershipClient = useServiceClientForData ? service : supabase;
  const { data: membership, error: membershipError } = await membershipClient
    .from("users")
    .select("org_id, role, use_demo_data")
    .eq("id", user.id)
    .single();

  if (membershipError || !membership?.org_id) {
    if (GUEST_MODE_ENABLED) {
      return {
        ok: true,
        supabase: service,
        user,
        orgId: DEMO_ORG_ID,
        role: "owner",
        isDemoMode: true,
      };
    }

    try {
      const provisioned = await ensureUserMembership(user);
      return {
        ok: true,
        supabase: useServiceClientForData ? service : supabase,
        user,
        orgId: provisioned.orgId,
        role: provisioned.role,
        isDemoMode: false,
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "User is not linked to an organization" }, { status: 403 }),
      };
    }
  }

  if (membership.use_demo_data) {
    return {
      ok: true,
      supabase: service,
      user,
      orgId: DEMO_ORG_ID,
      role: membership.role,
      isDemoMode: true,
    };
  }

  return {
    ok: true,
    supabase: useServiceClientForData ? service : supabase,
    user,
    orgId: membership.org_id,
    role: membership.role,
    isDemoMode: false,
  };
}
