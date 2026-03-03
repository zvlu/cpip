export type AlertFilter = "all" | "unread" | "critical";

export interface AppSettings {
  branding: {
    companyName: string;
    logoUrl: string;
  };
  campaignDefaults: {
    aov: number;
    commissionRatePct: number;
    defaultCtrPct: number;
    defaultCvrPct: number;
  };
  dashboard: {
    showQuickStartChecklist: boolean;
    showInsightTips: boolean;
    requireRecalculateConfirmation: boolean;
    quickStartDismissed: boolean;
  };
  alerts: {
    defaultFilter: AlertFilter;
    markAsReadOnOpen: boolean;
  };
  notifications: {
    desktopEnabled: boolean;
  };
}

export const SETTINGS_STORAGE_KEY = "cpip_settings_v1";
export const SETTINGS_UPDATED_EVENT = "cpip-settings-updated";
const MAX_LOGO_URL_LENGTH = 4_500_000;
const DEFAULT_LOGO_URL = "/app-logo-clean.png";
const LEGACY_LOGO_URLS = new Set([
  "/logo.png",
  "/creatorpulselogo.png",
  "/Gemini_Generated_Image_oo06tooo06tooo06-Photoroom.png",
]);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  branding: {
    companyName: "CreatorPulse",
    logoUrl: DEFAULT_LOGO_URL,
  },
  campaignDefaults: {
    aov: 45,
    commissionRatePct: 15,
    defaultCtrPct: 2,
    defaultCvrPct: 3,
  },
  dashboard: {
    showQuickStartChecklist: true,
    showInsightTips: true,
    requireRecalculateConfirmation: true,
    quickStartDismissed: false,
  },
  alerts: {
    defaultFilter: "all",
    markAsReadOnOpen: true,
  },
  notifications: {
    desktopEnabled: false,
  },
};

type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function cleanWorkspaceLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().slice(0, 80);
}

export function getAuthUserWorkspaceLabel(user: AuthUserLike | null | undefined): string {
  if (!user) return "";

  const metadata = user.user_metadata ?? {};
  const metadataNameCandidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
    metadata.username,
  ];

  for (const candidate of metadataNameCandidates) {
    if (typeof candidate === "string") {
      const cleaned = cleanWorkspaceLabel(candidate);
      if (cleaned) return cleaned;
    }
  }

  if (typeof user.email === "string") {
    const cleanedEmail = cleanWorkspaceLabel(user.email);
    if (cleanedEmail) return cleanedEmail;
  }

  return "";
}

export function resolveBrandCompanyName(
  storedCompanyName: string,
  user: AuthUserLike | null | undefined
): string {
  const cleanedStoredName = cleanWorkspaceLabel(storedCompanyName);
  const hasManualBrandName =
    cleanedStoredName.length > 0 && cleanedStoredName !== DEFAULT_APP_SETTINGS.branding.companyName;

  if (hasManualBrandName) {
    return cleanedStoredName;
  }

  return getAuthUserWorkspaceLabel(user) || DEFAULT_APP_SETTINGS.branding.companyName;
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toString(value: unknown, fallback: string, maxLength = 255): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function normalizeLogoUrl(value: string): string {
  if (value.startsWith("data:image/")) {
    return DEFAULT_LOGO_URL;
  }
  return LEGACY_LOGO_URLS.has(value) ? DEFAULT_LOGO_URL : value;
}

export function sanitizeAppSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  const incomingLogoUrl = toString(input?.branding?.logoUrl, DEFAULT_APP_SETTINGS.branding.logoUrl, MAX_LOGO_URL_LENGTH);
  return {
    branding: {
      companyName: toString(input?.branding?.companyName, DEFAULT_APP_SETTINGS.branding.companyName, 80),
      logoUrl: normalizeLogoUrl(incomingLogoUrl),
    },
    campaignDefaults: {
      aov: toNumber(input?.campaignDefaults?.aov, DEFAULT_APP_SETTINGS.campaignDefaults.aov, 0, 100000),
      commissionRatePct: toNumber(input?.campaignDefaults?.commissionRatePct, DEFAULT_APP_SETTINGS.campaignDefaults.commissionRatePct, 0, 100),
      defaultCtrPct: toNumber(input?.campaignDefaults?.defaultCtrPct, DEFAULT_APP_SETTINGS.campaignDefaults.defaultCtrPct, 0, 100),
      defaultCvrPct: toNumber(input?.campaignDefaults?.defaultCvrPct, DEFAULT_APP_SETTINGS.campaignDefaults.defaultCvrPct, 0, 100),
    },
    dashboard: {
      showQuickStartChecklist: toBoolean(
        input?.dashboard?.showQuickStartChecklist,
        DEFAULT_APP_SETTINGS.dashboard.showQuickStartChecklist
      ),
      showInsightTips: toBoolean(input?.dashboard?.showInsightTips, DEFAULT_APP_SETTINGS.dashboard.showInsightTips),
      requireRecalculateConfirmation: toBoolean(
        input?.dashboard?.requireRecalculateConfirmation,
        DEFAULT_APP_SETTINGS.dashboard.requireRecalculateConfirmation
      ),
      quickStartDismissed: toBoolean(input?.dashboard?.quickStartDismissed, DEFAULT_APP_SETTINGS.dashboard.quickStartDismissed),
    },
    alerts: {
      defaultFilter:
        input?.alerts?.defaultFilter === "all" || input?.alerts?.defaultFilter === "unread" || input?.alerts?.defaultFilter === "critical"
          ? input.alerts.defaultFilter
          : DEFAULT_APP_SETTINGS.alerts.defaultFilter,
      markAsReadOnOpen: toBoolean(input?.alerts?.markAsReadOnOpen, DEFAULT_APP_SETTINGS.alerts.markAsReadOnOpen),
    },
    notifications: {
      desktopEnabled: toBoolean(input?.notifications?.desktopEnabled, DEFAULT_APP_SETTINGS.notifications.desktopEnabled),
    },
  };
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return sanitizeAppSettings(parsed);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeAppSettings(settings)));
  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
}
