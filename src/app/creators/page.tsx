"use client";
import { useState } from "react";
import { CreatorList } from "@/components/creators/CreatorList";
import { CreatorDetail } from "@/components/creators/CreatorDetail";
import { AddCreatorModal } from "@/components/creators/AddCreatorModal";
import { useCampaign } from "@/lib/context/CampaignContext";

export default function CreatorsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedCampaign } = useCampaign();

  const campaignId = selectedCampaign?.id;

  const handleCreatorAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Creators</h1>
          <p className="text-gray-600 mt-2">Track creators across your workspace</p>
        </div>
        {!selected && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            Add Creator
          </button>
        )}
      </div>

      {!campaignId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">No campaign selected</h2>
          <p className="mt-1 text-sm text-blue-800">
            You can still add and track creators now. Select a campaign when you want campaign-level scoring, revenue, and advanced analytics.
          </p>
        </div>
      )}

      {campaignId && selected ? (
        <div>
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm mb-6 transition-colors"
          >
            ← Back to Creators
          </button>
          <CreatorDetail creatorId={selected} campaignId={campaignId} />
        </div>
      ) : (
        <CreatorList key={refreshKey} campaignId={campaignId} onSelect={campaignId ? setSelected : undefined} />
      )}

      <AddCreatorModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleCreatorAdded} />
    </div>
  );
}
