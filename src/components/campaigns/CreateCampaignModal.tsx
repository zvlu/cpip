"use client";
import { useCallback, useEffect, useState } from "react";
import { useCampaign } from "@/lib/context/CampaignContext";
import { loadAppSettings } from "@/lib/settings";
import { apiFetch } from "@/lib/api/client";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCampaignModal({ isOpen, onClose }: CreateCampaignModalProps) {
  const { refreshCampaigns, setSelectedCampaign } = useCampaign();
  const getDefaultFormData = useCallback(() => {
    const appSettings = loadAppSettings();
    return {
      name: "",
      product_name: "",
      aov: appSettings.campaignDefaults.aov,
      commission_rate: appSettings.campaignDefaults.commissionRatePct,
      default_ctr: appSettings.campaignDefaults.defaultCtrPct,
      default_cvr: appSettings.campaignDefaults.defaultCvrPct,
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(getDefaultFormData);

  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaultFormData());
    }
  }, [getDefaultFormData, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "name" || name === "product_name" ? value : parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          product_name: formData.product_name || undefined,
          aov: formData.aov,
          commission_rate: formData.commission_rate / 100,
          default_ctr: formData.default_ctr / 100,
          default_cvr: formData.default_cvr / 100,
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError || "Failed to create campaign");
      }

      const json = await res.json();
      if (json?.data) {
        setSelectedCampaign(json.data);
      }
      await refreshCampaigns();
      setFormData(getDefaultFormData());
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New Campaign</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Campaign Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Summer Sale 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Product Name</label>
            <input
              type="text"
              name="product_name"
              value={formData.product_name}
              onChange={handleInputChange}
              placeholder="e.g., Acme Essentials"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">AOV ($)</label>
              <input
                type="number"
                name="aov"
                value={formData.aov}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Commission (%)</label>
              <input
                type="number"
                name="commission_rate"
                value={formData.commission_rate}
                onChange={handleInputChange}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default CTR (%)</label>
              <input
                type="number"
                name="default_ctr"
                value={formData.default_ctr}
                onChange={handleInputChange}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default CVR (%)</label>
              <input
                type="number"
                name="default_cvr"
                value={formData.default_cvr}
                onChange={handleInputChange}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
