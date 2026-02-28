"use client";
import { useEffect, useState } from "react";

const ICONS: Record<string, string> = { score_drop: "📉", score_rise: "📈", viral_post: "🔥", inactive: "😴", new_milestone: "🏆", anomaly: "⚠️", campaign_target: "🎯" };
const SEV: Record<string, string> = { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-blue-500" };

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => { fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.data || [])); }, []);

  const dismiss = async (id: string) => {
    await fetch("/api/alerts", { method: "PATCH", body: JSON.stringify({ id, read: true }) });
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <div className="flex justify-between mb-4"><h3 className="font-semibold">Alerts</h3>{alerts.length > 0 && <span className="bg-red-500 text-xs px-2 py-1 rounded-full">{alerts.length}</span>}</div>
      {alerts.length === 0 ? <p className="text-zinc-500 text-center py-8">No new alerts ✨</p> : (
        <div className="space-y-3">{alerts.map((a) => (
          <div key={a.id} onClick={() => dismiss(a.id)} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
            <span className="text-xl">{ICONS[a.type] || "📌"}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="font-medium">{a.title}</span><span className={`text-xs px-2 py-0.5 rounded text-white ${SEV[a.severity]}`}>{a.severity}</span></div>
              <p className="text-sm text-zinc-500">{a.message}</p>
              <p className="text-xs text-zinc-600 mt-1">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
