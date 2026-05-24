// Solar War 2040 — Zustand store. Holds dynamic save state + actions; static
// definitions live in data.ts, resource math in engine.ts, and the competitive
// world simulation in world.ts.

import { create } from "zustand";
import {
  BUILDINGS,
  MARKETS,
  OFFLINE_CAP_SECONDS,
  SAVE_KEY,
  SHIPS,
  STOCKS,
  TECHS,
  freshSave,
} from "./data";
import { advance, buildingCost, canAfford, fmt, militaryPower, shipCost } from "./engine";
import { appendEvent, resolveCombat, worldTick } from "./world";
import type { GameEvent, MarketId, Rival, SaveState, StockId, StockMap } from "./types";

export type EspionageKind = "sabotage" | "steal";

interface GameStore extends SaveState {
  tick: (dt: number) => void;
  build: (id: string) => boolean;
  research: (id: string) => boolean;
  buildShip: (id: string) => boolean;
  attackRival: (id: string) => boolean;
  acquireRival: (id: string) => boolean;
  espionage: (id: string, kind: EspionageKind) => boolean;
  lobby: () => boolean;
  save: () => void;
  load: () => void;
  reset: () => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function sanitizeCounts(raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}

function mergeMarket(
  raw: unknown,
  base: Record<MarketId, number>
): Record<MarketId, number> {
  if (!raw || typeof raw !== "object") return { ...base };
  const r = raw as Record<string, unknown>;
  const out = { ...base };
  for (const m of MARKETS) {
    const v = r[m.id];
    if (typeof v === "number" && isFinite(v) && v >= 0) out[m.id] = v;
  }
  return out;
}

function validRivals(raw: unknown): Rival[] | null {
  if (!Array.isArray(raw)) return null;
  const ok = raw.every(
    (r) =>
      r &&
      typeof r.id === "string" &&
      typeof r.economy === "number" &&
      typeof r.military === "number"
  );
  return ok ? (raw as Rival[]) : null;
}

function clampSave(raw: unknown): SaveState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const base = freshSave();
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);

  const resources = { ...base.resources };
  if (s.resources && typeof s.resources === "object") {
    const r = s.resources as Record<string, unknown>;
    for (const k of STOCKS) resources[k] = Math.max(0, num(r[k], base.resources[k]));
  }

  const events = Array.isArray(s.events)
    ? (s.events.filter((e) => e && typeof e.text === "string") as GameEvent[]).slice(0, 40)
    : base.events;

  const go = s.gameOver as Record<string, unknown> | undefined;
  const gameOver =
    go && typeof go.over === "boolean" && typeof go.won === "boolean"
      ? { over: go.over, won: go.won, type: go.type as never, text: String(go.text ?? "") }
      : base.gameOver;

  return {
    resources,
    buildings:
      s.buildings && typeof s.buildings === "object"
        ? sanitizeCounts(s.buildings as Record<string, unknown>)
        : base.buildings,
    researched: Array.isArray(s.researched)
      ? s.researched.filter((x): x is string => typeof x === "string")
      : base.researched,
    fleet:
      s.fleet && typeof s.fleet === "object"
        ? sanitizeCounts(s.fleet as Record<string, unknown>)
        : base.fleet,
    rivals: validRivals(s.rivals) ?? base.rivals,
    marketShare: mergeMarket(s.marketShare, base.marketShare),
    marketSize: mergeMarket(s.marketSize, base.marketSize),
    regulation: clamp(num(s.regulation, base.regulation), 0, 100),
    events,
    eventSeq: num(s.eventSeq, base.eventSeq),
    worldClock: num(s.worldClock, 0),
    eventClock: num(s.eventClock, 0),
    gameOver,
    startedAt: num(s.startedAt, base.startedAt),
    lastSaved: num(s.lastSaved, Date.now()),
  };
}

function spend(resources: Record<StockId, number>, cost: StockMap) {
  const out = { ...resources };
  for (const [res, val] of Object.entries(cost)) out[res as StockId] -= val as number;
  return out;
}

export const useGame = create<GameStore>((set, get) => ({
  ...freshSave(),

  tick: (dt) => {
    if (dt <= 0) return;
    const state = get();
    const resources = advance(state, dt);
    set(worldTick({ ...state, resources }, dt));
  },

  build: (id) => {
    const b = BUILDINGS[id];
    if (!b) return false;
    const state = get();
    const owned = state.buildings[id] ?? 0;
    const cost = buildingCost(b, owned);
    if (!canAfford(state.resources, cost)) return false;
    set({ resources: spend(state.resources, cost), buildings: { ...state.buildings, [id]: owned + 1 } });
    return true;
  },

  research: (id) => {
    const t = TECHS[id];
    if (!t) return false;
    const state = get();
    if (state.researched.includes(id)) return false;
    if (t.requires && !t.requires.every((r) => state.researched.includes(r))) return false;
    if (!canAfford(state.resources, t.cost)) return false;
    const { events, eventSeq } = appendEvent(
      state.events,
      state.eventSeq,
      state.worldClock,
      "tech",
      `Researched ${t.name}.`
    );
    set({ resources: spend(state.resources, t.cost), researched: [...state.researched, id], events, eventSeq });
    return true;
  },

  buildShip: (id) => {
    const ship = SHIPS[id];
    if (!ship) return false;
    const state = get();
    if (ship.requiresTech && !state.researched.includes(ship.requiresTech)) return false;
    const owned = state.fleet[id] ?? 0;
    const cost = shipCost(ship, owned);
    if (!canAfford(state.resources, cost)) return false;
    set({ resources: spend(state.resources, cost), fleet: { ...state.fleet, [id]: owned + 1 } });
    return true;
  },

  attackRival: (id) => {
    const state = get();
    const rival = state.rivals.find((r) => r.id === id);
    if (!rival || rival.defeated) return false;
    const power = militaryPower(state.fleet);
    if (power.firepower <= 0) return false;
    const res = resolveCombat(power, rival);
    const fleet = { ...state.fleet };
    for (const sid of Object.keys(fleet)) {
      fleet[sid] = Math.max(0, Math.round(fleet[sid] * (1 - res.playerLossFrac)));
    }
    const rivals = state.rivals.map((r) =>
      r.id === id
        ? {
            ...r,
            military: res.rivalMilitaryAfter,
            crippled: r.crippled + res.rivalCrippleAdd,
            hostility: clamp(r.hostility + 25, 0, 100),
          }
        : r
    );
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "war", res.text);
    set({ fleet, rivals, events, eventSeq });
    return true;
  },

  acquireRival: (id) => {
    const state = get();
    const rival = state.rivals.find((r) => r.id === id);
    if (!rival || rival.defeated) return false;
    const power = militaryPower(state.fleet);
    const acquirable = rival.crippled > 0 || rival.military < power.firepower * 0.25;
    if (!acquirable) return false;
    const price = rival.economy * 0.6;
    if (state.resources.capital < price) return false;
    const resources = { ...state.resources };
    resources.capital += rival.economy * 0.3 - price;
    resources.influence += rival.influence * 0.5;
    const rivals = state.rivals.map((r) => (r.id === id ? { ...r, defeated: true, military: 0 } : r));
    const { events, eventSeq } = appendEvent(
      state.events,
      state.eventSeq,
      state.worldClock,
      "good",
      `Acquired ${rival.name} for ${fmt(price)} capital — their assets are now yours.`
    );
    set({ resources, rivals, events, eventSeq });
    return true;
  },

  espionage: (id, kind) => {
    const state = get();
    if (!state.researched.includes("cyberwarfare")) return false;
    const rival = state.rivals.find((r) => r.id === id);
    if (!rival || rival.defeated) return false;

    const resources = { ...state.resources };
    let text: string;
    let rivals: Rival[];

    if (kind === "sabotage") {
      const cost = 800 + Math.floor(rival.techLevel) * 100;
      if (resources.compute < cost) return false;
      resources.compute -= cost;
      rivals = state.rivals.map((r) =>
        r.id === id ? { ...r, crippled: r.crippled + 45, hostility: clamp(r.hostility + 18, 0, 100) } : r
      );
      text = `Sabotage successful — ${rival.name}'s operations are disrupted.`;
    } else {
      const cost = 600;
      if (resources.compute < cost) return false;
      resources.compute -= cost;
      const loot = rival.economy * 0.05;
      resources.capital += loot;
      rivals = state.rivals.map((r) =>
        r.id === id ? { ...r, hostility: clamp(r.hostility + 12, 0, 100) } : r
      );
      text = `Data theft from ${rival.name}: +${fmt(loot)} capital.`;
    }

    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "war", text);
    set({ resources, rivals, events, eventSeq });
    return true;
  },

  lobby: () => {
    const state = get();
    const costInf = 150;
    const costCap = 3000;
    if (state.resources.influence < costInf || state.resources.capital < costCap) return false;
    const resources = { ...state.resources };
    resources.influence -= costInf;
    resources.capital -= costCap;
    const { events, eventSeq } = appendEvent(
      state.events,
      state.eventSeq,
      state.worldClock,
      "good",
      "Lobbying campaign eased regulatory pressure."
    );
    set({ resources, regulation: clamp(state.regulation - 12, 0, 100), events, eventSeq });
    return true;
  },

  save: () => {
    if (typeof window === "undefined") return;
    const s = get();
    const payload: SaveState = {
      resources: s.resources,
      buildings: s.buildings,
      researched: s.researched,
      fleet: s.fleet,
      rivals: s.rivals,
      marketShare: s.marketShare,
      marketSize: s.marketSize,
      regulation: s.regulation,
      events: s.events,
      eventSeq: s.eventSeq,
      worldClock: s.worldClock,
      eventClock: s.eventClock,
      gameOver: s.gameOver,
      startedAt: s.startedAt,
      lastSaved: Date.now(),
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable — ignore */
    }
  },

  load: () => {
    if (typeof window === "undefined") return;
    let parsed: SaveState | null = null;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) parsed = clampSave(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (!parsed) return;
    set(parsed);
    const elapsed = (Date.now() - parsed.lastSaved) / 1000;
    if (elapsed > 2) get().tick(Math.min(elapsed, OFFLINE_CAP_SECONDS));
  },

  reset: () => {
    set(freshSave());
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
    }
  },
}));
