"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { objectives } from "@/lib/solarwar/world";
import { useGame } from "@/lib/solarwar/store";

export default function ObjectivesStrip() {
  const s = useGame();
  const list = objectives(s);
  const doneCount = list.filter((o) => o.done).length;

  return (
    <div className="rounded-xl border border-green-500/20 bg-black/40 p-3 mb-4">
      <p className="text-[11px] font-mono uppercase tracking-widest text-green-700 mb-2">
        <span className="text-red-500">&gt;</span> Objectives {doneCount}/{list.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((o) => (
          <span
            key={o.id}
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded border ${
              o.done
                ? "border-green-500/30 bg-green-500/10 text-green-300"
                : "border-green-500/10 bg-black/30 text-green-700"
            }`}
          >
            {o.done ? (
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            ) : (
              <Circle className="w-3 h-3 text-green-800" />
            )}
            {o.label}
            {!o.done && o.progress !== undefined && o.progress > 0 && (
              <span className="text-green-600">{Math.round(o.progress * 100)}%</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
