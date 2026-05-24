// Solar War 2040 — core type definitions for the prototype.

export type StockId = "capital" | "compute" | "talent" | "materials" | "influence";
export type FlowId = StockId | "energy";
export type LocationId = "earth" | "orbit" | "moon" | "asteroids" | "deep_space";

export type StockMap = Partial<Record<StockId, number>>;
export type FlowMap = Partial<Record<FlowId, number>>;

export interface ResourceDef {
  id: StockId;
  name: string;
  short: string;
  description: string;
  /** Tailwind text-color class used for accents. */
  color: string;
}

export interface Building {
  id: string;
  name: string;
  location: LocationId;
  description: string;
  /** Cost of the first copy. Scales by costGrowth^owned. */
  baseCost: StockMap;
  costGrowth?: number;
  /** Per-second output while powered (energy output is never throttled). */
  produces?: FlowMap;
  /** Per-second draw. Energy draw counts toward power demand; others are operating costs. */
  consumes?: FlowMap;
  /** Tech required before this building can be constructed. */
  requiresTech?: string;
}

export interface Tech {
  id: string;
  name: string;
  branch: string;
  description: string;
  cost: StockMap;
  requires?: string[];
  /** Multiplies production of specific stock resources. */
  mult?: Partial<Record<StockId, number>>;
  /** Multiplies production of every resource. */
  globalMult?: number;
  /** Building ids this tech makes available (for display / flavor). */
  unlocks?: string[];
  /** Expansion location this tech opens up. */
  unlocksLocation?: LocationId;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  tagline: string;
  /** Tech that unlocks this location. Earth & orbit are always open. */
  unlockedBy?: string;
}

export interface Stage {
  id: number;
  name: string;
  blurb: string;
}

export type MarketId = "consumer" | "enterprise" | "government";

export type RivalPersonality = "industrialist" | "researcher" | "militarist" | "influencer";

export type VictoryType =
  | "economic"
  | "technological"
  | "military"
  | "influence"
  | "sovereignty";

export interface Ship {
  id: string;
  name: string;
  shipClass: string;
  description: string;
  cost: StockMap;
  costGrowth?: number;
  firepower: number;
  hull: number;
  /** Per-ship ongoing draw (energy adds to power demand, capital is upkeep). */
  upkeep?: FlowMap;
  requiresTech?: string;
}

export interface RivalSeed {
  id: string;
  name: string;
  personality: RivalPersonality;
  blurb: string;
  economy: number;
  techLevel: number;
  influence: number;
  military: number;
  growth: number;
}

export interface Rival {
  id: string;
  name: string;
  personality: RivalPersonality;
  blurb: string;
  economy: number;
  techLevel: number;
  influence: number;
  military: number;
  growth: number;
  hostility: number;
  /** Seconds of reduced output remaining (from sabotage / combat losses). */
  crippled: number;
  defeated: boolean;
}

export type EventKind = "info" | "good" | "bad" | "war" | "tech" | "market";

export interface GameEvent {
  id: number;
  t: number;
  kind: EventKind;
  text: string;
}

export interface GameOver {
  over: boolean;
  won: boolean;
  type?: VictoryType | "defeated";
  text: string;
}

export interface SaveState {
  resources: Record<StockId, number>;
  buildings: Record<string, number>;
  researched: string[];
  fleet: Record<string, number>;
  rivals: Rival[];
  /** Player share (0..1) of each market. */
  marketShare: Record<MarketId, number>;
  /** Total addressable value of each market. */
  marketSize: Record<MarketId, number>;
  /** Earth government regulatory pressure, 0..100. */
  regulation: number;
  events: GameEvent[];
  eventSeq: number;
  worldClock: number;
  eventClock: number;
  gameOver: GameOver;
  startedAt: number;
  lastSaved: number;
}

