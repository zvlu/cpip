"use client";
import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api/client";

const TIER_COLORS: Record<string, string> = { S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#f97316", D: "#ef4444" };

type TopPerformer = {
  id: string;
  overall_score: number;
  creators?: {
    tiktok_username?: string;
  } | null;
};

type RecentTopPost = {
  id: string;
  views: number | null;
  likes: number | null;
  posted_at: string;
  creators?: {
    tiktok_username?: string;
  } | null;
};

type DashboardData = {
  total_creators: number;
  total_estimated_revenue: number;
  top_performers: TopPerformer[];
  recent_top_posts: RecentTopPost[];
  unread_alerts: Array<{ id: string }>;
  tier_distribution: Record<string, number>;
};

type TopChartType = "bar" | "line";
type TierChartType = "pie" | "bar";
type ExportAction = "workbook" | "summary" | "tiers" | "performers" | "posts";

export function DashboardOverview({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topChartType, setTopChartType] = useState<TopChartType>("bar");
  const [tierChartType, setTierChartType] = useState<TierChartType>("pie");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/dashboard?campaign_id=${encodeURIComponent(campaignId)}`, { signal: abortController.signal });
        if (!res.ok) throw new Error("Failed to load dashboard");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(err.message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [campaignId]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isExportMenuOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Failed to load dashboard</p>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <EmptyState icon="📊" title="No data available" description="Start by adding creators to your campaign" />;
  }

  const tierData = Object.entries(data.tier_distribution || {})
    .map(([tier, count]) => ({ tier, count: Number(count) || 0 }))
    .filter((entry) => entry.count > 0);
  const performerData = (data.top_performers || []).map((entry) => ({
    username: entry.creators?.tiktok_username || "Unknown",
    overall_score: Number(entry.overall_score) || 0,
  }));

  const summaryRows = [
    { metric: "Active Creators", value: Number(data.total_creators) || 0 },
    { metric: "Estimated Revenue (7d)", value: Number(data.total_estimated_revenue) || 0 },
    { metric: "Top Posts Count", value: data.recent_top_posts?.length || 0 },
    { metric: "Unread Alerts", value: data.unread_alerts?.length || 0 },
  ];

  const performerRows = performerData.map((entry, index) => ({
    rank: index + 1,
    creator: entry.username,
    overall_score: entry.overall_score,
  }));

  const postRows = (data.recent_top_posts || []).map((post) => ({
    creator: post.creators?.tiktok_username || "Unknown",
    views: Number(post.views) || 0,
    likes: Number(post.likes) || 0,
    posted_at: post.posted_at ? new Date(post.posted_at).toISOString() : "",
  }));

  const tierRows = tierData.map((entry) => ({ tier: entry.tier, count: entry.count }));

  const handleExportData = async (action: ExportAction) => {
    if (!data) return;

    setExporting(true);
    setExportError(null);
    setIsExportMenuOpen(false);

    try {
      const safeCampaignId = campaignId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const exportDate = new Date().toISOString().slice(0, 10);
      const exportPrefix = `dashboard_${safeCampaignId}_${exportDate}`;

      if (action === "workbook") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(performerRows), "TopPerformers");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(postRows), "RecentPosts");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tierRows), "TierDistribution");
        XLSX.writeFile(workbook, `${exportPrefix}.xlsx`);
      } else if (action === "summary") {
        downloadCsvFile(summaryRows, `${exportPrefix}_summary.csv`);
      } else if (action === "tiers") {
        downloadCsvFile(tierRows, `${exportPrefix}_creator_tiers.csv`);
      } else if (action === "performers") {
        downloadCsvFile(performerRows, `${exportPrefix}_top_performers.csv`);
      } else if (action === "posts") {
        downloadCsvFile(postRows, `${exportPrefix}_recent_posts.csv`);
      }
    } catch {
      setExportError("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Active Creators" value={data.total_creators} subtitle="Total in system" icon="👥" />
        <KPICard
          title="Est. Revenue"
          value={`$${(data.total_estimated_revenue || 0).toLocaleString()}`}
          subtitle="Last 7 days"
          icon="💰"
        />
        <KPICard title="Top Posts" value={data.recent_top_posts?.length || 0} subtitle="Recent activity" icon="🔥" />
        <KPICard title="Alerts" value={data.unread_alerts?.length || 0} subtitle="Unread notifications" icon="🔔" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers Chart */}
        <div className="card">
          <div className="card-header flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Performers</h3>
              <p className="text-sm text-gray-500 mt-1">By overall score</p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setTopChartType("bar")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  topChartType === "bar" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Bar
              </button>
              <button
                type="button"
                onClick={() => setTopChartType("line")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  topChartType === "line" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Line
              </button>
            </div>
          </div>
          <div className="card-body">
            {performerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                {topChartType === "bar" ? (
                  <BarChart data={performerData}>
                    <XAxis dataKey="username" angle={-45} textAnchor="end" height={80} tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                    <Bar dataKey="overall_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={performerData}>
                    <XAxis dataKey="username" angle={-45} textAnchor="end" height={80} tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                    <Line type="monotone" dataKey="overall_score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="📈" title="No data yet" description="Scores will appear once creators are added" />
            )}
          </div>
        </div>

        {/* Tier Distribution Chart */}
        <div className="card">
          <div className="card-header flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Creator Tiers</h3>
              <p className="text-sm text-gray-500 mt-1">Distribution by performance</p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setTierChartType("pie")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tierChartType === "pie" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Pie
              </button>
              <button
                type="button"
                onClick={() => setTierChartType("bar")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tierChartType === "bar" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Bar
              </button>
            </div>
          </div>
          <div className="card-body">
            {tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                {tierChartType === "pie" ? (
                  <PieChart>
                    <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} label>
                      {tierData.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || "#999"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                  </PieChart>
                ) : (
                  <BarChart data={tierData}>
                    <XAxis dataKey="tier" tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {tierData.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || "#999"} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="📊" title="No tiers assigned" description="Tiers will appear once scores are calculated" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Posts Table */}
      <div className="card">
        <div className="card-header flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Top Posts</h3>
            <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
          </div>
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={exporting}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
              aria-expanded={isExportMenuOpen}
              aria-haspopup="menu"
            >
              {exporting ? "Exporting..." : "Export Data"}
            </button>
            {isExportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
              >
                <button type="button" role="menuitem" onClick={() => handleExportData("workbook")} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                  Full Dashboard Workbook (.xlsx)
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportData("summary")} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                  Summary Metrics (.csv)
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportData("tiers")} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                  Creator Tiers (.csv)
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportData("performers")} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                  Top Performers (.csv)
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportData("posts")} className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                  Recent Top Posts (.csv)
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="card-body">
          {exportError && <p className="text-sm text-red-700 mb-3">{exportError}</p>}
          {data.recent_top_posts && data.recent_top_posts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Creator</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Views</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Engagement</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_top_posts.slice(0, 10).map((post) => (
                    <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-900 font-medium">{post.creators?.tiktok_username || "Unknown"}</td>
                      <td className="py-3 px-4 text-gray-700">{(post.views || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-700">{(post.likes || 0).toLocaleString()} likes</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(new Date(post.posted_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="📱" title="No posts yet" description="Posts will appear once creators are scraped" />
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon }: { title: string; value: any; subtitle: string; icon: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <div className="text-3xl">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function downloadCsvFile(rows: Array<Record<string, unknown>>, filename: string) {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((key) => toCsvValue(row[key])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
