"use client";

import { useGame } from "@/lib/solarwar/store";
import type { EventKind } from "@/lib/solarwar/types";

const KIND_COLOR: Record<EventKind, string> = {
  info: "text-green-600 border-green-500/20",
  good: "text-green-300 border-green-500/30",
  bad: "text-red-400 border-red-500/30",
  war: "text-orange-400 border-orange-500/30",
  tech: "text-cyan-400 border-cyan-500/30",
  market: "text-violet-400 border-violet-500/30",
};

function age(now: number, t: number): string {
  const d = Math.max(0, Math.floor(now - t));
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

export default function EventsFeed() {
  const events = useGame((s) => s.events);
  const worldClock = useGame((s) => s.worldClock);

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-black font-mono uppercase tracking-widest text-green-300 mb-2">
        Intel Feed
      </h3>
      {events.length === 0 && (
        <p className="text-[11px] font-mono text-muted-foreground">No activity yet.</p>
      )}
      {events.map((ev) => (
        <div
          key={ev.id}
          className={`flex items-start gap-2 rounded-md border bg-black/40 px-3 py-2 ${KIND_COLOR[ev.kind]}`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider opacity-70 w-9 flex-shrink-0 pt-0.5">
            {ev.kind}
          </span>
          <span className="text-[12px] font-mono flex-1 leading-snug">{ev.text}</span>
          <span className="text-[10px] font-mono text-green-800 flex-shrink-0">
            {age(worldClock, ev.t)}
          </span>
        </div>
      ))}
    </div>
  );
}
