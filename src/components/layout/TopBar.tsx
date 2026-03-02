"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCampaign } from "@/lib/context/CampaignContext";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { DEFAULT_APP_SETTINGS, loadAppSettings, resolveBrandCompanyName, SETTINGS_UPDATED_EVENT } from "@/lib/settings";
import { apiFetch } from "@/lib/api/client";

type NavItem = {
  href: string;
  label: string;
  description: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [companyName, setCompanyName] = useState(DEFAULT_APP_SETTINGS.branding.companyName);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_APP_SETTINGS.branding.logoUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuthUser();
  const demoMode = useDemoMode();

  const currentPage = NAV_ITEMS.find((item) => item.href === pathname)?.label || "Overview";

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    const applyBranding = () => {
      const settings = loadAppSettings();
      setCompanyName(resolveBrandCompanyName(settings.branding.companyName, user));
      setLogoUrl(settings.branding.logoUrl);
    };

    applyBranding();
    window.addEventListener(SETTINGS_UPDATED_EVENT, applyBranding);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, applyBranding);
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setIsOpen(false);
    router.push(href);
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      {demoMode.enabled && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Demo data mode is ON. Changes are blocked until you switch back to real data.
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/" className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 hover:bg-gray-100">
            <Image
              src={logoUrl}
              alt={`${companyName} logo`}
              className="h-6 w-auto object-contain"
              width={120}
              height={24}
              unoptimized
              loading="eager"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_APP_SETTINGS.branding.logoUrl;
              }}
            />
            <span className="text-xs font-semibold tracking-wide text-gray-600">{companyName}</span>
          </Link>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Workspace</p>
          <h2 className="text-lg font-semibold text-gray-900">{currentPage}</h2>
          {selectedCampaign && (
            <p className="mt-1 text-sm text-gray-600">
              Campaign: <span className="font-medium text-gray-800">{selectedCampaign.name}</span>
            </p>
          )}
        </div>

        <div className="relative w-full lg:max-w-xl" ref={searchContainerRef}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Search pages (Ctrl/Cmd+K)"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {isOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
              {filteredItems.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No pages match your search.</p>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => navigateTo(item.href)}
                    className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                  >
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={demoMode.loading || demoMode.updating}
            onClick={() => demoMode.updateDemoMode(!demoMode.enabled)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              demoMode.enabled ? "border-amber-300 bg-amber-100 text-amber-900" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
            title="Toggle demo data mode"
          >
            {demoMode.enabled ? "Demo: On" : "Demo: Off"}
          </button>

          <div className="hidden items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm lg:inline-flex">
            {authLoading ? (
              <span className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            ) : user ? (
              <>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="max-w-[180px] truncate text-gray-700">{user.email || "Signed in"}</span>
              </>
            ) : (
              <>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-gray-700">Signed out</span>
              </>
            )}
          </div>

          {pathname !== "/creators" && (
            <Link href="/creators" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Creator
            </Link>
          )}
          <Link href="/alerts" className="relative rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Alerts
            {unreadAlerts > 0 && (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                {unreadAlerts}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
