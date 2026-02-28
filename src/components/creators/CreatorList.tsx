"use client";
import { useEffect, useState } from "react";

const TIER_COLORS: Record<string, string> = { S: "bg-emerald-500", A: "bg-blue-500", B: "bg-amber-500", C: "bg-orange-500", D: "bg-red-500" };

export function CreatorList({ campaignId, onSelect }: { campaignId: string; onSelect: (id: string) => void }) {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { fetch(`/api/creators?campaign_id=${campaignId}`).then((r) => r.json()).then((d) => setCreators(d.data || [])); }, [campaignId]);

  const filtered = creators.filter((c) => c.tiktok_username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <input placeholder="Search creators..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 w-80 focus:outline-none focus:border-blue-500" />
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
            <th className="p-4">Creator</th><th className="p-4">Tier</th><th className="p-4">Score</th><th className="p-4">Followers</th><th className="p-4">Engagement</th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => {
              const s = c.latest_score?.[0];
              return (
                <tr key={c.id} onClick={() => onSelect(c.id)} className="border-b border-zinc-800/50 hover:bg-zinc-800/50 cursor-pointer">
                  <td className="p-4 font-medium">@{c.tiktok_username}{c.display_name && <span className="text-zinc-500 ml-2 text-sm">{c.display_name}</span>}</td>
                  <td className="p-4">{s?.tier && <span className={`px-2 py-1 rounded text-xs font-bold text-white ${TIER_COLORS[s.tier]}`}>{s.tier}</span>}</td>
                  <td className="p-4 font-bold">{s?.overall_score || "—"}</td>
                  <td className="p-4">{fmt(c.follower_count)}</td>
                  <td className="p-4">{s?.engagement_score || "—"}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number) { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(n); }
