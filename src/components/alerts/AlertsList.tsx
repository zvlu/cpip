"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/lib/hooks/useToast";
import { loadAppSettings } from "@/lib/settings";
import { apiFetch } from "@/lib/api/client";

const ALERT_ICONS: Record<string, string> = {
  score_drop: "SD",
  score_rise: "SR",
  viral_post: "VP",
  inactive: "IN",
  new_milestone: "NM",
  anomaly: "AN",
  campaign_target: "CT",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  warning: "bg-yellow-50 border-yellow-200",
  info: "bg-blue-50 border-blue-200",
};

type FilterType = "all" | "unread" | "critical";

export function AlertsList() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [markAsReadOnOpen, setMarkAsReadOnOpen] = useState(true);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const { toasts, removeToast, error: toastError, success } = useToast();

  useEffect(() => {
    const settings = loadAppSettings();
    setFilter(settings.alerts.defaultFilter);
    setMarkAsReadOnOpen(settings.alerts.markAsReadOnOpen);
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      const res = await apiFetch("/api/alerts?include_read=true");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthRequired(true);
          return;
        }
        throw new Error(`Failed to fetch alerts: ${res.statusText}`);
      }
      const json = await res.json();
      setAlerts(json.data || []);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load alerts";
      setError(errorMessage);
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const res = await apiFetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, read: true }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update alert: ${res.statusText}`);
      }

      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    } catch (err: any) {
      console.error("Failed to mark alert as read:", err);
      toastError(`Failed to update alert: ${err.message}`);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "unread") return !alert.read;
    if (filter === "critical") return alert.severity === "critical";
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleMarkAllAsRead = async () => {
    const unreadAlerts = filteredAlerts.filter((a) => !a.read);
    if (unreadAlerts.length === 0) return;

    setMarkingAllAsRead(true);
    try {
      const results = await Promise.allSettled(
        unreadAlerts.map((a) =>
          apiFetch("/api/alerts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: a.id, read: true }),
          }).then((res) => {
            if (!res.ok) throw new Error(res.statusText || "Request failed");
            return a.id;
          })
        )
      );

      const succeededIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);
      const failedCount = results.length - succeededIds.length;

      if (succeededIds.length > 0) {
        setAlerts((prev) => prev.map((a) => (succeededIds.includes(a.id) ? { ...a, read: true } : a)));
      }

      if (failedCount === 0) {
        success("All visible alerts marked as read.");
      } else if (succeededIds.length > 0) {
        toastError(`${failedCount} alert${failedCount === 1 ? "" : "s"} could not be updated.`);
      } else {
        toastError("Failed to mark visible alerts as read.");
      }
    } catch (err: any) {
      console.error("Failed to mark all as read:", err);
      toastError(`Failed to mark alerts as read: ${err?.message || "Unknown error"}`);
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <p className="text-gray-600">Manage and track notifications</p>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-red-700 font-medium">Failed to load alerts</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchAlerts}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <p className="text-gray-600">Manage and track notifications</p>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <p className="text-gray-900 font-medium">Sign in to view alerts</p>
          <p className="text-gray-600 text-sm mt-1">Your alerts are account-scoped and available after authentication.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/auth")}
              className="btn-primary text-sm"
            >
              Sign in
            </button>
            <button
              onClick={fetchAlerts}
              className="btn-secondary text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAllAsRead}
            className="btn-secondary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {markingAllAsRead ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "unread", "critical"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f === "unread" ? `Unread (${unreadCount})` : "Critical"}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500 text-lg">{alerts.length === 0 ? "No alerts yet" : "No alerts match this filter"}</p>
          <p className="text-gray-400 text-sm mt-1">
            {alerts.length === 0
              ? "We'll notify you when something important happens."
              : "Try switching filters to see more alerts."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {alerts.length === 0 ? (
              <>
                <button type="button" onClick={() => router.push("/creators")} className="btn-ghost text-sm">
                  Go to Creators
                </button>
                <button type="button" onClick={() => router.push("/")} className="btn-ghost text-sm">
                  Open Dashboard
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setFilter("all")} className="btn-ghost text-sm">
                Show all alerts
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => {
                if (markAsReadOnOpen && !alert.read) {
                  handleMarkAsRead(alert.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (markAsReadOnOpen && !alert.read) {
                    handleMarkAsRead(alert.id);
                  }
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Alert ${alert.title}`}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info} ${
                alert.read ? "opacity-60" : ""
              }`}
            >
                <div className="flex items-start gap-3 sm:gap-4">
                <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-current/20 bg-white/70 px-2 text-[11px] font-semibold tracking-wide text-gray-700">
                  {ALERT_ICONS[alert.type] || "IN"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
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
