const POSITIVE_WORDS = [
  "love",
  "amazing",
  "great",
  "best",
  "awesome",
  "perfect",
  "good",
  "excited",
  "favorite",
  "recommend",
];

const NEGATIVE_WORDS = [
  "hate",
  "bad",
  "worst",
  "terrible",
  "awful",
  "disappointed",
  "boring",
  "fake",
  "scam",
  "expensive",
];

const CTA_PHRASES = [
  "link in bio",
  "shop now",
  "use code",
  "buy now",
  "tap to shop",
  "check this out",
  "follow for more",
  "save this",
  "comment below",
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  beauty: ["makeup", "skincare", "beauty", "grwm", "cosmetic"],
  fashion: ["outfit", "style", "fashion", "ootd", "wardrobe"],
  fitness: ["gym", "workout", "fitness", "protein", "training"],
  food: ["recipe", "food", "cook", "meal", "kitchen"],
  tech: ["tech", "review", "gadget", "phone", "ai", "app"],
  lifestyle: ["routine", "daily", "vlog", "lifestyle", "morning"],
  finance: ["money", "invest", "budget", "income", "side hustle"],
  travel: ["travel", "trip", "hotel", "flight", "destination"],
};

export interface SemanticPostInput {
  caption: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  has_product_link: boolean;
}

export interface SemanticPostResult {
  topic_labels: string[];
  hook_type: string;
  cta_strength: number;
  sentiment_score: number;
  brand_safety_score: number;
  audience_intent: string;
  semantic_summary: string;
  confidence: number;
  model_provider: string;
  model_name: string;
  raw_response: Record<string, unknown>;
}

export interface CreatorSemanticProfile {
  top_topics: string[];
  content_consistency: number;
  average_sentiment: number;
  audience_demographic_match: number;
  recommendations: string[];
  metadata: Record<string, unknown>;
}

const DEFAULT_MODEL = process.env.SEMANTIC_ANALYSIS_MODEL || "gpt-4o-mini";

export async function analyzePostSemantics(input: SemanticPostInput): Promise<SemanticPostResult> {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicSemanticAnalysis(input);
  }

  try {
    const prompt = [
      "You are analyzing a short-form creator post for influencer campaign fit.",
      "Return JSON only with keys:",
      "topic_labels (array of strings), hook_type (string), cta_strength (0-100), sentiment_score (0-100),",
      "brand_safety_score (0-100), audience_intent (string), semantic_summary (string), confidence (0-100).",
      "Do not include markdown.",
      "",
      `caption: ${input.caption || ""}`,
      `hashtags: ${(input.hashtags || []).join(", ")}`,
      `views: ${input.views || 0}`,
      `likes: ${input.likes || 0}`,
      `comments: ${input.comments || 0}`,
      `shares: ${input.shares || 0}`,
      `has_product_link: ${Boolean(input.has_product_link)}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a strict JSON generator." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return heuristicSemanticAnalysis(input);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return heuristicSemanticAnalysis(input);
    }

    const parsed = JSON.parse(content) as Partial<SemanticPostResult>;
    return normalizeSemanticResult(parsed, input, "openai", DEFAULT_MODEL);
  } catch {
    return heuristicSemanticAnalysis(input);
  }
}

export function buildCreatorSemanticProfile(
  results: SemanticPostResult[],
  campaignContext?: { name?: string; product_name?: string }
): CreatorSemanticProfile {
  if (!results.length) {
    return {
      top_topics: [],
      content_consistency: 0,
      average_sentiment: 0,
      audience_demographic_match: 50,
      recommendations: ["No semantic data yet. Run a scrape first."],
      metadata: {},
    };
  }

  const topicCounts: Record<string, number> = {};
  for (const result of results) {
    for (const topic of result.topic_labels) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  const topicEntries = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  const top_topics = topicEntries.slice(0, 5).map(([topic]) => topic);
  const totalTagged = topicEntries.reduce((sum, [, count]) => sum + count, 0);
  const dominantShare = totalTagged > 0 ? topicEntries[0][1] / totalTagged : 0;
  const content_consistency = clamp01To100(0.2 + dominantShare * 0.8);

  const average_sentiment =
    results.reduce((sum, result) => sum + toNumber((result as any).sentiment_score, 0), 0) /
    Math.max(1, results.length);

  const audience_demographic_match = estimateAudienceMatch(top_topics, campaignContext);

  const recommendations = buildRecommendations({
    top_topics,
    content_consistency,
    average_sentiment,
    audience_demographic_match,
  });

  return {
    top_topics,
    content_consistency: round2(content_consistency),
    average_sentiment: round2(average_sentiment),
    audience_demographic_match: round2(audience_demographic_match),
    recommendations,
    metadata: {
      analyzed_posts: results.length,
      dominant_topic_share: round2(dominantShare * 100),
    },
  };
}

function heuristicSemanticAnalysis(input: SemanticPostInput): SemanticPostResult {
  const text = `${input.caption || ""} ${(input.hashtags || []).join(" ")}`.toLowerCase();
  const topic_labels = detectTopics(text, input.hashtags || []);
  const cta_strength = calcCtaStrength(text, input.has_product_link);
  const sentiment_score = calcSentiment(text);
  const brand_safety_score = calcBrandSafety(text);
  const hook_type = detectHookType(text);
  const audience_intent = detectAudienceIntent(text, cta_strength);

  return {
    topic_labels,
    hook_type,
    cta_strength,
    sentiment_score,
    brand_safety_score,
    audience_intent,
    semantic_summary: createSummary(topic_labels, hook_type, cta_strength),
    confidence: 62,
    model_provider: "heuristic",
    model_name: "rule-based-v1",
    raw_response: {
      method: "fallback-heuristic",
      engagement: {
        views: input.views,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
      },
    },
  };
}

function normalizeSemanticResult(
  parsed: Partial<SemanticPostResult>,
  input: SemanticPostInput,
  provider: string,
  model: string
): SemanticPostResult {
  const text = `${input.caption || ""} ${(input.hashtags || []).join(" ")}`.toLowerCase();
  const fallback = heuristicSemanticAnalysis(input);
  return {
    topic_labels: uniqStrings(parsed.topic_labels, fallback.topic_labels),
    hook_type: safeString(parsed.hook_type, fallback.hook_type),
    cta_strength: clamp100(parsed.cta_strength, fallback.cta_strength),
    sentiment_score: clamp100(parsed.sentiment_score, fallback.sentiment_score),
    brand_safety_score: clamp100(parsed.brand_safety_score, fallback.brand_safety_score),
    audience_intent: safeString(parsed.audience_intent, detectAudienceIntent(text, fallback.cta_strength)),
    semantic_summary: safeString(parsed.semantic_summary, fallback.semantic_summary),
    confidence: clamp100(parsed.confidence, 75),
    model_provider: provider,
    model_name: model,
    raw_response: typeof parsed.raw_response === "object" && parsed.raw_response ? parsed.raw_response : parsed,
  };
}

function detectTopics(text: string, hashtags: string[]): string[] {
  const fromKeywords = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([topic]) => topic);
  const fromHashtags = hashtags.map((tag) => tag.toLowerCase()).filter((tag) => TOPIC_KEYWORDS[tag]);
  const topics = [...fromKeywords, ...fromHashtags];
  return Array.from(new Set(topics)).slice(0, 5);
}

function calcCtaStrength(text: string, hasProductLink: boolean): number {
  const phraseHits = CTA_PHRASES.filter((phrase) => text.includes(phrase)).length;
  const base = phraseHits * 22 + (hasProductLink ? 20 : 0);
  return Math.min(100, Math.max(0, base));
}

function calcSentiment(text: string): number {
  const positiveHits = POSITIVE_WORDS.filter((word) => text.includes(word)).length;
  const negativeHits = NEGATIVE_WORDS.filter((word) => text.includes(word)).length;
  const raw = 50 + positiveHits * 10 - negativeHits * 12;
  return clamp100(raw, 50);
}

function calcBrandSafety(text: string): number {
  const riskyTerms = ["gambling", "violence", "hate", "scam", "explicit"];
  const riskHits = riskyTerms.filter((term) => text.includes(term)).length;
  return clamp100(100 - riskHits * 25, 100);
}

function detectHookType(text: string): string {
  if (text.includes("before") && text.includes("after")) return "transformation";
  if (text.includes("how to") || text.includes("tutorial")) return "tutorial";
  if (text.includes("story") || text.includes("storytime")) return "storytelling";
  if (text.includes("review") || text.includes("honest")) return "review";
  if (text.includes("challenge") || text.includes("trend")) return "trend";
  return "general";
}

function detectAudienceIntent(text: string, ctaStrength: number): string {
  if (ctaStrength >= 70) return "high_purchase_intent";
  if (text.includes("review") || text.includes("compare")) return "research_intent";
  if (text.includes("tutorial") || text.includes("tips")) return "learning_intent";
  return "awareness_intent";
}

function createSummary(topics: string[], hookType: string, ctaStrength: number): string {
  const topicPart = topics.length ? topics.join(", ") : "general";
  return `${hookType} content focused on ${topicPart} with CTA strength ${Math.round(ctaStrength)}.`;
}

function estimateAudienceMatch(topics: string[], campaignContext?: { name?: string; product_name?: string }): number {
  if (!campaignContext?.name && !campaignContext?.product_name) return 55;
  const context = `${campaignContext?.name || ""} ${campaignContext?.product_name || ""}`.toLowerCase();
  if (!topics.length) return 45;
  const overlap = topics.filter((topic) => context.includes(topic)).length;
  return clamp100(45 + (overlap / topics.length) * 55, 50);
}

function buildRecommendations(input: {
  top_topics: string[];
  content_consistency: number;
  average_sentiment: number;
  audience_demographic_match: number;
}): string[] {
  const recommendations: string[] = [];
  if (input.top_topics.length) {
    recommendations.push(`Top semantic theme: ${input.top_topics[0]}. Prioritize campaigns aligned with this niche.`);
  }
  if (input.content_consistency < 45) {
    recommendations.push("Content themes are scattered. Tighten positioning to improve conversion predictability.");
  }
  if (input.average_sentiment < 50) {
    recommendations.push("Audience sentiment is mixed. Review comments before assigning high-risk campaigns.");
  }
  if (input.audience_demographic_match >= 75) {
    recommendations.push("Strong campaign-topic alignment. This creator is a good fit for direct-response tests.");
  }
  if (!recommendations.length) {
    recommendations.push("Semantic signals look healthy. Continue monitoring after each scrape cycle.");
  }
  return recommendations;
}

function uniqStrings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  return clean.length ? Array.from(new Set(clean)).slice(0, 8) : fallback;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function clamp100(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clamp01To100(value: number): number {
  return Math.max(0, Math.min(100, value * 100));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
