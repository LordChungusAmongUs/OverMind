"use client";

import { Crown, Landmark, Skull } from "lucide-react";
import { MARKETS, MARKET_MARGIN, REG_TAX_MAX } from "@/lib/solarwar/data";
import { fmt } from "@/lib/solarwar/engine";
import { standings } from "@/lib/solarwar/world";
import { useGame } from "@/lib/solarwar/store";
import type { RivalPersonality } from "@/lib/solarwar/types";

const PERSONA: Record<RivalPersonality, string> = {
  industrialist: "Industrialist",
  researcher: "Researcher",
  militarist: "Militarist",
  influencer: "Influencer",
};

export default function MarketsPanel() {
  const s = useGame();
  const board = standings(s);
  const maxPower = Math.max(...board.map((r) => r.power), 1);
  const taxRate = REG_TAX_MAX * (s.regulation / 100) * 100;
  const canLobby = s.resources.influence >= 150 && s.resources.capital >= 3000;

  return (
    <div className="space-y-6">
      {/* Standings */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2 inline-flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-yellow-300" /> Solar Standings
        </h3>
        <div className="rounded-xl border border-green-500/20 bg-black/40 overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_0.6fr_0.8fr_0.8fr] gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-green-700 border-b border-green-500/10">
            <span>Corporation</span>
            <span className="text-right">Valuation</span>
            <span className="text-right">Tech</span>
            <span className="text-right">Influence</span>
            <span className="text-right">Military</span>
          </div>
          {board.map((row, i) => (
            <div
              key={row.id}
              className={`grid grid-cols-[1.6fr_1fr_0.6fr_0.8fr_0.8fr] gap-2 px-3 py-2 items-center border-b border-green-500/5 last:border-0 ${
                row.isPlayer ? "bg-green-500/10" : ""
              } ${row.defeated ? "opacity-40" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-green-700 w-4">#{i + 1}</span>
                  <span
                    className={`text-sm font-semibold truncate ${
                      row.isPlayer ? "text-green-300" : "text-green-200"
                    }`}
                  >
                    {row.name}
                  </span>
                  {row.defeated && <Skull className="w-3 h-3 text-red-500 flex-shrink-0" />}
                </div>
                <div className="h-1 mt-1 rounded-full bg-black/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.isPlayer ? "bg-green-400" : "bg-green-700"}`}
                    style={{ width: `${(row.power / maxPower) * 100}%` }}
                  />
                </div>
                {row.personality && (
                  <span className="text-[10px] font-mono text-green-800">{PERSONA[row.personality]}</span>
                )}
              </div>
              <span className="text-right font-mono text-sm text-green-400">{fmt(row.metrics.economy)}</span>
              <span className="text-right font-mono text-sm text-cyan-400">{Math.floor(row.metrics.tech)}</span>
              <span className="text-right font-mono text-sm text-rose-400">{fmt(row.metrics.influence)}</span>
              <span className="text-right font-mono text-sm text-orange-400">{fmt(row.metrics.military)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Markets */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2">
          Markets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MARKETS.map((m) => {
            const share = s.marketShare[m.id];
            const size = s.marketSize[m.id];
            const revenue = size * share * MARKET_MARGIN;
            return (
              <div key={m.id} className="holo-card rounded-lg border border-green-500/20 bg-black/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-200">{m.name}</span>
                  <span className="text-sm font-mono font-black text-green-300">
                    {(share * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 my-2 rounded-full bg-black/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-400"
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{m.description}</p>
                <p className="text-[11px] font-mono text-green-600 mt-1">
                  share revenue +{fmt(revenue)}/s · market {fmt(size)}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] font-mono text-green-800 mt-2">
          Build market divisions (Consumer / Enterprise / Government) and grow influence to win share from rivals.
        </p>
      </section>

      {/* Government */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2 inline-flex items-center gap-2">
          <Landmark className="w-3.5 h-3.5 text-green-400" /> Earth Government
        </h3>
        <div className="rounded-lg border border-green-500/20 bg-black/40 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-green-700">
              Regulatory pressure
            </span>
            <span
              className={`text-sm font-mono font-black ${
                s.regulation > 60 ? "text-red-400" : s.regulation > 30 ? "text-yellow-300" : "text-green-400"
              }`}
            >
              {Math.round(s.regulation)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${
                s.regulation > 60 ? "bg-red-500" : s.regulation > 30 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${s.regulation}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mb-3">
            Taxing {taxRate.toFixed(0)}% of your capital income. Rises with your size and military;
            Government Affairs Offices and lobbying push it back down.
          </p>
          <button
            onClick={() => s.lobby()}
            disabled={!canLobby}
            className={`w-full rounded-md px-3 py-2 text-xs font-mono font-semibold border transition-colors ${
              canLobby
                ? "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
            }`}
          >
            Lobby Government <span className="text-green-600">(−12% reg · 150 INF · 3.0K CAP)</span>
          </button>
        </div>
      </section>
    </div>
  );
}
