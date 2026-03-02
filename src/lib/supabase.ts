import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : name === "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getClientSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseClientKey = getClientSupabaseKey();

export const supabase = createClient(
  supabaseUrl,
  supabaseClientKey
);

export function getServiceClient() {
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
