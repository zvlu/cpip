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

  const campaignId = selectedCampaign?.id || "default";

  const handleCreatorAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Creators</h1>
          <p className="text-gray-600 mt-2">Manage and track creator performance metrics</p>
        </div>
        {!selected && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Add Creator
          </button>
        )}
      </div>

      {selected ? (
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
        <CreatorList key={refreshKey} campaignId={campaignId} onSelect={setSelected} />
      )}

      <AddCreatorModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleCreatorAdded} />
    </div>
  );
}
