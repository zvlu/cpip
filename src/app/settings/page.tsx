"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/lib/hooks/useToast";
import { AppSettings, DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, sanitizeAppSettings } from "@/lib/settings";
import { useCampaign } from "@/lib/context/CampaignContext";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { apiFetch } from "@/lib/api/client";

const MAX_LOGO_UPLOAD_BYTES = 1_200_000;
const ALLOWED_LOGO_UPLOAD_TYPES = ["image/png", "image/svg+xml", "image/webp", "image/jpeg"];
type CampaignDefaultField = "aov" | "commissionRatePct" | "defaultCtrPct" | "defaultCvrPct";
type ExportType = "workbook" | "summary" | "tiers" | "performers" | "posts";

type DashboardExportData = {
  total_creators: number;
  total_estimated_revenue: number;
  top_performers: Array<{ overall_score: number; creators?: { tiktok_username?: string } | null }>;
  recent_top_posts: Array<{ views: number | null; likes: number | null; posted_at: string; creators?: { tiktok_username?: string } | null }>;
  unread_alerts: Array<{ id: string }>;
  tier_distribution: Record<string, number>;
};

export default function SettingsPage() {
  const { selectedCampaign } = useCampaign();
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [campaignDefaultErrors, setCampaignDefaultErrors] = useState<Record<CampaignDefaultField, string>>({
    aov: "",
    commissionRatePct: "",
    defaultCtrPct: "",
    defaultCvrPct: "",
  });
  const [exportType, setExportType] = useState<ExportType>("workbook");
  const [isExportingData, setIsExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const logoUploadInputRef = useRef<HTMLInputElement>(null);
  const { toasts, removeToast, success, error, info, warning } = useToast();
  const demoMode = useDemoMode();
  const campaignId = selectedCampaign?.id;

  useEffect(() => {
    const next = loadAppSettings();
    setSavedSettings(next);
    setDraftSettings(next);
    setIsLoaded(true);

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(window.Notification.permission);
    }
  }, []);

  useEffect(() => {
    setLogoPreviewError(false);
  }, [draftSettings.branding.logoUrl]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);
  }, [savedSettings, draftSettings]);
  const hasValidationErrors = useMemo(() => Object.values(campaignDefaultErrors).some(Boolean), [campaignDefaultErrors]);

  const updateDraftSettings = (updater: (prev: AppSettings) => AppSettings) => {
    setDraftSettings((prev) => sanitizeAppSettings(updater(prev)));
  };

  const handleDesktopNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (typeof window === "undefined" || !("Notification" in window)) {
        warning("This browser does not support desktop notifications.");
        return;
      }

      if (Notification.permission === "denied") {
        warning("Notifications are blocked in your browser settings.");
        return;
      }

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission !== "granted") {
          info("Notification permission was not granted.");
          return;
        }
      }
    }

    updateDraftSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        desktopEnabled: enabled,
      },
    }));
  };

  const handleSendTestNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      warning("Desktop notifications are not available in this browser.");
      return;
    }

    if (Notification.permission !== "granted") {
      warning("Enable desktop notifications and grant permission first.");
      return;
    }

    new Notification("CreatorPulse Test Notification", {
      body: "Your alerts and workflow settings are active.",
    });
    success("Test notification sent.");
  };

  const handleSave = () => {
    if (hasValidationErrors) {
      error("Resolve campaign default validation errors before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const sanitized = sanitizeAppSettings(draftSettings);
      saveAppSettings(sanitized);
      setSavedSettings(sanitized);
      setDraftSettings(sanitized);
      success("Settings saved.");
    } catch {
      error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setDraftSettings(savedSettings);
    info("Unsaved changes discarded.");
  };

  const handleResetDefaults = () => {
    const confirmed = window.confirm("Reset all settings to defaults?");
    if (!confirmed) return;

    setDraftSettings(DEFAULT_APP_SETTINGS);
    saveAppSettings(DEFAULT_APP_SETTINGS);
    setSavedSettings(DEFAULT_APP_SETTINGS);
    success("Settings reset to defaults.");
  };

  const handleLogoFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_UPLOAD_TYPES.includes(file.type)) {
      error("Invalid logo format. Upload a PNG, SVG, WEBP, or JPG image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      error("Logo file is too large. Keep it under 1.2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const logoDataUrl = await fileToDataUrl(file);
      updateDraftSettings((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logoUrl: logoDataUrl,
        },
      }));
      success("Logo uploaded. Save settings to apply it everywhere.");
    } catch {
      error("Could not read this file. Please try another logo.");
    } finally {
      event.target.value = "";
    }
  };

  const clearUploadedLogo = () => {
    updateDraftSettings((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        logoUrl: DEFAULT_APP_SETTINGS.branding.logoUrl,
      },
    }));
    if (logoUploadInputRef.current) {
      logoUploadInputRef.current.value = "";
    }
  };

  const updateCampaignDefaultNumber = (
    field: CampaignDefaultField,
    rawValue: string,
    options: { min: number; max: number; label: string }
  ) => {
    if (rawValue.trim() === "") {
      setCampaignDefaultErrors((prev) => ({ ...prev, [field]: `${options.label} is required.` }));
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setCampaignDefaultErrors((prev) => ({ ...prev, [field]: `${options.label} must be a valid number.` }));
      return;
    }

    const outOfRange = parsed < options.min || parsed > options.max;
    setCampaignDefaultErrors((prev) => ({
      ...prev,
      [field]: outOfRange ? `${options.label} must be between ${options.min} and ${options.max}.` : "",
    }));

    updateDraftSettings((prev) => ({
      ...prev,
      campaignDefaults: {
        ...prev.campaignDefaults,
        [field]: parsed,
      },
    }));
  };

  const handleExportData = async () => {
    if (!campaignId) {
      setExportError("Create or select a campaign before exporting.");
      error("Create or select a campaign before exporting.");
      return;
    }

    setIsExportingData(true);
    setExportError(null);

    try {
      const res = await apiFetch(`/api/dashboard?campaign_id=${encodeURIComponent(campaignId)}`);
      if (!res.ok) {
        throw new Error("Failed to load dashboard data for export.");
      }

      const data: DashboardExportData = await res.json();
      const tierRows = Object.entries(data.tier_distribution || {})
        .map(([tier, count]) => ({ tier, count: Number(count) || 0 }))
        .filter((entry) => entry.count > 0);
      const performerRows = (data.top_performers || []).map((entry, index) => ({
        rank: index + 1,
        creator: entry.creators?.tiktok_username || "Unknown",
        overall_score: Number(entry.overall_score) || 0,
      }));
      const postRows = (data.recent_top_posts || []).map((post) => ({
        creator: post.creators?.tiktok_username || "Unknown",
        views: Number(post.views) || 0,
        likes: Number(post.likes) || 0,
        posted_at: post.posted_at ? new Date(post.posted_at).toISOString() : "",
      }));
      const summaryRows = [
        { metric: "Active Creators", value: Number(data.total_creators) || 0 },
        { metric: "Estimated Revenue (7d)", value: Number(data.total_estimated_revenue) || 0 },
        { metric: "Top Posts Count", value: data.recent_top_posts?.length || 0 },
        { metric: "Unread Alerts", value: data.unread_alerts?.length || 0 },
      ];

      const safeCampaignId = campaignId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const exportDate = new Date().toISOString().slice(0, 10);
      const exportPrefix = `dashboard_${safeCampaignId}_${exportDate}`;

      if (exportType === "workbook") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(performerRows), "TopPerformers");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(postRows), "RecentPosts");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tierRows), "TierDistribution");
        XLSX.writeFile(workbook, `${exportPrefix}.xlsx`);
      } else if (exportType === "summary") {
        downloadCsvFile(summaryRows, `${exportPrefix}_summary.csv`);
      } else if (exportType === "tiers") {
        downloadCsvFile(tierRows, `${exportPrefix}_creator_tiers.csv`);
      } else if (exportType === "performers") {
        downloadCsvFile(performerRows, `${exportPrefix}_top_performers.csv`);
      } else if (exportType === "posts") {
        downloadCsvFile(postRows, `${exportPrefix}_recent_posts.csv`);
      }

      success("Data export complete.");
    } catch (err: any) {
      const message = err?.message || "Failed to export data.";
      setExportError(message);
      error(message);
    } finally {
      setIsExportingData(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Settings</h1>
          <p className="mt-2 text-gray-600">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Settings</h1>
          <p className="mt-2 text-gray-600">Control defaults, alerts, dashboard behavior, and notifications.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
          <p className="mt-1 text-sm text-gray-500">Customize the workspace identity for your company.</p>
        </div>
        <div className="card-body space-y-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-900">Company Name</span>
            <input
              type="text"
              className="input-base"
              maxLength={80}
              value={draftSettings.branding.companyName}
              onChange={(e) =>
                updateDraftSettings((prev) => ({
                  ...prev,
                  branding: {
                    ...prev.branding,
                    companyName: e.target.value,
                  },
                }))
              }
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-900">Logo URL</span>
            <input
              type="url"
              className="input-base"
              placeholder="https://your-company.com/logo.png"
              value={draftSettings.branding.logoUrl}
              onChange={(e) =>
                updateDraftSettings((prev) => ({
                  ...prev,
                  branding: {
                    ...prev.branding,
                    logoUrl: e.target.value,
                  },
                }))
              }
            />
            <p className="text-xs text-gray-500">Paste a URL or upload an image file for best visual quality.</p>
          </label>

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-gray-900">Upload Logo</span>
            <input
              ref={logoUploadInputRef}
              type="file"
              accept=".png,.svg,.webp,.jpg,.jpeg,image/png,image/svg+xml,image/webp,image/jpeg"
              className="input-base file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              onChange={handleLogoFileUpload}
            />
            <p className="text-xs text-gray-500">Supported: PNG, SVG, WEBP, JPG up to 1.2 MB.</p>
          </label>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="mb-3 text-sm font-medium text-gray-900">Logo Preview</p>
            {!logoPreviewError ? (
              <Image
                src={draftSettings.branding.logoUrl}
                alt={`${draftSettings.branding.companyName} logo preview`}
                className="h-12 w-auto object-contain"
                width={160}
                height={48}
                unoptimized
                onError={() => setLogoPreviewError(true)}
              />
            ) : (
              <p className="text-xs text-red-600">Unable to load this logo. A default logo will be used in navigation.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={clearUploadedLogo}
            >
              Reset Logo to Default
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() =>
                updateDraftSettings((prev) => ({
                  ...prev,
                  branding: {
                    companyName: DEFAULT_APP_SETTINGS.branding.companyName,
                    logoUrl: DEFAULT_APP_SETTINGS.branding.logoUrl,
                  },
                }))
              }
            >
              Reset Branding to Default
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Campaign Defaults</h2>
          <p className="mt-1 text-sm text-gray-500">Used as pre-filled values when creating new campaigns.</p>
        </div>
        <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-900">Default AOV ($)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input-base"
              value={draftSettings.campaignDefaults.aov}
              onChange={(e) => updateCampaignDefaultNumber("aov", e.target.value, { min: 0, max: 1_000_000, label: "Default AOV" })}
            />
            <p className={`text-xs ${campaignDefaultErrors.aov ? "text-red-600" : "text-gray-500"}`}>
              {campaignDefaultErrors.aov || "Range: 0 to 1,000,000"}
            </p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-900">Default Commission (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="input-base"
              value={draftSettings.campaignDefaults.commissionRatePct}
              onChange={(e) =>
                updateCampaignDefaultNumber("commissionRatePct", e.target.value, {
                  min: 0,
                  max: 100,
                  label: "Default commission",
                })
              }
            />
            <p className={`text-xs ${campaignDefaultErrors.commissionRatePct ? "text-red-600" : "text-gray-500"}`}>
              {campaignDefaultErrors.commissionRatePct || "Range: 0 to 100"}
            </p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-900">Default CTR (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="input-base"
              value={draftSettings.campaignDefaults.defaultCtrPct}
              onChange={(e) =>
                updateCampaignDefaultNumber("defaultCtrPct", e.target.value, {
                  min: 0,
                  max: 100,
                  label: "Default CTR",
                })
              }
            />
            <p className={`text-xs ${campaignDefaultErrors.defaultCtrPct ? "text-red-600" : "text-gray-500"}`}>
              {campaignDefaultErrors.defaultCtrPct || "Range: 0 to 100"}
            </p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-900">Default CVR (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="input-base"
              value={draftSettings.campaignDefaults.defaultCvrPct}
              onChange={(e) =>
                updateCampaignDefaultNumber("defaultCvrPct", e.target.value, {
                  min: 0,
                  max: 100,
                  label: "Default CVR",
                })
              }
            />
            <p className={`text-xs ${campaignDefaultErrors.defaultCvrPct ? "text-red-600" : "text-gray-500"}`}>
              {campaignDefaultErrors.defaultCvrPct || "Range: 0 to 100"}
            </p>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Control dashboard prompts and safety checks.</p>
        </div>
        <div className="card-body space-y-4">
          <ToggleRow
            title="Show quick start checklist"
            description="Display onboarding actions on the Dashboard page."
            checked={draftSettings.dashboard.showQuickStartChecklist}
            onChange={(checked) =>
              updateDraftSettings((prev) => ({
                ...prev,
                dashboard: { ...prev.dashboard, showQuickStartChecklist: checked },
              }))
            }
          />
          <ToggleRow
            title="Show insight tips"
            description="Display informational cards about score and creative audit features."
            checked={draftSettings.dashboard.showInsightTips}
            onChange={(checked) =>
              updateDraftSettings((prev) => ({
                ...prev,
                dashboard: { ...prev.dashboard, showInsightTips: checked },
              }))
            }
          />
          <ToggleRow
            title="Require confirmation before recalculation"
            description="Ask for confirmation before recalculating scores and revenue."
            checked={draftSettings.dashboard.requireRecalculateConfirmation}
            onChange={(checked) =>
              updateDraftSettings((prev) => ({
                ...prev,
                dashboard: { ...prev.dashboard, requireRecalculateConfirmation: checked },
              }))
            }
          />
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Reset quick start progress</p>
                <p className="text-xs text-gray-600">Makes the checklist visible again on Dashboard.</p>
              </div>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() =>
                  updateDraftSettings((prev) => ({
                    ...prev,
                    dashboard: {
                      ...prev.dashboard,
                      quickStartDismissed: false,
                      showQuickStartChecklist: true,
                    },
                  }))
                }
              >
                Restore Checklist
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Alerts & Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">Set how alert feeds and browser notifications behave.</p>
        </div>
        <div className="card-body space-y-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-900">Default alerts filter</span>
            <select
              className="input-base"
              value={draftSettings.alerts.defaultFilter}
              onChange={(e) =>
                updateDraftSettings((prev) => ({
                  ...prev,
                  alerts: {
                    ...prev.alerts,
                    defaultFilter: e.target.value as AppSettings["alerts"]["defaultFilter"],
                  },
                }))
              }
            >
              <option value="all">All alerts</option>
              <option value="unread">Unread alerts</option>
              <option value="critical">Critical only</option>
            </select>
          </label>

          <ToggleRow
            title="Mark alert as read when opened"
            description="Clicking an alert immediately marks it as read."
            checked={draftSettings.alerts.markAsReadOnOpen}
            onChange={(checked) =>
              updateDraftSettings((prev) => ({
                ...prev,
                alerts: { ...prev.alerts, markAsReadOnOpen: checked },
              }))
            }
          />

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Desktop notifications</p>
                <p className="text-xs text-gray-600">
                  Browser permission: <span className="font-medium">{notificationPermission}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    draftSettings.notifications.desktopEnabled ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => handleDesktopNotificationToggle(!draftSettings.notifications.desktopEnabled)}
                >
                  {draftSettings.notifications.desktopEnabled ? "Enabled" : "Disabled"}
                </button>
                <button type="button" className="btn-ghost text-sm" onClick={handleSendTestNotification}>
                  Send Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Data Mode</h2>
          <p className="mt-1 text-sm text-gray-500">Choose between your real workspace data and guided demo data.</p>
        </div>
        <div className="card-body space-y-4">
          <ToggleRow
            title="Enable demo data mode"
            description="When enabled, the app uses sample data so you can explore features safely."
            checked={demoMode.enabled}
            onChange={(checked) => demoMode.updateDemoMode(checked)}
          />
          <p className="text-xs text-gray-600">
            Current mode:{" "}
            <span className="font-medium text-gray-800">{demoMode.loading ? "Loading..." : demoMode.enabled ? "Demo data" : "Real data"}</span>
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Data Export</h2>
          <p className="mt-1 text-sm text-gray-500">Download campaign data for reporting and portability.</p>
        </div>
        <div className="card-body space-y-3">
          <p className="text-sm text-gray-600">
            Export source: <span className="font-medium text-gray-800">{selectedCampaign?.name || "No campaign selected"}</span>
          </p>
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-900">Export format</span>
            <select
              className="input-base"
              value={exportType}
              onChange={(e) => {
                setExportType(e.target.value as ExportType);
                setExportError(null);
              }}
            >
              <option value="workbook">Full Dashboard Workbook (.xlsx)</option>
              <option value="summary">Summary Metrics (.csv)</option>
              <option value="tiers">Creator Tiers (.csv)</option>
              <option value="performers">Top Performers (.csv)</option>
              <option value="posts">Recent Top Posts (.csv)</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={handleExportData} disabled={isExportingData || !campaignId}>
              {isExportingData ? "Exporting..." : "Export Data"}
            </button>
            {exportError && <p className="text-sm text-red-700">{exportError}</p>}
          </div>
        </div>
      </section>

      <section className="card border-red-200">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
          <p className="mt-1 text-sm text-red-700">Reset all preference values for this browser.</p>
        </div>
        <div className="card-body">
          <button type="button" className="btn-danger text-sm" onClick={handleResetDefaults}>
            Reset to Defaults
          </button>
        </div>
      </section>

      {hasUnsavedChanges && (
        <div className="sticky bottom-4 z-30 rounded-xl border border-blue-200 bg-white p-4 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">You have unsaved settings changes.</p>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={handleDiscardChanges}>
                Discard
              </button>
              <button type="button" className="btn-primary text-sm" disabled={isSaving || hasValidationErrors} onClick={handleSave}>
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
          {hasValidationErrors && <p className="mt-2 text-xs text-red-600">Fix validation issues in Campaign Defaults before saving.</p>}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unexpected file reader output."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

function downloadCsvFile(rows: Array<Record<string, unknown>>, filename: string) {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((key) => toCsvValue(row[key])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            checked ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>
    </div>
  );
}
