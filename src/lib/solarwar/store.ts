// Solar War 2040 — Zustand store. Holds dynamic save state + actions; static
// definitions live in data.ts and all math lives in engine.ts.

import { create } from "zustand";
import { BUILDINGS, OFFLINE_CAP_SECONDS, SAVE_KEY, STOCKS, TECHS, freshSave } from "./data";
import { advance, buildingCost, canAfford } from "./engine";
import type { SaveState, StockId } from "./types";

interface GameStore extends SaveState {
  tick: (dt: number) => void;
  build: (id: string) => boolean;
  research: (id: string) => boolean;
  save: () => void;
  load: () => void;
  reset: () => void;
}

function clampSave(raw: unknown): SaveState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<SaveState>;
  if (!s.resources || !s.buildings || !Array.isArray(s.researched)) return null;
  const base = freshSave();
  const resources = { ...base.resources };
  for (const r of STOCKS) {
    const v = (s.resources as Record<string, number>)[r];
    if (typeof v === "number" && isFinite(v)) resources[r] = Math.max(0, v);
  }
  return {
    resources,
    buildings: { ...s.buildings },
    researched: s.researched.filter((id) => typeof id === "string"),
    startedAt: typeof s.startedAt === "number" ? s.startedAt : base.startedAt,
    lastSaved: typeof s.lastSaved === "number" ? s.lastSaved : Date.now(),
  };
}

export const useGame = create<GameStore>((set, get) => ({
  ...freshSave(),

  tick: (dt) => {
    if (dt <= 0) return;
    set((state) => ({ resources: advance(state, dt) }));
  },

  build: (id) => {
    const b = BUILDINGS[id];
    if (!b) return false;
    const state = get();
    const owned = state.buildings[id] ?? 0;
    const cost = buildingCost(b, owned);
    if (!canAfford(state.resources, cost)) return false;
    const resources = { ...state.resources };
    for (const [res, val] of Object.entries(cost)) {
      resources[res as StockId] -= val as number;
    }
    set({ resources, buildings: { ...state.buildings, [id]: owned + 1 } });
    return true;
  },

  research: (id) => {
    const t = TECHS[id];
    if (!t) return false;
    const state = get();
    if (state.researched.includes(id)) return false;
    if (t.requires && !t.requires.every((r) => state.researched.includes(r))) return false;
    if (!canAfford(state.resources, t.cost)) return false;
    const resources = { ...state.resources };
    for (const [res, val] of Object.entries(t.cost)) {
      resources[res as StockId] -= val as number;
    }
    set({ resources, researched: [...state.researched, id] });
    return true;
  },

  save: () => {
    if (typeof window === "undefined") return;
    const { resources, buildings, researched, startedAt } = get();
    const payload: SaveState = {
      resources,
      buildings,
      researched,
      startedAt,
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
    // Offline catch-up, capped.
    const elapsed = (Date.now() - parsed.lastSaved) / 1000;
    if (elapsed > 2) {
      get().tick(Math.min(elapsed, OFFLINE_CAP_SECONDS));
    }
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
