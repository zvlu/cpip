"use client";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api/client";

export function LookalikeDiscovery({ creatorId, campaignId }: { creatorId: string; campaignId: string }) {
  const [lookalikes, setLookalikes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchLookalikes = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/lookalike-discovery?creator_id=${creatorId}&campaign_id=${campaignId}`);
        const json = await res.json();
        if (!res.ok) {
          const message = json?.error?.message || json?.error || "Failed to load lookalike discovery";
          throw new Error(message);
        }
        setLookalikes(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLookalikes();
  }, [creatorId, campaignId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Finding similar creators..." />
      </div>
    );
  }

  if (error) {
    const likelyNoPeers = /no other creators/i.test(error);
    return (
      <div className={`rounded-lg p-6 ${likelyNoPeers ? "bg-yellow-50 border border-yellow-200" : "bg-red-50 border border-red-200"}`}>
        <p className={`${likelyNoPeers ? "text-yellow-900" : "text-red-800"} font-medium`}>
          {likelyNoPeers ? "Need more creators in this campaign" : "Failed to load lookalike discovery"}
        </p>
        <p className={`${likelyNoPeers ? "text-yellow-800" : "text-red-700"} text-sm mt-1`}>{error}</p>
      </div>
    );
  }

  if (!lookalikes || !lookalikes.similar_creators || lookalikes.similar_creators.length === 0) {
    return <EmptyState icon="🔍" title="No similar creators found" description="Try adding more creators to find matches" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Discovery Insights */}
      {lookalikes.discovery_insights && lookalikes.discovery_insights.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="card-body space-y-2">
            {lookalikes.discovery_insights.map((insight: string, idx: number) => (
              <p key={idx} className="text-sm text-blue-900 flex gap-2">
                <span>💡</span>
                <span>{insight}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Similar Creators List */}
      <div className="space-y-4">
        {lookalikes.similar_creators.map((creator: any) => (
          <div key={creator.creator_id} className="card">
            <div className="card-body space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">@{creator.tiktok_username}</h3>
                  <p className="text-sm text-gray-600 mt-1">{creator.follower_count.toLocaleString()} followers</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{creator.similarity_score}</div>
                  <p className="text-xs text-gray-500">similarity</p>
                </div>
              </div>

              {/* Similarity Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Audience Overlap</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{creator.audience_overlap}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Engagement Match</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{creator.engagement_similarity}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium">Content Style</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{creator.content_style_match}%</p>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Why:</span> {creator.reason}
                </p>
              </div>

              {/* Outreach Snippet */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Suggested Outreach</p>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative">
                  <p className="text-sm text-gray-700 pr-10">{creator.outreach_snippet}</p>
                  <button
                    onClick={() => copyToClipboard(creator.outreach_snippet, creator.creator_id)}
                    className="absolute top-3 right-3 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {copied === creator.creator_id ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
