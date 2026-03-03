import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BrandFooter } from "@/components/layout/BrandFooter";
import { CampaignProvider } from "@/lib/context/CampaignContext";

export const metadata: Metadata = {
  title: "CreatorPulse - Creator Performance Intelligence",
  description: "Track TikTok creator performance and estimated revenue",
  icons: {
    icon: "/app-logo-clean.png",
    shortcut: "/app-logo-clean.png",
    apple: "/app-logo-clean.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <CampaignProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="relative flex min-h-screen flex-1 flex-col p-4 sm:p-6 lg:p-8 md:ml-64">
              <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-blue-100/40 to-transparent" />
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
                <TopBar />
                <div className="flex-1">
                  {children}
                </div>
                <BrandFooter />
              </div>
            </main>
          </div>
        </CampaignProvider>
      </body>
    </html>
  );
}
