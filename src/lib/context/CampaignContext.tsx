"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";

interface Campaign {
  id: string;
  name: string;
  product_name?: string;
  aov: number;
  commission_rate: number;
  default_ctr: number;
  default_cvr: number;
  status: string;
  created_at: string;
}

interface CampaignContextType {
  selectedCampaign: Campaign | null;
  campaigns: Campaign[];
  setSelectedCampaign: (campaign: Campaign | null) => void;
  loading: boolean;
  error: string | null;
  refreshCampaigns: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);
const SELECTED_CAMPAIGN_STORAGE_KEY = "cpip_selected_campaign_id";

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/api/campaigns", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch campaigns: ${res.statusText}`);
      }

      const json = await res.json();
      const data = json.data || [];
      setCampaigns(data);

      const storedCampaignId = typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_CAMPAIGN_STORAGE_KEY) : null;
      const selectedCampaignId = selectedCampaign?.id || null;
      const preferredCampaignId = selectedCampaignId || storedCampaignId;
      const preferredCampaign = preferredCampaignId ? data.find((campaign: Campaign) => campaign.id === preferredCampaignId) : null;

      // Keep selection stable if still present, otherwise recover deterministically.
      if (preferredCampaign) {
        if (selectedCampaignId !== preferredCampaign.id) {
          setSelectedCampaign(preferredCampaign);
        }
      } else if (data.length > 0) {
        setSelectedCampaign(data[0]);
      } else if (selectedCampaign) {
        setSelectedCampaign(null);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load campaigns";
      setError(errorMessage);
      console.error("Campaign context error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign]);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedCampaign?.id) {
      window.localStorage.setItem(SELECTED_CAMPAIGN_STORAGE_KEY, selectedCampaign.id);
    } else {
      window.localStorage.removeItem(SELECTED_CAMPAIGN_STORAGE_KEY);
    }
  }, [selectedCampaign]);

  return (
    <CampaignContext.Provider value={{ selectedCampaign, campaigns, setSelectedCampaign, loading, error, refreshCampaigns }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error("useCampaign must be used within CampaignProvider");
  }
  return context;
}
