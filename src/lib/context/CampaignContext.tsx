"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

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

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/campaigns", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch campaigns: ${res.statusText}`);
      }

      const json = await res.json();
      const data = json.data || [];
      setCampaigns(data);

      // Auto-select first campaign if none selected
      if (!selectedCampaign && data && data.length > 0) {
        setSelectedCampaign(data[0]);
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
  }, []);

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
