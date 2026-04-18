import Sidebar from "@/components/layout/Sidebar";
import WeatherStrip from "@/components/weather/WeatherStrip";
import { TrendingUp, UtensilsCrossed, Youtube, AlertCircle } from "lucide-react";

export default function BriefingPage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase">{dateStr}</p>
          <h1 className="text-3xl font-black mt-2 font-mono">
            {greeting},{" "}
            <span className="gradient-text">DJ Thirsty</span>
          </h1>
          <p className="text-green-600 text-sm mt-1 font-mono">
            <span className="text-red-500">&gt;</span> King&apos;s BBQ, Burgers, &amp; More · Archdale, NC
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Restaurant", icon: UtensilsCrossed, status: "OFFLINE" },
            { label: "Markets",    icon: TrendingUp,      status: "OFFLINE" },
            { label: "YouTube",    icon: Youtube,         status: "OFFLINE" },
            { label: "Alerts",     icon: AlertCircle,     status: "NONE"    },
          ].map(({ label, icon: Icon, status }) => (
            <div key={label} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/5 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-700 font-mono uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold font-mono text-red-500/70">{status}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Weather */}
        <WeatherStrip />

        {/* Briefing placeholder */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="relative w-14 h-14 mb-5">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-14 h-14 rounded-full bg-green-500/5 border border-green-500/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <h3 className="font-bold font-mono text-green-400 mb-2 glow-text">AWAITING DATA FEED</h3>
            <p className="text-sm text-green-700 font-mono max-w-sm">
              Connect restaurant, markets, and YouTube modules to initialize daily briefing.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
