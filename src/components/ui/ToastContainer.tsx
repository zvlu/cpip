"use client";
import { Toast } from "@/lib/hooks/useToast";

const TOAST_ICONS: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const TOAST_COLORS: Record<string, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg p-4 flex items-center gap-3 animate-slide-up ${TOAST_COLORS[toast.type]}`}
        >
          <span className="text-lg font-bold">{TOAST_ICONS[toast.type]}</span>
          <p className="flex-1">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-lg font-bold hover:opacity-70 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
