export type WeeklyBriefDeliverySettings = {
  enabled: boolean;
  webhook_url: string;
  include_action_recommendations: boolean;
  payload_format: "generic" | "slack_blocks";
};

export const DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS: WeeklyBriefDeliverySettings = {
  enabled: false,
  webhook_url: "",
  include_action_recommendations: true,
  payload_format: "generic",
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value.trim();
  return fallback;
}

export function sanitizeWeeklyBriefDeliverySettings(value: unknown): WeeklyBriefDeliverySettings {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const payloadFormat = input.payload_format === "slack_blocks" ? "slack_blocks" : "generic";
  return {
    enabled: toBoolean(input.enabled, DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS.enabled),
    webhook_url: toString(input.webhook_url, DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS.webhook_url).slice(0, 2000),
    include_action_recommendations: toBoolean(
      input.include_action_recommendations,
      DEFAULT_WEEKLY_BRIEF_DELIVERY_SETTINGS.include_action_recommendations
    ),
    payload_format: payloadFormat,
  };
}
