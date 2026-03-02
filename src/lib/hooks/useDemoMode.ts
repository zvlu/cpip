"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

const DEMO_MODE_UPDATED_EVENT = "cpip-demo-mode-updated";

type DemoModeResponse = {
  enabled: boolean;
  prompt_seen: boolean;
};

export function useDemoMode() {
  const [enabled, setEnabled] = useState(false);
  const [promptSeen, setPromptSeen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const applyResponse = useCallback((data: DemoModeResponse) => {
    setEnabled(Boolean(data.enabled));
    setPromptSeen(Boolean(data.prompt_seen));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/settings/demo-mode", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load demo mode");
      const json = await response.json();
      applyResponse(json?.data || { enabled: false, prompt_seen: true });
    } catch {
      setEnabled(false);
      setPromptSeen(true);
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUpdated = () => {
      refresh();
    };
    window.addEventListener(DEMO_MODE_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(DEMO_MODE_UPDATED_EVENT, handleUpdated);
  }, [refresh]);

  const updateDemoMode = useCallback(
    async (nextEnabled: boolean) => {
      setUpdating(true);
      try {
        const response = await apiFetch("/api/settings/demo-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled, prompt_seen: true }),
        });
        if (!response.ok) return false;
        const json = await response.json();
        applyResponse(json?.data || { enabled: nextEnabled, prompt_seen: true });
        window.dispatchEvent(new Event(DEMO_MODE_UPDATED_EVENT));
        return true;
      } catch {
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [applyResponse]
  );

  const markPromptSeen = useCallback(async () => {
    try {
      const response = await apiFetch("/api/settings/demo-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_seen: true }),
      });
      if (!response.ok) return;
      const json = await response.json();
      applyResponse(json?.data || { enabled, prompt_seen: true });
      window.dispatchEvent(new Event(DEMO_MODE_UPDATED_EVENT));
    } catch {
      // Best-effort; onboarding prompt can appear again if request fails.
    }
  }, [applyResponse, enabled]);

  return {
    enabled,
    promptSeen,
    loading,
    updating,
    refresh,
    updateDemoMode,
    markPromptSeen,
  };
}

