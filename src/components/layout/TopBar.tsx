"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCampaign } from "@/lib/context/CampaignContext";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { apiFetch } from "@/lib/api/client";
import { CreateCampaignModal } from "@/components/campaigns/CreateCampaignModal";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

type CommandItem = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  href?: string;
  action?: "open_create_campaign";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "KPIs, scores, and revenue overview" },
  { href: "/creators", label: "Creators", description: "Manage and analyze creator performance" },
  { href: "/alerts", label: "Alerts", description: "Track critical notifications and events" },
  { href: "/settings", label: "Settings", description: "Branding, notifications, and defaults" },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCampaign } = useCampaign();
  const [query, setQuery] = useState("");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const commandListId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const commandButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { user, loading: authLoading } = useAuthUser();
  const demoMode = useDemoMode();

  const currentPage = NAV_ITEMS.find((item) => item.href === pathname)?.label || "Overview";

  const commandItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: CommandItem[] = [
      ...NAV_ITEMS.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        description: item.description,
        keywords: `${item.label} ${item.description}`,
        href: item.href,
      })),
      {
        id: "action-create-campaign",
        label: "Create Campaign",
        description: "Open campaign setup",
        keywords: "campaign create new setup",
        action: "open_create_campaign",
      },
      {
        id: "action-add-creator",
        label: "Add Creator",
        description: "Open creators page to add someone",
        keywords: "creator add new onboard",
        href: "/creators",
      },
    ];

    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!isPaletteOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsPaletteOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPaletteOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPaletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isPaletteOpen || commandItems.length === 0) return;
    setActiveCommandIndex((current) => Math.min(current, commandItems.length - 1));
  }, [commandItems, isPaletteOpen]);

  useEffect(() => {
    if (!isPaletteOpen || commandItems.length === 0) return;
    commandButtonRefs.current[activeCommandIndex]?.focus();
  }, [activeCommandIndex, commandItems.length, isPaletteOpen]);

  useEffect(() => {
    let isMounted = true;
    const fetchUnreadAlerts = async () => {
      try {
        const res = await apiFetch("/api/alerts");
        if (!res.ok) return;
        const json = await res.json();
        if (!isMounted) return;
        const unread = (json.data || []).filter((a: any) => !a.read).length;
        setUnreadAlerts(unread);
      } catch {
        // Best-effort UI enhancement; no-op on failures.
      }
    };

    fetchUnreadAlerts();
    const timer = setInterval(fetchUnreadAlerts, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const navigateTo = (href: string) => {
    setQuery("");
    setIsPaletteOpen(false);
    router.push(href);
  };

  const executeCommand = (command: CommandItem) => {
    if (command.action === "open_create_campaign") {
      setQuery("");
      setIsPaletteOpen(false);
      setIsCreateCampaignOpen(true);
      return;
    }

    if (command.href) {
      navigateTo(command.href);
    }
  };

  const handlePaletteInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isPaletteOpen) {
        setIsPaletteOpen(true);
        setActiveCommandIndex(0);
        return;
      }
      setActiveCommandIndex((current) => (commandItems.length ? (current + 1) % commandItems.length : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isPaletteOpen) {
        setIsPaletteOpen(true);
        setActiveCommandIndex(0);
        return;
      }
      setActiveCommandIndex((current) =>
        commandItems.length ? (current - 1 + commandItems.length) % commandItems.length : 0
      );
      return;
    }

    if (event.key === "Enter" && isPaletteOpen) {
      event.preventDefault();
      const command = commandItems[activeCommandIndex];
      if (command) executeCommand(command);
      return;
    }

    if (event.key === "Escape") {
      setIsPaletteOpen(false);
    }
  };

  return (
    <div className="surface-panel mb-5 p-3 sm:p-4">
      {demoMode.enabled && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Demo data mode is ON. Changes are blocked until you switch back to real data.
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Workspace</p>
          <h2 className="text-lg font-semibold text-gray-900">{currentPage}</h2>
          {selectedCampaign && (
            <p className="mt-1 text-sm text-gray-600">
              Campaign: <span className="font-medium text-gray-800">{selectedCampaign.name}</span>
            </p>
          )}
        </div>

        <div className="relative min-w-0 w-full lg:max-w-xl lg:flex-1" ref={searchContainerRef}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsPaletteOpen(true)}
            onKeyDown={handlePaletteInputKeyDown}
            placeholder="Search actions and pages (Ctrl/Cmd+K)"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            role="combobox"
            aria-expanded={isPaletteOpen}
            aria-controls={commandListId}
            aria-activedescendant={
              isPaletteOpen && commandItems[activeCommandIndex] ? `${commandListId}-item-${activeCommandIndex}` : undefined
            }
          />
          {isPaletteOpen && (
            <div id={commandListId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
              {commandItems.length === 0 ? (
                <div className="space-y-2 px-4 py-3">
                  <p className="text-sm text-gray-500">No command matches your search.</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                commandItems.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(element) => {
                      commandButtonRefs.current[index] = element;
                    }}
                    id={`${commandListId}-item-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeCommandIndex === index}
                    onClick={() => executeCommand(item)}
                    onMouseEnter={() => setActiveCommandIndex(index)}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 ${
                      activeCommandIndex === index ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
          <button
            type="button"
            disabled={demoMode.loading || demoMode.updating}
            onClick={() => demoMode.updateDemoMode(!demoMode.enabled)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
              demoMode.enabled ? "border-amber-300 bg-amber-100 text-amber-900" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
            title="Toggle demo data mode"
          >
            {demoMode.enabled ? "Demo: On" : "Demo: Off"}
          </button>

          <div className="hidden min-w-0 max-w-full items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm sm:inline-flex lg:max-w-[280px]">
            {authLoading ? (
              <span className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            ) : user ? (
              <>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="max-w-full whitespace-normal break-all text-gray-700">{user.email || "Signed in"}</span>
              </>
            ) : (
              <>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-gray-700">Signed out</span>
              </>
            )}
          </div>

          {pathname !== "/creators" && (
            <Link href="/creators" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:bg-blue-700">
              + Creator
            </Link>
          )}
          <Link href="/alerts" className="relative rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:-translate-y-px hover:bg-gray-50">
            Alerts
            {unreadAlerts > 0 && (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                {unreadAlerts}
              </span>
            )}
          </Link>
        </div>
      </div>
      <CreateCampaignModal isOpen={isCreateCampaignOpen} onClose={() => setIsCreateCampaignOpen(false)} />
    </div>
  );
}
