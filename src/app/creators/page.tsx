"use client";
import { useState } from "react";
import { CreatorList } from "@/components/creators/CreatorList";
import { CreatorDetail } from "@/components/creators/CreatorDetail";

export default function CreatorsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Creators</h1>
      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="text-blue-400 mb-4">← Back</button>
          <CreatorDetail creatorId={selected} campaignId="default" />
        </div>
      ) : (
        <CreatorList campaignId="default" onSelect={setSelected} />
      )}
    </div>
  );
}
