"use client";
import { useState } from "react";

interface InfoCardProps {
  icon?: string;
  title: string;
  description: string;
  type?: "info" | "tip" | "warning" | "success";
  dismissible?: boolean;
  persistKey?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const TYPE_STYLES = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  tip: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
};

const TYPE_ICONS = {
  info: "IN",
  tip: "TIP",
  warning: "AL",
  success: "OK",
};

export function InfoCard({
  icon,
  title,
  description,
  type = "info",
  dismissible = false,
  persistKey,
  action,
}: InfoCardProps) {
  const storageKey = persistKey ? `cpip_info_card_dismissed:${persistKey}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey || typeof window === "undefined") return false;
    return window.localStorage.getItem(storageKey) === "1";
  });

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "1");
    }
  };

  if (dismissed) return null;

  return (
    <div className={`p-4 rounded-lg border ${TYPE_STYLES[type]}`}>
      <div className="flex items-start gap-3">
        <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-current/20 bg-white/70 px-2 text-[11px] font-semibold tracking-wide flex-shrink-0">
          {icon || TYPE_ICONS[type]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-sm mt-1 opacity-90">{description}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm font-medium hover:opacity-80 transition-opacity underline"
            >
              {action.label}
            </button>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-lg opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
