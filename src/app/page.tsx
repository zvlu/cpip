"use client";
import { useState } from "react";
import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { useCampaign } from "@/lib/context/CampaignContext";
import { Tooltip } from "@/components/ui/Tooltip";
import { InfoCard } from "@/components/ui/InfoCard";

export default function Home() {
  const { selectedCampaign } = useCampaign();
  const [recalculating, setRecalculating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const campaignId = selectedCampaign?.id || "default";

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const scoresRes = await fetch("/api/scores/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!scoresRes.ok) throw new Error("Failed to recalculate scores");

      const revenueRes = await fetch("/api/revenue/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!revenueRes.ok) throw new Error("Failed to recalculate revenue");

      setLastUpdated(new Date());
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      alert(`❌ Recalculation failed: ${err.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor creator performance and estimated revenue in real-time</p>
        </div>
        <div className="flex gap-2">
          <Tooltip text="Refresh all performance scores and revenue estimates">
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Main Dashboard */}
      <DashboardOverview key={refreshKey} campaignId={campaignId} />

      {/* Footer Help */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-600">
          💡 <strong>Need help?</strong> Click the <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300">?</span> icons throughout the app for tips and explanations.
        </p>
      </div>
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
