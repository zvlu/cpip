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
    <footer className="mt-8 py-4">
      <div className="surface-panel flex flex-col items-center justify-center gap-2 px-4 py-4 text-center text-sm text-gray-600">
        <div className="flex items-center justify-center gap-2">
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
