-- Seed demo data for CreatorPulse
-- Columns match 001_create_schema.sql exactly

-- Demo organization
INSERT INTO organizations (id, name, slug, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Acme Brand Co', 'acme-brand', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Demo campaign
INSERT INTO campaigns (id, org_id, name, product_name, aov, commission_rate, default_ctr, default_cvr, status)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Summer Launch 2025',
  'Acme Essentials',
  45.00,
  0.15,
  0.02,
  0.03,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Demo creators (status must be active|inactive|blacklisted)
INSERT INTO creators (id, org_id, tiktok_username, display_name, follower_count, category, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sarah_styles',   'Sarah Styles',   284000, 'Beauty',   'active'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'mike_reviews',   'Mike Reviews',   152000, 'Tech',     'active'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'fitjenna',       'Jenna Fit',       97000, 'Fitness',  'active'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'techdale',       'Dale Tech',      410000, 'Tech',     'active'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'beautybex',      'Bex Beauty',      63000, 'Beauty',   'active'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'homechef_li',    'Li Home Chef',   198000, 'Food',     'inactive')
ON CONFLICT (id) DO NOTHING;

-- Link creators to campaign
INSERT INTO campaign_creators (campaign_id, creator_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Demo posts (only columns that exist in schema)
INSERT INTO posts (id, creator_id, campaign_id, tiktok_post_id, url, caption, views, likes, comments, shares, saves, posted_at, has_product_link) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_001', 'https://tiktok.com/@sarah_styles/video/1', 'Summer vibes with Acme sunscreen',  482000, 41200, 1830, 3200, 890, NOW() - INTERVAL '3 days', true),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_002', 'https://tiktok.com/@sarah_styles/video/2', 'GRWM featuring Acme palette',       310000, 28500,  920, 1800, 620, NOW() - INTERVAL '7 days', true),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'tt_003', 'https://tiktok.com/@mike_reviews/video/3', 'Honest review of Acme gadget',      195000, 16400, 2100,  980, 410, NOW() - INTERVAL '2 days', true),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'tt_004', 'https://tiktok.com/@fitjenna/video/4',     'Morning routine with Acme protein',  89000,  7200,  430,  320, 180, NOW() - INTERVAL '1 day',  true),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', NULL,                                   'tt_005', 'https://tiktok.com/@techdale/video/5',     'Unboxing new tech from Acme',       720000, 62000, 4100, 8200, 2400, NOW() - INTERVAL '5 days', false),
  ('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'tt_006', 'https://tiktok.com/@beautybex/video/6',    'Acme lipstick shade review',         54000,  4800,  210,  150,  90, NOW() - INTERVAL '4 days', true),
  ('e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000006', NULL,                                   'tt_007', 'https://tiktok.com/@homechef_li/video/7',  'Cooking with Acme kitchen set',     167000, 14200,  890,  670, 340, NOW() - INTERVAL '6 days', false)
ON CONFLICT (tiktok_post_id) DO NOTHING;

-- Demo revenue estimates (generated columns are auto-calculated, we just supply inputs)
INSERT INTO revenue_estimates (post_id, campaign_id, views, ctr, cvr, aov, commission_rate) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 482000, 0.02, 0.03, 45.00, 0.15),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 310000, 0.02, 0.03, 45.00, 0.15),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 195000, 0.02, 0.03, 45.00, 0.15),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',  89000, 0.02, 0.03, 45.00, 0.15),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001',  54000, 0.02, 0.03, 45.00, 0.15)
ON CONFLICT (post_id, campaign_id) DO NOTHING;

-- Demo performance scores
INSERT INTO performance_scores (creator_id, campaign_id, score_date, engagement_score, consistency_score, revenue_score, growth_score, reach_score, overall_score) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE, 92, 85, 88, 78, 90, 87),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE, 85, 90, 72, 65, 78, 78),
  ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE, 78, 70, 60, 82, 55, 69),
  ('c0000000-0000-0000-0000-000000000004', NULL,                                   CURRENT_DATE, 88, 60, 80, 42, 95, 73),
  ('c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', CURRENT_DATE, 71, 65, 55, 68, 48, 61),
  ('c0000000-0000-0000-0000-000000000006', NULL,                                   CURRENT_DATE, 82, 40, 70, 31, 72, 59)
ON CONFLICT (creator_id, campaign_id, score_date) DO NOTHING;

-- Demo alerts (type must match check constraint)
INSERT INTO alerts (org_id, creator_id, type, severity, title, message) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'score_drop', 'warning',  'Engagement declining',   'Dale Tech engagement rate dropped 18% over the last 7 days'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'viral_post', 'info',     'Viral content detected', 'Sarah Styles sunscreen post crossed 400K views'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'inactive',   'critical', 'Creator inactive',       'Li Home Chef has not posted in 14 days')
ON CONFLICT DO NOTHING;
