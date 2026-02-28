import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "CPIP - Creator Performance Intelligence",
  description: "Track TikTok creator performance and estimated revenue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 ml-64">{children}</main>
      </body>
    </html>
  );
}
