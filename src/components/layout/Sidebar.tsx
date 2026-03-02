import Link from "next/link";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/creators", label: "Creators", icon: "👥" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm">
      {/* Logo Section */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="text-2xl font-bold text-blue-600">⚡</div>
          <div className="text-xl font-bold text-gray-900">CPIP</div>
        </div>
        <p className="text-xs text-gray-500 font-medium">Creator Performance Intelligence</p>
      </div>

      {/* Campaign Selector Section */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Campaign</p>
        <CampaignSelector />
      </div>

      {/* Navigation Section */}
      <nav className="space-y-1 flex-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium text-sm group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer Section */}
      <div className="pt-6 border-t border-gray-200">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-900 mb-1">Demo Mode</p>
          <p className="text-xs text-blue-700">Sample data loaded</p>
        </div>
      </div>
    </aside>
  );
}
