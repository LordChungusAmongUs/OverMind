import Sidebar from "@/components/layout/Sidebar";
import { Shirt, Star, ShoppingBag, Calendar, Clock, Palette } from "lucide-react";

const modules = [
  { icon: Shirt,       title: "Wardrobe Log",       description: "Catalog your clothes and build a digital closet",                          active: false },
  { icon: Palette,     title: "Outfit Builder",      description: "AI-generated outfit combinations from your wardrobe",                       active: false },
  { icon: Calendar,    title: "Outfit Calendar",     description: "Plan outfits for the week based on weather and events",                     active: false },
  { icon: ShoppingBag, title: "Shopping Picks",      description: "AI-curated recommendations to fill wardrobe gaps",                          active: false },
  { icon: Star,        title: "Style Profile",       description: "Define your aesthetic and get style-matched suggestions",                   active: false },
];

export default function StylistPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> stylist.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Personal Stylist</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            AI wardrobe management, outfit planning, and style coaching
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Wardrobe",   value: "—",  sub: "items logged"    },
            { label: "Outfits",    value: "—",  sub: "saved looks"     },
            { label: "Style",      value: "—",  sub: "profile set"     },
          ].map(({ label, value, sub }) => (
            <div key={label} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shirt className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-3xl font-black font-mono text-green-800">{value}</p>
              <p className="text-xs text-green-800 font-mono mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Today's pick placeholder */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <Star className="w-4 h-4 text-green-400" />
            <span className="text-xs font-mono font-bold text-green-400 uppercase tracking-wider">Today&apos;s Outfit</span>
          </div>
          <div className="p-8 text-center">
            <div className="relative w-14 h-14 mb-4 mx-auto">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-14 h-14 rounded-full bg-green-500/5 border border-green-500/30 flex items-center justify-center">
                <Shirt className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <h3 className="font-bold font-mono text-green-400 mb-2 glow-text">COMING SOON</h3>
            <p className="text-sm text-green-700 font-mono max-w-sm mx-auto">
              Build your wardrobe log to get daily AI outfit suggestions based on weather, events, and your style profile.
            </p>
          </div>
        </div>

        {/* Modules grid */}
        <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
          <span className="text-red-500">&gt;</span> modules
        </p>
        <div className="grid grid-cols-2 gap-3">
          {modules.map(({ icon: Icon, title, description }) => (
            <div key={title} className="holo-card rounded-xl border border-green-500/10 bg-black/20 p-4 opacity-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg border border-green-500/10 bg-black/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-green-800" />
                </div>
                <div>
                  <p className="font-bold font-mono text-sm text-green-800 mb-1">{title}</p>
                  <p className="text-xs text-green-900 font-mono">{description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-green-900 font-mono">
                    <Clock className="w-3 h-3" /> PLANNED
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
