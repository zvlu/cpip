"use client";
import { useState } from "react";
import { useCampaign } from "@/lib/context/CampaignContext";
import { CreateCampaignModal } from "./CreateCampaignModal";

export function CampaignSelector() {
  const { selectedCampaign, campaigns, setSelectedCampaign } = useCampaign();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSelectCampaign = (campaign: any) => {
    setSelectedCampaign(campaign);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex w-full items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-900 font-medium text-sm"
        >
          <span>📊</span>
          <span className="truncate max-w-xs">
            {selectedCampaign ? `${selectedCampaign.name}${selectedCampaign.product_name ? ` - ${selectedCampaign.product_name}` : ""}` : "Select Campaign"}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-full sm:w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            <div className="p-2 border-b border-gray-200">
              <button
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setIsDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                + New Campaign
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {campaigns.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No campaigns available</div>
              ) : (
                campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => handleSelectCampaign(campaign)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedCampaign?.id === campaign.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    {campaign.product_name && <div className="text-xs text-gray-500 mt-0.5">{campaign.product_name}</div>}
                    <div className="text-xs text-gray-400 mt-1">AOV: ${campaign.aov} • Commission: {(campaign.commission_rate * 100).toFixed(0)}%</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <CreateCampaignModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </>
  );
}
