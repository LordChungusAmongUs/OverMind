"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SHIPS } from "@/lib/solarwar/data";
import { militaryPower } from "@/lib/solarwar/engine";
import { useGame } from "@/lib/solarwar/store";
import type { BattleResult, Rival } from "@/lib/solarwar/types";

const W = 640;
const H = 360;
const SIM_SPEED = 1.6; // sim seconds per real second
const MAX_SIM = 22; // hard timeout in sim seconds
const PLAYER_CAP = 16;
const RANGE: Record<string, number> = { Escort: 70, Line: 95, Heavy: 135, Capital: 165 };

interface Unit {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  fp: number;
  range: number;
  speed: number;
  side: "p" | "e";
  typeId?: string;
  ships: number; // player ships represented by this sprite
  alive: boolean;
  fireT: number; // remaining draw time of beam
  tx: number;
  ty: number;
}

function buildUnits(fleet: Record<string, number>, rival: Rival) {
  const units: Unit[] = [];
  const totalPlayer = Object.entries(fleet).reduce(
    (a, [id, c]) => a + (SHIPS[id] ? c : 0),
    0
  );

  for (const [id, count] of Object.entries(fleet)) {
    const ship = SHIPS[id];
    if (!ship || count <= 0) continue;
    const sprites = Math.max(1, Math.round((PLAYER_CAP * count) / Math.max(1, totalPlayer)));
    const perSprite = count / sprites;
    for (let i = 0; i < sprites; i++) {
      units.push({
        x: 60 + Math.random() * 60,
        y: 40 + ((H - 80) * (i + 0.5)) / sprites + (Math.random() * 20 - 10),
        hp: ship.hull * perSprite,
        maxHp: ship.hull * perSprite,
        fp: ship.firepower * perSprite,
        range: RANGE[ship.shipClass] ?? 90,
        speed: 38 + (ship.shipClass === "Escort" ? 22 : 0),
        side: "p",
        typeId: id,
        ships: perSprite,
        alive: true,
        fireT: 0,
        tx: 0,
        ty: 0,
      });
    }
  }

  const eFp = Math.max(1, rival.military);
  const eHull = rival.military * 2.2 + 50;
  const k = Math.min(16, Math.max(3, Math.round(rival.military / 25)));
  for (let i = 0; i < k; i++) {
    units.push({
      x: W - 60 - Math.random() * 60,
      y: 40 + ((H - 80) * (i + 0.5)) / k + (Math.random() * 20 - 10),
      hp: eHull / k,
      maxHp: eHull / k,
      fp: eFp / k,
      range: 100 + Math.random() * 50,
      speed: 42,
      side: "e",
      ships: 0,
      alive: true,
      fireT: 0,
      tx: 0,
      ty: 0,
    });
  }
  return { units, eFp };
}

function nearestEnemy(u: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const o of units) {
    if (!o.alive || o.side === u.side) continue;
    const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export default function TacticalBattle() {
  const battleTarget = useGame((s) => s.battleTarget);
  const rivals = useGame((s) => s.rivals);
  const fleet = useGame((s) => s.fleet);
  const resolveBattle = useGame((s) => s.resolveBattle);
  const cancelBattle = useGame((s) => s.cancelBattle);

  const rival = rivals.find((r) => r.id === battleTarget) ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);

  const sim = useMemo(() => {
    if (!rival) return null;
    const { units, eFp } = buildUnits(fleet, rival);
    return { units, eFp, t: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleTarget]);

  useEffect(() => {
    if (!sim || !rival) return;
    let raf = 0;
    let last = performance.now();
    let finished = false;

    const step = (dt: number) => {
      sim.t += dt;
      for (const u of sim.units) {
        if (!u.alive) continue;
        const target = nearestEnemy(u, sim.units);
        u.fireT = Math.max(0, u.fireT - dt);
        if (!target) continue;
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > u.range) {
          u.x += (dx / dist) * u.speed * dt;
          u.y += (dy / dist) * u.speed * dt;
        } else {
          target.hp -= u.fp * dt;
          u.fireT = 0.12;
          u.tx = target.x;
          u.ty = target.y;
          if (target.hp <= 0) target.alive = false;
        }
      }
    };

    const finish = () => {
      finished = true;
      const alive = (s: "p" | "e") => sim.units.filter((u) => u.alive && u.side === s);
      const pAlive = alive("p");
      const eAlive = alive("e");
      const survFp = eAlive.reduce((a, u) => a + u.fp, 0);
      const survFrac = sim.eFp > 0 ? survFp / sim.eFp : 0;

      const lossByType: Record<string, number> = {};
      for (const u of sim.units) {
        if (u.side === "p" && !u.alive && u.typeId) {
          lossByType[u.typeId] = (lossByType[u.typeId] ?? 0) + u.ships;
        }
      }
      const playerLosses: Record<string, number> = {};
      for (const [id, lost] of Object.entries(lossByType)) {
        const n = Math.min(fleet[id] ?? 0, Math.round(lost));
        if (n > 0) playerLosses[id] = n;
      }

      let outcome: BattleResult["outcome"];
      let crippleAdd: number;
      let text: string;
      const name = rival.name;
      if (pAlive.length === 0) {
        outcome = "loss";
        crippleAdd = 0;
        text = `Your fleet was annihilated assaulting ${name}.`;
      } else if (eAlive.length === 0) {
        outcome = "win";
        crippleAdd = 70;
        text = `Decisive victory over ${name}. Their fleet is destroyed.`;
      } else if (survFrac < 0.45) {
        outcome = "pyrrhic";
        crippleAdd = 35;
        text = `Costly engagement with ${name}. You hold the field, barely.`;
      } else {
        outcome = "loss";
        crippleAdd = 0;
        text = `${name} repelled your assault. You withdraw with heavy losses.`;
      }

      setResult({
        outcome,
        text,
        playerLosses,
        rivalMilitaryAfter: outcome === "win" ? rival.military * 0.15 : survFp,
        rivalCrippleAdd: crippleAdd,
      });
      setDone(true);
    };

    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#02060a";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,255,65,0.25)";
      for (let i = 0; i < 60; i++) {
        const sx = (i * 9973) % W;
        const sy = (i * 7919) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }
      for (const u of sim.units) {
        if (!u.alive) continue;
        if (u.fireT > 0) {
          ctx.strokeStyle = u.side === "p" ? "rgba(0,255,120,0.7)" : "rgba(255,60,40,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.lineTo(u.tx, u.ty);
          ctx.stroke();
        }
        const r = 4 + Math.min(8, Math.sqrt(u.maxHp) / 3);
        ctx.fillStyle = u.side === "p" ? "#39ff14" : "#ff3030";
        ctx.beginPath();
        ctx.moveTo(u.x + (u.side === "p" ? r : -r), u.y);
        ctx.lineTo(u.x - (u.side === "p" ? r : -r), u.y - r * 0.7);
        ctx.lineTo(u.x - (u.side === "p" ? r : -r), u.y + r * 0.7);
        ctx.closePath();
        ctx.fill();
        const w = r * 2;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(u.x - r, u.y - r - 4, w, 2);
        ctx.fillStyle = u.side === "p" ? "#39ff14" : "#ff3030";
        ctx.fillRect(u.x - r, u.y - r - 4, w * Math.max(0, u.hp / u.maxHp), 2);
      }
    };

    const frame = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!finished) {
        step(real * SIM_SPEED);
        draw();
        const pAlive = sim.units.some((u) => u.alive && u.side === "p");
        const eAlive = sim.units.some((u) => u.alive && u.side === "e");
        if (!pAlive || !eAlive || sim.t >= MAX_SIM) finish();
        else raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, rival]);

  if (!battleTarget || !rival) return null;

  const player = militaryPower(fleet);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-green-500/30 bg-black/90 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-green-700">
              <span className="text-red-500">&gt;</span> tactical engagement
            </p>
            <h2 className="text-xl font-black font-mono text-green-300">
              vs {rival.name}
            </h2>
          </div>
          <div className="text-right text-[11px] font-mono">
            <p className="text-green-400">YOUR FP {Math.round(player.firepower)}</p>
            <p className="text-red-400">ENEMY MIL {Math.round(rival.military)}</p>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-lg border border-green-500/20 bg-[#02060a]"
        />

        {!done ? (
          <div className="text-center mt-3">
            <p className="text-[11px] font-mono text-green-600 animate-pulse mb-2">
              engagement in progress…
            </p>
            <button
              onClick={() => cancelBattle()}
              className="text-[11px] font-mono text-red-400/70 hover:text-red-300 border border-red-500/20 rounded px-3 py-1 transition-colors"
            >
              Retreat
            </button>
          </div>
        ) : (
          result && (
            <div className="mt-3 text-center">
              <p
                className={`text-lg font-black font-mono mb-1 ${
                  result.outcome === "win"
                    ? "text-green-300"
                    : result.outcome === "pyrrhic"
                    ? "text-yellow-300"
                    : "text-red-400"
                }`}
              >
                {result.outcome === "win" ? "VICTORY" : result.outcome === "pyrrhic" ? "PYRRHIC VICTORY" : "DEFEAT"}
              </p>
              <p className="text-sm font-mono text-green-500 mb-3">{result.text}</p>
              <button
                onClick={() => resolveBattle(rival.id, result)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-mono font-semibold border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
              >
                Continue
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
