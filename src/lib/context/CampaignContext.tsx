"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

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

  const refreshCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const { data } = await res.json();
      setCampaigns(data || []);

      // Auto-select first campaign if none selected
      if (!selectedCampaign && data && data.length > 0) {
        setSelectedCampaign(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
