"use client";

import { Lock } from "lucide-react";
import { BUILDINGS, LOCATIONS, TECHS } from "@/lib/solarwar/data";
import {
  buildingCost,
  canAfford,
  fmt,
  isBuildingUnlocked,
  isLocationUnlocked,
} from "@/lib/solarwar/engine";
import type { Building, FlowId, FlowMap, LocationId, StockId, StockMap } from "@/lib/solarwar/types";

const FLOW_CODE: Record<FlowId, string> = {
  capital: "CAP",
  compute: "CMP",
  talent: "TAL",
  materials: "MAT",
  influence: "INF",
  energy: "ENR",
};

const FLOW_COLOR: Record<FlowId, string> = {
  capital: "text-green-400",
  compute: "text-cyan-400",
  talent: "text-violet-400",
  materials: "text-amber-400",
  influence: "text-rose-400",
  energy: "text-yellow-300",
};

function FlowChips({ map, sign }: { map: FlowMap; sign: "+" | "−" }) {
  const entries = Object.entries(map) as [FlowId, number][];
  return (
    <>
      {entries.map(([id, val]) => (
        <span key={id} className={`text-[11px] font-mono ${FLOW_COLOR[id]}`}>
          {sign}
          {fmt(val)} {FLOW_CODE[id]}
        </span>
      ))}
    </>
  );
}

function CostChips({ cost, resources }: { cost: StockMap; resources: Record<StockId, number> }) {
  const entries = Object.entries(cost) as [StockId, number][];
  return (
    <>
      {entries.map(([id, val]) => {
        const enough = resources[id] >= val;
        return (
          <span
            key={id}
            className={`text-[11px] font-mono ${enough ? "text-green-600" : "text-red-400"}`}
          >
            {fmt(val)} {FLOW_CODE[id]}
          </span>
        );
      })}
    </>
  );
}

function BuildingCard({
  building,
  owned,
  unlocked,
  resources,
  onBuild,
}: {
  building: Building;
  owned: number;
  unlocked: boolean;
  resources: Record<StockId, number>;
  onBuild: () => void;
}) {
  const cost = buildingCost(building, owned);
  const affordable = canAfford(resources, cost);
  const reqTech = building.requiresTech ? TECHS[building.requiresTech] : undefined;

  if (!unlocked) {
    return (
      <div className="rounded-lg border border-green-500/10 bg-black/20 p-3 opacity-60">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-green-800" />
          <span className="text-sm font-semibold text-green-700">{building.name}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Requires research: <span className="text-green-600">{reqTech?.name ?? "—"}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="holo-card rounded-lg border border-green-500/20 bg-black/40 p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-green-200 leading-tight">{building.name}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 flex-shrink-0">
          ×{owned}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{building.description}</p>

      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {building.produces && <FlowChips map={building.produces} sign="+" />}
        {building.consumes && <FlowChips map={building.consumes} sign="−" />}
      </div>

      <button
        onClick={onBuild}
        disabled={!affordable}
        className={`mt-auto w-full rounded-md px-2 py-1.5 text-xs font-mono font-semibold border transition-colors ${
          affordable
            ? "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
            : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
        }`}
      >
        <span className="uppercase tracking-wider">Build</span>
        <span className="ml-1.5 inline-flex flex-wrap gap-x-2">
          <CostChips cost={cost} resources={resources} />
        </span>
      </button>
    </div>
  );
}

export default function BuildingsPanel({
  resources,
  buildings,
  researched,
  onBuild,
}: {
  resources: Record<StockId, number>;
  buildings: Record<string, number>;
  researched: string[];
  onBuild: (id: string) => void;
}) {
  const byLocation = (loc: LocationId) =>
    Object.values(BUILDINGS).filter((b) => b.location === loc);

  return (
    <div className="space-y-6">
      {LOCATIONS.map((loc) => {
        const locUnlocked = isLocationUnlocked(loc.id, researched);
        const list = byLocation(loc.id);
        const unlockTech = loc.unlockedBy ? TECHS[loc.unlockedBy] : undefined;

        return (
          <section key={loc.id}>
            <div className="flex items-baseline gap-3 mb-2">
              <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300">
                {loc.name}
              </h3>
              <span className="text-[11px] font-mono text-green-700">{loc.tagline}</span>
              {!locUnlocked && (
                <span className="text-[11px] font-mono text-red-400/80 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {unlockTech?.name}
                </span>
              )}
            </div>

            {locUnlocked ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((b) => (
                  <BuildingCard
                    key={b.id}
                    building={b}
                    owned={buildings[b.id] ?? 0}
                    unlocked={isBuildingUnlocked(b, researched)}
                    resources={resources}
                    onBuild={() => onBuild(b.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-green-500/10 bg-black/20 p-4 text-[11px] font-mono text-muted-foreground">
                Locked. Research <span className="text-green-500">{unlockTech?.name}</span> to open{" "}
                {loc.name}.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
