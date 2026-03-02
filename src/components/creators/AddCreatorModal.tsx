"use client";
import { useState } from "react";

interface AddCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = ["Beauty", "Tech", "Fitness", "Food", "Lifestyle", "Other"];

export function AddCreatorModal({ isOpen, onClose, onSuccess }: AddCreatorModalProps) {
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
      // Clean up username
      let username = formData.tiktok_username.trim();
      if (username.startsWith("@")) {
        username = username.slice(1);
      }

      if (!username) {
        throw new Error("Username is required");
      }

      // Create creator
      const createRes = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktok_username: username,
          display_name: formData.display_name || undefined,
          category: formData.category || undefined,
          tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
        }),
      });

      if (!createRes.ok) {
        const { error: apiError } = await createRes.json();
        throw new Error(apiError || "Failed to create creator");
      }

      const { data: creator } = await createRes.json();
      setSuccess(`Creator added! Now scraping posts...`);

      // Trigger scrape
      setScraping(true);
      try {
        const scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creator_id: creator.id }),
        });

        if (scrapeRes.ok) {
          const { scraped } = await scrapeRes.json();
          setSuccess(`✅ Creator added! Scraped ${scraped} posts.`);
        } else {
          setSuccess(`✅ Creator added! (Scrape pending)`);
        }
      } catch (err: any) {
        setSuccess(`✅ Creator added! (Scrape failed: ${err.message})`);
      } finally {
        setScraping(false);
      }

      // Reset form and close
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Creator</h2>
          <p className="text-sm text-gray-600 mt-1">Add a new TikTok creator to your campaign</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">TikTok Username *</label>
            <input
              type="text"
              name="tiktok_username"
              value={formData.tiktok_username}
              onChange={handleInputChange}
              placeholder="e.g., @sarah_styles or sarah_styles"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading || scraping}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Display Name</label>
            <input
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleInputChange}
              placeholder="e.g., Sarah Styles"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || scraping}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || scraping}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Tags</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="e.g., fashion, trending, verified"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || scraping}
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated values</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || scraping}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || scraping}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading || scraping ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {scraping ? "Scraping..." : "Adding..."}
                </>
              ) : (
                "Add & Scrape"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
