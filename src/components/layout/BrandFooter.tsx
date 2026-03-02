"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DEFAULT_APP_SETTINGS, loadAppSettings, SETTINGS_UPDATED_EVENT } from "@/lib/settings";

export function BrandFooter() {
  const [companyName, setCompanyName] = useState(DEFAULT_APP_SETTINGS.branding.companyName);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_APP_SETTINGS.branding.logoUrl);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const applyBranding = () => {
      const settings = loadAppSettings();
      setCompanyName(settings.branding.companyName);
      setLogoUrl(settings.branding.logoUrl);
    };

    applyBranding();
    window.addEventListener(SETTINGS_UPDATED_EVENT, applyBranding);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, applyBranding);
  }, []);

  return (
    <footer className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col items-start justify-between gap-3 text-sm text-gray-600 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Image
            src={logoUrl}
            alt={`${companyName} logo`}
            className="h-5 w-auto object-contain"
            width={96}
            height={20}
            unoptimized
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_APP_SETTINGS.branding.logoUrl;
            }}
          />
          <span className="font-medium text-gray-700">{companyName}</span>
        </div>
        <p>© {currentYear} {companyName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
