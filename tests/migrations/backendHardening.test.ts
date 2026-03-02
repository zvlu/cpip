import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("backend hardening migration", () => {
  const migrationPath = join(process.cwd(), "supabase/migrations/003_backend_hardening.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("creates predictive_scores table", () => {
    expect(migrationSql).toContain("create table if not exists predictive_scores");
  });

  it("adds semantic campaign foreign keys", () => {
    expect(migrationSql).toContain("post_semantic_features_campaign_id_fkey");
    expect(migrationSql).toContain("creator_semantic_profiles_campaign_id_fkey");
  });

  it("defines RLS policies for hardened tables", () => {
    expect(migrationSql).toContain("create policy posts_org_isolation");
    expect(migrationSql).toContain("create policy predictive_scores_org_isolation");
    expect(migrationSql).toContain("create policy creator_semantic_profiles_org_isolation");
  });
});
