import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import {
  Youtube, Music2, Facebook, Instagram, Radio,
  CheckCircle2, Clock, Users, Upload, Disc3,
} from "lucide-react";

const platforms = [
  {
    icon: Disc3,
    name: "Dehydration Nation",
    handle: "Label management · 7 artist channels",
    description: "Artist channels, prompt studio, album manager, fan engagement automation.",
    href: "/music/label",
    active: true,
    color: "cyan",
    stat: "record label",
  },
  {
    icon: Youtube,
    name: "YouTube",
    handle: "@djthirstyboy",
    description: "Full pipeline — AI lyrics, art, audio, auto-upload",
    href: "/music/youtube",
    active: true,
    color: "red",
    stat: "7 personas",
  },
  {
    icon: Radio,
    name: "SoundCloud",
    handle: "@djthirstyboy",
    description: "Audio-only distribution with auto-tagging",
    href: "/music/soundcloud",
    active: false,
    color: "orange",
    stat: "coming soon",
  },
  {
    icon: Facebook,
    name: "Facebook",
    handle: "DJ ThirstyBoy",
    description: "Reels and video post automation",
    href: "/music/facebook",
    active: false,
    color: "blue",
    stat: "coming soon",
  },
  {
    icon: Instagram,
    name: "Instagram",
    handle: "@djthirstyboy",
    description: "Reels, stories, and feed posts",
    href: "/music/instagram",
    active: false,
    color: "pink",
    stat: "coming soon",
  },
  {
    icon: Music2,
    name: "TikTok",
    handle: "@djthirstyboy",
    description: "Short-form video clips with auto-captions",
    href: "/music/tiktok",
    active: false,
    color: "cyan",
    stat: "coming soon",
  },
];

const colorMap: Record<string, { border: string; bg: string; icon: string; badge: string }> = {
  red:    { border: "border-red-500/30",    bg: "bg-red-500/5",    icon: "text-red-400",    badge: "border-red-500/30 bg-red-500/10 text-red-300"    },
  orange: { border: "border-orange-500/20", bg: "bg-black/40",     icon: "text-orange-600", badge: "border-orange-500/20 bg-orange-500/5 text-orange-800" },
  blue:   { border: "border-blue-500/20",   bg: "bg-black/40",     icon: "text-blue-700",   badge: "border-blue-500/20 bg-blue-500/5 text-blue-900"   },
  pink:   { border: "border-pink-500/20",   bg: "bg-black/40",     icon: "text-pink-700",   badge: "border-pink-500/20 bg-pink-500/5 text-pink-900"   },
  cyan:   { border: "border-cyan-500/20",   bg: "bg-black/40",     icon: "text-cyan-700",   badge: "border-cyan-500/20 bg-cyan-500/5 text-cyan-900"   },
};

export default function MusicPage() {
  const activePlatforms = platforms.filter(p => p.active).length;

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> music_hub.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Music</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            AI record label — multi-platform distribution · 7 personas
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Artists</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">7</p>
            <p className="text-xs text-green-700 font-mono mt-1">AI personas loaded</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Platforms</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">{activePlatforms}<span className="text-green-800 text-lg">/{platforms.length}</span></p>
            <p className="text-xs text-green-700 font-mono mt-1">live · {platforms.length - activePlatforms} planned</p>
          </div>
          <div className="holo-card rounded-xl border border-red-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative w-4 h-4 flex-shrink-0">
                <span className="ping-slow absolute inset-0 rounded-full bg-red-500/30" />
                <Upload className="relative w-4 h-4 text-red-400" />
              </div>
              <span className="text-xs font-mono font-semibold text-red-500 uppercase tracking-wider">Pipeline</span>
            </div>
            <p className="text-lg font-black font-mono text-green-300 glow-text">ACTIVE</p>
            <p className="text-xs text-green-700 font-mono mt-1">YouTube auto-upload live</p>
          </div>
        </div>

        {/* Platform grid */}
        <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
          <span className="text-red-500">&gt;</span> platforms
        </p>
        <div className="space-y-3">
          {platforms.map(({ icon: Icon, name, handle, description, href, active, color, stat }) => {
            const c = colorMap[color];
            const card = (
              <div className={`holo-card rounded-xl border p-5 transition-all ${
                active
                  ? `${c.border} ${c.bg} hover:border-opacity-60`
                  : "border-green-500/10 bg-black/20 opacity-50"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                    active ? `${c.border} ${c.bg}` : "border-green-500/10 bg-black/20"
                  }`}>
                    {active ? (
                      <div className="relative">
                        <span className="ping-slow absolute inset-0 rounded-full bg-current opacity-20" />
                        <Icon className={`relative w-6 h-6 ${c.icon}`} />
                      </div>
                    ) : (
                      <Icon className={`w-6 h-6 ${c.icon}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`font-bold font-mono ${active ? "text-green-300" : "text-green-800"}`}>{name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${c.badge}`}>{stat}</span>
                      {active && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 font-mono ml-auto">
                          <CheckCircle2 className="w-3 h-3" /> LIVE
                        </span>
                      )}
                      {!active && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-500/10 bg-black/20 text-green-900 font-mono ml-auto">
                          <Clock className="w-3 h-3" /> PLANNED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-green-700 font-mono">{handle}</p>
                    <p className="text-xs text-green-800 font-mono mt-1">{description}</p>
                  </div>
                  {active && (
                    <span className="text-red-500 font-mono font-bold text-lg flex-shrink-0">›</span>
                  )}
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
