"use client";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";

export function CreativeAudit({ creatorId, campaignId }: { creatorId: string; campaignId: string }) {
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/creative-audit?creator_id=${creatorId}&campaign_id=${campaignId}`);
        if (!res.ok) throw new Error("Failed to load creative audit");
        const json = await res.json();
        setAudit(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [creatorId, campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Analyzing content..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Failed to load creative audit</p>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!audit) {
    return <EmptyState icon="🎬" title="No audit data" description="Run a creative audit to analyze content" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hook Strength Meter */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Hook Strength</h3>
          <p className="text-sm text-gray-500 mt-1">How compelling the opening moments are</p>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${audit.hook_strength}%` }}
                />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{audit.hook_strength}</div>
          </div>
          <p className="text-sm text-gray-600">
            {audit.hook_strength >= 80
              ? "Exceptional - hooks viewers immediately"
              : audit.hook_strength >= 60
              ? "Strong - effective opening strategy"
              : audit.hook_strength >= 40
              ? "Moderate - room for improvement"
              : "Weak - consider refining opening moments"}
          </p>
        </div>
      </div>

      {/* Content Diversity */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Content Diversity</h3>
          <p className="text-sm text-gray-500 mt-1">Variety of content styles used</p>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all"
                  style={{ width: `${audit.content_diversity}%` }}
                />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{audit.content_diversity}</div>
          </div>
          <p className="text-sm text-gray-600">
            {audit.content_diversity >= 70
              ? "Excellent variety keeps audience engaged"
              : audit.content_diversity >= 50
              ? "Good mix of content types"
              : "Limited variety - consider diversifying"}
          </p>
        </div>
      </div>

      {/* Top Content Styles */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Top Content Styles</h3>
          <p className="text-sm text-gray-500 mt-1">What works best for this creator</p>
        </div>
        <div className="card-body">
          {audit.top_content_styles && audit.top_content_styles.length > 0 ? (
            <div className="space-y-4">
              {audit.top_content_styles.map((style: any, idx: number) => (
                <div key={idx} className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{style.style.replace(/_/g, " ")}</p>
                      <p className="text-sm text-gray-600 mt-1">{style.post_count} posts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{style.average_views.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">avg views</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, (style.average_engagement_rate / 10) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{style.average_engagement_rate.toFixed(1)}% engagement</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No content styles identified</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Creative Recommendations</h3>
        </div>
        <div className="card-body">
          {audit.recommendations && audit.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {audit.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex gap-3 text-sm text-gray-700">
                  <span className="text-lg flex-shrink-0">💡</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No recommendations at this time</p>
          )}
        </div>
      </div>
    </div>
  );
}
