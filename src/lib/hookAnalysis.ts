/**
 * Creative Hook Analysis
 * Analyzes content patterns to identify what makes a creator's content successful
 * Categorizes content by style and identifies top-performing hooks
 */

export type ContentStyle =
  | "ASMR_UNBOXING"
  | "EDUCATIONAL_DEEPDIVE"
  | "LIFESTYLE_INTEGRATION"
  | "COMEDY_SKIT"
  | "TRANSFORMATION"
  | "TREND_PARTICIPATION"
  | "STORYTELLING"
  | "CHALLENGE"
  | "TUTORIAL"
  | "REVIEW";

export interface ContentAnalysis {
  style: ContentStyle;
  description: string;
  emoji: string;
}

export interface HookMetrics {
  style: ContentStyle;
  averageViews: number;
  averageEngagementRate: number;
  postCount: number;
  topPerformingPost: {
    views: number;
    likes: number;
    comments: number;
    engagement_rate: number;
  } | null;
}

export interface CreativeAudit {
  topContentStyles: HookMetrics[];
  contentDiversity: number;
  hookStrength: number;
  recommendations: string[];
  bestPerformingStyle: ContentStyle | null;
}

const CONTENT_STYLE_KEYWORDS: Record<ContentStyle, string[]> = {
  ASMR_UNBOXING: ["unboxing", "asmr", "opening", "reveal", "package"],
  EDUCATIONAL_DEEPDIVE: ["explain", "how to", "tutorial", "guide", "learn", "tips"],
  LIFESTYLE_INTEGRATION: ["morning routine", "daily", "lifestyle", "vlog", "day in my life"],
  COMEDY_SKIT: ["funny", "comedy", "skit", "joke", "laugh", "hilarious"],
  TRANSFORMATION: ["before after", "transformation", "glow up", "makeover", "change"],
  TREND_PARTICIPATION: ["trend", "challenge", "viral", "sound", "dance"],
  STORYTELLING: ["story", "storytime", "experience", "journey", "happened"],
  CHALLENGE: ["challenge", "dare", "test", "try", "attempt"],
  TUTORIAL: ["diy", "how to make", "recipe", "craft", "build"],
  REVIEW: ["review", "rating", "honest", "thoughts", "opinion"],
};

const CONTENT_DESCRIPTIONS: Record<ContentStyle, string> = {
  ASMR_UNBOXING: "Sensory-focused unboxing and product reveal content",
  EDUCATIONAL_DEEPDIVE: "Educational and instructional content",
  LIFESTYLE_INTEGRATION: "Daily life and routine content",
  COMEDY_SKIT: "Humorous and comedic content",
  TRANSFORMATION: "Before/after and transformation content",
  TREND_PARTICIPATION: "Trending audio and challenge participation",
  STORYTELLING: "Narrative and personal story content",
  CHALLENGE: "Challenge and dare content",
  TUTORIAL: "DIY and instructional content",
  REVIEW: "Product and experience reviews",
};

const CONTENT_EMOJIS: Record<ContentStyle, string> = {
  ASMR_UNBOXING: "📦",
  EDUCATIONAL_DEEPDIVE: "📚",
  LIFESTYLE_INTEGRATION: "🌅",
  COMEDY_SKIT: "😂",
  TRANSFORMATION: "✨",
  TREND_PARTICIPATION: "🔥",
  STORYTELLING: "📖",
  CHALLENGE: "🎯",
  TUTORIAL: "🛠️",
  REVIEW: "⭐",
};

export function analyzeContentHooks(posts: any[]): CreativeAudit {
  if (!posts || posts.length === 0) {
    return {
      topContentStyles: [],
      contentDiversity: 0,
      hookStrength: 0,
      recommendations: ["No posts available for analysis"],
      bestPerformingStyle: null,
    };
  }

  const styleMetrics: Record<ContentStyle, HookMetrics> = {} as any;

  for (const style of Object.keys(CONTENT_STYLE_KEYWORDS) as ContentStyle[]) {
    const matchingPosts = posts.filter((post) => {
      const caption = (post.caption || "").toLowerCase();
      const keywords = CONTENT_STYLE_KEYWORDS[style];
      return keywords.some((keyword) => caption.includes(keyword));
    });

    if (matchingPosts.length > 0) {
      const totalViews = matchingPosts.reduce((sum, p) => sum + (p.views || 0), 0);
      const totalEngagement = matchingPosts.reduce(
        (sum, p) => sum + ((p.likes || 0) + (p.comments || 0) + (p.shares || 0)),
        0
      );
      const avgEngagementRate = (totalEngagement / Math.max(totalViews, 1)) * 100;
      const topPost = matchingPosts.reduce((max, p) => ((p.views || 0) > (max.views || 0) ? p : max));

      styleMetrics[style] = {
        style,
        averageViews: totalViews / matchingPosts.length,
        averageEngagementRate: avgEngagementRate,
        postCount: matchingPosts.length,
        topPerformingPost: {
          views: topPost.views || 0,
          likes: topPost.likes || 0,
          comments: topPost.comments || 0,
          engagement_rate: ((topPost.likes + topPost.comments + topPost.shares) / Math.max(topPost.views, 1)) * 100,
        },
      };
    }
  }

  const topContentStyles = Object.values(styleMetrics)
    .filter((m) => m.postCount > 0)
    .sort((a, b) => b.averageViews - a.averageViews)
    .slice(0, 5);

  const contentDiversity = Math.min(100, (topContentStyles.length / 10) * 100);
  const hookStrength =
    topContentStyles.length > 0
      ? Math.min(100, topContentStyles[0].averageEngagementRate * 10)
      : 0;

  const recommendations = generateHookRecommendations(topContentStyles, contentDiversity);

  return {
    topContentStyles,
    contentDiversity: Math.round(contentDiversity),
    hookStrength: Math.round(hookStrength),
    recommendations,
    bestPerformingStyle: topContentStyles[0]?.style || null,
  };
}

function generateHookRecommendations(styles: HookMetrics[], diversity: number): string[] {
  const recommendations: string[] = [];

  if (styles.length === 0) {
    recommendations.push("No clear content patterns found - diversify content strategy");
    return recommendations;
  }

  const topStyle = styles[0];
  recommendations.push(
    `${CONTENT_EMOJIS[topStyle.style]} "${CONTENT_DESCRIPTIONS[topStyle.style]}" performs best`
  );

  if (topStyle.averageEngagementRate > 5) {
    recommendations.push(`Exceptionally high engagement on ${topStyle.style} content`);
  }

  if (diversity < 30) {
    recommendations.push("Content is repetitive - try mixing in other styles");
  } else if (diversity > 70) {
    recommendations.push("Great content diversity - keeps audience engaged");
  }

  if (styles.length > 1) {
    const secondStyle = styles[1];
    recommendations.push(`Secondary strength: ${CONTENT_EMOJIS[secondStyle.style]} ${CONTENT_DESCRIPTIONS[secondStyle.style]}`);
  }

  return recommendations;
}

export function getContentStyleDescription(style: ContentStyle): ContentAnalysis {
  return {
    style,
    description: CONTENT_DESCRIPTIONS[style],
    emoji: CONTENT_EMOJIS[style],
  };
}
