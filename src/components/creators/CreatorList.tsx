"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

const TIER_COLORS: Record<string, string> = { S: "bg-emerald-500", A: "bg-blue-500", B: "bg-amber-500", C: "bg-orange-500", D: "bg-red-500" };

export function CreatorList({
  campaignId,
  onSelect,
  onAddCreator,
}: {
  campaignId?: string;
  onSelect?: (id: string) => void;
  onAddCreator?: () => void;
}) {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthUser();

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true);
        setError(null);
        const query = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : "";
        const res = await apiFetch(`/api/creators${query}`);
        if (!res.ok) {
          let message = "Failed to load creators";
          try {
            const body = await res.json();
            if (body?.error) message = body.error;
          } catch {
            // No-op: keep fallback message
          }
          if (res.status === 401) {
            message = "Your session has expired. Please sign in again.";
          }
          throw new Error(message);
        }
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
    if (!user) {
      return (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
          <p className="text-yellow-900 font-medium">Sign in to load creators</p>
          <p className="text-yellow-800 text-sm mt-1">
            You are currently signed out, so creator data may be unavailable.
          </p>
          <div className="mt-4">
            <Link
              href="/auth"
              className="btn-primary inline-flex items-center text-sm"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-red-800 font-medium">Failed to load creators</p>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (creators.length === 0) {
    return (
      <EmptyState
        title="No creators yet"
        description="Add your first creator to get started"
        action={onAddCreator ? { label: "Add Creator", onClick: onAddCreator } : undefined}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search Bar */}
      <div>
        <input
          placeholder="Search creators by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base w-full sm:max-w-md text-gray-900 placeholder-gray-500"
        />
      </div>

      {/* Creators Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No results found" description={`No creators match "${search}"`} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Creator</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Tier</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Score</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Followers</th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((creator) => {
                const latestScore = creator.latest_score?.[0];
                return (
                  <tr
                    key={creator.id}
                    onClick={onSelect ? () => onSelect(creator.id) : undefined}
                    onKeyDown={
                      onSelect
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect(creator.id);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onSelect ? 0 : undefined}
                    role={onSelect ? "button" : undefined}
                    aria-label={onSelect ? `Open details for @${creator.tiktok_username}` : undefined}
                    className={`border-b border-gray-100 transition-colors ${onSelect ? "cursor-pointer hover:bg-gray-50/70" : ""}`}
                  >
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">@{creator.tiktok_username}</div>
                      {creator.display_name && <div className="text-sm text-gray-500 mt-0.5">{creator.display_name}</div>}
                    </td>
                    <td className="py-4 px-6">
                      {latestScore?.tier ? (
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${TIER_COLORS[latestScore.tier]}`}>
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
