"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TIER_COLORS: Record<string, string> = { S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#f97316", D: "#ef4444" };

export function DashboardOverview({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?campaign_id=${campaignId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  if (!data)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading dashboard</div>
      </div>
    );

  const tierData = Object.entries(data.tier_distribution || {}).map(([tier, count]) => ({ tier, count }));

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI title="Active Creators" value={data.total_creators} subtitle="Total in system" />
        <KPI title="Est. Revenue" value={`$${(data.total_estimated_revenue || 0).toLocaleString()}`} subtitle="Last 7 days" />
        <KPI title="Top Posts" value={data.recent_top_posts?.length || 0} subtitle="Recent activity" />
        <KPI title="Alerts" value={data.unread_alerts?.length || 0} subtitle="Unread notifications" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top 10 Performers</h3>
            <p className="text-sm text-gray-500 mt-1">By overall score</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.top_performers}>
              <XAxis dataKey="creators.tiktok_username" angle={-45} textAnchor="end" height={80} tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#6b7280" }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Bar dataKey="overall_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Creator Tiers</h3>
            <p className="text-sm text-gray-500 mt-1">Distribution by performance</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} label>
                {tierData.map((e: any) => (
                  <Cell key={e.tier} fill={TIER_COLORS[e.tier] || "#999"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Posts Table */}
      {data.recent_top_posts?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Top Posts</h3>
            <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Creator</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Views</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Caption</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_top_posts.slice(0, 5).map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-900 font-medium">@{p.creators?.tiktok_username}</td>
                    <td className="py-3 px-4 text-gray-600">{fmt(p.views)}</td>
                    <td className="py-3 px-4 text-gray-600 truncate max-w-xs">{p.caption || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value, subtitle }: { title: string; value: any; subtitle?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition-colors">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
