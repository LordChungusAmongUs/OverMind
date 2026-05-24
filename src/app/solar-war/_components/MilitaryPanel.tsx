"use client";

import { Crosshair, Lock, Radiation, ShieldAlert, Swords, Wifi } from "lucide-react";
import { SHIPS, TECHS } from "@/lib/solarwar/data";
import { canAfford, fmt, militaryPower, shipCost } from "@/lib/solarwar/engine";
import { useGame } from "@/lib/solarwar/store";
import type { Rival, StockId, StockMap } from "@/lib/solarwar/types";

const CODE: Partial<Record<StockId, string>> = {
  capital: "CAP",
  materials: "MAT",
  compute: "CMP",
};

function Cost({ cost, resources }: { cost: StockMap; resources: Record<StockId, number> }) {
  return (
    <>
      {(Object.entries(cost) as [StockId, number][]).map(([id, val]) => (
        <span key={id} className={resources[id] >= val ? "text-green-600" : "text-red-400"}>
          {fmt(val)} {CODE[id]}
        </span>
      ))}
    </>
  );
}

function RivalCard({ rival, playerFirepower }: { rival: Rival; playerFirepower: number }) {
  const attack = useGame((s) => s.attackRival);
  const acquire = useGame((s) => s.acquireRival);
  const espionage = useGame((s) => s.espionage);
  const capital = useGame((s) => s.resources.capital);
  const compute = useGame((s) => s.resources.compute);
  const cyber = useGame((s) => s.researched.includes("cyberwarfare"));

  if (rival.defeated) {
    return (
      <div className="rounded-lg border border-green-500/10 bg-black/20 p-3 opacity-50">
        <span className="text-sm font-semibold text-green-700 line-through">{rival.name}</span>
        <p className="text-[11px] font-mono text-red-500/70">Defeated / absorbed</p>
      </div>
    );
  }

  const price = rival.economy * 0.6;
  const acquirable = rival.crippled > 0 || rival.military < playerFirepower * 0.25;
  const canAttack = playerFirepower > 0;
  const sabotageCost = 800 + Math.floor(rival.techLevel) * 100;

  const btn = (enabled: boolean) =>
    `flex-1 rounded px-2 py-1.5 text-[11px] font-mono font-semibold border transition-colors inline-flex items-center justify-center gap-1 ${
      enabled
        ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
        : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
    }`;

  return (
    <div className="holo-card rounded-lg border border-green-500/20 bg-black/40 p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-green-200">{rival.name}</span>
        <span className="text-[10px] font-mono text-green-700">{rival.personality}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
        <span className="text-orange-400">MIL {fmt(rival.military)}</span>
        <span className="text-green-400">VAL {fmt(rival.economy)}</span>
        <span className="text-cyan-400">TECH {Math.floor(rival.techLevel)}</span>
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-green-700">
          <span>hostility</span>
          <span>{Math.round(rival.hostility)}%</span>
        </div>
        <div className="h-1 rounded-full bg-black/50 overflow-hidden">
          <div
            className={`h-full rounded-full ${rival.hostility > 55 ? "bg-red-500" : "bg-yellow-600"}`}
            style={{ width: `${rival.hostility}%` }}
          />
        </div>
        {rival.crippled > 0 && (
          <span className="text-[10px] font-mono text-red-400">crippled {Math.ceil(rival.crippled)}s</span>
        )}
      </div>

      <div className="flex gap-1.5">
        <button className={btn(canAttack)} disabled={!canAttack} onClick={() => attack(rival.id)}>
          <Swords className="w-3 h-3" /> Attack
        </button>
        <button
          className={btn(cyber && compute >= sabotageCost)}
          disabled={!cyber || compute < sabotageCost}
          onClick={() => espionage(rival.id, "sabotage")}
          title={`Sabotage — ${fmt(sabotageCost)} compute`}
        >
          <Radiation className="w-3 h-3" /> Sabotage
        </button>
        <button
          className={btn(cyber && compute >= 600)}
          disabled={!cyber || compute < 600}
          onClick={() => espionage(rival.id, "steal")}
          title="Steal data — 600 compute"
        >
          <Wifi className="w-3 h-3" /> Steal
        </button>
      </div>
      <button
        className={`w-full rounded px-2 py-1.5 text-[11px] font-mono font-semibold border transition-colors ${
          acquirable && capital >= price
            ? "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
            : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
        }`}
        disabled={!acquirable || capital < price}
        onClick={() => acquire(rival.id)}
        title={acquirable ? `Acquire for ${fmt(price)} capital` : "Cripple their fleet first"}
      >
        Acquire <span className="text-green-700">({fmt(price)} CAP)</span>
      </button>
    </div>
  );
}

export default function MilitaryPanel() {
  const fleet = useGame((s) => s.fleet);
  const resources = useGame((s) => s.resources);
  const researched = useGame((s) => s.researched);
  const rivals = useGame((s) => s.rivals);
  const buildShip = useGame((s) => s.buildShip);

  const power = militaryPower(fleet);
  const noMilitary = !researched.includes("security_forces");

  return (
    <div className="space-y-6">
      {/* Fleet summary */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2 inline-flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> Fleet
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Firepower", value: power.firepower, color: "text-orange-400" },
            { label: "Hull", value: power.hull, color: "text-cyan-400" },
            { label: "Ships", value: power.ships, color: "text-green-400" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-green-500/20 bg-black/40 px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-green-700">{m.label}</p>
              <p className={`text-xl font-black font-mono ${m.color}`}>{fmt(m.value)}</p>
            </div>
          ))}
        </div>
        {noMilitary && (
          <p className="text-[11px] font-mono text-yellow-300/80 mt-2">
            Research <span className="text-cyan-300">Cyberwarfare → Security Forces</span> (Defense
            branch) to build warships.
          </p>
        )}
      </section>

      {/* Shipyard */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2">
          Shipyard
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.values(SHIPS).map((ship) => {
            const owned = fleet[ship.id] ?? 0;
            const unlocked = !ship.requiresTech || researched.includes(ship.requiresTech);
            if (!unlocked) {
              return (
                <div key={ship.id} className="rounded-lg border border-green-500/10 bg-black/20 p-3 opacity-60">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-green-800" />
                    <span className="text-sm font-semibold text-green-700">{ship.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Requires {TECHS[ship.requiresTech!]?.name}
                  </p>
                </div>
              );
            }
            const cost = shipCost(ship, owned);
            const affordable = canAfford(resources, cost);
            return (
              <div key={ship.id} className="holo-card rounded-lg border border-green-500/20 bg-black/40 p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-green-200 leading-tight">{ship.name}</span>
                    <p className="text-[10px] font-mono text-green-700">{ship.shipClass}</p>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 flex-shrink-0">
                    ×{owned}
                  </span>
                </div>
                <div className="flex gap-2 text-[11px] font-mono">
                  <span className="text-orange-400">FP {ship.firepower}</span>
                  <span className="text-cyan-400">HP {ship.hull}</span>
                </div>
                <button
                  onClick={() => buildShip(ship.id)}
                  disabled={!affordable}
                  className={`mt-auto w-full rounded-md px-2 py-1.5 text-xs font-mono font-semibold border transition-colors ${
                    affordable
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
                      : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
                  }`}
                >
                  <span className="uppercase tracking-wider">Build</span>
                  <span className="ml-1.5 inline-flex flex-wrap gap-x-2">
                    <Cost cost={cost} resources={resources} />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rivals */}
      <section>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2 inline-flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-red-400" /> Rival Corporations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rivals.map((r) => (
            <RivalCard key={r.id} rival={r} playerFirepower={power.firepower} />
          ))}
        </div>
      </section>
    </div>
  );
}
