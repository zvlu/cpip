import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BrandFooter } from "@/components/layout/BrandFooter";
import { CampaignProvider } from "@/lib/context/CampaignContext";

export const metadata: Metadata = {
  title: "CreatorPulse - Creator Performance Intelligence",
  description: "Track TikTok creator performance and estimated revenue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <CampaignProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 md:ml-64">
              <div className="max-w-7xl mx-auto">
                <TopBar />
                {children}
                <BrandFooter />
              </div>
            </main>
          </div>
        </CampaignProvider>
      </body>
    </html>
  );
}
