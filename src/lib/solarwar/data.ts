// Solar War 2040 — static game data: resources, locations, buildings, tech tree, stages.

import type {
  Building,
  LocationDef,
  MarketId,
  ResourceDef,
  RivalSeed,
  SaveState,
  Ship,
  Stage,
  StockId,
  Tech,
} from "./types";

export const TICK_MS = 200;
export const OFFLINE_CAP_SECONDS = 8 * 3600; // catch up at most 8h while away
export const SAVE_KEY = "solarwar.save.v2";

export const STOCKS: StockId[] = [
  "capital",
  "compute",
  "talent",
  "materials",
  "influence",
];

export const RESOURCES: Record<StockId, ResourceDef> = {
  capital: {
    id: "capital",
    name: "Capital",
    short: "CAP",
    description: "Financial reserves. Spent on construction, hiring and acquisitions.",
    color: "text-green-400",
  },
  compute: {
    id: "compute",
    name: "Compute",
    short: "CMP",
    description: "The primary strategic resource. Fuels research and AI services.",
    color: "text-cyan-400",
  },
  talent: {
    id: "talent",
    name: "Talent",
    short: "TAL",
    description: "Human capital. Required to construct advanced facilities.",
    color: "text-violet-400",
  },
  materials: {
    id: "materials",
    name: "Materials",
    short: "MAT",
    description: "Physical resources for manufacturing, construction and shipbuilding.",
    color: "text-amber-400",
  },
  influence: {
    id: "influence",
    name: "Influence",
    short: "INF",
    description: "Political and social leverage from products, media and dependence.",
    color: "text-rose-400",
  },
};

export const LOCATIONS: LocationDef[] = [
  { id: "earth", name: "Earth", tagline: "Talent · Customers · Capital" },
  { id: "orbit", name: "Orbit", tagline: "Energy · Compute · Manufacturing" },
  { id: "moon", name: "Moon", tagline: "Materials · Industry", unlockedBy: "lunar_logistics" },
  { id: "asteroids", name: "Asteroids", tagline: "Rare resources · Strategic materials", unlockedBy: "mass_drivers" },
  { id: "deep_space", name: "Deep Space", tagline: "Sovereignty · Megaprojects", unlockedBy: "fusion_propulsion" },
];

export const BUILDINGS: Record<string, Building> = {
  // ── EARTH ────────────────────────────────────────────────────────────
  operations_center: {
    id: "operations_center",
    name: "Operations Center",
    location: "earth",
    description: "Your corporate HQ. Generates revenue and recruits talent, with on-site power.",
    baseCost: { capital: 2200 },
    costGrowth: 1.2,
    produces: { capital: 10, talent: 0.08, energy: 14 },
  },
  recruitment_hub: {
    id: "recruitment_hub",
    name: "Recruitment Hub",
    location: "earth",
    description: "Attracts engineers and scientists. Salaries are an ongoing cost.",
    baseCost: { capital: 900 },
    costGrowth: 1.16,
    produces: { talent: 0.35 },
    consumes: { energy: 3, capital: 0.6 },
  },
  leased_cloud: {
    id: "leased_cloud",
    name: "Leased Cloud  (outsourced)",
    location: "earth",
    description: "Rent compute from a neutral provider. No power needed, but you pay rent forever.",
    baseCost: { capital: 600 },
    costGrowth: 1.13,
    produces: { compute: 1 },
    consumes: { capital: 1.3 },
  },
  solar_farm: {
    id: "solar_farm",
    name: "Solar Farm",
    location: "earth",
    description: "Terrestrial photovoltaics. Cheap, reliable energy capacity.",
    baseCost: { capital: 1100, materials: 15 },
    costGrowth: 1.15,
    produces: { energy: 45 },
  },
  consumer_division: {
    id: "consumer_division",
    name: "Consumer AI Products",
    location: "earth",
    description: "Personal AI sold to a mass market. Drives consumer market share and influence.",
    baseCost: { capital: 4500 },
    costGrowth: 1.17,
    produces: { capital: 22, influence: 0.5 },
    consumes: { energy: 12 },
    requiresTech: "personal_ai",
  },
  enterprise_division: {
    id: "enterprise_division",
    name: "Enterprise AI Division",
    location: "earth",
    description: "Automation and logistics sold to corporations. High margins, big contracts.",
    baseCost: { capital: 6000 },
    costGrowth: 1.17,
    produces: { capital: 34 },
    consumes: { energy: 14, compute: 0.4 },
    requiresTech: "enterprise_ai",
  },
  gov_relations: {
    id: "gov_relations",
    name: "Government Affairs Office",
    location: "earth",
    description: "Defense and infrastructure contracts. Stable income, influence, and political cover.",
    baseCost: { capital: 5000 },
    costGrowth: 1.18,
    produces: { capital: 18, influence: 0.8 },
    consumes: { energy: 8 },
    requiresTech: "gov_contracts",
  },
  fusion_reactor: {
    id: "fusion_reactor",
    name: "Fusion Reactor",
    location: "earth",
    description: "Net-positive fusion. Enormous baseload power for your industrial base.",
    baseCost: { capital: 18000, materials: 220 },
    costGrowth: 1.18,
    produces: { energy: 340 },
    requiresTech: "fusion",
  },

  // ── ORBIT ────────────────────────────────────────────────────────────
  comms_satellite: {
    id: "comms_satellite",
    name: "Communications Satellite",
    location: "orbit",
    description: "Global mesh networking. Projects influence across markets.",
    baseCost: { capital: 1600, materials: 8 },
    costGrowth: 1.16,
    produces: { influence: 0.55 },
    consumes: { energy: 2 },
  },
  orbital_data_center: {
    id: "orbital_data_center",
    name: "Orbital Data Center  (in-house)",
    location: "orbit",
    description: "Own your compute. Higher output than leasing, but it needs real power.",
    baseCost: { capital: 2800, materials: 25 },
    costGrowth: 1.16,
    produces: { compute: 2 },
    consumes: { energy: 8 },
  },
  orbital_solar_array: {
    id: "orbital_solar_array",
    name: "Orbital Solar Array",
    location: "orbit",
    description: "Space-based solar with no day/night cycle. Massive clean capacity.",
    baseCost: { capital: 7000, materials: 130 },
    costGrowth: 1.16,
    produces: { energy: 130 },
    requiresTech: "orbital_energy",
  },
  ai_cluster: {
    id: "ai_cluster",
    name: "AI Compute Cluster",
    location: "orbit",
    description: "Frontier-model training fabric. The backbone of singularity-grade compute.",
    baseCost: { capital: 13000, materials: 160, compute: 500 },
    costGrowth: 1.17,
    produces: { compute: 9 },
    consumes: { energy: 42 },
    requiresTech: "ai_models",
  },

  // ── MOON ─────────────────────────────────────────────────────────────
  mining_outpost: {
    id: "mining_outpost",
    name: "Lunar Mining Outpost",
    location: "moon",
    description: "Extract regolith and metals from the lunar surface.",
    baseCost: { capital: 9000, materials: 60 },
    costGrowth: 1.16,
    produces: { materials: 2.2 },
    consumes: { energy: 14, capital: 1 },
  },
  robotic_factory: {
    id: "robotic_factory",
    name: "Autonomous Factory",
    location: "moon",
    description: "Self-operating robotic manufacturing. Turns raw mass into materials and profit.",
    baseCost: { capital: 22000, materials: 320 },
    costGrowth: 1.17,
    produces: { materials: 6.5, capital: 9 },
    consumes: { energy: 32 },
    requiresTech: "industrial_robotics",
  },

  // ── ASTEROIDS ────────────────────────────────────────────────────────
  asteroid_harvester: {
    id: "asteroid_harvester",
    name: "Asteroid Harvester",
    location: "asteroids",
    description: "Strip-mines metal-rich asteroids for rare strategic materials.",
    baseCost: { capital: 55000, materials: 900 },
    costGrowth: 1.18,
    produces: { materials: 20, capital: 12 },
    consumes: { energy: 65 },
  },

  // ── DEEP SPACE ───────────────────────────────────────────────────────
  sovereign_colony: {
    id: "sovereign_colony",
    name: "Sovereign Colony",
    location: "deep_space",
    description: "A fully self-sufficient off-world civilization. The ultimate megaproject.",
    baseCost: { capital: 280000, materials: 5500 },
    costGrowth: 1.25,
    produces: { influence: 9, capital: 45, talent: 1.2 },
    consumes: { energy: 160 },
  },
};

export const TECHS: Record<string, Tech> = {
  // ── COMPUTE / SEMICONDUCTORS ─────────────────────────────────────────
  ai_models: {
    id: "ai_models",
    name: "Advanced AI Models",
    branch: "Compute",
    description: "+25% compute output. Unlocks AI Compute Clusters in orbit.",
    cost: { compute: 300 },
    mult: { compute: 1.25 },
    unlocks: ["ai_cluster"],
  },
  chip_design: {
    id: "chip_design",
    name: "AI-Driven Chip Design",
    branch: "Semiconductors",
    description: "+40% compute. AI designing its own silicon — the first feedback loop.",
    cost: { compute: 700, capital: 5000 },
    requires: ["ai_models"],
    mult: { compute: 1.4 },
  },
  agi: {
    id: "agi",
    name: "Distributed AGI",
    branch: "Compute",
    description: "+50% compute and +20% to ALL output. Superintelligence compounds everything.",
    cost: { compute: 5500 },
    requires: ["chip_design"],
    mult: { compute: 1.5 },
    globalMult: 1.2,
  },
  singularity: {
    id: "singularity",
    name: "Technological Singularity",
    branch: "Compute",
    description: "The capstone. Researching it wins a Technological Victory outright.",
    cost: { compute: 60000, capital: 500000, materials: 8000 },
    requires: ["agi", "fusion_propulsion"],
    globalMult: 1.5,
  },

  // ── ENERGY ───────────────────────────────────────────────────────────
  fusion: {
    id: "fusion",
    name: "Fusion Power",
    branch: "Energy",
    description: "Unlocks Fusion Reactors — massive terrestrial baseload power.",
    cost: { compute: 800, capital: 8000, materials: 100 },
    unlocks: ["fusion_reactor"],
  },
  orbital_energy: {
    id: "orbital_energy",
    name: "Orbital Energy Systems",
    branch: "Energy",
    description: "Unlocks Orbital Solar Arrays — clean power that never sleeps.",
    cost: { compute: 1300, capital: 11000 },
    requires: ["fusion"],
    unlocks: ["orbital_solar_array"],
  },

  // ── ROBOTICS ─────────────────────────────────────────────────────────
  industrial_robotics: {
    id: "industrial_robotics",
    name: "Industrial Robotics",
    branch: "Robotics",
    description: "+30% materials. Unlocks Autonomous Factories on the Moon.",
    cost: { compute: 750, capital: 6000 },
    mult: { materials: 1.3 },
    unlocks: ["robotic_factory"],
  },
  humanoid_robots: {
    id: "humanoid_robots",
    name: "Humanoid Robotics",
    branch: "Robotics",
    description: "+20% capital and +20% materials. Labor that scales without payroll.",
    cost: { compute: 2200, capital: 16000 },
    requires: ["industrial_robotics"],
    mult: { capital: 1.2, materials: 1.2 },
  },

  // ── MATERIALS ────────────────────────────────────────────────────────
  advanced_materials: {
    id: "advanced_materials",
    name: "Meta-materials",
    branch: "Materials Science",
    description: "+25% materials. Graphene, superconductors and programmable matter.",
    cost: { compute: 1100, materials: 160 },
    mult: { materials: 1.25 },
  },

  // ── CONSUMER / MEDIA / FINANCE ───────────────────────────────────────
  personal_ai: {
    id: "personal_ai",
    name: "Personal AI",
    branch: "Consumer",
    description: "+20% influence. Unlocks Consumer AI Products and the consumer market.",
    cost: { compute: 250 },
    mult: { influence: 1.2 },
    unlocks: ["consumer_division"],
  },
  enterprise_ai: {
    id: "enterprise_ai",
    name: "Enterprise AI",
    branch: "Enterprise",
    description: "+25% capital. Unlocks the Enterprise AI Division and B2B market.",
    cost: { compute: 600, capital: 4000 },
    mult: { capital: 1.25 },
    unlocks: ["enterprise_division"],
  },
  gov_contracts: {
    id: "gov_contracts",
    name: "Government Contracts",
    branch: "Government",
    description: "+25% influence. Unlocks the Government Affairs Office and public market.",
    cost: { compute: 700, capital: 5000 },
    mult: { influence: 1.25 },
    unlocks: ["gov_relations"],
  },
  recommendation_engines: {
    id: "recommendation_engines",
    name: "Recommendation Engines",
    branch: "Media",
    description: "+50% influence. Shape what billions of people see and want.",
    cost: { compute: 950, capital: 4000 },
    requires: ["personal_ai"],
    mult: { influence: 1.5 },
  },
  ai_investing: {
    id: "ai_investing",
    name: "AI Capital Markets",
    branch: "Finance",
    description: "+40% capital. Autonomous trading and capital optimization.",
    cost: { compute: 1600, capital: 10000 },
    mult: { capital: 1.4 },
  },

  // ── TRANSPORTATION / SPACE ───────────────────────────────────────────
  orbital_logistics: {
    id: "orbital_logistics",
    name: "Orbital Logistics",
    branch: "Transportation",
    description: "+10% materials. Cheap, frequent launches — the gateway to deep space.",
    cost: { compute: 500, capital: 6000 },
    mult: { materials: 1.1 },
  },
  lunar_logistics: {
    id: "lunar_logistics",
    name: "Nuclear Propulsion",
    branch: "Transportation",
    description: "Opens the Moon for expansion.",
    cost: { compute: 1500, capital: 20000, materials: 200 },
    requires: ["orbital_logistics"],
    unlocksLocation: "moon",
  },
  mass_drivers: {
    id: "mass_drivers",
    name: "Mass Drivers",
    branch: "Transportation",
    description: "Opens the Asteroid Belt for resource extraction.",
    cost: { compute: 3200, capital: 50000, materials: 650 },
    requires: ["lunar_logistics"],
    unlocksLocation: "asteroids",
  },
  fusion_propulsion: {
    id: "fusion_propulsion",
    name: "Fusion Propulsion",
    branch: "Transportation",
    description: "+25% to ALL output. Opens Deep Space for sovereign colonization.",
    cost: { compute: 8500, capital: 160000, materials: 3200 },
    requires: ["mass_drivers", "fusion"],
    globalMult: 1.25,
    unlocksLocation: "deep_space",
  },

  // ── DEFENSE ──────────────────────────────────────────────────────────
  cyberwarfare: {
    id: "cyberwarfare",
    name: "Cyberwarfare",
    branch: "Defense",
    description: "Enables espionage against rivals (sabotage, data theft) and cyber-defense.",
    cost: { compute: 600, capital: 3000 },
  },
  security_forces: {
    id: "security_forces",
    name: "Corporate Security Forces",
    branch: "Defense",
    description: "Unlocks Corvettes — your first armed escorts.",
    cost: { compute: 1200, capital: 8000, materials: 120 },
    requires: ["cyberwarfare"],
    unlocks: ["corvette"],
  },
  corporate_military: {
    id: "corporate_military",
    name: "Corporate Military",
    branch: "Defense",
    description: "Unlocks Frigates. You can now wage real war on rival corporations.",
    cost: { compute: 2600, capital: 24000, materials: 400 },
    requires: ["security_forces"],
    unlocks: ["frigate"],
  },
  autonomous_fleets: {
    id: "autonomous_fleets",
    name: "Autonomous Fleets",
    branch: "Defense",
    description: "+10% to ALL output. Self-commanding warships need no crews.",
    cost: { compute: 4200, capital: 42000, materials: 520 },
    requires: ["corporate_military"],
    globalMult: 1.1,
  },
  directed_energy: {
    id: "directed_energy",
    name: "Directed-Energy Weapons",
    branch: "Defense",
    description: "Unlocks Cruisers. Lasers and railguns outrange conventional arms.",
    cost: { compute: 5000, capital: 60000, materials: 900 },
    requires: ["autonomous_fleets"],
    unlocks: ["cruiser"],
  },
  orbital_warfare: {
    id: "orbital_warfare",
    name: "Orbital Warfare",
    branch: "Defense",
    description: "Unlocks Dreadnoughts — capital ships that can break a planetary defense.",
    cost: { compute: 9000, capital: 140000, materials: 2400 },
    requires: ["directed_energy"],
    unlocks: ["dreadnought"],
  },
};

export const SHIPS: Record<string, Ship> = {
  corvette: {
    id: "corvette",
    name: "Corvette",
    shipClass: "Escort",
    description: "Cheap, fast escort. Numbers matter.",
    cost: { capital: 3000, materials: 40 },
    costGrowth: 1.08,
    firepower: 10,
    hull: 25,
    upkeep: { energy: 4, capital: 0.5 },
    requiresTech: "security_forces",
  },
  frigate: {
    id: "frigate",
    name: "Frigate",
    shipClass: "Line",
    description: "Workhorse warship with balanced guns and armor.",
    cost: { capital: 9000, materials: 130, compute: 100 },
    costGrowth: 1.09,
    firepower: 32,
    hull: 70,
    upkeep: { energy: 11, capital: 1.4 },
    requiresTech: "corporate_military",
  },
  cruiser: {
    id: "cruiser",
    name: "Cruiser",
    shipClass: "Heavy",
    description: "Directed-energy main battery. Anchors a battle line.",
    cost: { capital: 28000, materials: 420, compute: 400 },
    costGrowth: 1.1,
    firepower: 95,
    hull: 190,
    upkeep: { energy: 28, capital: 4 },
    requiresTech: "directed_energy",
  },
  dreadnought: {
    id: "dreadnought",
    name: "Dreadnought",
    shipClass: "Capital",
    description: "A mobile fortress. Few corporations can field even one.",
    cost: { capital: 95000, materials: 1600, compute: 1500 },
    costGrowth: 1.12,
    firepower: 320,
    hull: 650,
    upkeep: { energy: 75, capital: 12 },
    requiresTech: "orbital_warfare",
  },
};

export const STAGES: Stage[] = [
  { id: 1, name: "AI Startup", blurb: "A scrappy team and a dream." },
  { id: 2, name: "Technology Company", blurb: "Shipping products, gaining traction." },
  { id: 3, name: "Global Corporation", blurb: "A household name across every market." },
  { id: 4, name: "Orbital Conglomerate", blurb: "Your infrastructure rings the Earth." },
  { id: 5, name: "Sovereign Space Corporation", blurb: "Self-sufficient beyond the homeworld." },
  { id: 6, name: "Interplanetary Superpower", blurb: "You rival nations across the Solar System." },
];

export const MARKETS: { id: MarketId; name: string; description: string }[] = [
  {
    id: "consumer",
    name: "Consumer",
    description: "Personal AI, entertainment and devices. Vast user base and influence.",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Corporate AI, automation and logistics. High margins, fast growth.",
  },
  {
    id: "government",
    name: "Government",
    description: "Defense, infrastructure and intelligence. Stability and political cover.",
  },
];

export const RIVAL_SEEDS: RivalSeed[] = [
  {
    id: "cognis",
    name: "Cognis Labs",
    personality: "researcher",
    blurb: "A secretive research house racing for the singularity.",
    economy: 10000,
    techLevel: 1,
    influence: 6,
    military: 0,
    growth: 1.0,
  },
  {
    id: "praetor",
    name: "Praetor Systems",
    personality: "militarist",
    blurb: "Defense contractor turned warlord. Builds fleets first, asks later.",
    economy: 9000,
    techLevel: 0,
    influence: 4,
    military: 12,
    growth: 0.95,
  },
  {
    id: "lumen",
    name: "Lumen Collective",
    personality: "influencer",
    blurb: "Owns the feeds, the recommendations, and the public mood.",
    economy: 11000,
    techLevel: 1,
    influence: 14,
    military: 0,
    growth: 1.0,
  },
];

// ── World tuning ─────────────────────────────────────────────────────────
export const MARKET_GROWTH = 0.010; // base market-size growth per second
export const MARKET_MARGIN = 0.0016; // capital/sec per unit of (size × share)
export const SHARE_EASE = 0.06; // per-second convergence of share toward target
export const RIVAL_BASE_GROWTH = 0.009; // baseline rival economy growth per second
export const EVENT_INTERVAL = 50; // mean seconds between random world events
export const REG_TAX_MAX = 0.45; // capital-income tax fraction at regulation = 100

export function freshSave(): SaveState {
  const now = Date.now();
  return {
    resources: { capital: 8000, compute: 0, talent: 5, materials: 0, influence: 0 },
    buildings: { operations_center: 1, orbital_data_center: 1, comms_satellite: 1 },
    researched: [],
    fleet: {},
    rivals: RIVAL_SEEDS.map((s) => ({ ...s, hostility: 10, crippled: 0, defeated: false })),
    marketShare: { consumer: 0.12, enterprise: 0.1, government: 0.08 },
    marketSize: { consumer: 60000, enterprise: 40000, government: 28000 },
    regulation: 8,
    events: [
      { id: 0, t: now, kind: "info", text: "Incorporation complete. The Solar War begins." },
    ],
    eventSeq: 1,
    worldClock: 0,
    eventClock: 0,
    gameOver: { over: false, won: false, text: "" },
    startedAt: now,
    lastSaved: now,
  };
}
