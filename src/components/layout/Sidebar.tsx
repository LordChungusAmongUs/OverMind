"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  TrendingUp,
  Youtube,
  Newspaper,
  Settings,
  Zap,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Briefing", icon: Newspaper },
  { href: "/restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/youtube", label: "YouTube", icon: Youtube },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-card/80 backdrop-blur-md border-r border-border/60 flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/60">
        <div className="relative w-8 h-8 flex-shrink-0">
          {/* Ping glow ring behind icon */}
          <span className="ping-slow absolute inset-0 rounded-lg bg-primary/30" />
          <div className="relative w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <Zap className="w-4 h-4 text-primary" />
          </div>
        </div>
        <span className="gradient-text font-black text-lg tracking-tight">
          Overmind
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/15 text-primary nav-active-glow border border-primary/20"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-all", active && "drop-shadow-[0_0_6px_rgba(139,92,246,0.8)]")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border/60">
        <p className="text-xs text-muted-foreground">@djthirstyboy</p>
        <p className="text-xs text-muted-foreground/50 mt-0.5">Powered by AI</p>
      </div>
    </aside>
  );
}
