"use client";

import { Building, CheckCircle2, Handshake } from "lucide-react";
import { NEUTRAL_COMPANIES } from "@/lib/solarwar/data";
import { canAfford, fmt } from "@/lib/solarwar/engine";
import { useGame } from "@/lib/solarwar/store";
import type { FlowId, FlowMap, StockId, StockMap } from "@/lib/solarwar/types";

const CODE: Record<FlowId, string> = {
  capital: "CAP",
  compute: "CMP",
  talent: "TAL",
  materials: "MAT",
  influence: "INF",
  energy: "ENR",
};
const COLOR: Record<FlowId, string> = {
  capital: "text-green-400",
  compute: "text-cyan-400",
  talent: "text-violet-400",
  materials: "text-amber-400",
  influence: "text-rose-400",
  energy: "text-yellow-300",
};

function Flows({ map }: { map: FlowMap }) {
  return (
    <>
      {(Object.entries(map) as [FlowId, number][]).map(([id, v]) => (
        <span key={id} className={`text-[11px] font-mono ${COLOR[id]}`}>
          +{fmt(v)} {CODE[id]}/s
        </span>
      ))}
    </>
  );
}

function Cost({ cost, resources }: { cost: StockMap; resources: Record<StockId, number> }) {
  return (
    <>
      {(Object.entries(cost) as [StockId, number][]).map(([id, v]) => (
        <span key={id} className={resources[id] >= v ? "text-green-600" : "text-red-400"}>
          {fmt(v)} {CODE[id]}
        </span>
      ))}
    </>
  );
}

export default function NeutralPanel() {
  const resources = useGame((s) => s.resources);
  const neutral = useGame((s) => s.neutral);
  const lease = useGame((s) => s.leaseCompany);
  const acquire = useGame((s) => s.acquireCompany);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-mono text-green-800">
        Outsource for speed (lease — instant capability, ongoing rent) or vertically integrate
        (acquire — big upfront cost, free output forever).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {NEUTRAL_COMPANIES.map((c) => {
          const status = neutral[c.id] ?? "none";
          const owned = status === "owned";
          const leased = status === "leased";
          const affordAcq = canAfford(resources, c.acquireCost);
          return (
            <div key={c.id} className="holo-card rounded-lg border border-green-500/20 bg-black/40 p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-green-200 leading-tight">{c.name}</span>
                  <p className="text-[10px] font-mono text-green-700">{c.sector}</p>
                </div>
                {owned ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 inline-flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Owned
                  </span>
                ) : leased ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-300 flex-shrink-0">
                    Leased
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{c.description}</p>

              {owned ? (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <Flows map={c.ownedProvides} />
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <Flows map={c.leaseProvides} />
                  <span className="text-[11px] font-mono text-red-400">−{fmt(c.leaseCost)} CAP/s rent</span>
                </div>
              )}

              {!owned && (
                <div className="flex gap-1.5 mt-auto">
                  <button
                    onClick={() => lease(c.id)}
                    className={`flex-1 rounded px-2 py-1.5 text-[11px] font-mono font-semibold border transition-colors inline-flex items-center justify-center gap-1 ${
                      leased
                        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
                        : "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                    }`}
                  >
                    <Handshake className="w-3 h-3" /> {leased ? "End Lease" : "Lease"}
                  </button>
                  <button
                    onClick={() => acquire(c.id)}
                    disabled={!affordAcq}
                    className={`flex-1 rounded px-2 py-1.5 text-[11px] font-mono font-semibold border transition-colors inline-flex items-center justify-center gap-1 ${
                      affordAcq
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                        : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
                    }`}
                  >
                    <Building className="w-3 h-3" /> Acquire
                    <span className="inline-flex gap-1">
                      <Cost cost={c.acquireCost} resources={resources} />
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
