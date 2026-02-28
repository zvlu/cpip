const WEIGHTS = { engagement: 0.25, revenue: 0.30, consistency: 0.20, reach: 0.15, growth: 0.10 };

interface Post {
  views: number; likes: number; comments: number; shares: number; saves: number;
  posted_at: string; revenue_estimates?: { estimated_revenue: number }[];
}

export function calculateCreatorScore(
  posts: Post[],
  prevScore: { engagement_score: number } | null,
  creator: { follower_count: number }
) {
  if (!posts.length) return emptyScore();

  const totalEng = posts.reduce((s, p) => s + p.likes + p.comments + p.shares * 2 + p.saves * 1.5, 0);
  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const engRate = totalViews > 0 ? totalEng / totalViews : 0;
  const engagement_score = clamp(norm(engRate, 0.01, 0.08) * 100);

  const totalRev = posts.reduce((s, p) => s + Number(p.revenue_estimates?.[0]?.estimated_revenue || 0), 0);
  const revPerPost = totalRev / posts.length;
  const revenue_score = clamp(norm(revPerPost, 0, 500) * 100);

  const postsPerWeek = (posts.length / 30) * 7;
  const consistency_score = clamp(norm(postsPerWeek, 0, 5) * 100);

  const avgViews = totalViews / posts.length;
  const vtf = creator.follower_count > 0 ? avgViews / creator.follower_count : 0;
  const reach_score = clamp(norm(vtf, 0.05, 2.0) * 100);

  let growth_score = 50;
  if (prevScore) {
    const delta = engagement_score - prevScore.engagement_score;
    growth_score = clamp(norm(delta, -20, 20) * 100);
  }

  const overall_score = Math.round(
    engagement_score * WEIGHTS.engagement + revenue_score * WEIGHTS.revenue +
    consistency_score * WEIGHTS.consistency + reach_score * WEIGHTS.reach + growth_score * WEIGHTS.growth
  );

  return {
    score_date: new Date().toISOString().split("T")[0],
    engagement_score: r2(engagement_score), consistency_score: r2(consistency_score),
    revenue_score: r2(revenue_score), growth_score: r2(growth_score),
    reach_score: r2(reach_score), overall_score,
    metadata: { total_posts: posts.length, total_views: totalViews, total_revenue: totalRev, engagement_rate: r2(engRate * 100), posts_per_week: r2(postsPerWeek) },
  };
}

function norm(v: number, min: number, max: number) { return (v - min) / (max - min); }
function clamp(v: number) { return Math.max(0, Math.min(100, v)); }
function r2(n: number) { return Math.round(n * 100) / 100; }
function emptyScore() {
  return { score_date: new Date().toISOString().split("T")[0], engagement_score: 0, consistency_score: 0, revenue_score: 0, growth_score: 0, reach_score: 0, overall_score: 0, metadata: {} };
}
