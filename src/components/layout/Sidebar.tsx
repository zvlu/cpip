"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";
import { supabase } from "@/lib/supabase";
import { DEFAULT_APP_SETTINGS, loadAppSettings, resolveBrandCompanyName, SETTINGS_UPDATED_EVENT } from "@/lib/settings";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/creators", label: "Creators", icon: "👥" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState(DEFAULT_APP_SETTINGS.branding.companyName);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_APP_SETTINGS.branding.logoUrl);
  const { user, loading: authLoading } = useAuthUser();
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const applyBranding = () => {
      const settings = loadAppSettings();
      setCompanyName(resolveBrandCompanyName(settings.branding.companyName, user));
      setLogoUrl(settings.branding.logoUrl);
    };

    applyBranding();
    window.addEventListener(SETTINGS_UPDATED_EVENT, applyBranding);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, applyBranding);
    };
  }, [user]);

  const handleSignOut = async () => {
    if (!user) {
      setIsMobileOpen(false);
      router.push("/auth");
      return;
    }
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsMobileOpen(false);
    router.push("/");
    router.refresh();
    setIsSigningOut(false);
  };

  const handleNavigate = () => {
    setIsMobileOpen(false);
  };

  useEffect(() => {
    // Keep mobile nav state in sync with route changes.
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen || !asideRef.current) return;

    const container = asideRef.current;
    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
    focusable[0]?.focus();

    const onTrapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onTrapFocus);
    return () => {
      container.removeEventListener("keydown", onTrapFocus);
    };
  }, [isMobileOpen]);

  const isNavItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
            aria-label="Open navigation menu"
            aria-expanded={isMobileOpen}
            aria-controls="app-navigation"
          >
            Menu
          </button>
          <Link href="/" className="block w-28" onClick={handleNavigate}>
            <Image
              src={logoUrl}
              alt={`${companyName} logo`}
              className="h-auto w-full object-contain"
              width={180}
              height={64}
              unoptimized
              loading="eager"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_APP_SETTINGS.branding.logoUrl;
              }}
            />
          </Link>
          <div className="w-12" />
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        id="app-navigation"
        ref={asideRef}
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 max-w-[85vw] transform flex-col border-r border-gray-200 bg-white p-4 shadow-sm transition-transform duration-200 md:w-64 md:max-w-none md:translate-x-0 md:p-6 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between md:block">
          <Link href="/" className="block hover:opacity-80 transition-opacity" onClick={handleNavigate}>
            <div className="w-40 md:w-full">
              <Image
                src={logoUrl}
                alt={`${companyName} logo`}
                className="h-auto w-full object-contain"
                width={220}
                height={80}
                unoptimized
                loading="eager"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_APP_SETTINGS.branding.logoUrl;
                }}
              />
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            Close
          </button>
        </div>

        {/* Campaign Selector Section */}
        <div className="mb-6 border-b border-gray-200 pb-5 md:mb-8 md:pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Campaign</p>
          <CampaignSelector />
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={handleNavigate}
              className={`group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isNavItemActive(n.href)
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              aria-current={isNavItemActive(n.href) ? "page" : undefined}
            >
              <span className="text-lg transition-transform group-hover:scale-110">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer Section */}
        <div className="border-t border-gray-200 pt-6">
          {authLoading ? (
            <div className="mb-3 rounded-lg border border-gray-200 p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-36 animate-pulse rounded bg-gray-200" />
            </div>
          ) : user ? (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Signed In</p>
              <p className="mt-1 truncate text-sm font-medium text-green-900">{user.email || "Authenticated user"}</p>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800">Signed Out</p>
              <p className="mt-1 text-sm text-yellow-900">No active session detected.</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut || authLoading}
            className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition ${
              user
                ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            } ${isSigningOut || authLoading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {isSigningOut ? "Signing out..." : user ? "Sign out" : "Sign in"}
          </button>
        </div>
      </aside>
    </>
  );
}
