type WeeklyBriefData = {
  generated_at: string;
  highlights: string[];
  risks: string[];
  next_steps: string[];
};

type ActionRecommendation = {
  action: "scale" | "watch" | "pause" | "investigate";
  priority: "high" | "medium" | "low";
  title: string;
};

export function formatWeeklyBriefMarkdown(params: {
  orgId: string;
  campaignId: string | null;
  weeklyBrief: WeeklyBriefData;
  actionRecommendations: ActionRecommendation[];
  includeActionRecommendations: boolean;
}): string {
  const { orgId, campaignId, weeklyBrief, actionRecommendations, includeActionRecommendations } = params;
  const lines = [
    "# Weekly Campaign Brief",
    "",
    `Org: ${orgId}`,
    `Campaign: ${campaignId || "none"}`,
    `Generated: ${new Date(weeklyBrief.generated_at).toLocaleString()}`,
    "",
    "## Highlights",
    ...weeklyBrief.highlights.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...weeklyBrief.risks.map((item) => `- ${item}`),
    "",
    "## Next Steps",
    ...weeklyBrief.next_steps.map((item) => `- ${item}`),
    "",
  ];

  if (includeActionRecommendations) {
    lines.push("## Action Recommendations");
    lines.push(...actionRecommendations.map((item) => `- [${item.priority}] ${item.action.toUpperCase()}: ${item.title}`));
    lines.push("");
  }

  return lines.join("\n");
}

export function formatWeeklyBriefSlackBlocks(params: {
  campaignId: string | null;
  weeklyBrief: WeeklyBriefData;
  actionRecommendations: ActionRecommendation[];
  includeActionRecommendations: boolean;
}) {
  const { campaignId, weeklyBrief, actionRecommendations, includeActionRecommendations } = params;
  const sections = [
    {
      type: "header",
      text: { type: "plain_text", text: "Weekly Campaign Brief", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Campaign:* ${campaignId || "none"}\n*Generated:* ${new Date(weeklyBrief.generated_at).toLocaleString()}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Highlights*\n${weeklyBrief.highlights.map((item) => `• ${item}`).join("\n")}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Risks*\n${weeklyBrief.risks.map((item) => `• ${item}`).join("\n")}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Next Steps*\n${weeklyBrief.next_steps.map((item) => `• ${item}`).join("\n")}` },
    },
  ] as Array<Record<string, unknown>>;

  if (includeActionRecommendations && actionRecommendations.length > 0) {
    sections.push({ type: "divider" });
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Recommendations*\n${actionRecommendations
          .slice(0, 6)
          .map((item) => `• [${item.priority}] ${item.action.toUpperCase()}: ${item.title}`)
          .join("\n")}`,
      },
    });
  }

  return {
    text: "Weekly Campaign Brief",
    blocks: sections,
  };
}
