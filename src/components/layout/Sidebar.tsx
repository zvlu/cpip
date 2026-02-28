import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/creators", label: "Creators", icon: "👥" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900 border-r border-zinc-800 p-4">
      <div className="text-xl font-bold mb-8 text-blue-400">⚡ CPIP</div>
      <nav className="space-y-2">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition">
            <span>{n.icon}</span><span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
