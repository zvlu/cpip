"use client";

import { Tooltip } from "@/components/ui/Tooltip";

export function HelpHint({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold leading-none text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
        aria-label="More information"
        title="More information"
      >
        ?
      </span>
    </Tooltip>
  );
}
