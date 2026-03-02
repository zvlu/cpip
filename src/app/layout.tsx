import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { CampaignProvider } from "@/lib/context/CampaignContext";

export const metadata: Metadata = {
  title: "CPIP - Creator Performance Intelligence",
  description: "Track TikTok creator performance and estimated revenue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-white">
        <CampaignProvider>
          <Sidebar />
          <main className="flex-1 p-8 ml-64">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </CampaignProvider>
      </body>
    </html>
  );
}
