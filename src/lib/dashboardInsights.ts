type RecommendationPriority = "high" | "medium" | "low";
type RecommendationAction = "scale" | "watch" | "pause" | "investigate";

type ScoreRow = {
  id: string;
  overall_score: number | null;
  creators?:
    | {
        tiktok_username?: string | null;
        display_name?: string | null;
      }
    | Array<{
        tiktok_username?: string | null;
        display_name?: string | null;
      }>
    | null;
};

type AlertRow = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
};

export type DashboardRecommendation = {
  id: string;
  action: RecommendationAction;
  priority: RecommendationPriority;
  title: string;
  reason: string;
};

export type WeeklyBrief = {
  generated_at: string;
  highlights: string[];
  risks: string[];
  next_steps: string[];
};

function toName(row: ScoreRow): string {
  const creators = Array.isArray(row.creators) ? row.creators[0] : row.creators;
  return creators?.display_name || creators?.tiktok_username || "Creator";
}

export function buildActionRecommendations(params: {
  topPerformers: ScoreRow[];
  bottomPerformers: ScoreRow[];
  unreadAlerts: AlertRow[];
}): DashboardRecommendation[] {
  const { topPerformers, bottomPerformers, unreadAlerts } = params;
  const recommendations: DashboardRecommendation[] = [];

  const criticalAlerts = unreadAlerts.filter((a) => a.severity === "critical");
  if (criticalAlerts.length > 0) {
    recommendations.push({
      id: "investigate-critical-alerts",
      action: "investigate",
      priority: "high",
      title: `Investigate ${criticalAlerts.length} critical alert${criticalAlerts.length === 1 ? "" : "s"}`,
      reason: "Critical alerts usually indicate score drops, inactivity, or anomalous campaign performance.",
    });
  }

  const scaleCandidates = topPerformers
    .filter((row) => Number(row.overall_score || 0) >= 80)
    .slice(0, 3);
  if (scaleCandidates.length > 0) {
    recommendations.push({
      id: "scale-top-creators",
      action: "scale",
      priority: "high",
      title: `Scale top performers: ${scaleCandidates.map(toName).join(", ")}`,
      reason: "These creators are in elite score range (80+) and are likely to return higher incremental revenue.",
    });
  }

  const watchCandidates = topPerformers
    .filter((row) => {
      const score = Number(row.overall_score || 0);
      return score >= 60 && score < 80;
    })
    .slice(0, 3);
  if (watchCandidates.length > 0) {
    recommendations.push({
      id: "watch-mid-tier",
      action: "watch",
      priority: "medium",
      title: `Watch and test: ${watchCandidates.map(toName).join(", ")}`,
      reason: "These creators are promising but need tighter creative guidance before full budget expansion.",
    });
  }

  const pauseCandidates = bottomPerformers
    .filter((row) => Number(row.overall_score || 0) < 35)
    .slice(0, 3);
  if (pauseCandidates.length > 0) {
    recommendations.push({
      id: "pause-low-performers",
      action: "pause",
      priority: "medium",
      title: `Pause or re-brief: ${pauseCandidates.map(toName).join(", ")}`,
      reason: "Low-scoring creators are likely consuming spend without efficient return.",
    });
  }

  return recommendations.slice(0, 5);
}

export function buildWeeklyBrief(params: {
  totalCreators: number;
  totalEstimatedRevenue: number;
  unreadAlerts: AlertRow[];
  topPerformers: ScoreRow[];
  bottomPerformers: ScoreRow[];
}): WeeklyBrief {
  const { totalCreators, totalEstimatedRevenue, unreadAlerts, topPerformers, bottomPerformers } = params;

  const criticalCount = unreadAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = unreadAlerts.filter((a) => a.severity === "warning").length;
  const topOne = topPerformers[0];
  const lowOne = bottomPerformers[0];

  const highlights = [
    `${totalCreators} active creators tracked this cycle.`,
    `Estimated revenue: $${Math.round(totalEstimatedRevenue).toLocaleString()}.`,
    topOne
      ? `Top performer: ${toName(topOne)} with score ${Math.round(Number(topOne.overall_score || 0))}.`
      : "No top performer available yet.",
  ];

  const risks = [
    criticalCount > 0
      ? `${criticalCount} critical alert${criticalCount === 1 ? "" : "s"} need immediate attention.`
      : "No critical alerts detected.",
    warningCount > 0
      ? `${warningCount} warning alert${warningCount === 1 ? "" : "s"} should be reviewed this week.`
      : "No warning alerts detected.",
    lowOne
      ? `Lowest tracked performer: ${toName(lowOne)} at score ${Math.round(Number(lowOne.overall_score || 0))}.`
      : "No low performer risk signal available yet.",
  ];

  const next_steps = [
    "Reallocate budget toward top-tier creators (80+ score band).",
    "Review critical and warning alerts before launching new spend.",
    "Run a fresh score and revenue recalculation after creator/post updates.",
  ];

  return {
    generated_at: new Date().toISOString(),
    highlights,
    risks,
    next_steps,
  };
}
