"use client";
import { useState } from "react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { useCampaign } from "@/lib/context/CampaignContext";

export default function Home() {
  const { selectedCampaign } = useCampaign();
  const [recalculating, setRecalculating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const campaignId = selectedCampaign?.id || "default";

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      // Recalculate scores
      const scoresRes = await fetch("/api/scores/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!scoresRes.ok) throw new Error("Failed to recalculate scores");

      // Recalculate revenue
      const revenueRes = await fetch("/api/revenue/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (!revenueRes.ok) throw new Error("Failed to recalculate revenue");

      setLastUpdated(new Date());
      setRefreshKey((prev) => prev + 1);

      // Show success toast (in a real app, use a toast library)
      alert("✅ Recalculated scores and revenue");
    } catch (err: any) {
      alert(`❌ Recalculation failed: ${err.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor creator performance and estimated revenue in real-time</p>
        </div>
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
              Recalculate All
            </>
          )}
        </button>
      </div>

      {lastUpdated && (
        <div className="text-sm text-gray-500">
          Last updated: {formatTime(lastUpdated)}
        </div>
      )}

      <DashboardOverview key={refreshKey} campaignId={campaignId} />
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
