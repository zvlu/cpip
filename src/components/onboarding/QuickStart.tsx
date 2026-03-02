"use client";
import { useState } from "react";

interface QuickStartStep {
  icon: string;
  title: string;
  description: string;
  action: {
    label: string;
    onClick: () => void;
  };
  completed?: boolean;
}

interface QuickStartProps {
  steps: QuickStartStep[];
  onDismiss: () => void;
  demoChoice?: {
    visible: boolean;
    enabled: boolean;
    loading: boolean;
    onUseRealData: () => void;
    onUseDemoData: () => void;
    onDismissPrompt: () => void;
  };
}

export function QuickStart({ steps, onDismiss, demoChoice }: QuickStartProps) {
  const [collapsed, setCollapsed] = useState(false);
  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 z-40 text-sm sm:text-base"
      >
        <span>📚</span>
        <span>Quick Start ({completedCount}/{steps.length})</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] max-w-96 bg-white rounded-lg border border-gray-200 shadow-lg z-40 animate-slide-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <h3 className="font-semibold text-gray-900">Quick Start Guide</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Minimize quick start guide"
            title="Minimize"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            −
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close quick start guide"
            title="Close"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">
            {completedCount} of {steps.length} completed
          </p>
          <p className="text-xs font-medium text-gray-600">{Math.round(progressPercent)}%</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
        {demoChoice?.visible && (
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <h4 className="text-sm font-semibold text-blue-900">Choose your starting view</h4>
            <p className="mt-1 text-xs text-blue-800">
              Demo data mode helps you explore features quickly. You can switch this anytime from the top bar or settings.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={demoChoice.loading}
                onClick={demoChoice.onUseRealData}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  !demoChoice.enabled ? "bg-blue-700 text-white" : "bg-white text-blue-800 border border-blue-300"
                }`}
              >
                Use real data
              </button>
              <button
                type="button"
                disabled={demoChoice.loading}
                onClick={demoChoice.onUseDemoData}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  demoChoice.enabled ? "bg-blue-700 text-white" : "bg-white text-blue-800 border border-blue-300"
                }`}
              >
                Explore demo data
              </button>
              <button
                type="button"
                disabled={demoChoice.loading}
                onClick={demoChoice.onDismissPrompt}
                className="text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                Decide later
              </button>
            </div>
          </div>
        )}

        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border-2 transition-all ${
              step.completed
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200 hover:border-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">{step.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                  {step.completed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Done</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                {!step.completed && (
                  <button
                    onClick={step.action.onClick}
                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {step.action.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between">
        <button
          onClick={onDismiss}
          className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Dismiss
        </button>
        {completedCount === steps.length && (
          <span className="text-xs text-green-600 font-medium">🎉 All done!</span>
        )}
      </div>
    </div>
  );
}
