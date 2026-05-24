// Solar War 2040 — pure game logic: production math, costs, gating, progression.

import {
  BUILDINGS,
  LOCATIONS,
  STAGES,
  STOCKS,
  TECHS,
} from "./data";
import type {
  Building,
  LocationId,
  SaveState,
  StockId,
  StockMap,
  Tech,
} from "./types";

function zeroStocks(): Record<StockId, number> {
  return { capital: 0, compute: 0, talent: 0, materials: 0, influence: 0 };
}

/** Combined production multiplier per stock from all researched techs. */
export function techMultipliers(researched: string[]): Record<StockId, number> {
  const m = { capital: 1, compute: 1, talent: 1, materials: 1, influence: 1 };
  let global = 1;
  for (const id of researched) {
    const t = TECHS[id];
    if (!t) continue;
    if (t.globalMult) global *= t.globalMult;
    if (t.mult) {
      for (const key of Object.keys(t.mult) as StockId[]) {
        m[key] *= t.mult[key] as number;
      }
    }
  }
  for (const key of STOCKS) m[key] *= global;
  return m;
}

export interface Rates {
  energySupply: number;
  energyDemand: number;
  /** 0..1 — fraction of demanded power that is met. Throttles all production. */
  powerRatio: number;
  /** Net per-second change for each stock resource. */
  net: Record<StockId, number>;
  /** Gross (powered) production, before operating-cost consumption. */
  gross: Record<StockId, number>;
  mult: Record<StockId, number>;
}

export function computeRates(state: Pick<SaveState, "buildings" | "researched">): Rates {
  const mult = techMultipliers(state.researched);
  const gross = zeroStocks();
  const consume = zeroStocks();
  let energySupply = 0;
  let energyDemand = 0;

  for (const [id, count] of Object.entries(state.buildings)) {
    if (!count) continue;
    const b = BUILDINGS[id];
    if (!b) continue;
    if (b.produces) {
      for (const [res, val] of Object.entries(b.produces)) {
        if (res === "energy") energySupply += val * count;
        else gross[res as StockId] += val * count;
      }
    }
    if (b.consumes) {
      for (const [res, val] of Object.entries(b.consumes)) {
        if (res === "energy") energyDemand += val * count;
        else consume[res as StockId] += val * count;
      }
    }
  }

  const powerRatio = energyDemand > 0 ? Math.min(1, energySupply / energyDemand) : 1;
  const net = zeroStocks();
  const poweredGross = zeroStocks();
  for (const r of STOCKS) {
    poweredGross[r] = gross[r] * mult[r] * powerRatio;
    net[r] = poweredGross[r] - consume[r];
  }

  return { energySupply, energyDemand, powerRatio, net, gross: poweredGross, mult };
}

/** Advance accumulated stocks by dt seconds. Stocks never go below zero. */
export function advance(state: SaveState, dt: number): Record<StockId, number> {
  const { net } = computeRates(state);
  const out = { ...state.resources };
  for (const r of STOCKS) {
    out[r] = Math.max(0, out[r] + net[r] * dt);
  }
  return out;
}

const DEFAULT_GROWTH = 1.15;

export function buildingCost(b: Building, owned: number): StockMap {
  const cost: StockMap = {};
  const growth = b.costGrowth ?? DEFAULT_GROWTH;
  for (const [res, val] of Object.entries(b.baseCost)) {
    cost[res as StockId] = (val as number) * Math.pow(growth, owned);
  }
  return cost;
}

export function canAfford(resources: Record<StockId, number>, cost: StockMap): boolean {
  for (const [res, val] of Object.entries(cost)) {
    if (resources[res as StockId] < (val as number)) return false;
  }
  return true;
}

export function isLocationUnlocked(loc: LocationId, researched: string[]): boolean {
  const def = LOCATIONS.find((l) => l.id === loc);
  if (!def?.unlockedBy) return true;
  return researched.includes(def.unlockedBy);
}

export function isBuildingUnlocked(b: Building, researched: string[]): boolean {
  if (!isLocationUnlocked(b.location, researched)) return false;
  if (b.requiresTech && !researched.includes(b.requiresTech)) return false;
  return true;
}

export type TechStatus = "researched" | "available" | "locked";

export function techStatus(t: Tech, researched: string[]): TechStatus {
  if (researched.includes(t.id)) return "researched";
  if (t.requires && !t.requires.every((r) => researched.includes(r))) return "locked";
  return "available";
}

export function currentStage(state: SaveState): number {
  const techs = state.researched.length;
  const totalBuildings = Object.values(state.buildings).reduce((a, b) => a + b, 0);
  const orbitInfra =
    (state.buildings.orbital_solar_array ?? 0) > 0 || (state.buildings.ai_cluster ?? 0) > 0;
  const moonOpen = state.researched.includes("lunar_logistics");
  const deepOpen = state.researched.includes("fusion_propulsion");

  if (deepOpen && (state.buildings.sovereign_colony ?? 0) > 0) return 6;
  if (moonOpen && techs >= 8) return 5;
  if (orbitInfra && techs >= 5) return 4;
  if (techs >= 4 || state.resources.capital >= 250000) return 3;
  if (techs >= 1 || totalBuildings >= 6) return 2;
  return 1;
}

export function stageById(id: number) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Compact number formatting: 1.2K, 3.4M, 1.10B, 2.30T. */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 1) return n.toFixed(1);
  if (abs === 0) return "0";
  return n.toFixed(2);
}

export function fmtRate(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${fmt(Math.abs(n))}/s`;
}
