"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TIER_COLORS: Record<string, string> = { S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#f97316", D: "#ef4444" };

export function DashboardOverview({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?campaign_id=${campaignId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="animate-pulse text-zinc-500">Loading dashboard...</div>;
  if (!data) return <div>Error loading dashboard</div>;

  const tierData = Object.entries(data.tier_distribution || {}).map(([tier, count]) => ({ tier, count }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI title="Active Creators" value={data.total_creators} />
        <KPI title="Est. Revenue" value={`$${(data.total_estimated_revenue || 0).toLocaleString()}`} />
        <KPI title="Top Posts (7d)" value={data.recent_top_posts?.length || 0} />
        <KPI title="Alerts" value={data.unread_alerts?.length || 0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-4">Top 10 Performers</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.top_performers}>
              <XAxis dataKey="creators.tiktok_username" angle={-45} textAnchor="end" height={80} tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#a1a1aa" }} />
              <Tooltip />
              <Bar dataKey="overall_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-4">Creator Tiers</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} label>
                {tierData.map((e: any) => <Cell key={e.tier} fill={TIER_COLORS[e.tier] || "#999"} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
