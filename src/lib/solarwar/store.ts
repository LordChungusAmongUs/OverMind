// Solar War 2040 — Zustand store. Holds dynamic save state + actions; static
// definitions live in data.ts, resource math in engine.ts, and the competitive
// world simulation in world.ts.

import { create } from "zustand";
import {
  BUILDINGS,
  MARKETS,
  NEUTRAL_COMPANIES,
  OFFLINE_CAP_SECONDS,
  SAVE_KEY,
  SHIPS,
  STOCKS,
  TECHS,
  freshSave,
} from "./data";
import { advance, buildingCost, canAfford, fmt, militaryPower, shipCost } from "./engine";
import { appendEvent, playerMetrics, worldTick } from "./world";
import type {
  BattleResult,
  GameEvent,
  MarketId,
  NeutralStatus,
  Rival,
  SaveState,
  StockId,
  StockMap,
} from "./types";

export type EspionageKind = "sabotage" | "steal";

interface GameStore extends SaveState {
  /** Tick multiplier; 0 = paused. Not persisted. */
  speed: number;
  /** Rival id currently being attacked in the tactical view. Not persisted. */
  battleTarget: string | null;
  tick: (dt: number) => void;
  setSpeed: (s: number) => void;
  build: (id: string) => boolean;
  research: (id: string) => boolean;
  buildShip: (id: string) => boolean;
  leaseCompany: (id: string) => boolean;
  acquireCompany: (id: string) => boolean;
  proposeTreaty: (id: string) => boolean;
  requestBattle: (id: string) => boolean;
  resolveBattle: (id: string, result: BattleResult) => void;
  cancelBattle: () => void;
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

function sanitizeNeutral(raw: unknown): Record<string, NeutralStatus> {
  const out: Record<string, NeutralStatus> = {};
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const c of NEUTRAL_COMPANIES) {
      if (r[c.id] === "leased" || r[c.id] === "owned") out[c.id] = r[c.id] as NeutralStatus;
    }
  }
  return out;
}

function mergeMarket(raw: unknown, base: Record<MarketId, number>): Record<MarketId, number> {
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
    (r) => r && typeof r.id === "string" && typeof r.economy === "number" && typeof r.military === "number"
  );
  if (!ok) return null;
  return raw.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? r.id),
    personality: r.personality ?? "industrialist",
    blurb: String(r.blurb ?? ""),
    economy: r.economy,
    techLevel: typeof r.techLevel === "number" ? r.techLevel : 0,
    influence: typeof r.influence === "number" ? r.influence : 0,
    military: r.military,
    growth: typeof r.growth === "number" ? r.growth : 1,
    hostility: typeof r.hostility === "number" ? r.hostility : 10,
    crippled: typeof r.crippled === "number" ? r.crippled : 0,
    defeated: !!r.defeated,
    treaty: r.treaty === "pact" ? "pact" : "none",
  }));
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
      s.fleet && typeof s.fleet === "object" ? sanitizeCounts(s.fleet as Record<string, unknown>) : base.fleet,
    neutral: sanitizeNeutral(s.neutral),
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
  speed: 1,
  battleTarget: null,

  setSpeed: (s) => set({ speed: s }),

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
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "tech", `Researched ${t.name}.`);
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

  leaseCompany: (id) => {
    const c = NEUTRAL_COMPANIES.find((x) => x.id === id);
    if (!c) return false;
    const state = get();
    const status = state.neutral[id] ?? "none";
    if (status === "owned") return false;
    const next: NeutralStatus = status === "leased" ? "none" : "leased";
    set({ neutral: { ...state.neutral, [id]: next } });
    return true;
  },

  acquireCompany: (id) => {
    const c = NEUTRAL_COMPANIES.find((x) => x.id === id);
    if (!c) return false;
    const state = get();
    if (state.neutral[id] === "owned") return false;
    if (!canAfford(state.resources, c.acquireCost)) return false;
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "good", `Acquired ${c.name} — vertically integrated.`);
    set({
      resources: spend(state.resources, c.acquireCost),
      neutral: { ...state.neutral, [id]: "owned" },
      events,
      eventSeq,
    });
    return true;
  },

  proposeTreaty: (id) => {
    const state = get();
    const rival = state.rivals.find((r) => r.id === id);
    if (!rival || rival.defeated || rival.treaty === "pact") return false;
    if (state.resources.influence < 300) return false;
    const pm = playerMetrics(state);
    const pStr = pm.economy + pm.military * 1500 + pm.influence * 20;
    const rStr = rival.economy + rival.military * 1500 + rival.influence * 20;
    const accept = rival.hostility < 75 && pStr >= rStr * 0.7 && state.resources.capital >= 8000;

    const resources = { ...state.resources };
    if (accept) {
      resources.influence -= 300;
      resources.capital -= 8000;
      const rivals = state.rivals.map((r) =>
        r.id === id ? { ...r, treaty: "pact" as const, hostility: clamp(r.hostility - 30, 0, 100) } : r
      );
      const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "good", `${rival.name} signed a non-aggression pact.`);
      set({ resources, rivals, events, eventSeq });
    } else {
      resources.influence -= 100;
      const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "info", `${rival.name} rebuffed your overtures.`);
      set({ resources, events, eventSeq });
    }
    return accept;
  },

  requestBattle: (id) => {
    const state = get();
    const rival = state.rivals.find((r) => r.id === id);
    if (!rival || rival.defeated) return false;
    if (militaryPower(state.fleet).firepower <= 0) return false;
    set({ battleTarget: id });
    return true;
  },

  cancelBattle: () => set({ battleTarget: null }),

  resolveBattle: (id, result) => {
    const state = get();
    const fleet = { ...state.fleet };
    for (const [sid, lost] of Object.entries(result.playerLosses)) {
      fleet[sid] = Math.max(0, (fleet[sid] ?? 0) - lost);
    }
    const rivals = state.rivals.map((r) =>
      r.id === id
        ? {
            ...r,
            military: result.rivalMilitaryAfter,
            crippled: r.crippled + result.rivalCrippleAdd,
            hostility: clamp(r.hostility + 25, 0, 100),
            treaty: "none" as const,
          }
        : r
    );
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "war", result.text);
    set({ fleet, rivals, events, eventSeq, battleTarget: null });
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
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "good", `Acquired ${rival.name} for ${fmt(price)} capital — their assets are now yours.`);
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
      rivals = state.rivals.map((r) => (r.id === id ? { ...r, hostility: clamp(r.hostility + 12, 0, 100) } : r));
      text = `Data theft from ${rival.name}: +${fmt(loot)} capital.`;
    }

    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "war", text);
    set({ resources, rivals, events, eventSeq });
    return true;
  },

  lobby: () => {
    const state = get();
    if (state.resources.influence < 150 || state.resources.capital < 3000) return false;
    const resources = { ...state.resources };
    resources.influence -= 150;
    resources.capital -= 3000;
    const { events, eventSeq } = appendEvent(state.events, state.eventSeq, state.worldClock, "good", "Lobbying campaign eased regulatory pressure.");
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
      neutral: s.neutral,
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
    set({ ...freshSave(), speed: 1, battleTarget: null });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
    }
  },
}));
