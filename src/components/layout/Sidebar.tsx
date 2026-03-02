import Link from "next/link";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/creators", label: "Creators", icon: "👥" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
      <div className="mb-8">
        <div className="text-2xl font-bold text-gray-900">⚡ CPIP</div>
        <p className="text-xs text-gray-500 mt-1">Creator Performance Intelligence</p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-600 mb-2">CAMPAIGN</p>
        <CampaignSelector />
      </div>

      <nav className="space-y-1 flex-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <span className="text-lg">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <div className="pt-6 border-t border-gray-200 text-xs text-gray-500">
        <p>Demo Mode</p>
        <p className="mt-1">Sample data loaded</p>
      </div>
    </aside>
  );
}
