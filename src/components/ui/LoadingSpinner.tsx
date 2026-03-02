"use client";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const SIZE_CLASSES = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
};

const TEXT_SIZES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function LoadingSpinner({ size = "md", text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${SIZE_CLASSES[size]} border-gray-300 border-t-blue-600 rounded-full animate-spin`}
      />
      {text && <p className={`text-gray-500 ${TEXT_SIZES[size]}`}>{text}</p>}
    </div>
  );
}
