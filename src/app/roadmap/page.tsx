"use client";

import Sidebar from "@/components/layout/Sidebar";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

type Status = "done" | "partial" | "planned";

interface Feature {
  label: string;
  status: Status;
  note?: string;
}

interface Phase {
  number: number;
  title: string;
  subtitle: string;
  color: string;
  features: Feature[];
}

const PHASES: Phase[] = [
  {
    number: 1,
    title: "Music & Content Automation",
    subtitle: "AI record label — multi-channel, multi-artist, multi-platform",
    color: "violet",
    features: [
      { label: "Song concept generation (ChatGPT → lyrics, art prompt, metadata)", status: "done" },
      { label: "AI audio generation via Suno", status: "done" },
      { label: "FFmpeg video encoding (static image + audio → MP4)", status: "done" },
      { label: "YouTube OAuth upload pipeline", status: "done" },
      { label: "Multi-track approval queue (approve / skip per track)", status: "done" },
      { label: "Automated end-to-end job runner (no-touch pipeline)", status: "done" },
      { label: "7-persona artist system (ThirstyBoy)", status: "done" },
      { label: "Multi-artist / multi-channel support", status: "planned" },
      { label: "AI record label branding & channel management", status: "planned" },
      { label: "Playlist auto-management (create, update, curate)", status: "planned" },
      { label: "YouTube comment auto-replies (AI persona responses)", status: "planned" },
      { label: "SoundCloud distribution", status: "planned" },
      { label: "Facebook / Instagram reels distribution", status: "planned" },
      { label: "TikTok distribution", status: "planned" },
      { label: "Spotify / DSP distribution", status: "planned" },
      { label: "Analytics dashboard (views, subs, revenue per artist)", status: "planned" },
      { label: "Scheduling / release calendar", status: "partial", note: "Calendar tab exists, logic TBD" },
    ],
  },
  {
    number: 2,
    title: "Restaurant Automation",
    subtitle: "King's BBQ — inventory, scheduling, reporting, payroll",
    color: "orange",
    features: [
      { label: "Inventory count UI (cases / pounds per vendor)", status: "partial", note: "Page scaffolded, full logic in progress" },
      { label: "Figure POS data scraping (Chrome extension)", status: "planned" },
      { label: "Daily sales ingestion & display", status: "planned" },
      { label: "Vendor price comparison (lowest price per item)", status: "planned" },
      { label: "Auto-generated order sheets by vendor", status: "planned" },
      { label: "Par-level tracking (auto-adjust from usage history)", status: "planned" },
      { label: "Prep lists (daily, based on sales forecast)", status: "planned" },
      { label: "Employee scheduling (8-person shift structure)", status: "planned" },
      { label: "Daily P&L report", status: "planned" },
      { label: "Weekly P&L report", status: "planned" },
      { label: "Payroll calculations", status: "planned" },
      { label: "Daily task checklist for manager", status: "planned" },
      { label: "Labor cost % tracking", status: "planned" },
    ],
  },
  {
    number: 3,
    title: "Personal Life OS",
    subtitle: "Daily agenda, health, budget, grocery, style",
    color: "emerald",
    features: [
      { label: "Daily agenda planner (AI-generated, time-blocked)", status: "planned" },
      { label: "Meal prep assistant (weekly plan + macros)", status: "planned" },
      { label: "Grocery list generator (from meal plan)", status: "planned" },
      { label: "Budget assistant (income vs. expenses, goals)", status: "planned" },
      { label: "Health coach (workouts, sleep, progress tracking)", status: "planned" },
      { label: "Personal stylist (outfit recommendations, wardrobe log)", status: "planned" },
      { label: "Morning briefing (combines all modules into daily summary)", status: "partial", note: "Briefing page exists, feeds TBD" },
    ],
  },
  {
    number: 4,
    title: "Revenue Automation",
    subtitle: "Arbitrage betting, poker, OnlyFans",
    color: "yellow",
    features: [
      { label: "OddsJam arbitrage scanner + bet tracker", status: "planned" },
      { label: "Automated bet placement workflow", status: "planned" },
      { label: "P&L tracking per sportsbook", status: "planned" },
      { label: "Online poker session tracker + HUD data", status: "planned" },
      { label: "Poker bankroll management & session analytics", status: "planned" },
      { label: "OnlyFans account automation (post scheduling, DM workflows)", status: "planned" },
      { label: "Combined revenue dashboard across all streams", status: "planned" },
    ],
  },
];

const STATUS_CONFIG = {
  done:    { icon: CheckCircle2, label: "Done",        className: "text-green-400" },
  partial: { icon: Clock,        label: "In Progress", className: "text-yellow-400" },
  planned: { icon: Circle,       label: "Planned",     className: "text-muted-foreground" },
};

const PHASE_COLORS: Record<string, { border: string; bg: string; badge: string; bar: string; num: string }> = {
  violet:  { border: "border-violet-500/30",  bg: "bg-violet-500/5",  badge: "bg-violet-500/15 text-violet-300",  bar: "bg-violet-500", num: "text-violet-400" },
  orange:  { border: "border-orange-500/30",  bg: "bg-orange-500/5",  badge: "bg-orange-500/15 text-orange-300",  bar: "bg-orange-500", num: "text-orange-400" },
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", badge: "bg-emerald-500/15 text-emerald-300", bar: "bg-emerald-500", num: "text-emerald-400" },
  yellow:  { border: "border-yellow-500/30",  bg: "bg-yellow-500/5",  badge: "bg-yellow-500/15 text-yellow-300",  bar: "bg-yellow-500", num: "text-yellow-400" },
};

function phaseProgress(phase: Phase) {
  const total = phase.features.length;
  const done = phase.features.filter(f => f.status === "done").length;
  const partial = phase.features.filter(f => f.status === "partial").length;
  const pct = Math.round(((done + partial * 0.5) / total) * 100);
  return { total, done, partial, pct };
}

function overallProgress(phases: Phase[]) {
  const allFeatures = phases.flatMap(p => p.features);
  const total = allFeatures.length;
  const done = allFeatures.filter(f => f.status === "done").length;
  const partial = allFeatures.filter(f => f.status === "partial").length;
  const pct = Math.round(((done + partial * 0.5) / total) * 100);
  return { total, done, partial, planned: total - done - partial, pct };
}

export default function RoadmapPage() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });
  const overall = overallProgress(PHASES);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Project Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-1">Overmind — full automation across music, restaurant, life, and revenue</p>
        </div>

        {/* Overall progress */}
        <div className="p-5 rounded-xl border border-border bg-card mb-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Overall Progress</p>
              <p className="text-3xl font-bold text-foreground">{overall.pct}%</p>
            </div>
            <div className="flex gap-5 text-sm text-right">
              <div><p className="text-green-400 font-semibold">{overall.done}</p><p className="text-xs text-muted-foreground">Done</p></div>
              <div><p className="text-yellow-400 font-semibold">{overall.partial}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
              <div><p className="text-muted-foreground font-semibold">{overall.planned}</p><p className="text-xs text-muted-foreground">Planned</p></div>
              <div><p className="text-foreground font-semibold">{overall.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overall.pct}%` }} />
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-4">
          {PHASES.map(phase => {
            const { done, partial, pct } = phaseProgress(phase);
            const colors = PHASE_COLORS[phase.color];
            const isOpen = !!expanded[phase.number];

            return (
              <div key={phase.number} className={`rounded-xl border ${colors.border} ${colors.bg}`}>
                {/* Phase header */}
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [phase.number]: !prev[phase.number] }))}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <span className={`text-2xl font-black ${colors.num} w-8 flex-shrink-0`}>{phase.number}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-foreground">{phase.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{pct}%</span>
                      {done > 0 && <span className="text-xs text-green-400 font-medium">{done} done</span>}
                      {partial > 0 && <span className="text-xs text-yellow-400 font-medium">{partial} in progress</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                    <div className={`h-1.5 rounded-full bg-black/20 mt-2 overflow-hidden`}>
                      <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Feature list */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-2">
                    <div className="h-px bg-border/50 mb-3" />
                    {phase.features.map((feature, i) => {
                      const { icon: Icon, className } = STATUS_CONFIG[feature.status];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${className}`} />
                          <div className="min-w-0">
                            <p className={`text-sm ${feature.status === "planned" ? "text-muted-foreground" : "text-foreground"}`}>
                              {feature.label}
                            </p>
                            {feature.note && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5">{feature.note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground/40 mt-8 text-center">Last updated manually — edit src/app/roadmap/page.tsx to update status</p>
      </main>
    </div>
  );
}
