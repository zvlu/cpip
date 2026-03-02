"use client";

import { supabase } from "@/lib/supabase";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const hadExplicitAuthorization = headers.has("Authorization");
  if (!hadExplicitAuthorization) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  let response = await fetch(input, { ...init, headers });
  if (response.status !== 401 || hadExplicitAuthorization) return response;

  // Retry once after explicit token refresh for startup races/expired tokens.
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) return response;

  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  response = await fetch(input, { ...init, headers });
  return response;
}
