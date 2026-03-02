/**
 * Lookalike Discovery Engine
 * Finds similar creators based on audience overlap, engagement patterns, and content style
 */

export interface LookalikeMatch {
  creator_id: string;
  tiktok_username: string;
  similarity_score: number; // 0-100
  audience_overlap: number; // % of shared audience
  engagement_similarity: number; // How similar engagement rates are
  content_style_match: number; // How similar content styles are
  follower_count: number;
  engagement_rate: number;
  reason: string;
}

export interface LookalikeDiscoveryResult {
  seed_creator: {
    id: string;
    username: string;
  };
  similar_creators: LookalikeMatch[];
  discovery_insights: string[];
}

export function calculateSimilarityScore(
  seedCreator: any,
  candidateCreator: any,
  seedMetrics: any,
  candidateMetrics: any
): LookalikeMatch {
  // 1. Audience Overlap (30% weight)
  const audienceOverlap = calculateAudienceOverlap(seedCreator, candidateCreator);

  // 2. Engagement Similarity (40% weight)
  const engagementSimilarity = calculateEngagementSimilarity(seedMetrics, candidateMetrics);

  // 3. Content Style Match (30% weight)
  const contentStyleMatch = calculateContentStyleMatch(seedMetrics, candidateMetrics);

  // Weighted composite score
  const similarityScore = audienceOverlap * 0.3 + engagementSimilarity * 0.4 + contentStyleMatch * 0.3;

  // Generate reason
  const reason = generateMatchReason(audienceOverlap, engagementSimilarity, contentStyleMatch);

  return {
    creator_id: candidateCreator.id,
    tiktok_username: candidateCreator.tiktok_username,
    similarity_score: Math.round(Math.min(100, Math.max(0, similarityScore))),
    audience_overlap: Math.round(audienceOverlap),
    engagement_similarity: Math.round(engagementSimilarity),
    content_style_match: Math.round(contentStyleMatch),
    follower_count: candidateCreator.follower_count || 0,
    engagement_rate: candidateMetrics?.engagement_rate || 0,
    reason,
  };
}

function calculateAudienceOverlap(seedCreator: any, candidateCreator: any): number {
  // Simplified: based on follower count similarity and niche alignment
  const followerRatio = Math.min(
    seedCreator.follower_count,
    candidateCreator.follower_count
  ) / Math.max(seedCreator.follower_count, candidateCreator.follower_count);

  // Assume niche alignment based on category (simplified)
  const nicheAlignment = 70; // Would be calculated from actual audience data

  return followerRatio * 50 + nicheAlignment * 0.5;
}

function calculateEngagementSimilarity(seedMetrics: any, candidateMetrics: any): number {
  if (!seedMetrics || !candidateMetrics) return 0;

  const seedEngagement = seedMetrics.engagement_rate || 0;
  const candidateEngagement = candidateMetrics.engagement_rate || 0;

  // Calculate how close the engagement rates are (100 = identical, 0 = very different)
  const engagementDiff = Math.abs(seedEngagement - candidateEngagement);
  const engagementSimilarity = Math.max(0, 100 - engagementDiff * 5);

  return engagementSimilarity;
}

function calculateContentStyleMatch(seedMetrics: any, candidateMetrics: any): number {
  if (!seedMetrics || !candidateMetrics) return 50;

  // Compare content consistency, posting frequency, and style diversity
  const seedConsistency = seedMetrics.content_consistency || 50;
  const candidateConsistency = candidateMetrics.content_consistency || 50;

  const consistencyDiff = Math.abs(seedConsistency - candidateConsistency);
  const styleMatch = Math.max(0, 100 - consistencyDiff * 2);

  return styleMatch;
}

function generateMatchReason(audienceOverlap: number, engagementSimilarity: number, contentStyleMatch: number): string {
  const reasons: string[] = [];

  if (audienceOverlap > 70) {
    reasons.push("Strong audience overlap");
  } else if (audienceOverlap > 50) {
    reasons.push("Good audience alignment");
  }

  if (engagementSimilarity > 75) {
    reasons.push("Similar engagement patterns");
  } else if (engagementSimilarity > 60) {
    reasons.push("Comparable engagement rates");
  }

  if (contentStyleMatch > 70) {
    reasons.push("Matching content style");
  }

  return reasons.length > 0 ? reasons.join(" + ") : "Potential match";
}

export function generateOutreachSnippet(creator: any, topPost: any, seedCreatorName: string): string {
  const postType = topPost?.caption?.length > 100 ? "detailed" : "concise";
  const viewCount = topPost?.views || 0;

  return `Hi @${creator.tiktok_username}! We noticed your ${postType} content style resonates with audiences similar to @${seedCreatorName}. Your recent post got ${viewCount.toLocaleString()} views. We'd love to explore a partnership opportunity.`;
}
