"use client";

import { CheckCircle2, FlaskConical, Lock } from "lucide-react";
import { TECHS } from "@/lib/solarwar/data";
import { canAfford, fmt, techStatus } from "@/lib/solarwar/engine";
import type { StockId, Tech } from "@/lib/solarwar/types";

const CODE: Record<StockId, string> = {
  capital: "CAP",
  compute: "CMP",
  talent: "TAL",
  materials: "MAT",
  influence: "INF",
};

function branchOrder(techs: Tech[]): string[] {
  const seen: string[] = [];
  for (const t of techs) if (!seen.includes(t.branch)) seen.push(t.branch);
  return seen;
}

function TechCard({
  tech,
  researched,
  resources,
  onResearch,
}: {
  tech: Tech;
  researched: string[];
  resources: Record<StockId, number>;
  onResearch: () => void;
}) {
  const status = techStatus(tech, researched);
  const affordable = canAfford(resources, tech.cost);
  const costEntries = Object.entries(tech.cost) as [StockId, number][];

  const border =
    status === "researched"
      ? "border-green-500/40 bg-green-500/5"
      : status === "available"
      ? "border-green-500/20 bg-black/40"
      : "border-green-500/10 bg-black/20 opacity-70";

  return (
    <div className={`rounded-lg border ${border} p-3 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-green-200 leading-tight">{tech.name}</span>
        {status === "researched" && (
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
        )}
        {status === "locked" && <Lock className="w-3.5 h-3.5 text-green-800 flex-shrink-0" />}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{tech.description}</p>

      {status === "locked" && tech.requires && (
        <p className="text-[11px] font-mono text-red-400/80">
          Needs: {tech.requires.map((r) => TECHS[r]?.name ?? r).join(", ")}
        </p>
      )}

      {status === "researched" ? (
        <div className="mt-auto text-[11px] font-mono uppercase tracking-wider text-green-500">
          Researched
        </div>
      ) : status === "available" ? (
        <button
          onClick={onResearch}
          disabled={!affordable}
          className={`mt-auto w-full rounded-md px-2 py-1.5 text-xs font-mono font-semibold border transition-colors ${
            affordable
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
              : "border-green-900/40 bg-black/40 text-green-900 cursor-not-allowed"
          }`}
        >
          <span className="uppercase tracking-wider">Research</span>
          <span className="ml-1.5 inline-flex flex-wrap gap-x-2">
            {costEntries.map(([id, val]) => (
              <span
                key={id}
                className={resources[id] >= val ? "text-green-600" : "text-red-400"}
              >
                {fmt(val)} {CODE[id]}
              </span>
            ))}
          </span>
        </button>
      ) : (
        <div className="mt-auto flex flex-wrap gap-x-2 text-[11px] font-mono text-green-800">
          {costEntries.map(([id, val]) => (
            <span key={id}>
              {fmt(val)} {CODE[id]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResearchPanel({
  resources,
  researched,
  onResearch,
}: {
  resources: Record<StockId, number>;
  researched: string[];
  onResearch: (id: string) => void;
}) {
  const techs = Object.values(TECHS);
  const branches = branchOrder(techs);

  return (
    <div className="space-y-6">
      {branches.map((branch) => (
        <section key={branch}>
          <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2 inline-flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
            {branch}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {techs
              .filter((t) => t.branch === branch)
              .map((t) => (
                <TechCard
                  key={t.id}
                  tech={t}
                  researched={researched}
                  resources={resources}
                  onResearch={() => onResearch(t.id)}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
