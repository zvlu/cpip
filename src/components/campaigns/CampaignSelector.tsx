"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useCampaign } from "@/lib/context/CampaignContext";
import { CreateCampaignModal } from "./CreateCampaignModal";

export function CampaignSelector() {
  const { selectedCampaign, campaigns, setSelectedCampaign } = useCampaign();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleSelectCampaign = (campaign: any) => {
    setSelectedCampaign(campaign);
    setIsDropdownOpen(false);
  };

  const totalMenuItems = campaigns.length + 1;

  const closeDropdown = (focusTrigger = false) => {
    setIsDropdownOpen(false);
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  };

  const openCreateCampaignModal = () => {
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
  };

  const executeMenuItem = (index: number) => {
    if (index === 0) {
      openCreateCampaignModal();
      return;
    }
    const campaign = campaigns[index - 1];
    if (campaign) {
      handleSelectCampaign(campaign);
    }
  };

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDropdown(true);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    setHighlightedIndex(0);
  }, [isDropdownOpen, campaigns.length]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    itemRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, isDropdownOpen]);

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex(0);
              setIsDropdownOpen(true);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex(totalMenuItems - 1);
              setIsDropdownOpen(true);
            }
          }}
          className="flex w-full items-start gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
          aria-expanded={isDropdownOpen}
          aria-haspopup="menu"
          aria-controls={dropdownId}
        >
          <span>📊</span>
          <span className="min-w-0 flex-1 whitespace-normal break-words">
            {selectedCampaign ? `${selectedCampaign.name}${selectedCampaign.product_name ? ` - ${selectedCampaign.product_name}` : ""}` : "Select Campaign"}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div
            id={dropdownId}
            role="menu"
            className="absolute top-full left-0 z-50 mt-2 w-full rounded-lg border border-gray-300 bg-white shadow-lg sm:w-80"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightedIndex((current) => (current + 1) % totalMenuItems);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedIndex((current) => (current - 1 + totalMenuItems) % totalMenuItems);
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setHighlightedIndex(0);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setHighlightedIndex(totalMenuItems - 1);
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                executeMenuItem(highlightedIndex);
              }
            }}
          >
            <div className="p-2 border-b border-gray-200">
              <button
                ref={(element) => {
                  itemRefs.current[0] = element;
                }}
                type="button"
                role="menuitem"
                onMouseEnter={() => setHighlightedIndex(0)}
                onClick={openCreateCampaignModal}
                className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                  highlightedIndex === 0 ? "bg-blue-50 text-blue-700" : "text-blue-600 hover:bg-blue-50"
                }`}
              >
                + New Campaign
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {campaigns.length === 0 ? (
                <div className="space-y-3 p-4 text-center text-sm text-gray-500">
                  <p>No campaigns available</p>
                  <button
                    type="button"
                    onClick={openCreateCampaignModal}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Create Campaign
                  </button>
                </div>
              ) : (
                campaigns.map((campaign, index) => (
                  <button
                    key={campaign.id}
                    ref={(element) => {
                      itemRefs.current[index + 1] = element;
                    }}
                    role="menuitem"
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index + 1)}
                    onClick={() => handleSelectCampaign(campaign)}
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                      selectedCampaign?.id === campaign.id || highlightedIndex === index + 1 ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    {campaign.product_name && <div className="text-xs text-gray-500 mt-0.5">{campaign.product_name}</div>}
                    <div className="text-xs text-gray-400 mt-1">AOV: ${campaign.aov} • Commission: {(campaign.commission_rate * 100).toFixed(0)}%</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <CreateCampaignModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </>
  );
}
