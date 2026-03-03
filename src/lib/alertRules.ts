export type AlertRules = {
  score_drop_threshold: number;
  score_rise_threshold: number;
  inactive_days_threshold: number;
  anomaly_delta_threshold: number;
};

export const DEFAULT_ALERT_RULES: AlertRules = {
  score_drop_threshold: 10,
  score_rise_threshold: 10,
  inactive_days_threshold: 14,
  anomaly_delta_threshold: 25,
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

export function sanitizeAlertRules(value: unknown): AlertRules {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    score_drop_threshold: clamp(Math.round(toNumber(input.score_drop_threshold, DEFAULT_ALERT_RULES.score_drop_threshold)), 1, 100),
    score_rise_threshold: clamp(Math.round(toNumber(input.score_rise_threshold, DEFAULT_ALERT_RULES.score_rise_threshold)), 1, 100),
    inactive_days_threshold: clamp(Math.round(toNumber(input.inactive_days_threshold, DEFAULT_ALERT_RULES.inactive_days_threshold)), 1, 120),
    anomaly_delta_threshold: clamp(Math.round(toNumber(input.anomaly_delta_threshold, DEFAULT_ALERT_RULES.anomaly_delta_threshold)), 5, 100),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
