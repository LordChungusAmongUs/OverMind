"use client";

import { Boxes, Cpu, DollarSign, Globe, Users, Zap } from "lucide-react";
import { RESOURCES, STOCKS } from "@/lib/solarwar/data";
import { fmt, fmtRate, type Rates } from "@/lib/solarwar/engine";
import type { StockId } from "@/lib/solarwar/types";

const ICONS: Record<StockId, typeof DollarSign> = {
  capital: DollarSign,
  compute: Cpu,
  talent: Users,
  materials: Boxes,
  influence: Globe,
};

export default function ResourceBar({
  resources,
  rates,
}: {
  resources: Record<StockId, number>;
  rates: Rates;
}) {
  const powerPct = Math.round(rates.powerRatio * 100);
  const powered = powerPct >= 100;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {STOCKS.map((id) => {
        const def = RESOURCES[id];
        const Icon = ICONS[id];
        const rate = rates.net[id];
        return (
          <div
            key={id}
            title={def.description}
            className="rounded-lg border border-green-500/20 bg-black/40 px-3 py-2"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${def.color}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-green-700">
                {def.name}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${def.color} leading-tight`}>
              {fmt(resources[id])}
            </div>
            <div
              className={`text-[11px] font-mono ${
                rate > 0 ? "text-green-500" : rate < 0 ? "text-red-400" : "text-muted-foreground"
              }`}
            >
              {fmtRate(rate)}
            </div>
          </div>
        );
      })}

      {/* Energy — a flow, not a stock */}
      <div
        title="Energy is a power flow. Supply must meet demand or all production is throttled."
        className={`rounded-lg border px-3 py-2 ${
          powered ? "border-green-500/20 bg-black/40" : "border-red-500/40 bg-red-500/5"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Zap className={`w-3.5 h-3.5 ${powered ? "text-yellow-300" : "text-red-400"}`} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-green-700">
            Energy
          </span>
        </div>
        <div
          className={`text-lg font-black font-mono leading-tight ${
            powered ? "text-yellow-300" : "text-red-400"
          }`}
        >
          {fmt(rates.energySupply)}
          <span className="text-xs text-green-700">/{fmt(rates.energyDemand)}</span>
        </div>
        <div
          className={`text-[11px] font-mono ${powered ? "text-green-500" : "text-red-400"}`}
        >
          {powered ? "powered" : `${powerPct}% — deficit`}
        </div>
      </div>
    </div>
  );
}
