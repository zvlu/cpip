"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

export function CreatorDetail({ creatorId, campaignId }: { creatorId: string; campaignId: string }) {
  const [creator, setCreator] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/creators/${creatorId}`).then((r) => r.json()),
      fetch(`/api/scores?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
      fetch(`/api/posts?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
    ]).then(([c, s, p]) => { setCreator(c.data); setScores(s.data || []); setPosts(p.data || []); });
  }, [creatorId, campaignId]);

  if (!creator) return <div className="animate-pulse text-zinc-500">Loading...</div>;
  const ls = scores[0];
  const radar = ls ? [
    { m: "Engagement", v: ls.engagement_score }, { m: "Revenue", v: ls.revenue_score },
    { m: "Consistency", v: ls.consistency_score }, { m: "Reach", v: ls.reach_score }, { m: "Growth", v: ls.growth_score },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">@{creator.tiktok_username}</h2>
          <p className="text-zinc-500">{creator.display_name}</p>
          {ls && <div className="flex gap-2 mt-2"><span className="px-2 py-1 bg-blue-600 rounded text-xs font-bold">{ls.tier}-Tier</span><span className="px-2 py-1 bg-zinc-800 rounded text-xs">Score: {ls.overall_score}</span></div>}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-4">Performance Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radar}><PolarGrid stroke="#333" /><PolarAngleAxis dataKey="m" tick={{ fill: "#a1a1aa" }} /><Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} /></RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-4">Score Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scores.slice().reverse()}>
              <XAxis dataKey="score_date" tick={{ fill: "#a1a1aa", fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fill: "#a1a1aa" }} /><Tooltip />
              <Line type="monotone" dataKey="overall_score" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="engagement_score" stroke="#10b981" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h3 className="font-semibold mb-4">Recent Posts</h3>
        <div className="space-y-2">
          {posts.map((p: any) => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex-1"><p className="text-sm truncate max-w-lg">{p.caption}</p>{p.has_product_link && <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded mt-1 inline-block">🛒 Product</span>}</div>
              <div className="text-right text-sm"><div>{fmt(p.views)} views</div><div className="text-zinc-500">Est. ${p.revenue_estimates?.[0]?.estimated_revenue?.toFixed(2) || "0"}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(n); }
