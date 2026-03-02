"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { useCampaign } from "@/lib/context/CampaignContext";
import { Tooltip } from "@/components/ui/Tooltip";
import { InfoCard } from "@/components/ui/InfoCard";
import { QuickStart } from "@/components/onboarding/QuickStart";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from "@/lib/settings";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { apiFetch } from "@/lib/api/client";

export default function Home() {
  const router = useRouter();
  const { selectedCampaign } = useCampaign();
  const [recalculating, setRecalculating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ creators: 0, alerts: 0 });
  const [dashboardSettings, setDashboardSettings] = useState(DEFAULT_APP_SETTINGS.dashboard);
  const [quickStartVisible, setQuickStartVisible] = useState(true);
  const { toasts, removeToast, success, error, info } = useToast();
  const demoMode = useDemoMode();

  const campaignId = selectedCampaign?.id;

  useEffect(() => {
    const appSettings = loadAppSettings();
    setDashboardSettings({ ...appSettings.dashboard });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
      const [creatorsRes, alertsRes] = await Promise.all([apiFetch("/api/creators?limit=1"), apiFetch("/api/alerts")]);
        if (creatorsRes.ok) {
          const creatorsJson = await creatorsRes.json();
          setStats((prev) => ({ ...prev, creators: creatorsJson.total || 0 }));
        }
        if (alertsRes.ok) {
          const alertsJson = await alertsRes.json();
          const unread = (alertsJson.data || []).filter((a: any) => !a.read).length;
          setStats((prev) => ({ ...prev, alerts: unread }));
        }
      } catch {
        // Non-critical UI enhancement; keep main flow unaffected.
      }
    };

    fetchStats();
  }, [refreshKey]);

  const handleRecalculate = async () => {
    if (!campaignId) {
      info("Create or select a campaign before recalculating.");
      return;
    }

    if (dashboardSettings.requireRecalculateConfirmation) {
      const confirmed = window.confirm("Recalculate scores and revenue for the current campaign?");
      if (!confirmed) return;
    }

    setRecalculating(true);
    info("Recalculation started. This may take a moment...");
    try {
      const scoresRes = await apiFetch("/api/scores/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!scoresRes.ok) throw new Error("Failed to recalculate scores");

      const revenueRes = await apiFetch("/api/revenue/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!revenueRes.ok) throw new Error("Failed to recalculate revenue");

      setLastUpdated(new Date());
      setRefreshKey((prev) => prev + 1);
      success("Scores and revenue recalculated successfully.");
    } catch (err: any) {
      error(`Recalculation failed: ${err.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const quickStartSteps = [
    {
      icon: "📦",
      title: "Create your first campaign",
      description: "Set campaign AOV, commission, and conversion defaults.",
      action: { label: "Open Campaign Selector", onClick: () => info("Use the Campaign dropdown in the sidebar to create one.") },
      completed: Boolean(campaignId),
    },
    {
      icon: "👥",
      title: "Add creators",
      description: "Build your roster so scoring and analytics can run.",
      action: { label: "Go to Creators", onClick: () => router.push("/creators") },
      completed: stats.creators > 0,
    },
    {
      icon: "🔔",
      title: "Review alerts daily",
      description: "Stay on top of score drops, anomalies, and opportunities.",
      action: { label: "Open Alerts", onClick: () => router.push("/alerts") },
      completed: stats.alerts === 0 && stats.creators > 0,
    },
  ];
  const shouldShowQuickStart = quickStartVisible && dashboardSettings.showQuickStartChecklist && !dashboardSettings.quickStartDismissed;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor creator performance and estimated revenue in real-time</p>
        </div>
        <div className="flex gap-2">
          <Tooltip text="Refresh all performance scores and revenue estimates">
            <button
              onClick={handleRecalculate}
              disabled={recalculating || !campaignId}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {recalculating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Recalculating...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Recalculate
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span>⏱️</span>
          <span>Last updated: {formatTime(lastUpdated)}</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/creators"
          className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 group-hover:text-blue-700">Add Creators</h3>
              <p className="text-sm text-blue-700 mt-1">Build your creator roster</p>
            </div>
            <span className="text-2xl">👥</span>
          </div>
        </Link>

        <Link
          href="/alerts"
          className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-orange-900 group-hover:text-orange-700">View Alerts</h3>
              <p className="text-sm text-orange-700 mt-1">Check performance notifications</p>
            </div>
            <span className="text-2xl">🔔</span>
          </div>
        </Link>

        <Link
          href="/creators"
          className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-green-900 group-hover:text-green-700">Find Similar</h3>
              <p className="text-sm text-green-700 mt-1">Discover lookalike creators</p>
            </div>
            <span className="text-2xl">🔍</span>
          </div>
        </Link>
      </div>

      {/* Helpful Tips */}
      {dashboardSettings.showInsightTips && (
        <div className="space-y-3">
          <InfoCard
            icon="📊"
            type="tip"
            title="Predictive ROI Score"
            description="Each creator now has a conversion probability and viral potential score. Use these to prioritize spend."
            dismissible
          />
          <InfoCard
            icon="🎬"
            type="tip"
            title="Creative Audit"
            description="View each creator's top-performing content styles. Send targeted briefs based on what works."
            dismissible
          />
        </div>
      )}

      {/* Main Dashboard */}
      {campaignId ? (
        <DashboardOverview key={refreshKey} campaignId={campaignId} />
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">Create your first campaign</h2>
          <p className="mt-1 text-sm text-blue-800">
            Select <strong>+ New Campaign</strong> from the sidebar campaign dropdown to unlock dashboard analytics and recalculation.
          </p>
        </div>
      )}

      {/* Footer Help */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6 text-center">
        <p className="text-sm text-gray-600">
          💡 <strong>Need help?</strong> Click the <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300">?</span> icons throughout the app for tips and explanations.
        </p>
      </div>

      {shouldShowQuickStart && (
        <QuickStart
          steps={quickStartSteps}
          demoChoice={{
            visible: !demoMode.loading && !demoMode.promptSeen,
            enabled: demoMode.enabled,
            loading: demoMode.updating,
            onUseRealData: () => demoMode.updateDemoMode(false),
            onUseDemoData: () => demoMode.updateDemoMode(true),
            onDismissPrompt: () => demoMode.markPromptSeen(),
          }}
          onDismiss={() => {
            setQuickStartVisible(false);
            const currentSettings = loadAppSettings();
            const nextSettings = {
              ...currentSettings,
              dashboard: {
                ...currentSettings.dashboard,
                quickStartDismissed: true,
              },
            };
            saveAppSettings(nextSettings);
            setDashboardSettings({ ...nextSettings.dashboard });
          }}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}
