"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Crown,
  FlaskConical,
  Radio,
  RotateCcw,
  Swords,
  Trophy,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { STAGES, TECHS, TICK_MS } from "@/lib/solarwar/data";
import { computeRates, currentStage, stageById } from "@/lib/solarwar/engine";
import { useGame } from "@/lib/solarwar/store";
import ResourceBar from "./_components/ResourceBar";
import BuildingsPanel from "./_components/BuildingsPanel";
import ResearchPanel from "./_components/ResearchPanel";
import MarketsPanel from "./_components/MarketsPanel";
import MilitaryPanel from "./_components/MilitaryPanel";
import EventsFeed from "./_components/EventsFeed";

type Tab = "ops" | "research" | "markets" | "military" | "intel";

const TABS = [
  { id: "ops", label: "Operations", icon: Building2 },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "markets", label: "Markets", icon: Crown },
  { id: "military", label: "Military", icon: Swords },
  { id: "intel", label: "Intel", icon: Radio },
] as const;

const EVENT_TICKER_COLOR: Record<string, string> = {
  info: "text-green-500",
  good: "text-green-300",
  bad: "text-red-400",
  war: "text-orange-400",
  tech: "text-cyan-400",
  market: "text-violet-400",
};

export default function SolarWarPage() {
  const resources = useGame((s) => s.resources);
  const buildings = useGame((s) => s.buildings);
  const researched = useGame((s) => s.researched);
  const fleet = useGame((s) => s.fleet);
  const marketShare = useGame((s) => s.marketShare);
  const marketSize = useGame((s) => s.marketSize);
  const regulation = useGame((s) => s.regulation);
  const gameOver = useGame((s) => s.gameOver);
  const latest = useGame((s) => s.events[0]);
  const build = useGame((s) => s.build);
  const research = useGame((s) => s.research);
  const reset = useGame((s) => s.reset);

  const [tab, setTab] = useState<Tab>("ops");

  useEffect(() => {
    useGame.getState().load();
    const tickIv = setInterval(() => useGame.getState().tick(TICK_MS / 1000), TICK_MS);
    const saveIv = setInterval(() => useGame.getState().save(), 5000);
    const persist = () => useGame.getState().save();
    window.addEventListener("beforeunload", persist);
    return () => {
      clearInterval(tickIv);
      clearInterval(saveIv);
      window.removeEventListener("beforeunload", persist);
      persist();
    };
  }, []);

  const rates = useMemo(
    () => computeRates({ buildings, researched, fleet, marketShare, marketSize, regulation }),
    [buildings, researched, fleet, marketShare, marketSize, regulation]
  );
  const stageNum = currentStage({ resources, buildings, researched });
  const stage = stageById(stageNum);

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-5">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> solar_war_2040.exe
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black font-mono gradient-text">Solar War 2040</h1>
              <p className="text-green-700 text-sm font-mono mt-1">
                Build an AI corporation into an interplanetary superpower.
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm("Reset Solar War? All progress will be lost.")) reset();
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-red-400/70 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-md px-2.5 py-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Corporate stage */}
        <div className="rounded-xl border border-green-500/20 bg-black/40 p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-green-700">
                <span className="text-red-500">&gt;</span> Corporate Stage {stageNum}/{STAGES.length}
              </p>
              <p className="text-lg font-black font-mono text-green-300">{stage.name}</p>
              <p className="text-xs text-muted-foreground">{stage.blurb}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {STAGES.map((st) => (
              <div
                key={st.id}
                title={st.name}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  st.id <= stageNum ? "bg-green-400 shadow-[0_0_6px_rgba(0,255,65,0.5)]" : "bg-green-900/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="mb-3">
          <ResourceBar resources={resources} rates={rates} />
          {rates.powerRatio < 1 && (
            <p className="text-[11px] font-mono text-red-400/90 mt-2">
              ⚠ Power deficit — production throttled to {Math.round(rates.powerRatio * 100)}%. Build
              more energy capacity.
            </p>
          )}
        </div>

        {/* Intel ticker */}
        {latest && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-green-500/15 bg-black/40 px-3 py-1.5 text-[11px] font-mono">
            <span className="text-green-700 uppercase tracking-wider">intel</span>
            <span className={EVENT_TICKER_COLOR[latest.kind] ?? "text-green-500"}>{latest.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-semibold border transition-colors ${
                tab === id
                  ? "border-green-500/40 bg-green-500/10 text-green-300 nav-active-glow"
                  : "border-transparent text-green-600 hover:text-green-300 hover:bg-green-500/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "research" && (
                <span className="text-[10px] text-green-700">
                  {researched.length}/{Object.keys(TECHS).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Panels */}
        {tab === "ops" && (
          <BuildingsPanel
            resources={resources}
            buildings={buildings}
            researched={researched}
            onBuild={build}
          />
        )}
        {tab === "research" && (
          <ResearchPanel resources={resources} researched={researched} onResearch={research} />
        )}
        {tab === "markets" && <MarketsPanel />}
        {tab === "military" && <MilitaryPanel />}
        {tab === "intel" && <EventsFeed />}

        <p className="text-[11px] text-muted-foreground/40 mt-8 text-center font-mono">
          Prototype · auto-saves to this browser · v0.2
        </p>
      </main>

      {/* Victory / defeat overlay */}
      {gameOver.over && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div
            className={`max-w-md w-full rounded-2xl border bg-black/90 p-8 text-center ${
              gameOver.won ? "border-green-400/40 glow-border" : "border-red-500/50"
            }`}
          >
            <Trophy
              className={`w-10 h-10 mx-auto mb-4 ${gameOver.won ? "text-yellow-300" : "text-red-500"}`}
            />
            <h2
              className={`text-2xl font-black font-mono mb-1 ${
                gameOver.won ? "gradient-text" : "text-red-400"
              }`}
            >
              {gameOver.won ? "VICTORY" : "DEFEAT"}
            </h2>
            {gameOver.type && (
              <p className="text-xs font-mono uppercase tracking-widest text-green-700 mb-3">
                {gameOver.type} {gameOver.won ? "victory" : ""}
              </p>
            )}
            <p className="text-sm text-green-300 font-mono mb-6 leading-relaxed">{gameOver.text}</p>
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-mono font-semibold border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
