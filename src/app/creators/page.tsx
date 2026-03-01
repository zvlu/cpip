"use client";
import { useState } from "react";
import { CreatorList } from "@/components/creators/CreatorList";
import { CreatorDetail } from "@/components/creators/CreatorDetail";

export default function CreatorsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Creators</h1>
        <p className="text-gray-600 mt-2">Manage and track creator performance metrics</p>
      </div>

      {selected ? (
        <div>
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm mb-6 transition-colors"
          >
            ← Back to Creators
          </button>
          <CreatorDetail creatorId={selected} campaignId="default" />
        </div>
      ) : (
        <CreatorList campaignId="default" onSelect={setSelected} />
      )}
    </div>
  );
}
