-- Seed demo data for CreatorPulse

-- Demo organization
INSERT INTO organizations (id, name, slug)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Acme Brand Co', 'acme-brand')
ON CONFLICT (id) DO NOTHING;

-- Demo creators
INSERT INTO creators (id, org_id, tiktok_handle, display_name, avatar_url, follower_count, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '@sarah_styles', 'Sarah Styles', NULL, 284000, 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '@mike_reviews', 'Mike Reviews', NULL, 152000, 'active'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '@fitjenna', 'Jenna Fit', NULL, 97000, 'active'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '@techdale', 'Dale Tech', NULL, 410000, 'watch'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', '@beautybex', 'Bex Beauty', NULL, 63000, 'active'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', '@homechef_li', 'Li Home Chef', NULL, 198000, 'paused')
ON CONFLICT (id) DO NOTHING;

-- Demo campaign
INSERT INTO campaigns (id, org_id, name, status, start_date, end_date)
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Summer Launch 2025', 'active', '2025-06-01', '2025-09-01')
ON CONFLICT (id) DO NOTHING;

-- Demo posts
INSERT INTO posts (id, creator_id, org_id, campaign_id, tiktok_post_id, video_url, caption, views, likes, comments, shares, posted_at) VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_001', 'https://tiktok.com/1', 'Summer vibes with Acme sunscreen', 482000, 41200, 1830, 3200, NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_002', 'https://tiktok.com/2', 'GRWM featuring Acme palette', 310000, 28500, 920, 1800, NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_003', 'https://tiktok.com/3', 'Honest review of Acme gadget', 195000, 16400, 2100, 980, NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_004', 'https://tiktok.com/4', 'Morning routine with Acme protein', 89000, 7200, 430, 320, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL, 'tt_005', 'https://tiktok.com/5', 'Unboxing new tech from Acme', 720000, 62000, 4100, 8200, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'tt_006', 'https://tiktok.com/6', 'Acme lipstick shade review', 54000, 4800, 210, 150, NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', NULL, 'tt_007', 'https://tiktok.com/7', 'Cooking with Acme kitchen set', 167000, 14200, 890, 670, NOW() - INTERVAL '6 days')
ON CONFLICT DO NOTHING;

-- Demo performance scores
INSERT INTO performance_scores (id, creator_id, org_id, composite_score, engagement_rate, growth_rate, content_quality, audience_authenticity, scored_at) VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 92, 8.6, 12.3, 94, 97, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 85, 9.5, 6.1, 88, 91, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 78, 7.4, 15.8, 76, 82, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 88, 8.6, 4.2, 90, 85, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 71, 7.6, 8.9, 68, 74, NOW()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 82, 7.2, 3.1, 85, 90, NOW())
ON CONFLICT DO NOTHING;

-- Demo revenue estimates
INSERT INTO revenue_estimates (id, post_id, creator_id, org_id, estimated_gmv, estimated_commission, commission_rate, confidence)
SELECT gen_random_uuid(), p.id, p.creator_id, p.org_id,
  CASE
    WHEN p.views > 500000 THEN 12400.00
    WHEN p.views > 200000 THEN 6800.00
    WHEN p.views > 100000 THEN 3200.00
    ELSE 1200.00
  END,
  CASE
    WHEN p.views > 500000 THEN 1860.00
    WHEN p.views > 200000 THEN 1020.00
    WHEN p.views > 100000 THEN 480.00
    ELSE 180.00
  END,
  15.0,
  CASE
    WHEN p.views > 300000 THEN 'high'
    WHEN p.views > 100000 THEN 'medium'
    ELSE 'low'
  END
FROM posts p
ON CONFLICT DO NOTHING;

-- Demo alerts
INSERT INTO alerts (id, org_id, creator_id, type, severity, title, description) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'engagement_drop', 'warning', 'Engagement declining', 'Dale Tech engagement rate dropped 18% over the last 7 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'viral_post', 'info', 'Viral content detected', 'Sarah Styles sunscreen post crossed 400K views'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'creator_inactive', 'critical', 'Creator inactive', 'Li Home Chef has not posted in 14 days')
ON CONFLICT DO NOTHING;
