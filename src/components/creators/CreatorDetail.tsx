"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

export function CreatorDetail({ creatorId, campaignId }: { creatorId: string; campaignId: string }) {
  const [creator, setCreator] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/creators/${creatorId}`).then((r) => r.json()),
      fetch(`/api/scores?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
      fetch(`/api/posts?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
    ])
      .then(([c, s, p]) => {
        setCreator(c.data);
        setScores(s.data || []);
        setPosts(p.data || []);
      })
      .finally(() => setLoading(false));
  }, [creatorId, campaignId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading creator details...</div>
      </div>
    );

  if (!creator)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Creator not found</div>
      </div>
    );

  const ls = scores[0];
  const radar = ls
    ? [
        { m: "Engagement", v: ls.engagement_score },
        { m: "Revenue", v: ls.revenue_score },
        { m: "Consistency", v: ls.consistency_score },
        { m: "Reach", v: ls.reach_score },
        { m: "Growth", v: ls.growth_score },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">@{creator.tiktok_username}</h1>
            {creator.display_name && <p className="text-lg text-gray-600 mt-1">{creator.display_name}</p>}
            {ls && (
              <div className="flex gap-3 mt-4">
                <span className="px-4 py-2 bg-blue-100 text-blue-900 rounded-full text-sm font-bold">{ls.tier}-Tier</span>
                <span className="px-4 py-2 bg-gray-100 text-gray-900 rounded-full text-sm font-medium">Score: {ls.overall_score}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Followers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(creator.follower_count)}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Performance Breakdown</h3>
            <p className="text-sm text-gray-500 mt-1">Score components</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radar}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="m" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Score Trend</h3>
            <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scores.slice().reverse()}>
              <XAxis dataKey="score_date" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#6b7280" }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="overall_score" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="engagement_score" stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Posts */}
      {posts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
            <p className="text-sm text-gray-500 mt-1">Latest activity</p>
          </div>
          <div className="space-y-3">
            {posts.slice(0, 10).map((p: any) => (
              <div key={p.id} className="flex justify-between items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 line-clamp-2">{p.caption || "No caption"}</p>
                  <div className="flex gap-2 mt-2">
                    {p.has_product_link && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">🛒 Product Link</span>}
                    {p.hashtags?.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{p.hashtags.length} hashtags</span>}
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{fmt(p.views)} views</p>
                  <p className="text-xs text-gray-500 mt-1">Est. ${(p.revenue_estimates?.[0]?.estimated_revenue || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
