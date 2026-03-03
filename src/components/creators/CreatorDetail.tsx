"use client";
import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CreativeAudit } from "./CreativeAudit";
import { LookalikeDiscovery } from "./LookalikeDiscovery";
import { apiFetch } from "@/lib/api/client";

export function CreatorDetail({ creatorId, campaignId }: { creatorId: string; campaignId: string }) {
  const [creator, setCreator] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [predictiveScore, setPredictiveScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [predictiveError, setPredictiveError] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "creative" | "lookalikes">("overview");

  const loadCreatorData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const creatorRes = await apiFetch(`/api/creators/${creatorId}`);
      const creatorJson = await creatorRes.json();
      if (!creatorRes.ok || !creatorJson?.data) {
        throw new Error("Creator not found");
      }
      setCreator(creatorJson.data);

      const [scoresRes, postsRes, predictiveRes] = await Promise.allSettled([
        apiFetch(`/api/scores?creator_id=${creatorId}&campaign_id=${campaignId}`),
        apiFetch(`/api/posts?creator_id=${creatorId}&campaign_id=${campaignId}`),
        apiFetch(`/api/predictive-score?creator_id=${creatorId}&campaign_id=${campaignId}`),
      ]);

      if (scoresRes.status === "fulfilled" && scoresRes.value.ok) {
        const scoreJson = await scoresRes.value.json();
        setScores(scoreJson.data || []);
      } else {
        setScores([]);
      }

      if (postsRes.status === "fulfilled" && postsRes.value.ok) {
        const postJson = await postsRes.value.json();
        setPosts(postJson.data || []);
      } else {
        setPosts([]);
      }

      if (predictiveRes.status === "fulfilled" && predictiveRes.value.ok) {
        const predictiveJson = await predictiveRes.value.json();
        if (typeof predictiveJson?.overall_roi_score === "number") {
          setPredictiveScore(predictiveJson);
          setPredictiveError(null);
        } else {
          setPredictiveScore(null);
        }
      } else {
        setPredictiveScore(null);
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load creator details");
      setCreator(null);
      setScores([]);
      setPosts([]);
      setPredictiveScore(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, creatorId]);

  useEffect(() => {
    loadCreatorData();
  }, [loadCreatorData]);

  const handleGeneratePredictiveScore = async () => {
    setPredictiveLoading(true);
    setPredictiveError(null);
    try {
      const res = await apiFetch("/api/predictive-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creatorId, campaign_id: campaignId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to generate predictive score");
      }
      const calculated = json?.data || null;
      if (!calculated || typeof calculated.overall_roi_score !== "number") {
        throw new Error("Predictive score response was incomplete");
      }
      setPredictiveScore(calculated);
    } catch (err: any) {
      setPredictiveError(err?.message || "Could not generate predictive score");
    } finally {
      setPredictiveLoading(false);
    }
  };

  const handleRunScrape = async () => {
    setScrapeLoading(true);
    setScrapeError(null);
    try {
      const res = await apiFetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creatorId, campaign_id: campaignId, wait_for_completion: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to run scrape");
      }
      await loadCreatorData();
    } catch (err: any) {
      setScrapeError(err?.message || "Scrape failed");
    } finally {
      setScrapeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Loading creator details..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 font-medium">{loadError}</div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 font-medium">Creator not found</div>
      </div>
    );
  }

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
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">@{creator.tiktok_username}</h1>
            {creator.display_name && <p className="text-base sm:text-lg text-gray-600 mt-1">{creator.display_name}</p>}
            <div className="flex gap-3 mt-4 flex-wrap">
              {ls && (
                <>
                  <span className="px-4 py-2 bg-blue-100 text-blue-900 rounded-full text-sm font-bold">{ls.tier}-Tier</span>
                  <span className="px-4 py-2 bg-gray-100 text-gray-900 rounded-full text-sm font-medium">Score: {ls.overall_score}</span>
                </>
              )}
              {predictiveScore && (
                <span className="px-4 py-2 bg-green-100 text-green-900 rounded-full text-sm font-medium">ROI: {predictiveScore.overall_roi_score}%</span>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-600">Followers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(creator.follower_count)}</p>
          </div>
        </div>
      </div>

      {/* Predictive ROI Score Card */}
      <div className="space-y-3">
        {predictiveScore ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="card-body">
                <p className="text-sm text-gray-600 font-medium">Conversion Probability</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{predictiveScore.conversion_probability}%</p>
                <p className="text-xs text-gray-500 mt-2">Likelihood of driving sales</p>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <p className="text-sm text-gray-600 font-medium">Viral Potential</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{predictiveScore.viral_potential}%</p>
                <p className="text-xs text-gray-500 mt-2">Post going viral odds</p>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <p className="text-sm text-gray-600 font-medium">Overall ROI Score</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{predictiveScore.overall_roi_score}%</p>
                <p className="text-xs text-gray-500 mt-2">Composite performance</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Predictive ROI score is not generated yet.</p>
                <p className="text-xs text-gray-600 mt-1">Generate it from the latest 30-day campaign data.</p>
              </div>
              <button
                type="button"
                onClick={handleGeneratePredictiveScore}
                disabled={predictiveLoading}
                className="btn-secondary text-sm disabled:opacity-60"
              >
                {predictiveLoading ? "Generating..." : "Generate Predictive Score"}
              </button>
            </div>
          </div>
        )}
        {predictiveError && <p className="text-sm text-red-600">{predictiveError}</p>}
      </div>
      {scrapeError && <p className="text-sm text-red-600">{scrapeError}</p>}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4 sm:gap-8 overflow-x-auto">
          {(["overview", "creative", "lookalikes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "creative" && "Creative Audit"}
              {tab === "lookalikes" && "Similar Creators"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Breakdown */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Performance Breakdown</h3>
                <p className="text-sm text-gray-500 mt-1">Score components</p>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radar}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="m" tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Trend */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Score Trend</h3>
                <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
              </div>
              <div className="card-body">
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
          </div>

          {/* Recent Posts */}
          {posts.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
                <p className="text-sm text-gray-500 mt-1">Latest activity</p>
              </div>
              <div className="card-body space-y-3">
                {posts.slice(0, 10).map((p: any) => (
                  <div key={p.id} className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 line-clamp-2">{p.caption || "No caption"}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {p.has_product_link && <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Product Link</span>}
                        {p.hashtags?.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{p.hashtags.length} hashtags</span>}
                      </div>
                    </div>
                    <div className="text-left sm:text-right sm:ml-4 flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{fmt(p.views)} views</p>
                      <p className="text-xs text-gray-500 mt-1">Est. ${(p.revenue_estimates?.[0]?.estimated_revenue || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">No posts found for this creator in this campaign.</p>
                  <p className="text-xs text-gray-600 mt-1">Run a scrape to populate analytics, score trends, and audits.</p>
                </div>
                <button type="button" className="btn-secondary text-sm" onClick={handleRunScrape} disabled={scrapeLoading}>
                  {scrapeLoading ? "Scraping..." : "Run Scrape"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "creative" && (
        <CreativeAudit creatorId={creatorId} campaignId={campaignId} onRunScrape={handleRunScrape} scrapeLoading={scrapeLoading} />
      )}

      {activeTab === "lookalikes" && <LookalikeDiscovery creatorId={creatorId} campaignId={campaignId} />}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
