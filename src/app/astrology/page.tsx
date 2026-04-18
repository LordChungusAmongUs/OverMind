import Sidebar from "@/components/layout/Sidebar";
import { Star, Moon, Sun, Compass, Clock } from "lucide-react";

const signs = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const planets = [
  { name: "Sun",     sign: "—", house: "—" },
  { name: "Moon",    sign: "—", house: "—" },
  { name: "Rising",  sign: "—", house: "—" },
  { name: "Mercury", sign: "—", house: "—" },
  { name: "Venus",   sign: "—", house: "—" },
  { name: "Mars",    sign: "—", house: "—" },
];

export default function AstrologyPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> astrology.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Astrology</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Personal birth chart, daily transits, and AI readings
          </p>
        </div>

        {/* Birth chart placeholder */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: Sun,     label: "Sun Sign",   value: "—",  sub: "core identity" },
            { icon: Moon,    label: "Moon Sign",  value: "—",  sub: "emotions" },
            { icon: Compass, label: "Rising",     value: "—",  sub: "outer mask" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-3xl font-black font-mono text-green-800">{value}</p>
              <p className="text-xs text-green-800 font-mono mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Planet positions */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <Star className="w-4 h-4 text-green-400" />
            <span className="text-xs font-mono font-bold text-green-400 uppercase tracking-wider">Planetary Placements</span>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {planets.map(({ name, sign, house }) => (
              <div key={name} className="flex items-center justify-between p-3 rounded-lg border border-green-500/15 bg-black/40">
                <span className="text-xs font-mono text-green-700">{name}</span>
                <span className="text-xs font-mono text-green-800">{sign} · House {house}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily reading placeholder */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
          <div className="p-10 text-center">
            <div className="relative w-14 h-14 mb-5 mx-auto">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-14 h-14 rounded-full bg-green-500/5 border border-green-500/30 flex items-center justify-center">
                <Star className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <h3 className="font-bold font-mono text-green-400 mb-2 glow-text">COMING SOON</h3>
            <p className="text-sm text-green-700 font-mono max-w-sm mx-auto">
              Enter your birth date, time, and location to generate your full natal chart and daily AI transit readings.
            </p>
            <div className="mt-6 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-green-800" />
              <span className="text-xs text-green-900 font-mono">Requires birth data setup</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
