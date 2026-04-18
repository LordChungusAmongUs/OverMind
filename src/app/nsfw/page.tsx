import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { Facebook, Instagram, DollarSign, MessageSquare, CheckCircle2, Clock, Camera, Twitter, Music2 } from "lucide-react";

const platforms = [
  {
    icon: DollarSign,
    name: "OnlyFans",
    handle: "djthirstyboy",
    description: "Post scheduling, DM workflows, PPV automation",
    href: "/nsfw/onlyfans",
    active: false,
    color: "blue",
    priority: true,
  },
  {
    icon: Facebook,
    name: "Facebook",
    handle: "DJ ThirstyBoy",
    description: "Adult group and page content automation",
    href: "/nsfw/facebook",
    active: false,
    color: "indigo",
    priority: false,
  },
  {
    icon: Camera,
    name: "Snapchat",
    handle: "@djthirstyboy",
    description: "Story and spotlight automation",
    href: "/nsfw/snapchat",
    active: false,
    color: "yellow",
    priority: false,
  },
  {
    icon: Music2,
    name: "TikTok",
    handle: "@djthirstyboy",
    description: "Short-form adult content and duets",
    href: "/nsfw/tiktok",
    active: false,
    color: "cyan",
    priority: false,
  },
  {
    icon: Instagram,
    name: "Instagram",
    handle: "@djthirstyboy",
    description: "Reels, stories, and close friends list",
    href: "/nsfw/instagram",
    active: false,
    color: "pink",
    priority: false,
  },
  {
    icon: Twitter,
    name: "X",
    handle: "@djthirstyboy",
    description: "Post scheduling and engagement automation",
    href: "/nsfw/x",
    active: false,
    color: "slate",
    priority: false,
  },
  {
    icon: MessageSquare,
    name: "Reddit",
    handle: "u/djthirstyboy",
    description: "Subreddit posting and cross-posting automation",
    href: "/nsfw/reddit",
    active: false,
    color: "orange",
    priority: false,
  },
];

const colorMap: Record<string, { border: string; bg: string; icon: string; ring: string }> = {
  blue:   { border: "border-blue-400/30",   bg: "bg-blue-400/5",   icon: "text-blue-400",   ring: "bg-blue-400/20"   },
  indigo: { border: "border-indigo-500/20", bg: "bg-black/40",     icon: "text-indigo-600", ring: "bg-indigo-500/20" },
  yellow: { border: "border-yellow-400/20", bg: "bg-black/40",     icon: "text-yellow-600", ring: "bg-yellow-400/20" },
  cyan:   { border: "border-cyan-500/20",   bg: "bg-black/40",     icon: "text-cyan-600",   ring: "bg-cyan-500/20"   },
  pink:   { border: "border-pink-500/20",   bg: "bg-black/40",     icon: "text-pink-600",   ring: "bg-pink-500/20"   },
  slate:  { border: "border-slate-400/20",  bg: "bg-black/40",     icon: "text-slate-400",  ring: "bg-slate-400/20"  },
  orange: { border: "border-orange-500/20", bg: "bg-black/40",     icon: "text-orange-600", ring: "bg-orange-500/20" },
};

export default function NSFWPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> nsfw_hub.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">NSFW</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Adult content automation — multi-platform distribution
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider mb-2">Platforms</p>
            <p className="text-3xl font-black font-mono text-green-300">0<span className="text-green-800 text-lg">/{platforms.length}</span></p>
            <p className="text-xs text-green-700 font-mono mt-1">{platforms.length} planned</p>
          </div>
          <div className="holo-card rounded-xl border border-blue-400/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-mono font-semibold text-blue-500 uppercase tracking-wider">Priority</p>
            </div>
            <p className="text-lg font-black font-mono text-green-300">OnlyFans</p>
            <p className="text-xs text-green-700 font-mono mt-1">highest revenue potential</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider mb-2">Revenue</p>
            <p className="text-lg font-black font-mono text-green-800 glow-text">AWAITING</p>
            <p className="text-xs text-green-800 font-mono mt-1">connect platforms to track</p>
          </div>
        </div>

        {/* Platform list */}
        <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
          <span className="text-red-500">&gt;</span> platforms
        </p>
        <div className="space-y-3">
          {platforms.map(({ icon: Icon, name, handle, description, href, active, color, priority }) => {
            const c = colorMap[color];
            const card = (
              <div className={`holo-card rounded-xl border p-5 transition-all ${
                active ? `${c.border} ${c.bg}` : priority ? `${c.border} ${c.bg}` : "border-green-500/10 bg-black/20 opacity-60"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${c.border} ${c.bg}`}>
                    {priority ? (
                      <div className="relative">
                        <span className="ping-slow absolute inset-0 rounded-full opacity-30" style={{ background: "currentColor" }} />
                        <Icon className={`relative w-6 h-6 ${c.icon}`} />
                      </div>
                    ) : (
                      <Icon className={`w-6 h-6 ${c.icon}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className={`font-bold font-mono ${priority ? "text-green-300" : "text-green-800"}`}>{name}</p>
                      {priority && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono border border-blue-400/30 bg-blue-400/10 text-blue-300">PRIORITY</span>
                      )}
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-500/10 bg-black/20 text-green-900 font-mono ml-auto">
                        <Clock className="w-3 h-3" /> PLANNED
                      </span>
                    </div>
                    <p className="text-xs text-green-700 font-mono">{handle}</p>
                    <p className="text-xs text-green-800 font-mono mt-1">{description}</p>
                  </div>
                </div>
              </div>
            );
            return active
              ? <Link key={name} href={href}>{card}</Link>
              : <div key={name}>{card}</div>;
          })}
        </div>

      </main>
    </div>
  );
}
