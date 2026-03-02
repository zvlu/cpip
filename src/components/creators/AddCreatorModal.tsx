"use client";
import { useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { InfoCard } from "@/components/ui/InfoCard";
import { useCampaign } from "@/lib/context/CampaignContext";
import { apiFetch } from "@/lib/api/client";

interface AddCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = ["Beauty", "Tech", "Fitness", "Food", "Lifestyle", "Fashion", "Health", "Entertainment", "Other"];

export function AddCreatorModal({ isOpen, onClose, onSuccess }: AddCreatorModalProps) {
  const { selectedCampaign } = useCampaign();
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tiktok_username: "",
    display_name: "",
    category: "",
    tags: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let username = formData.tiktok_username.trim();
      if (username.startsWith("@")) {
        username = username.slice(1);
      }

      if (!username) {
        throw new Error("Username is required");
      }

      const createRes = await apiFetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktok_username: username,
          display_name: formData.display_name || undefined,
          category: formData.category || undefined,
          tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
          campaign_id: selectedCampaign?.id,
        }),
      });

      if (!createRes.ok) {
        const { error: apiError } = await createRes.json();
        throw new Error(apiError || "Failed to create creator");
      }

      const { data: creator } = await createRes.json();
      setSuccess(
        selectedCampaign?.name
          ? `✅ Creator added to ${selectedCampaign.name}. Starting scrape...`
          : "✅ Creator added. Starting scrape..."
      );

      setScraping(true);
      try {
        const scrapeRes = await apiFetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creator_id: creator.id }),
        });

        if (scrapeRes.ok) {
          const { scraped } = await scrapeRes.json();
          setSuccess(`✅ Done. Added creator and scraped ${scraped} posts.`);
        } else {
          setSuccess(`✅ Creator added. Scrape is pending.`);
        }
      } catch (err: any) {
        setSuccess(`✅ Creator added. Scrape will continue in the background.`);
      } finally {
        setScraping(false);
      }

      setFormData({ tiktok_username: "", display_name: "", category: "", tags: "" });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add Creator</h2>
          <p className="text-sm text-gray-600 mt-1">Quickly add a TikTok creator to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info Card */}
          <InfoCard
            icon="💡"
            type="tip"
            title="Pro tip"
            description="Add the creator's TikTok username and we'll automatically analyze their content and performance."
            dismissible
          />

          {!selectedCampaign?.id && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-medium">
              No campaign selected. Creator will be tracked org-wide and can be linked to a campaign later.
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              ❌ {error}
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
              {success}
            </div>
          )}

          {/* TikTok Username */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-semibold text-gray-900">TikTok Username</label>
              <Tooltip text="Enter the creator&apos;s TikTok handle. You can include or omit the @ symbol.">
                <span className="text-gray-400 cursor-help font-bold">?</span>
              </Tooltip>
            </div>
            <input
              type="text"
              name="tiktok_username"
              value={formData.tiktok_username}
              onChange={handleInputChange}
              placeholder="e.g., sarah_styles"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
              required
              disabled={loading || scraping}
            />
            <p className="text-xs text-gray-500 mt-1.5">💡 Copy from the creator&apos;s TikTok profile URL</p>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-semibold text-gray-900">Display Name</label>
              <Tooltip text="The creator&apos;s real name or brand name. This helps you identify them in reports.">
                <span className="text-gray-400 cursor-help font-bold">?</span>
              </Tooltip>
            </div>
            <input
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleInputChange}
              placeholder="e.g., Sarah Styles"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
              disabled={loading || scraping}
            />
            <p className="text-xs text-gray-500 mt-1.5">Optional but recommended</p>
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-semibold text-gray-900">Content Category</label>
              <Tooltip text="Select the primary category of content the creator produces. This helps organize and filter creators.">
                <span className="text-gray-400 cursor-help font-bold">?</span>
              </Tooltip>
            </div>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-all"
              disabled={loading || scraping}
            >
              <option value="">Select a category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5">Optional</p>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-semibold text-gray-900">Tags</label>
              <Tooltip text="Add custom tags to organize and filter creators. Separate multiple tags with commas.">
                <span className="text-gray-400 cursor-help font-bold">?</span>
              </Tooltip>
            </div>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="e.g., verified, trending, nano-influencer"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
              disabled={loading || scraping}
            />
            <p className="text-xs text-gray-500 mt-1.5">Comma-separated, optional</p>
          </div>

          {/* What Happens Next */}
          <InfoCard
            icon="⚡"
            type="info"
            title="What happens next"
            description="We'll sync recent posts first. Campaign-specific score and revenue analytics are available once the creator is linked to a campaign."
            dismissible
          />

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || scraping}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || scraping || !formData.tiktok_username.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading || scraping ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {scraping ? "Analyzing..." : "Adding..."}
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Add Creator</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
