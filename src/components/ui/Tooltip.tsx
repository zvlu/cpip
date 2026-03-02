"use client";
import { useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const POSITION_CLASSES = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

const ARROW_CLASSES = {
  top: "top-full border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent",
  bottom: "bottom-full border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent",
  left: "left-full border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent",
  right: "right-full border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent",
};

export function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>

      {visible && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg whitespace-nowrap pointer-events-none animate-fade-in ${POSITION_CLASSES[position]}`}
        >
          {text}
          <div
            className={`absolute w-0 h-0 border-4 ${ARROW_CLASSES[position]}`}
          />
        </div>
      )}
    </div>
  );
}
