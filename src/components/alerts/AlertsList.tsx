"use client";
import { useEffect, useState } from "react";

const ALERT_ICONS: Record<string, string> = {
  score_drop: "📉",
  score_rise: "📈",
  viral_post: "🔥",
  inactive: "😴",
  new_milestone: "🏆",
  anomaly: "⚠️",
  campaign_target: "🎯",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  warning: "bg-yellow-50 border-yellow-200",
  info: "bg-blue-50 border-blue-200",
};

type FilterType = "all" | "unread" | "critical";

export function AlertsList() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const { data } = await res.json();
      setAlerts(data || []);
    } catch (err: any) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, read: true }),
      });

      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
      }
    } catch (err: any) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadAlerts = filteredAlerts.filter((a) => !a.read);
      await Promise.all(unreadAlerts.map((a) => handleMarkAsRead(a.id)));
    } catch (err: any) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "unread") return !alert.read;
    if (filter === "critical") return alert.severity === "critical";
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-2">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "unread", "critical"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f === "unread" ? `Unread (${unreadCount})` : "Critical"}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No alerts yet</p>
          <p className="text-gray-400 text-sm mt-1">We'll notify you when something important happens.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => handleMarkAsRead(alert.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info} ${
                alert.read ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl flex-shrink-0">{ALERT_ICONS[alert.type] || "ℹ️"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                      {alert.message && <p className="text-gray-700 text-sm mt-1">{alert.message}</p>}
                    </div>
                    {!alert.read && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">{formatTime(new Date(alert.created_at))}</span>
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">{alert.type.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
