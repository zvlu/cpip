-- Allow public read access to demo data for development
-- This enables the dashboard to work before a user is fully onboarded

-- Creators: allow select for anyone (demo-friendly)
CREATE POLICY "creators_public_read" ON creators FOR SELECT USING (true);

-- Posts: allow select for anyone
CREATE POLICY "posts_public_read" ON posts FOR SELECT USING (true);

-- Performance scores: allow select for anyone
CREATE POLICY "scores_public_read" ON performance_scores FOR SELECT USING (true);

-- Revenue estimates: allow select for anyone
CREATE POLICY "revenue_public_read" ON revenue_estimates FOR SELECT USING (true);

-- Alerts: allow select for demo org
CREATE POLICY "alerts_public_read" ON alerts FOR SELECT USING (true);

-- Allow update on alerts for dismissing
CREATE POLICY "alerts_public_update" ON alerts FOR UPDATE USING (true);

-- Organizations: allow select
CREATE POLICY "orgs_public_read" ON organizations FOR SELECT USING (true);

-- Campaign creators: allow select
CREATE POLICY "campaign_creators_public_read" ON campaign_creators FOR SELECT USING (true);

-- Campaigns: allow select
CREATE POLICY "campaigns_public_read" ON campaigns FOR SELECT USING (true);
