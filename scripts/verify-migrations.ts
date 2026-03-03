import { readdirSync, readFileSync } from "fs";
import { join } from "path";

function assertContains(content: string, needle: string, label: string) {
  if (!content.includes(needle)) {
    throw new Error(`Missing migration requirement: ${label}`);
  }
}

function main() {
  const migrationsDir = join(process.cwd(), "supabase/migrations");
  const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  const migrationNumbers = migrationFiles
    .map((file) => Number(file.split("_")[0]))
    .filter((num) => Number.isFinite(num));
  const uniqueNumbers = new Set(migrationNumbers);
  if (uniqueNumbers.size !== migrationNumbers.length) {
    throw new Error(`Duplicate migration version detected. Found: ${migrationFiles.join(", ")}`);
  }

  const requiredVersions = [1, 2, 3, 4, 5, 6, 7];
  for (const version of requiredVersions) {
    if (!uniqueNumbers.has(version)) {
      throw new Error(`Missing migration version ${String(version).padStart(3, "0")}`);
    }
  }

  const migration001 = readFileSync(join(process.cwd(), "supabase/migrations/001_initial_schema.sql"), "utf8");
  const migration003 = readFileSync(join(process.cwd(), "supabase/migrations/003_backend_hardening.sql"), "utf8");
  const migration005 = readFileSync(join(process.cwd(), "supabase/migrations/005_rls_hardening.sql"), "utf8");

  assertContains(migration003, "create table if not exists predictive_scores", "predictive_scores table");
  assertContains(migration003, "alter table if exists post_semantic_features", "semantic features campaign_id normalization");
  assertContains(migration003, "creator_semantic_profiles", "creator semantic profile hardening");
  assertContains(migration003, "enable row level security", "RLS enable statements");
  assertContains(migration003, "create policy predictive_scores_org_isolation", "predictive score policy");
  assertContains(migration005, "create or replace function public.requesting_user_org_id()", "requesting_user_org_id helper");
  assertContains(migration001, "alter table posts enable row level security;", "posts RLS baseline");

  console.log("Migration verification passed.");
}

main();
