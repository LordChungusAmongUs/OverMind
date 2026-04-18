"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  TrendingUp,
  Music2,
  Newspaper,
  Settings,
  Zap,
  Map,
  Lock,
  Activity,
  Star,
  Shirt,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/",           label: "Briefing",   icon: Newspaper,       exact: true  },
  { href: "/restaurant", label: "Restaurant", icon: UtensilsCrossed, exact: false },
  { href: "/markets",    label: "Markets",    icon: TrendingUp,      exact: false },
  { href: "/music",      label: "Music",      icon: Music2,          exact: false },
  { href: "/nsfw",       label: "NSFW",       icon: Lock,            exact: false },
  { href: "/health",     label: "Health",     icon: Activity,        exact: false },
  { href: "/astrology",  label: "Astrology",  icon: Star,            exact: false },
  { href: "/stylist",    label: "Stylist",    icon: Shirt,           exact: false },
  { href: "/budget",     label: "Budget",     icon: Wallet,          exact: false },
  { href: "/planner",    label: "Planner",    icon: CalendarDays,    exact: false },
  { href: "/roadmap",    label: "Roadmap",    icon: Map,             exact: false },
  { href: "/settings",   label: "Settings",   icon: Settings,        exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-black/60 backdrop-blur-md border-r border-green-500/20 flex flex-col z-50">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-green-500/20">
        <div className="relative w-8 h-8 flex-shrink-0">
          <span className="ping-slow absolute inset-0 rounded-lg bg-green-500/30" />
          <div className="relative w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-green-400" />
          </div>
        </div>
        <span className="gradient-text font-black text-lg tracking-tight">
          Overmind
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border",
                active
                  ? "bg-green-500/10 text-green-400 border-green-500/30 nav-active-glow"
                  : "text-green-500/60 hover:bg-green-500/5 hover:text-green-300 border-transparent"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 transition-all flex-shrink-0",
                active
                  ? "text-green-400 drop-shadow-[0_0_6px_rgba(0,255,65,0.8)]"
                  : "text-green-600"
              )} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-green-500/20">
        <p className="text-xs text-green-600">@djthirstyboy</p>
        <p className="text-xs text-green-900 mt-0.5">Powered by AI</p>
      </div>

    </aside>
  );
}
