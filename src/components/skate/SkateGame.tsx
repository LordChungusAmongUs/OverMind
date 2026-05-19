"use client";

import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────── */

type Vec2 = { x: number; y: number };

type Rail = {
  a: Vec2;
  b: Vec2;
  kind: "rail" | "ledge";
};

type Ramp = {
  x: number;
  y: number;
  w: number;
  h: number;
  // direction the player launches off the ramp (unit vector)
  dir: Vec2;
};

type Obstacle = { x: number; y: number; w: number; h: number };

type PlayerState = "GROUNDED" | "AIRBORNE" | "GRINDING" | "BAILED";

type AirInputs = {
  kickflips: number; // Down presses
  heelflips: number; // Up presses
  spinDeg: number;   // signed; +CW / -CCW
};

type GrindKind = "FiftyFifty" | "FiveOh" | "Nose" | "Crooked" | "Smith" | "Board";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; ttl: number;
  color: string;
};

type Popup = {
  x: number; y: number;
  text: string;
  score: number;
  ttl: number;
  life: number;
};

type QuarterResult = { number: number; score: number; best: string };

type Phase = "MENU" | "PRE_QUARTER" | "PLAYING" | "QUARTER_END" | "GAME_OVER";

type GameRefs = {
  // World
  rails: Rail[];
  ramps: Ramp[];
  obstacles: Obstacle[];
  worldW: number;
  worldH: number;

  // Player
  pos: Vec2;
  vel: Vec2;     // velocity in world units (per frame at 60fps)
  speed: number; // scalar pushing speed
  angle: number; // facing direction radians
  state: PlayerState;
  airT: number;
  airTMax: number;
  airHeight: number;
  air: AirInputs;
  launchKind: "Ollie" | "Nollie";
  bailT: number;
  grindRail: Rail | null;
  grindKind: GrindKind;
  grindT: number;
  grindAccum: number; // points accumulated this grind

  // Input
  keys: Record<string, boolean>;

  // Combo / score
  comboTricks: string[];
  comboScore: number;
  comboMul: number;
  comboT: number; // remaining frames for combo window

  // Animation
  pushAnim: number;     // pulses while pushing
  wheelSpin: number;
  popups: Popup[];
  particles: Particle[];

  // Camera
  cam: Vec2;

  // Quarter / game
  phase: Phase;
  phaseT: number;
  quarter: number;
  quarterT: number; // seconds remaining
  quarterDuration: number;
  quarterScore: number;
  bestThisQuarter: { name: string; score: number };
  results: QuarterResult[];

  // HUD signal
  hudTick: number;
};

/* ────────────────────────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────────────────────────── */

// Authentic GBC-ish viewport. We render at this size, then scale up via CSS.
const VIEW_W = 240;
const VIEW_H = 176;
const RENDER_SCALE = 3;

const TILE = 16;
const WORLD_W = 60 * TILE; // 960
const WORLD_H = 44 * TILE; // 704

// Physics
const MAX_SPEED = 2.6;
const PUSH_GAIN = 0.12;
const ROLL_FRICTION = 0.992;
const BRAKE = 0.90;
const TURN_RATE = 0.07;
const REVERT_SPIN = Math.PI;        // 180 degrees per revert press
const AIR_BASE_FRAMES = 42;         // base air time for ollie
const AIR_NOLLIE_BONUS = 6;
const POP_HEIGHT = 9;               // pixels of perceived hop

// Trick scoring
const SCORE_OLLIE = 50;
const SCORE_NOLLIE = 75;
const SCORE_KICKFLIP = 200;
const SCORE_HEELFLIP = 200;
const SCORE_180 = 100;
const SCORE_360_BONUS = 100;
const SCORE_540_BONUS = 250;
const SCORE_720_BONUS = 500;

const COMBO_WINDOW_FRAMES = 90; // ~1.5s to chain
const GRIND_PER_FRAME = 6;

const QUARTER_SECONDS = 60;
const TOTAL_QUARTERS = 4;

/* GBC-ish palette */
const PAL = {
  grassA: "#7ea65c",
  grassB: "#5d8a3f",
  grassEdge: "#3e5e29",
  concreteA: "#cdc9b2",
  concreteB: "#a8a48d",
  concreteEdge: "#807a5f",
  curb: "#62583f",
  rail: "#b9bcc8",
  railShade: "#646977",
  ledgeTop: "#b9a079",
  ledgeSide: "#7a6440",
  rampLight: "#d5d0b6",
  rampDark: "#827a5b",
  shadow: "rgba(0,0,0,0.32)",
  outline: "#1a1a1f",
  // Player
  hair: "#3c2a18",
  skin: "#e8b783",
  shirt: "#d23a3a",
  shirtShade: "#8a1f1f",
  pants: "#324aa8",
  pantsShade: "#1e2f72",
  board: "#9c5b29",
  boardShade: "#5a3014",
  trucks: "#cfd2dc",
  wheels: "#f1edcf",
  // HUD
  uiGreen: "#3df04a",
  uiGreenDim: "#1c8027",
  uiRed: "#ff4d4d",
  uiYellow: "#f7d44c",
  uiText: "#dff0c5",
  uiTextDark: "#0f1808",
  uiPanel: "#102414",
  uiPanelLight: "#1e3a22",
};

/* ────────────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────────────── */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist2 = (a: Vec2, b: Vec2) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (v: Vec2): Vec2 => {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
};

function distancePointSeg(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number; proj: Vec2 } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const proj = { x: a.x + dx * t, y: a.y + dy * t };
  return { d: Math.hypot(p.x - proj.x, p.y - proj.y), t, proj };
}

function rectsOverlap(a: Obstacle, b: Obstacle) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Generate the skate park */
function buildPark(): { rails: Rail[]; ramps: Ramp[]; obstacles: Obstacle[] } {
  const rails: Rail[] = [
    // Long center rail
    { a: { x: 280, y: 220 }, b: { x: 540, y: 220 }, kind: "rail" },
    // Diagonal rail
    { a: { x: 140, y: 380 }, b: { x: 360, y: 470 }, kind: "rail" },
    // Top right rail
    { a: { x: 620, y: 140 }, b: { x: 800, y: 140 }, kind: "rail" },
    // Bottom long ledge
    { a: { x: 180, y: 560 }, b: { x: 660, y: 560 }, kind: "ledge" },
    // Mid right ledge
    { a: { x: 720, y: 320 }, b: { x: 720, y: 480 }, kind: "ledge" },
    // Short rail near spawn
    { a: { x: 420, y: 340 }, b: { x: 540, y: 340 }, kind: "rail" },
  ];

  const ramps: Ramp[] = [
    { x: 100,  y: 110, w: 80, h: 32, dir: { x: 0, y: 1 } },   // top-left, launches downward
    { x: 820,  y: 540, w: 80, h: 32, dir: { x: -1, y: 0 } },  // bottom-right
    { x: 460,  y: 620, w: 80, h: 32, dir: { x: 0, y: -1 } },  // bottom, launches up
  ];

  // No solid obstacles — keep play area free. Could add planters etc.
  const obstacles: Obstacle[] = [];

  return { rails, ramps, obstacles };
}

/* ────────────────────────────────────────────────────────────────────
   TRICK NAMING & SCORING
   ──────────────────────────────────────────────────────────────────── */

function spinLabel(deg: number): string {
  const a = Math.abs(deg);
  if (a < 90) return "";
  if (a < 270) return "180";
  if (a < 450) return "360";
  if (a < 630) return "540";
  if (a < 810) return "720";
  return "900+";
}

function trickName(launch: "Ollie" | "Nollie", air: AirInputs): string {
  const { kickflips: k, heelflips: h, spinDeg } = air;
  const spin = spinLabel(spinDeg);
  const stance = launch === "Nollie" ? "Nollie " : "";

  // Flat (no flips)
  if (k === 0 && h === 0) {
    if (spin === "") return launch;
    return `${stance}${spin} Spin`;
  }

  // Hardflip-style: 1 each
  if (k === 1 && h === 1) {
    const base = "Hardflip";
    return spin === "" ? `${stance}${base}` : `${stance}${spin} ${base}`;
  }

  // Pure kickflips
  if (k >= 1 && h === 0) {
    const mult = k === 1 ? "" : k === 2 ? "Double " : k === 3 ? "Triple " : `${k}x `;
    const base = `${mult}Kickflip`;
    if (spin === "360") return `${stance}Tre Flip`;
    if (spin === "") return `${stance}${base}`;
    return `${stance}${spin} ${base}`;
  }

  // Pure heelflips
  if (h >= 1 && k === 0) {
    const mult = h === 1 ? "" : h === 2 ? "Double " : h === 3 ? "Triple " : `${h}x `;
    const base = `${mult}Heelflip`;
    if (spin === "360") return `${stance}360 Heelflip`;
    if (spin === "") return `${stance}${base}`;
    return `${stance}${spin} ${base}`;
  }

  // Mixed combos
  const more = k > h ? "Varial Kickflip" : "Varial Heelflip";
  return spin === "" ? `${stance}${more}` : `${stance}${spin} ${more}`;
}

function trickScore(launch: "Ollie" | "Nollie", air: AirInputs): number {
  let s = launch === "Nollie" ? SCORE_NOLLIE : SCORE_OLLIE;
  s += air.kickflips * SCORE_KICKFLIP;
  s += air.heelflips * SCORE_HEELFLIP;
  // mixed bonus
  if (air.kickflips > 0 && air.heelflips > 0) s += 100;
  // spin scoring
  const a = Math.abs(air.spinDeg);
  if (a >= 180) s += SCORE_180;
  if (a >= 360) s += SCORE_360_BONUS;
  if (a >= 540) s += SCORE_540_BONUS;
  if (a >= 720) s += SCORE_720_BONUS;
  // doubled-up flip bonus
  if (air.kickflips >= 2 || air.heelflips >= 2) s += 200;
  return s;
}

function grindName(k: GrindKind): string {
  switch (k) {
    case "FiftyFifty": return "50-50 Grind";
    case "FiveOh":     return "5-0 Grind";
    case "Nose":       return "Nosegrind";
    case "Crooked":    return "Crooked Grind";
    case "Smith":      return "Smith Grind";
    case "Board":      return "Boardslide";
  }
}

/* ────────────────────────────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────────────────────────────── */

export default function SkateGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef<GameRefs | null>(null);
  const rafRef = useRef<number | null>(null);

  // Light HUD state — updated cheaply, not every frame
  const [hud, setHud] = useState({
    phase: "MENU" as Phase,
    quarter: 1,
    quarterT: QUARTER_SECONDS,
    quarterScore: 0,
    comboTricks: [] as string[],
    comboScore: 0,
    comboMul: 1,
    comboActive: false,
    lastTrick: "",
    lastTrickScore: 0,
    results: [] as QuarterResult[],
    bestName: "",
    bestScore: 0,
    state: "GROUNDED" as PlayerState,
  });

  /* INITIALIZE */
  useEffect(() => {
    const park = buildPark();
    refs.current = {
      rails: park.rails,
      ramps: park.ramps,
      obstacles: park.obstacles,
      worldW: WORLD_W,
      worldH: WORLD_H,

      pos: { x: 480, y: 380 },
      vel: { x: 0, y: 0 },
      speed: 0,
      angle: -Math.PI / 2, // facing up
      state: "GROUNDED",
      airT: 0,
      airTMax: 0,
      airHeight: 0,
      air: { kickflips: 0, heelflips: 0, spinDeg: 0 },
      launchKind: "Ollie",
      bailT: 0,
      grindRail: null,
      grindKind: "FiftyFifty",
      grindT: 0,
      grindAccum: 0,

      keys: {},

      comboTricks: [],
      comboScore: 0,
      comboMul: 1,
      comboT: 0,

      pushAnim: 0,
      wheelSpin: 0,
      popups: [],
      particles: [],

      cam: { x: 0, y: 0 },

      phase: "MENU",
      phaseT: 0,
      quarter: 1,
      quarterT: QUARTER_SECONDS,
      quarterDuration: QUARTER_SECONDS,
      quarterScore: 0,
      bestThisQuarter: { name: "—", score: 0 },
      results: [],

      hudTick: 0,
    };
  }, []);

  /* INPUT */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const r = refs.current;
      if (!r) return;
      const k = e.key;

      // Prevent scroll for arrows / space
      if (k === " " || k.startsWith("Arrow")) e.preventDefault();

      // Edge-detect: only fire on keydown transitions
      const fresh = !r.keys[k];
      r.keys[k] = true;
      if (!fresh) return;

      // Menu / between-states
      if (r.phase === "MENU") {
        if (k === " " || k === "Enter") {
          r.phase = "PRE_QUARTER";
          r.phaseT = 120; // ~2s countdown
        }
        return;
      }
      if (r.phase === "QUARTER_END") {
        if (k === " " || k === "Enter") {
          r.phase = "PRE_QUARTER";
          r.phaseT = 120;
        }
        return;
      }
      if (r.phase === "GAME_OVER") {
        if (k === " " || k === "Enter") {
          // Reset
          r.quarter = 1;
          r.results = [];
          r.quarterScore = 0;
          r.bestThisQuarter = { name: "—", score: 0 };
          r.phase = "PRE_QUARTER";
          r.phaseT = 120;
        }
        return;
      }
      if (r.phase !== "PLAYING") return;

      // GROUND inputs
      if (r.state === "GROUNDED") {
        if (k === "ArrowDown") {
          // Ollie launch
          r.state = "AIRBORNE";
          r.launchKind = "Ollie";
          r.air = { kickflips: 0, heelflips: 0, spinDeg: 0 };
          const dur = AIR_BASE_FRAMES;
          r.airT = dur;
          r.airTMax = dur;
          spawnDust(r, 6);
        } else if (k === "ArrowUp") {
          // Nollie launch
          r.state = "AIRBORNE";
          r.launchKind = "Nollie";
          r.air = { kickflips: 0, heelflips: 0, spinDeg: 0 };
          const dur = AIR_BASE_FRAMES + AIR_NOLLIE_BONUS;
          r.airT = dur;
          r.airTMax = dur;
          spawnDust(r, 6);
        } else if (k === "ArrowLeft") {
          // CCW revert
          r.angle -= REVERT_SPIN;
          r.comboTricks.push("Revert");
          r.comboScore += 25;
          r.comboT = COMBO_WINDOW_FRAMES;
          spawnDust(r, 3);
        } else if (k === "ArrowRight") {
          // CW revert
          r.angle += REVERT_SPIN;
          r.comboTricks.push("Revert");
          r.comboScore += 25;
          r.comboT = COMBO_WINDOW_FRAMES;
          spawnDust(r, 3);
        }
      }
      // AIR inputs
      else if (r.state === "AIRBORNE") {
        if (k === "ArrowDown") r.air.kickflips += 1;
        else if (k === "ArrowUp") r.air.heelflips += 1;
        else if (k === "ArrowLeft") r.air.spinDeg -= 180;
        else if (k === "ArrowRight") r.air.spinDeg += 180;
      }
    };

    const up = (e: KeyboardEvent) => {
      const r = refs.current;
      if (!r) return;
      r.keys[e.key] = false;
    };

    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* GAME LOOP */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let last = performance.now();
    let acc = 0;
    const step = 1000 / 60;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      while (acc >= step) {
        update();
        acc -= step;
      }
      render(ctx);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ────────────────────────────────────────────────────────────────
     UPDATE
     ──────────────────────────────────────────────────────────────── */

  function update() {
    const r = refs.current;
    if (!r) return;

    // Phase transitions
    if (r.phase === "MENU") {
      // Idle drifting in background
      r.pos.x = 480; r.pos.y = 380;
    } else if (r.phase === "PRE_QUARTER") {
      r.phaseT -= 1;
      if (r.phaseT <= 0) {
        r.phase = "PLAYING";
        r.quarterT = QUARTER_SECONDS;
        r.quarterScore = 0;
        r.bestThisQuarter = { name: "—", score: 0 };
        r.comboTricks = []; r.comboScore = 0; r.comboMul = 1; r.comboT = 0;
        r.pos = { x: 480, y: 380 };
        r.vel = { x: 0, y: 0 };
        r.speed = 0;
        r.angle = -Math.PI / 2;
        r.state = "GROUNDED";
        r.popups = []; r.particles = [];
      }
    } else if (r.phase === "QUARTER_END") {
      r.phaseT -= 1;
    } else if (r.phase === "GAME_OVER") {
      r.phaseT -= 1;
    }

    if (r.phase === "PLAYING") {
      tickPlay(r);
    }

    // Cheap HUD sync (60Hz)
    r.hudTick += 1;
    if (r.hudTick % 4 === 0) {
      setHud({
        phase: r.phase,
        quarter: r.quarter,
        quarterT: Math.max(0, r.quarterT),
        quarterScore: Math.floor(r.quarterScore),
        comboTricks: r.comboTricks.slice(-4),
        comboScore: Math.floor(r.comboScore),
        comboMul: r.comboMul,
        comboActive: r.comboT > 0,
        lastTrick: r.bestThisQuarter.name,
        lastTrickScore: r.bestThisQuarter.score,
        results: r.results.slice(),
        bestName: r.bestThisQuarter.name,
        bestScore: r.bestThisQuarter.score,
        state: r.state,
      });
    }
  }

  function tickPlay(r: GameRefs) {
    // Quarter timer
    r.quarterT -= 1 / 60;
    if (r.quarterT <= 0) {
      finishQuarter(r);
      return;
    }

    // Apply input — push/brake while grounded
    const k = r.keys;
    if (r.state === "GROUNDED") {
      if (k[" "]) {
        r.speed = Math.min(MAX_SPEED, r.speed + PUSH_GAIN);
        r.pushAnim = (r.pushAnim + 1) % 24;
      }
      if (k["Shift"]) {
        r.speed *= BRAKE;
        spawnDust(r, 1);
      }
      // Tiny natural deceleration
      r.speed *= ROLL_FRICTION;
      if (Math.abs(r.speed) < 0.01) r.speed = 0;

      // velocity from heading + speed
      r.vel.x = Math.cos(r.angle) * r.speed;
      r.vel.y = Math.sin(r.angle) * r.speed;
      r.pos.x += r.vel.x;
      r.pos.y += r.vel.y;

      // Check ramps
      for (const ramp of r.ramps) {
        if (
          r.pos.x > ramp.x && r.pos.x < ramp.x + ramp.w &&
          r.pos.y > ramp.y && r.pos.y < ramp.y + ramp.h &&
          r.speed > 1.0
        ) {
          // launch
          r.state = "AIRBORNE";
          r.launchKind = "Ollie";
          r.air = { kickflips: 0, heelflips: 0, spinDeg: 0 };
          r.airT = AIR_BASE_FRAMES + 18;
          r.airTMax = r.airT;
          r.angle = Math.atan2(ramp.dir.y, ramp.dir.x);
          spawnDust(r, 10);
          break;
        }
      }

      r.wheelSpin += r.speed * 0.4;
    } else if (r.state === "AIRBORNE") {
      // Continue moving along velocity vector at air speed
      r.pos.x += r.vel.x;
      r.pos.y += r.vel.y;
      r.airT -= 1;
      const t = r.airT / Math.max(1, r.airTMax);
      // Parabolic arc for visual height
      r.airHeight = Math.sin((1 - t) * Math.PI) * (POP_HEIGHT + r.air.kickflips * 1.5 + r.air.heelflips * 1.5);

      if (r.airT <= 0) {
        // LAND
        landFromAir(r);
      }
    } else if (r.state === "GRINDING") {
      if (!r.grindRail) {
        r.state = "GROUNDED";
      } else {
        // Slide along rail
        const rail = r.grindRail;
        const railVec = { x: rail.b.x - rail.a.x, y: rail.b.y - rail.a.y };
        const railLen = Math.hypot(railVec.x, railVec.y) || 1;
        const rdir = { x: railVec.x / railLen, y: railVec.y / railLen };
        // Pick direction matching player facing
        const dot = Math.cos(r.angle) * rdir.x + Math.sin(r.angle) * rdir.y;
        const sign = dot >= 0 ? 1 : -1;
        const sp = Math.max(1.4, Math.min(MAX_SPEED, r.speed));
        r.pos.x += rdir.x * sp * sign;
        r.pos.y += rdir.y * sp * sign;
        // Snap onto rail (perpendicular)
        const proj = distancePointSeg(r.pos, rail.a, rail.b);
        r.pos.x = proj.proj.x;
        r.pos.y = proj.proj.y;
        // Angle aligns with rail
        r.angle = Math.atan2(rdir.y * sign, rdir.x * sign);

        // Award grind points
        r.grindT += 1;
        r.grindAccum += GRIND_PER_FRAME;
        r.comboScore += GRIND_PER_FRAME;
        r.comboT = COMBO_WINDOW_FRAMES;

        // End grind: bail off the rail end, hop input, or shift
        const offEnd = proj.t <= 0.001 || proj.t >= 0.999;
        const hop = k["ArrowDown"] || k["ArrowUp"];
        const brake = k["Shift"];
        if (offEnd || hop || brake) {
          // Convert to a trick: pop off the grind
          const name = `${grindName(r.grindKind)} (${Math.floor(r.grindAccum)})`;
          pushTrick(r, name, Math.floor(r.grindAccum));
          r.grindRail = null;
          r.grindAccum = 0;
          r.grindT = 0;
          if (hop) {
            r.state = "AIRBORNE";
            r.launchKind = "Ollie";
            r.air = { kickflips: 0, heelflips: 0, spinDeg: 0 };
            r.airT = AIR_BASE_FRAMES - 6;
            r.airTMax = r.airT;
            // push off slightly
          } else {
            r.state = "GROUNDED";
          }
        }
      }
    } else if (r.state === "BAILED") {
      r.bailT -= 1;
      if (r.bailT <= 0) {
        r.state = "GROUNDED";
        r.speed = 0;
        r.angle = -Math.PI / 2;
      }
    }

    // Bounds — push back into world
    if (r.pos.x < 24) { r.pos.x = 24; r.speed *= 0.5; }
    if (r.pos.x > r.worldW - 24) { r.pos.x = r.worldW - 24; r.speed *= 0.5; }
    if (r.pos.y < 24) { r.pos.y = 24; r.speed *= 0.5; }
    if (r.pos.y > r.worldH - 24) { r.pos.y = r.worldH - 24; r.speed *= 0.5; }

    // Combo timer
    if (r.comboT > 0) {
      r.comboT -= 1;
      if (r.comboT <= 0) endCombo(r);
    }

    // Particles & popups
    for (const p of r.particles) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life += 1;
    }
    r.particles = r.particles.filter(p => p.life < p.ttl);

    for (const pop of r.popups) {
      pop.y -= 0.6;
      pop.life += 1;
    }
    r.popups = r.popups.filter(p => p.life < p.ttl);

    // Camera follow
    const tx = clamp(r.pos.x - VIEW_W / 2, 0, r.worldW - VIEW_W);
    const ty = clamp(r.pos.y - VIEW_H / 2, 0, r.worldH - VIEW_H);
    r.cam.x = lerp(r.cam.x, tx, 0.15);
    r.cam.y = lerp(r.cam.y, ty, 0.15);
  }

  function landFromAir(r: GameRefs) {
    r.airHeight = 0;

    // Check rail proximity for grind
    let bestRail: Rail | null = null;
    let bestDist = Infinity;
    for (const rail of r.rails) {
      const { d, t } = distancePointSeg(r.pos, rail.a, rail.b);
      if (t > 0 && t < 1 && d < 14 && d < bestDist) {
        bestRail = rail;
        bestDist = d;
      }
    }

    // Is the player holding any dpad for a grind?
    const k = r.keys;
    const holdingAny = k["ArrowDown"] || k["ArrowUp"] || k["ArrowLeft"] || k["ArrowRight"];

    if (bestRail && holdingAny) {
      // Start grind
      const gk: GrindKind =
        k["ArrowDown"] ? "FiveOh" :
        k["ArrowUp"]   ? "Nose" :
        k["ArrowLeft"] ? "Crooked" :
        k["ArrowRight"]? "Smith" :
        "FiftyFifty";
      // If holding two opposite arrows, fall back to board
      if (k["ArrowLeft"] && k["ArrowRight"]) {
        // Boardslide
        r.grindKind = "Board";
      } else {
        r.grindKind = gk;
      }
      r.grindRail = bestRail;
      r.state = "GRINDING";
      r.grindT = 0;
      r.grindAccum = 0;

      // Score the air trick that led into grind
      const name = trickName(r.launchKind, r.air);
      const score = trickScore(r.launchKind, r.air);
      pushTrick(r, name + " → " + grindName(r.grindKind), score);
      return;
    }

    // Plain land
    const name = trickName(r.launchKind, r.air);
    const score = trickScore(r.launchKind, r.air);

    // Check spin alignment for bail risk (too many flips and no spin = sketchy? we keep it forgiving)
    pushTrick(r, name, score);

    // Apply spin to facing
    r.angle += (r.air.spinDeg * Math.PI) / 180;

    r.state = "GROUNDED";
    spawnDust(r, 6);
  }

  function pushTrick(r: GameRefs, name: string, score: number) {
    r.comboTricks.push(name);
    if (r.comboTricks.length > 12) r.comboTricks.shift();
    // base score adds to combo total
    r.comboScore += score;
    // each subsequent trick bumps multiplier
    if (r.comboT > 0) r.comboMul = Math.min(8, r.comboMul + 0.5);
    r.comboT = COMBO_WINDOW_FRAMES;

    r.popups.push({
      x: r.pos.x, y: r.pos.y - 18,
      text: `+${score}  ${name}`,
      score,
      ttl: 70, life: 0,
    });
  }

  function endCombo(r: GameRefs) {
    if (r.comboTricks.length === 0) return;
    const total = Math.floor(r.comboScore * r.comboMul);
    r.quarterScore += total;
    if (total > r.bestThisQuarter.score) {
      r.bestThisQuarter = {
        name: r.comboTricks.slice(-3).join(" + "),
        score: total,
      };
    }
    r.popups.push({
      x: r.pos.x, y: r.pos.y - 32,
      text: `COMBO ×${r.comboMul.toFixed(1)}  +${total}`,
      score: total,
      ttl: 110, life: 0,
    });
    r.comboTricks = [];
    r.comboScore = 0;
    r.comboMul = 1;
  }

  function finishQuarter(r: GameRefs) {
    // Cash out any active combo
    if (r.comboTricks.length > 0) {
      r.comboT = 0;
      endCombo(r);
    }
    r.results.push({
      number: r.quarter,
      score: Math.floor(r.quarterScore),
      best: r.bestThisQuarter.name,
    });
    if (r.quarter >= TOTAL_QUARTERS) {
      r.phase = "GAME_OVER";
      r.phaseT = 0;
    } else {
      r.quarter += 1;
      r.phase = "QUARTER_END";
      r.phaseT = 0;
    }
    r.state = "GROUNDED";
  }

  function spawnDust(r: GameRefs, n: number) {
    for (let i = 0; i < n; i++) {
      r.particles.push({
        x: r.pos.x + (Math.random() - 0.5) * 6,
        y: r.pos.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1.4,
        vy: (Math.random() - 0.5) * 1.4,
        life: 0,
        ttl: 18 + Math.floor(Math.random() * 10),
        color: Math.random() < 0.5 ? PAL.concreteB : PAL.concreteEdge,
      });
    }
  }

  /* ────────────────────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────────────────────── */

  function render(ctx: CanvasRenderingContext2D) {
    const r = refs.current;
    if (!r) return;

    // Background grass — base
    ctx.fillStyle = PAL.grassA;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // World-relative draws use camera offset
    const cx = Math.floor(r.cam.x);
    const cy = Math.floor(r.cam.y);

    drawGround(ctx, cx, cy);
    drawConcrete(ctx, cx, cy);
    drawRamps(ctx, r, cx, cy);
    drawRails(ctx, r, cx, cy);
    drawParticles(ctx, r, cx, cy);
    drawPlayer(ctx, r, cx, cy);
    drawPopups(ctx, r, cx, cy);
    drawOverlay(ctx, r);
  }

  function drawGround(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Checkered grass pattern
    const startX = -((cx) % (TILE * 2));
    const startY = -((cy) % (TILE * 2));
    for (let y = startY - TILE * 2; y < VIEW_H + TILE * 2; y += TILE) {
      for (let x = startX - TILE * 2; x < VIEW_W + TILE * 2; x += TILE) {
        const wx = x + cx, wy = y + cy;
        const tx = Math.floor(wx / TILE);
        const ty = Math.floor(wy / TILE);
        const dark = ((tx + ty) & 1) === 0;
        ctx.fillStyle = dark ? PAL.grassA : PAL.grassB;
        ctx.fillRect(x, y, TILE, TILE);
        // tufts
        if (((tx * 73856093) ^ (ty * 19349663)) % 17 === 0) {
          ctx.fillStyle = PAL.grassEdge;
          ctx.fillRect(x + 4, y + 5, 2, 1);
          ctx.fillRect(x + 9, y + 11, 2, 1);
        }
      }
    }
  }

  function drawConcrete(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Big concrete plaza in the middle
    const px = 80 - cx, py = 80 - cy, pw = 800, ph = 540;
    // Outer curb darker
    ctx.fillStyle = PAL.curb;
    ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    // Concrete pattern (checker)
    for (let y = 0; y < ph; y += TILE) {
      for (let x = 0; x < pw; x += TILE) {
        const tx = (x / TILE) | 0;
        const ty = (y / TILE) | 0;
        ctx.fillStyle = ((tx + ty) & 1) === 0 ? PAL.concreteA : PAL.concreteB;
        ctx.fillRect(px + x, py + y, TILE, TILE);
      }
    }
    // Outline lines
    ctx.fillStyle = PAL.concreteEdge;
    ctx.fillRect(px, py, pw, 1);
    ctx.fillRect(px, py + ph - 1, pw, 1);
    ctx.fillRect(px, py, 1, ph);
    ctx.fillRect(px + pw - 1, py, 1, ph);

    // Faux quarter-pipe outline in lower-right
    ctx.fillStyle = PAL.rampDark;
    ctx.fillRect(px + 540 - cx + cx, py + 380 - cy + cy, 0, 0); // noop guard

    // Pretty cracks
    ctx.fillStyle = PAL.concreteEdge;
    ctx.fillRect(px + 120, py + 220, 80, 1);
    ctx.fillRect(px + 200, py + 220, 1, 40);
    ctx.fillRect(px + 540, py + 60, 60, 1);
  }

  function drawRamps(ctx: CanvasRenderingContext2D, r: GameRefs, cx: number, cy: number) {
    for (const ramp of r.ramps) {
      const x = ramp.x - cx, y = ramp.y - cy;
      // Base
      ctx.fillStyle = PAL.rampDark;
      ctx.fillRect(x, y, ramp.w, ramp.h);
      // Top edge highlight (the lip)
      ctx.fillStyle = PAL.rampLight;
      if (ramp.dir.y > 0) ctx.fillRect(x, y, ramp.w, 3);
      if (ramp.dir.y < 0) ctx.fillRect(x, y + ramp.h - 3, ramp.w, 3);
      if (ramp.dir.x > 0) ctx.fillRect(x, y, 3, ramp.h);
      if (ramp.dir.x < 0) ctx.fillRect(x + ramp.w - 3, y, 3, ramp.h);
      // Texture lines
      ctx.fillStyle = PAL.outline;
      for (let i = 4; i < ramp.w; i += 8) {
        ctx.fillRect(x + i, y + 3, 1, ramp.h - 6);
      }
    }
  }

  function drawRails(ctx: CanvasRenderingContext2D, r: GameRefs, cx: number, cy: number) {
    for (const rail of r.rails) {
      const ax = rail.a.x - cx, ay = rail.a.y - cy;
      const bx = rail.b.x - cx, by = rail.b.y - cy;
      if (rail.kind === "ledge") {
        // Ledge: thick brown plank
        // axis-aligned only (we constructed it that way)
        const minx = Math.min(ax, bx), maxx = Math.max(ax, bx);
        const miny = Math.min(ay, by), maxy = Math.max(ay, by);
        const w = Math.max(6, maxx - minx);
        const h = Math.max(6, maxy - miny);
        ctx.fillStyle = PAL.ledgeSide;
        ctx.fillRect(minx - 3, miny - 3, w + 6, h + 6);
        ctx.fillStyle = PAL.ledgeTop;
        ctx.fillRect(minx - 2, miny - 2, w + 4, h + 4);
        ctx.fillStyle = PAL.outline;
        ctx.fillRect(minx - 3, miny - 3, w + 6, 1);
        ctx.fillRect(minx - 3, miny + h + 2, w + 6, 1);
      } else {
        // Steel rail with shadow
        ctx.strokeStyle = PAL.shadow;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ax, ay + 2);
        ctx.lineTo(bx, by + 2);
        ctx.stroke();
        ctx.strokeStyle = PAL.railShade;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.strokeStyle = PAL.rail;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 1);
        ctx.lineTo(bx, by - 1);
        ctx.stroke();
        // Support posts at ends
        ctx.fillStyle = PAL.railShade;
        ctx.fillRect(ax - 1, ay, 2, 5);
        ctx.fillRect(bx - 1, by, 2, 5);
      }
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D, r: GameRefs, cx: number, cy: number) {
    for (const p of r.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 2, 2);
    }
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, r: GameRefs, cx: number, cy: number) {
    const px = r.pos.x - cx;
    const py = r.pos.y - cy;

    // Shadow (always at ground level, even when airborne)
    ctx.fillStyle = PAL.shadow;
    ellipse(ctx, px, py + 5, 7, 3);

    // Apply airborne offset
    const drawY = py - (r.state === "AIRBORNE" ? r.airHeight : 0);

    // Spin angle: includes in-air spin animation
    let angle = r.angle;
    if (r.state === "AIRBORNE") {
      const tProgress = 1 - r.airT / Math.max(1, r.airTMax);
      angle += (r.air.spinDeg * Math.PI / 180) * tProgress;
    }

    ctx.save();
    ctx.translate(Math.round(px), Math.round(drawY));
    ctx.rotate(angle + Math.PI / 2); // sprite drawn pointing "up" by default
    drawSkater(ctx, r);
    ctx.restore();
  }

  // Draw a chunky GBC-style top-down skater sprite. Center at (0,0). +Y is forward direction.
  function drawSkater(ctx: CanvasRenderingContext2D, r: GameRefs) {
    // Board (drawn first, beneath person)
    // Board oriented along Y axis
    const boardLen = 14;
    const boardWid = 4;
    // Wheels animation: rotate slightly with spin
    ctx.fillStyle = PAL.boardShade;
    rect(ctx, -boardWid / 2 - 1, -boardLen / 2 - 1, boardWid + 2, boardLen + 2);
    ctx.fillStyle = PAL.board;
    rect(ctx, -boardWid / 2, -boardLen / 2, boardWid, boardLen);
    // Wood grain
    ctx.fillStyle = PAL.boardShade;
    rect(ctx, -boardWid / 2, -1, boardWid, 1);
    // Trucks
    ctx.fillStyle = PAL.trucks;
    rect(ctx, -boardWid / 2 - 1, -boardLen / 2 + 2, boardWid + 2, 1);
    rect(ctx, -boardWid / 2 - 1,  boardLen / 2 - 3, boardWid + 2, 1);
    // Wheels (offset blink with spin animation)
    const wob = (Math.floor(r.wheelSpin) & 1) ? 0 : 1;
    ctx.fillStyle = PAL.wheels;
    rect(ctx, -boardWid / 2 - 2, -boardLen / 2 + 2 + wob, 1, 1);
    rect(ctx,  boardWid / 2 + 1, -boardLen / 2 + 2, 1, 1);
    rect(ctx, -boardWid / 2 - 2,  boardLen / 2 - 3, 1, 1);
    rect(ctx,  boardWid / 2 + 1,  boardLen / 2 - 3 + wob, 1, 1);

    // Player body — top-down. Head is a small circle, shoulders wider.
    // Pants
    ctx.fillStyle = PAL.pantsShade;
    rect(ctx, -4, -3, 8, 8);
    ctx.fillStyle = PAL.pants;
    rect(ctx, -3, -2, 6, 6);
    // Shirt (above pants in top-down, top half of body)
    ctx.fillStyle = PAL.shirtShade;
    rect(ctx, -5, -6, 10, 5);
    ctx.fillStyle = PAL.shirt;
    rect(ctx, -4, -5, 8, 3);
    // Arms (when pushing)
    if (r.pushAnim > 0 && r.state === "GROUNDED") {
      const armOut = Math.floor(r.pushAnim / 6) % 2;
      ctx.fillStyle = PAL.skin;
      rect(ctx, -6, -3 + armOut, 2, 2);
      rect(ctx, 4, -3 - armOut, 2, 2);
    } else {
      // Arms at sides
      ctx.fillStyle = PAL.skin;
      rect(ctx, -6, -3, 2, 3);
      rect(ctx, 4, -3, 2, 3);
    }
    // Head
    ctx.fillStyle = PAL.hair;
    rect(ctx, -3, -8, 6, 4);
    // Skin under hair (face bottom edge)
    ctx.fillStyle = PAL.skin;
    rect(ctx, -2, -5, 4, 1);
    // Helmet/cap top hint
    ctx.fillStyle = "#000";
    rect(ctx, -2, -8, 4, 1);

    // Outline (subtle)
    ctx.fillStyle = PAL.outline;
    // top of head
    rect(ctx, -3, -9, 6, 1);
  }

  function drawPopups(ctx: CanvasRenderingContext2D, r: GameRefs, cx: number, cy: number) {
    for (const p of r.popups) {
      const alpha = 1 - (p.life / p.ttl);
      ctx.globalAlpha = alpha;
      const x = Math.round(p.x - cx);
      const y = Math.round(p.y - cy);
      pixelText(ctx, p.text, x - p.text.length * 2, y, PAL.uiText, PAL.outline);
      ctx.globalAlpha = 1;
    }
  }

  /* ────────────────────────────────────────────────────────────────
     OVERLAY (in-canvas HUD elements like timer / banners)
     ──────────────────────────────────────────────────────────────── */

  function drawOverlay(ctx: CanvasRenderingContext2D, r: GameRefs) {
    // Top bar
    ctx.fillStyle = PAL.uiPanel;
    ctx.fillRect(0, 0, VIEW_W, 14);
    ctx.fillStyle = PAL.uiGreenDim;
    ctx.fillRect(0, 13, VIEW_W, 1);

    // Quarter indicator (left)
    pixelText(ctx, `Q${r.quarter}/${TOTAL_QUARTERS}`, 4, 4, PAL.uiGreen, PAL.outline);

    // Timer (center)
    const t = Math.max(0, Math.ceil(r.quarterT));
    const m = Math.floor(t / 60);
    const s = t % 60;
    const tstr = `${m}:${s.toString().padStart(2, "0")}`;
    pixelText(ctx, tstr, Math.floor(VIEW_W / 2) - tstr.length * 2, 4, PAL.uiYellow, PAL.outline);

    // Quarter score (right)
    const sstr = `${Math.floor(r.quarterScore).toString().padStart(6, "0")}`;
    pixelText(ctx, sstr, VIEW_W - sstr.length * 4 - 4, 4, PAL.uiText, PAL.outline);

    // Combo bar bottom-left
    if (r.comboT > 0 && r.comboTricks.length > 0) {
      const recent = r.comboTricks.slice(-3).join(" + ");
      pixelText(ctx, recent, 4, VIEW_H - 22, PAL.uiGreen, PAL.outline);
      pixelText(ctx, `x${r.comboMul.toFixed(1)}  ${Math.floor(r.comboScore)}`, 4, VIEW_H - 12, PAL.uiYellow, PAL.outline);
      // Window bar
      const w = Math.floor((r.comboT / COMBO_WINDOW_FRAMES) * 60);
      ctx.fillStyle = PAL.uiGreenDim;
      ctx.fillRect(4, VIEW_H - 4, 60, 2);
      ctx.fillStyle = PAL.uiGreen;
      ctx.fillRect(4, VIEW_H - 4, w, 2);
    }

    // State indicator bottom-right
    let stateLabel = "";
    if (r.state === "AIRBORNE") stateLabel = "AIR";
    else if (r.state === "GRINDING") stateLabel = "GRIND";
    else if (r.state === "BAILED") stateLabel = "BAIL";
    if (stateLabel) {
      pixelText(ctx, stateLabel, VIEW_W - stateLabel.length * 4 - 4, VIEW_H - 12,
        r.state === "GRINDING" ? PAL.uiYellow : PAL.uiText, PAL.outline);
    }

    if (r.phase === "MENU") drawMenu(ctx, r);
    if (r.phase === "PRE_QUARTER") drawPreQuarter(ctx, r);
    if (r.phase === "QUARTER_END") drawQuarterEnd(ctx, r);
    if (r.phase === "GAME_OVER") drawGameOver(ctx, r);
  }

  function drawMenu(ctx: CanvasRenderingContext2D, _r: GameRefs) {
    panel(ctx, 20, 20, VIEW_W - 40, VIEW_H - 40);
    centerText(ctx, "PIXEL  SKATE", VIEW_W / 2, 38, PAL.uiGreen);
    centerText(ctx, "LEAGUE", VIEW_W / 2, 48, PAL.uiGreen);
    centerText(ctx, "PSL  -  4 QUARTERS", VIEW_W / 2, 64, PAL.uiYellow);

    centerText(ctx, "SPACE  PUSH", VIEW_W / 2, 84, PAL.uiText);
    centerText(ctx, "SHIFT  BRAKE", VIEW_W / 2, 94, PAL.uiText);
    centerText(ctx, "DOWN  OLLIE   UP  NOLLIE", VIEW_W / 2, 104, PAL.uiText);
    centerText(ctx, "L/R  REVERT  /  SPIN", VIEW_W / 2, 114, PAL.uiText);
    centerText(ctx, "AIR  COMBOS  =  FLIP TRICKS", VIEW_W / 2, 124, PAL.uiText);
    centerText(ctx, "HOLD  D-PAD  ON  RAIL  GRIND", VIEW_W / 2, 134, PAL.uiText);

    const blink = (Math.floor(performance.now() / 400) & 1) === 0;
    if (blink) centerText(ctx, "PRESS  SPACE", VIEW_W / 2, VIEW_H - 28, PAL.uiGreen);
  }

  function drawPreQuarter(ctx: CanvasRenderingContext2D, r: GameRefs) {
    panel(ctx, 40, VIEW_H / 2 - 28, VIEW_W - 80, 56);
    centerText(ctx, `QUARTER  ${r.quarter}`, VIEW_W / 2, VIEW_H / 2 - 16, PAL.uiGreen);
    const cd = Math.max(1, Math.ceil(r.phaseT / 60));
    centerText(ctx, `${cd}`, VIEW_W / 2, VIEW_H / 2 - 2, PAL.uiYellow);
    centerText(ctx, `BEST OF 4`, VIEW_W / 2, VIEW_H / 2 + 10, PAL.uiText);
  }

  function drawQuarterEnd(ctx: CanvasRenderingContext2D, r: GameRefs) {
    panel(ctx, 30, 30, VIEW_W - 60, VIEW_H - 60);
    centerText(ctx, `Q${r.results.length} COMPLETE`, VIEW_W / 2, 44, PAL.uiGreen);
    centerText(ctx, `SCORE  ${r.results[r.results.length - 1]?.score ?? 0}`, VIEW_W / 2, 58, PAL.uiYellow);
    const best = r.results[r.results.length - 1]?.best ?? "—";
    centerText(ctx, `BEST: ${best.slice(0, 22)}`, VIEW_W / 2, 70, PAL.uiText);
    // Standings
    let y = 90;
    for (const res of r.results) {
      centerText(ctx, `Q${res.number}  ${res.score}`, VIEW_W / 2, y, PAL.uiText);
      y += 10;
    }
    const blink = (Math.floor(performance.now() / 400) & 1) === 0;
    if (blink) centerText(ctx, "PRESS  SPACE", VIEW_W / 2, VIEW_H - 22, PAL.uiGreen);
  }

  function drawGameOver(ctx: CanvasRenderingContext2D, r: GameRefs) {
    panel(ctx, 20, 20, VIEW_W - 40, VIEW_H - 40);
    centerText(ctx, "GAME  OVER", VIEW_W / 2, 36, PAL.uiRed);
    const total = r.results.reduce((s, q) => s + q.score, 0);
    centerText(ctx, `FINAL  ${total}`, VIEW_W / 2, 52, PAL.uiYellow);
    let y = 72;
    for (const res of r.results) {
      centerText(ctx, `Q${res.number}   ${res.score}`, VIEW_W / 2, y, PAL.uiText);
      y += 10;
    }
    const blink = (Math.floor(performance.now() / 400) & 1) === 0;
    if (blink) centerText(ctx, "SPACE  TO  RETRY", VIEW_W / 2, VIEW_H - 28, PAL.uiGreen);
  }

  /* ────────────────────────────────────────────────────────────────
     PRIMITIVES (pixel-perfect)
     ──────────────────────────────────────────────────────────────── */

  function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(Math.round(cx), Math.round(cy), rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.uiPanel;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = PAL.uiGreenDim;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  }

  function centerText(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, color: string) {
    pixelText(ctx, s, Math.round(cx - s.length * 2), Math.round(y), color, PAL.outline);
  }

  /* Tiny 3x5 pixel font. */
  function pixelText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, shadow?: string) {
    const upper = s.toUpperCase();
    if (shadow) {
      drawTextRaw(ctx, upper, x + 1, y + 1, shadow);
    }
    drawTextRaw(ctx, upper, x, y, color);
  }

  function drawTextRaw(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT["?"];
      for (let row = 0; row < 5; row++) {
        const bits = g[row];
        for (let col = 0; col < 3; col++) {
          if (bits & (1 << (2 - col))) {
            ctx.fillRect(cx + col, y + row, 1, 1);
          }
        }
      }
      cx += 4;
    }
  }

  /* ────────────────────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{
        width: VIEW_W * RENDER_SCALE,
        height: VIEW_H * RENDER_SCALE,
      }}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          style={{
            width: VIEW_W * RENDER_SCALE,
            height: VIEW_H * RENDER_SCALE,
            imageRendering: "pixelated",
            display: "block",
            background: PAL.grassA,
            border: "2px solid #2a3a1f",
            borderRadius: 4,
            boxShadow: "0 0 40px rgba(0,255,65,0.15), inset 0 0 12px rgba(0,0,0,0.5)",
          }}
        />
        {/* CRT scanlines overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
            mixBlendMode: "multiply",
            borderRadius: 4,
          }}
        />
      </div>

      {/* Side HUD: results board */}
      <div className="grid grid-cols-4 gap-2 w-full max-w-3xl text-center font-mono text-xs">
        {[1, 2, 3, 4].map(q => {
          const res = hud.results.find(r => r.number === q);
          const isCurrent = hud.phase === "PLAYING" && hud.quarter === q;
          return (
            <div
              key={q}
              className={
                "border rounded p-2 " +
                (isCurrent
                  ? "border-green-400 bg-green-500/10 text-green-300"
                  : res
                    ? "border-green-700/50 bg-black/40 text-green-500"
                    : "border-green-900/40 bg-black/20 text-green-800")
              }
            >
              <div className="text-[10px] uppercase tracking-widest">Q{q}</div>
              <div className="font-bold text-base mt-1">
                {res ? res.score : isCurrent ? hud.quarterScore : "—"}
              </div>
              <div className="text-[9px] mt-1 truncate" title={res?.best ?? ""}>
                {res ? res.best : isCurrent ? (hud.comboTricks.slice(-1)[0] ?? "") : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls cheat sheet */}
      <div className="w-full max-w-3xl text-xs font-mono text-green-500 border border-green-900/50 rounded p-3 bg-black/30 grid grid-cols-2 gap-x-6 gap-y-1">
        <div><span className="text-green-300">SPACE</span> — Push</div>
        <div><span className="text-green-300">SHIFT</span> — Slow / Stop</div>
        <div><span className="text-green-300">↓</span> Ollie · <span className="text-green-300">↑</span> Nollie</div>
        <div><span className="text-green-300">← →</span> Revert (ground) / Spin (air)</div>
        <div className="col-span-2"><span className="text-green-300">In air:</span> ↓ kickflip · ↑ heelflip · ← / → 180° (stack for tre flips, varials, 540s)</div>
        <div className="col-span-2"><span className="text-green-300">Land on a rail holding a D-Pad direction</span> → grind (5-0 / Nose / Crooked / Smith / Board)</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   3x5 PIXEL FONT (5 rows, 3 cols, bits high→low MSB on left)
   ──────────────────────────────────────────────────────────────── */
const FONT: Record<string, number[]> = {
  "A": [0b010, 0b101, 0b111, 0b101, 0b101],
  "B": [0b110, 0b101, 0b110, 0b101, 0b110],
  "C": [0b011, 0b100, 0b100, 0b100, 0b011],
  "D": [0b110, 0b101, 0b101, 0b101, 0b110],
  "E": [0b111, 0b100, 0b110, 0b100, 0b111],
  "F": [0b111, 0b100, 0b110, 0b100, 0b100],
  "G": [0b011, 0b100, 0b101, 0b101, 0b011],
  "H": [0b101, 0b101, 0b111, 0b101, 0b101],
  "I": [0b111, 0b010, 0b010, 0b010, 0b111],
  "J": [0b001, 0b001, 0b001, 0b101, 0b010],
  "K": [0b101, 0b110, 0b100, 0b110, 0b101],
  "L": [0b100, 0b100, 0b100, 0b100, 0b111],
  "M": [0b101, 0b111, 0b111, 0b101, 0b101],
  "N": [0b101, 0b111, 0b111, 0b111, 0b101],
  "O": [0b010, 0b101, 0b101, 0b101, 0b010],
  "P": [0b110, 0b101, 0b110, 0b100, 0b100],
  "Q": [0b010, 0b101, 0b101, 0b111, 0b011],
  "R": [0b110, 0b101, 0b110, 0b101, 0b101],
  "S": [0b011, 0b100, 0b010, 0b001, 0b110],
  "T": [0b111, 0b010, 0b010, 0b010, 0b010],
  "U": [0b101, 0b101, 0b101, 0b101, 0b011],
  "V": [0b101, 0b101, 0b101, 0b101, 0b010],
  "W": [0b101, 0b101, 0b111, 0b111, 0b101],
  "X": [0b101, 0b101, 0b010, 0b101, 0b101],
  "Y": [0b101, 0b101, 0b010, 0b010, 0b010],
  "Z": [0b111, 0b001, 0b010, 0b100, 0b111],
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b110, 0b001, 0b010, 0b100, 0b111],
  "3": [0b111, 0b001, 0b010, 0b001, 0b110],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b110, 0b001, 0b110],
  "6": [0b011, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b110],
  ".": [0b000, 0b000, 0b000, 0b000, 0b010],
  ",": [0b000, 0b000, 0b000, 0b010, 0b100],
  "/": [0b001, 0b001, 0b010, 0b100, 0b100],
  "-": [0b000, 0b000, 0b111, 0b000, 0b000],
  ":": [0b000, 0b010, 0b000, 0b010, 0b000],
  "+": [0b000, 0b010, 0b111, 0b010, 0b000],
  "x": [0b000, 0b101, 0b010, 0b101, 0b000],
  "(": [0b001, 0b010, 0b010, 0b010, 0b001],
  ")": [0b100, 0b010, 0b010, 0b010, 0b100],
  "→": [0b000, 0b010, 0b011, 0b010, 0b000],
  "·": [0b000, 0b000, 0b010, 0b000, 0b000],
  " ": [0b000, 0b000, 0b000, 0b000, 0b000],
  "?": [0b110, 0b001, 0b010, 0b000, 0b010],
  "!": [0b010, 0b010, 0b010, 0b000, 0b010],
  "—": [0b000, 0b000, 0b111, 0b000, 0b000],
};
