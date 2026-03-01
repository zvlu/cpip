"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

const AUTH_ROUTES = ["/login", "/sign-up"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 ml-64">{children}</main>
    </div>
  );
}
