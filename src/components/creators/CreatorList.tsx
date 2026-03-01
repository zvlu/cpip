"use client";
import { useEffect, useState } from "react";

const TIER_COLORS: Record<string, string> = { S: "bg-emerald-500", A: "bg-blue-500", B: "bg-amber-500", C: "bg-orange-500", D: "bg-red-500" };

export function CreatorList({ campaignId, onSelect }: { campaignId: string; onSelect: (id: string) => void }) {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/creators?campaign_id=${campaignId}`)
      .then((r) => r.json())
      .then((d) => setCreators(d.data || []))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const filtered = creators.filter((c) => c.tiktok_username.toLowerCase().includes(search.toLowerCase()));

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading creators...</div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div>
        <input
          placeholder="Search creators by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
        />
      </div>

      {/* Creators Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-4 px-6 font-semibold text-gray-900 text-sm">Creator</th>
              <th className="text-left py-4 px-6 font-semibold text-gray-900 text-sm">Tier</th>
              <th className="text-left py-4 px-6 font-semibold text-gray-900 text-sm">Score</th>
              <th className="text-left py-4 px-6 font-semibold text-gray-900 text-sm">Followers</th>
              <th className="text-left py-4 px-6 font-semibold text-gray-900 text-sm">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-6 text-center text-gray-500">
                  {search ? "No creators found" : "No creators available"}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const s = c.latest_score?.[0];
                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-semibold text-gray-900">@{c.tiktok_username}</p>
                        {c.display_name && <p className="text-sm text-gray-500 mt-0.5">{c.display_name}</p>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {s?.tier && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${TIER_COLORS[s.tier]}`}>{s.tier}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-gray-900">{s?.overall_score || "—"}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-600">{fmt(c.follower_count)}</td>
                    <td className="py-4 px-6 text-gray-600">{s?.engagement_score || "—"}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500">
        Showing {filtered.length} of {creators.length} creators
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
