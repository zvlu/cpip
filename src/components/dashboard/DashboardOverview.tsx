"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";

const TIER_COLORS: Record<string, string> = { S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#f97316", D: "#ef4444" };

export function DashboardOverview({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/dashboard?campaign_id=${campaignId}`);
        if (!res.ok) throw new Error("Failed to load dashboard");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId]);

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

  const tierData = Object.entries(data.tier_distribution || {}).map(([tier, count]) => ({ tier, count }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Top 10 Performers</h3>
            <p className="text-sm text-gray-500 mt-1">By overall score</p>
          </div>
          <div className="card-body">
            {data.top_performers && data.top_performers.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.top_performers}>
                  <XAxis dataKey="creators.tiktok_username" angle={-45} textAnchor="end" height={80} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#6b7280" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                  <Bar dataKey="overall_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="📈" title="No data yet" description="Scores will appear once creators are added" />
            )}
          </div>
        </div>

        {/* Tier Distribution Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Creator Tiers</h3>
            <p className="text-sm text-gray-500 mt-1">Distribution by performance</p>
          </div>
          <div className="card-body">
            {tierData.length > 0 ? (
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
            ) : (
              <EmptyState icon="📊" title="No tiers assigned" description="Tiers will appear once scores are calculated" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Posts Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Recent Top Posts</h3>
          <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
        </div>
        <div className="card-body">
          {data.recent_top_posts && data.recent_top_posts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Creator</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Views</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Engagement</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_top_posts.slice(0, 10).map((post: any) => (
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
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <div className="text-3xl">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
