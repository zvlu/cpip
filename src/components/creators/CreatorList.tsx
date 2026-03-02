"use client";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";

const TIER_COLORS: Record<string, string> = { S: "bg-emerald-500", A: "bg-blue-500", B: "bg-amber-500", C: "bg-orange-500", D: "bg-red-500" };

export function CreatorList({ campaignId, onSelect }: { campaignId: string; onSelect: (id: string) => void }) {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/creators?campaign_id=${campaignId}`);
        if (!res.ok) throw new Error("Failed to load creators");
        const json = await res.json();
        setCreators(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, [campaignId]);

  const filtered = creators.filter((c) => c.tiktok_username.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Loading creators..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Failed to load creators</p>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (creators.length === 0) {
    return <EmptyState icon="👥" title="No creators yet" description="Add your first creator to get started" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search Bar */}
      <div>
        <input
          placeholder="Search creators by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
        />
      </div>

      {/* Creators Table */}
      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No results found" description={`No creators match "${search}"`} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
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
              {filtered.map((creator) => {
                const latestScore = creator.latest_score?.[0];
                return (
                  <tr
                    key={creator.id}
                    onClick={() => onSelect(creator.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">@{creator.tiktok_username}</div>
                      {creator.display_name && <div className="text-sm text-gray-500 mt-0.5">{creator.display_name}</div>}
                    </td>
                    <td className="py-4 px-6">
                      {latestScore?.tier ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-sm ${TIER_COLORS[latestScore.tier]}`}>
                          {latestScore.tier}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {latestScore?.overall_score ? <span className="font-semibold text-gray-900">{latestScore.overall_score.toFixed(1)}</span> : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="py-4 px-6 text-gray-700">{fmt(creator.follower_count)}</td>
                    <td className="py-4 px-6 text-gray-700">{latestScore?.engagement_score ? latestScore.engagement_score.toFixed(1) + "%" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
