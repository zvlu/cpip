/**
 * Predictive ROI Score Algorithm
 * Calculates the likelihood of a creator driving conversions for a brand campaign
 * Based on: engagement rate, audience quality, content consistency, and viral potential
 */

export interface PredictiveScoreInput {
  engagementRate: number; // 0-100 (likes + comments + shares) / views * 100
  averageViews: number; // Average views per post in last 30 days
  followerGrowthRate: number; // % growth in last 30 days
  postFrequency: number; // Posts per week
  audienceDemographicMatch: number; // 0-100, how well audience matches target demographic
  contentConsistency: number; // 0-100, how consistent the content theme is
  viralPostCount: number; // Number of posts with >100k views in last 30 days
  totalPosts: number; // Total posts analyzed
  averageSentiment: number; // 0-100, positive sentiment in comments
}

export interface PredictiveScoreResult {
  conversionProbability: number; // 0-100, likelihood of driving sales
  viralPotential: number; // 0-100, likelihood of post going viral
  overallROIScore: number; // 0-100, composite score
  recommendations: string[];
  riskFactors: string[];
}

export function calculatePredictiveROIScore(input: PredictiveScoreInput): PredictiveScoreResult {
  // 1. Conversion Probability (40% weight)
  const conversionScore = calculateConversionProbability(input);

  // 2. Viral Potential (30% weight)
  const viralScore = calculateViralPotential(input);

  // 3. Audience Quality (20% weight)
  const audienceQualityScore = calculateAudienceQuality(input);

  // 4. Content Consistency (10% weight)
  const consistencyScore = input.contentConsistency;

  // Weighted composite score
  const overallROIScore =
    conversionScore * 0.4 + viralScore * 0.3 + audienceQualityScore * 0.2 + consistencyScore * 0.1;

  // Generate recommendations and risk factors
  const recommendations = generateRecommendations(input, overallROIScore);
  const riskFactors = identifyRiskFactors(input);

  return {
    conversionProbability: Math.round(conversionScore),
    viralPotential: Math.round(viralScore),
    overallROIScore: Math.round(Math.min(100, Math.max(0, overallROIScore))),
    recommendations,
    riskFactors,
  };
}

function calculateConversionProbability(input: PredictiveScoreInput): number {
  // Conversion is driven by engagement rate, audience match, and post frequency
  const engagementComponent = input.engagementRate * 0.5; // High engagement = more likely to convert
  const audienceMatchComponent = input.audienceDemographicMatch * 0.3; // Right audience = conversions
  const frequencyComponent = Math.min(input.postFrequency * 10, 20); // Consistent posting helps, but diminishing returns

  return engagementComponent + audienceMatchComponent + frequencyComponent;
}

function calculateViralPotential(input: PredictiveScoreInput): number {
  // Viral potential is driven by past viral success, engagement rate, and follower growth
  const viralHistoryScore = (input.viralPostCount / Math.max(input.totalPosts, 1)) * 100; // % of posts that went viral
  const engagementComponent = input.engagementRate * 0.6; // High engagement = viral potential
  const growthComponent = Math.min(input.followerGrowthRate * 2, 30); // Rapid growth indicates viral appeal

  return (viralHistoryScore * 0.4 + engagementComponent * 0.4 + growthComponent * 0.2) * 0.8; // Scale down to 0-100
}

function calculateAudienceQuality(input: PredictiveScoreInput): number {
  // Audience quality is driven by demographic match, engagement rate, and sentiment
  const demographicComponent = input.audienceDemographicMatch * 0.5;
  const engagementComponent = input.engagementRate * 0.3; // Engaged audiences are higher quality
  const sentimentComponent = input.averageSentiment * 0.2; // Positive sentiment = quality audience

  return demographicComponent + engagementComponent + sentimentComponent;
}

function generateRecommendations(input: PredictiveScoreInput, score: number): string[] {
  const recommendations: string[] = [];

  if (score >= 80) {
    recommendations.push("🌟 Excellent fit - prioritize for high-budget campaigns");
    recommendations.push("💰 Consider exclusive partnership or long-term contract");
  } else if (score >= 60) {
    recommendations.push("✅ Good fit - suitable for mid-tier campaigns");
    recommendations.push("📈 Monitor performance and increase spend if ROI is strong");
  } else if (score >= 40) {
    recommendations.push("⚠️ Moderate fit - test with smaller campaign first");
    recommendations.push("🔍 Analyze past performance with similar brands");
  } else {
    recommendations.push("❌ Lower fit - consider for niche campaigns only");
    recommendations.push("📊 Request detailed analytics before engagement");
  }

  if (input.engagementRate > 8) {
    recommendations.push("🔥 Exceptionally high engagement - leverage for authentic content");
  }

  if (input.followerGrowthRate > 15) {
    recommendations.push("📈 Rapidly growing audience - act quickly to secure partnership");
  }

  if (input.contentConsistency < 40) {
    recommendations.push("⚠️ Content theme is inconsistent - may confuse audience");
  }

  return recommendations;
}

function identifyRiskFactors(input: PredictiveScoreInput): string[] {
  const risks: string[] = [];

  if (input.engagementRate < 1) {
    risks.push("Very low engagement rate - audience may not be responsive");
  }

  if (input.audienceDemographicMatch < 40) {
    risks.push("Poor demographic match - may not reach target audience");
  }

  if (input.postFrequency < 0.5) {
    risks.push("Infrequent posting - may struggle to maintain visibility");
  }

  if (input.contentConsistency < 30) {
    risks.push("Highly inconsistent content - brand message may get lost");
  }

  if (input.averageSentiment < 50) {
    risks.push("Negative audience sentiment - may impact brand perception");
  }

  if (input.viralPostCount === 0 && input.totalPosts > 20) {
    risks.push("No viral history - may lack reach potential");
  }

  return risks;
}

/**
 * Tier assignment based on Predictive ROI Score
 */
export function assignTierByPredictiveScore(score: number): string {
  if (score >= 85) return "S"; // Elite tier
  if (score >= 70) return "A"; // Premium tier
  if (score >= 55) return "B"; // Standard tier
  if (score >= 40) return "C"; // Entry tier
  return "D"; // Monitor tier
}
