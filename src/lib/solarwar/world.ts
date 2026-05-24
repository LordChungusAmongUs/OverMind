// Solar War 2040 — the competitive world: rival corporations, markets, combat,
// espionage, government regulation, random events and victory/defeat checks.

import {
  BUILDINGS,
  EVENT_INTERVAL,
  MARKETS,
  MARKET_GROWTH,
  RIVAL_BASE_GROWTH,
  SHARE_EASE,
} from "./data";
import { computeRates, fmt, militaryPower, type MilitaryPower } from "./engine";
import type {
  EventKind,
  GameEvent,
  GameOver,
  MarketId,
  Rival,
  RivalPersonality,
  SaveState,
  VictoryType,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface CorpMetrics {
  economy: number;
  tech: number;
  influence: number;
  military: number;
}

export function playerMetrics(state: SaveState): CorpMetrics {
  let assetValue = 0;
  for (const [id, count] of Object.entries(state.buildings)) {
    const b = BUILDINGS[id];
    if (b?.baseCost.capital) assetValue += b.baseCost.capital * count;
  }
  return {
    economy: state.resources.capital + assetValue,
    tech: state.researched.length,
    influence: state.resources.influence,
    military: militaryPower(state.fleet).firepower,
  };
}

function corpPower(m: CorpMetrics): number {
  return (
    Math.log10(Math.max(10, m.economy)) * 10 +
    m.tech * 4 +
    Math.log10(Math.max(1, m.influence + 1)) * 6 +
    Math.log10(Math.max(1, m.military + 1)) * 6
  );
}

export interface Standing {
  id: string;
  name: string;
  isPlayer: boolean;
  personality?: RivalPersonality;
  metrics: CorpMetrics;
  power: number;
  defeated: boolean;
}

function rivalMetrics(r: Rival): CorpMetrics {
  return { economy: r.economy, tech: r.techLevel, influence: r.influence, military: r.military };
}

export function standings(state: SaveState): Standing[] {
  const pm = playerMetrics(state);
  const rows: Standing[] = [
    { id: "player", name: "Your Corporation", isPlayer: true, metrics: pm, power: corpPower(pm), defeated: false },
    ...state.rivals.map((r) => ({
      id: r.id,
      name: r.name,
      isPlayer: false,
      personality: r.personality,
      metrics: rivalMetrics(r),
      power: r.defeated ? 0 : corpPower(rivalMetrics(r)),
      defeated: r.defeated,
    })),
  ];
  return rows.sort((a, b) => Number(a.defeated) - Number(b.defeated) || b.power - a.power);
}

// ── Markets ────────────────────────────────────────────────────────────────

const AFFINITY: Record<RivalPersonality, Record<MarketId, number>> = {
  industrialist: { consumer: 1.0, enterprise: 1.2, government: 1.0 },
  researcher: { consumer: 0.9, enterprise: 1.8, government: 0.8 },
  militarist: { consumer: 0.7, enterprise: 0.9, government: 1.8 },
  influencer: { consumer: 2.0, enterprise: 0.8, government: 1.0 },
};

export function playerMarketStrength(state: SaveState): Record<MarketId, number> {
  const b = state.buildings;
  const has = (t: string) => state.researched.includes(t);
  const inf = state.resources.influence;
  const mil = militaryPower(state.fleet).firepower;
  return {
    consumer:
      8 * (b.consumer_division ?? 0) +
      inf * 0.02 +
      (has("personal_ai") ? 10 : 0) +
      (has("recommendation_engines") ? 40 : 0) +
      4,
    enterprise:
      10 * (b.enterprise_division ?? 0) +
      4 * (b.ai_cluster ?? 0) +
      1.5 * (b.orbital_data_center ?? 0) +
      (has("enterprise_ai") ? 15 : 0) +
      4,
    government:
      10 * (b.gov_relations ?? 0) +
      inf * 0.02 +
      mil * 0.05 +
      (has("gov_contracts") ? 15 : 0) +
      (has("orbital_warfare") ? 20 : 0) +
      4,
  };
}

function rivalMarketStrength(r: Rival, market: MarketId): number {
  if (r.defeated) return 0;
  const base = Math.sqrt(Math.max(1, r.economy)) / 3 + r.techLevel * 2;
  let s = base * AFFINITY[r.personality][market];
  if (market === "consumer" || market === "government") s += r.influence * 0.02;
  if (market === "government") s += r.military * 0.05;
  return s;
}

export function marketTargetShare(state: SaveState): Record<MarketId, number> {
  const ps = playerMarketStrength(state);
  const out = {} as Record<MarketId, number>;
  for (const m of MARKETS) {
    let rivalStr = 0;
    for (const r of state.rivals) rivalStr += rivalMarketStrength(r, m.id);
    out[m.id] = clamp(ps[m.id] / (ps[m.id] + rivalStr + 8), 0, 0.95);
  }
  return out;
}

// ── Combat ───────────────────────────────────────────────────────────────

export interface CombatResult {
  result: "win" | "pyrrhic" | "loss";
  text: string;
  playerLossFrac: number;
  rivalMilitaryAfter: number;
  rivalCrippleAdd: number;
}

export function resolveCombat(player: MilitaryPower, rival: Rival): CombatResult {
  const pf = player.firepower;
  const rf = rival.military;
  const ratio = (pf + 1) / (rf + 1);
  const jitter = 0.85 + Math.random() * 0.3;
  const eff = ratio * jitter;

  if (eff >= 1.3) {
    return {
      result: "win",
      text: `Decisive victory over ${rival.name}. Their fleet is shattered.`,
      playerLossFrac: clamp(0.18 / eff, 0.04, 0.35),
      rivalMilitaryAfter: rf * 0.3,
      rivalCrippleAdd: 70,
    };
  }
  if (eff >= 0.85) {
    return {
      result: "pyrrhic",
      text: `Costly engagement with ${rival.name}. Both sides bled heavily.`,
      playerLossFrac: clamp(0.45 / eff, 0.25, 0.6),
      rivalMilitaryAfter: rf * 0.6,
      rivalCrippleAdd: 35,
    };
  }
  return {
    result: "loss",
    text: `Assault on ${rival.name} repelled. Your fleet took grievous losses.`,
    playerLossFrac: clamp(0.7 / eff, 0.45, 0.9),
    rivalMilitaryAfter: rf * 0.88,
    rivalCrippleAdd: 0,
  };
}

// ── Events ─────────────────────────────────────────────────────────────────

export function appendEvent(
  events: GameEvent[],
  seq: number,
  t: number,
  kind: EventKind,
  text: string
): { events: GameEvent[]; eventSeq: number } {
  return { events: [{ id: seq, t, kind, text }, ...events].slice(0, 40), eventSeq: seq + 1 };
}

interface EventOutcome {
  kind: EventKind;
  text: string;
  regDelta?: number;
}

const EVENT_POOL: ((s: SaveState) => EventOutcome)[] = [
  (s) => {
    const m = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    s.marketSize[m.id] *= 1.18;
    return { kind: "market", text: `Boom in the ${m.name} market — demand surges.` };
  },
  (s) => {
    const m = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    s.marketSize[m.id] *= 0.9;
    return { kind: "market", text: `Correction hits the ${m.name} market.` };
  },
  (s) => {
    const gain = Math.max(500, s.resources.compute * 0.1);
    s.resources.compute += gain;
    return { kind: "tech", text: `Research breakthrough: +${fmt(gain)} compute.` };
  },
  (s) => {
    s.resources.talent += 5;
    return { kind: "good", text: "A wave of top graduates joins your firm: +5 talent." };
  },
  (s) => {
    s.resources.materials *= 0.9;
    return { kind: "bad", text: "Supply-chain disruption drains material stockpiles." };
  },
  (s) => {
    const gain = Math.max(5000, s.resources.capital * 0.05);
    s.resources.capital += gain;
    return { kind: "good", text: `Government grant awarded: +${fmt(gain)} capital.`, regDelta: -3 };
  },
  () => ({ kind: "bad", text: "Regulators open an antitrust inquiry.", regDelta: 10 }),
  (s) => {
    const alive = s.rivals.filter((r) => !r.defeated);
    if (alive.length) {
      const r = alive[Math.floor(Math.random() * alive.length)];
      r.techLevel += 2;
      r.economy *= 1.05;
      return { kind: "war", text: `${r.name} announces a major breakthrough.` };
    }
    return { kind: "info", text: "The markets are quiet." };
  },
  (s) => {
    if (s.researched.includes("cyberwarfare")) {
      return { kind: "info", text: "Your cyber-defenses repel an intrusion attempt." };
    }
    const loss = s.resources.compute * 0.08;
    s.resources.compute = Math.max(0, s.resources.compute - loss);
    return { kind: "bad", text: `Cyber-intrusion siphons ${fmt(loss)} compute. (Research Cyberwarfare.)` };
  },
  (s) => {
    s.marketSize.consumer *= 1.22;
    s.resources.influence += 20;
    return { kind: "good", text: "A product goes viral — consumer reach explodes." };
  },
];

// ── Regulation ───────────────────────────────────────────────────────────

function regulationTarget(state: SaveState, economy: number, firepower: number): number {
  const govOffices = state.buildings.gov_relations ?? 0;
  return clamp(6 + Math.log10(Math.max(10, economy)) * 7 + firepower * 0.008 - govOffices * 5, 0, 100);
}

// ── Victory / defeat ───────────────────────────────────────────────────────

function win(type: VictoryType, text: string): GameOver {
  return { over: true, won: true, type, text };
}

function checkVictory(state: SaveState): GameOver | null {
  const m = playerMetrics(state);
  const alive = state.rivals.filter((r) => !r.defeated);
  const topEcon = alive.reduce((a, r) => Math.max(a, r.economy), 0);
  const topInf = alive.reduce((a, r) => Math.max(a, r.influence), 0);

  if (state.researched.includes("singularity")) {
    return win("technological", "You reached the Technological Singularity. Your AI now improves itself faster than anyone can follow.");
  }
  if (alive.length === 0) {
    return win("military", "Every rival corporation has been destroyed or absorbed. The Solar System is yours.");
  }
  if (m.economy >= 5_000_000 && m.economy >= topEcon * 2) {
    return win("economic", "Your corporation commands the Solar economy, dwarfing every competitor.");
  }
  if (m.influence >= 100_000 && m.influence >= topInf * 2) {
    return win("influence", "Humanity now depends on you. You are indispensable — an Influence Victory.");
  }
  if ((state.buildings.sovereign_colony ?? 0) >= 1) {
    const r = computeRates(state);
    if (r.powerRatio >= 1 && r.net.materials > 0 && r.net.capital > 0) {
      return win("sovereignty", "Your off-world colony is fully self-sufficient. You are a sovereign interplanetary power.");
    }
  }
  return null;
}

// ── World tick ───────────────────────────────────────────────────────────

export type WorldUpdate = Pick<
  SaveState,
  | "resources"
  | "fleet"
  | "rivals"
  | "marketSize"
  | "marketShare"
  | "regulation"
  | "events"
  | "eventSeq"
  | "worldClock"
  | "eventClock"
  | "gameOver"
>;

export function worldTick(state: SaveState, dt: number): WorldUpdate {
  const resources = { ...state.resources };
  const fleet = { ...state.fleet };
  const rivals = state.rivals.map((r) => ({ ...r }));
  const marketSize = { ...state.marketSize };
  const marketShare = { ...state.marketShare };
  let regulation = state.regulation;
  let events = state.events;
  let eventSeq = state.eventSeq;
  let gameOver = state.gameOver;
  const worldClock = state.worldClock + dt;
  const eventClock = state.eventClock + dt;

  const pPow = militaryPower(fleet);

  // 1. Rivals develop.
  for (const r of rivals) {
    if (r.defeated) continue;
    const crip = r.crippled > 0 ? 0.4 : 1;
    r.crippled = Math.max(0, r.crippled - dt);
    r.economy *= 1 + RIVAL_BASE_GROWTH * r.growth * crip * dt;
    r.techLevel += dt * (r.personality === "researcher" ? 0.02 : 0.012) * crip;
    r.influence += dt * (r.personality === "influencer" ? 0.9 : 0.3) * crip;
    r.military +=
      dt * (r.personality === "militarist" ? 0.7 : 0.15) * crip * (0.5 + Math.log10(Math.max(10, r.economy)) / 4);
    r.hostility = clamp(r.hostility + dt * (r.personality === "militarist" ? 0.06 : 0.025), 0, 100);
  }

  // 2. Rival aggression toward the player.
  for (const r of rivals) {
    if (r.defeated || gameOver.over) continue;
    const willStrike =
      r.hostility > 55 && r.military > pPow.firepower * 1.25 && Math.random() < (dt / 30) * (r.hostility / 100);
    if (!willStrike) continue;
    const dmg = Math.min(resources.capital * 0.12, r.military * 200);
    resources.capital = Math.max(0, resources.capital - dmg);
    for (const id of Object.keys(fleet)) fleet[id] = Math.max(0, Math.floor(fleet[id] * 0.75));
    regulation = clamp(regulation + 4, 0, 100);
    r.hostility = clamp(r.hostility - 15, 0, 100);
    ({ events, eventSeq } = appendEvent(events, eventSeq, worldClock, "war", `${r.name} raided your assets — lost ${fmt(dmg)} capital.`));
    if (pPow.firepower === 0 && resources.capital < r.economy * 0.05 && r.military > 60) {
      gameOver = { over: true, won: false, type: "defeated", text: `${r.name} has absorbed your defenceless corporation. Game over.` };
    }
  }

  // 3. Markets grow and player share converges toward its competitive target.
  for (const m of MARKETS) marketSize[m.id] *= 1 + MARKET_GROWTH * dt;
  const target = marketTargetShare({ ...state, resources, fleet, rivals });
  for (const m of MARKETS) {
    marketShare[m.id] = clamp(marketShare[m.id] + (target[m.id] - marketShare[m.id]) * Math.min(1, SHARE_EASE * dt), 0, 0.95);
  }

  // 4. Government regulation drifts toward a target driven by your scale.
  const econ = playerMetrics({ ...state, resources, fleet }).economy;
  const regTarget = regulationTarget(state, econ, pPow.firepower);
  regulation = clamp(regulation + (regTarget - regulation) * Math.min(1, 0.02 * dt), 0, 100);

  // 5. Random world events.
  const fires = dt <= 2 ? (Math.random() < dt / EVENT_INTERVAL ? 1 : 0) : Math.min(3, Math.floor(dt / EVENT_INTERVAL));
  for (let i = 0; i < fires; i++) {
    const fn = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
    const out = fn({ ...state, resources, rivals, marketSize });
    if (out.regDelta) regulation = clamp(regulation + out.regDelta, 0, 100);
    ({ events, eventSeq } = appendEvent(events, eventSeq, worldClock, out.kind, out.text));
  }

  // 6. Victory / defeat.
  if (!gameOver.over) {
    const v = checkVictory({ ...state, resources, fleet, rivals });
    if (v) {
      gameOver = v;
      ({ events, eventSeq } = appendEvent(events, eventSeq, worldClock, v.won ? "good" : "bad", v.text));
    }
  }

  return { resources, fleet, rivals, marketSize, marketShare, regulation, events, eventSeq, worldClock, eventClock, gameOver };
}
