"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreatorList } from "@/components/creators/CreatorList";
import { CreatorDetail } from "@/components/creators/CreatorDetail";
import { AddCreatorModal } from "@/components/creators/AddCreatorModal";
import { useCampaign } from "@/lib/context/CampaignContext";

export default function CreatorsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchParams = useSearchParams();
  const { selectedCampaign, campaigns, setSelectedCampaign } = useCampaign();

  const campaignId = selectedCampaign?.id;
  const requestedCreatorId = searchParams.get("creator_id");
  const requestedCampaignId = searchParams.get("campaign_id");

  useEffect(() => {
    if (!requestedCampaignId || !campaigns.length) return;
    const match = campaigns.find((campaign) => campaign.id === requestedCampaignId);
    if (match && selectedCampaign?.id !== match.id) {
      setSelectedCampaign(match);
    }
  }, [campaigns, requestedCampaignId, selectedCampaign?.id, setSelectedCampaign]);

  useEffect(() => {
    if (!requestedCreatorId || !campaignId) return;
    setSelected(requestedCreatorId);
  }, [requestedCreatorId, campaignId]);

  const handleCreatorAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600">Track creators across your workspace</p>
        {!selected && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
          >
            Add Creator
          </button>
        )}
      </div>

      {!campaignId && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
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
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            ← Back to Creators
          </button>
          <CreatorDetail creatorId={selected} campaignId={campaignId} />
        </div>
      ) : (
        <CreatorList
          key={refreshKey}
          campaignId={campaignId}
          onSelect={campaignId ? setSelected : undefined}
          onAddCreator={() => setIsAddModalOpen(true)}
        />
      )}

      <AddCreatorModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleCreatorAdded} />
    </div>
  );
}
