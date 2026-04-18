import Sidebar from "@/components/layout/Sidebar";
import {
  TrendingUp,
  UtensilsCrossed,
  Youtube,
  AlertCircle,
} from "lucide-react";

export default function BriefingPage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-background/95">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">{dateStr}</p>
          <h1 className="text-3xl font-bold mt-1">
            {greeting},{" "}
            <span className="gradient-text">DJ Thirsty</span>
          </h1>
          <p className="text-muted-foreground mt-1">King&apos;s BBQ, Burgers, &amp; More · Archdale, NC</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Restaurant", icon: UtensilsCrossed, status: "Not connected", delay: "0s" },
            { label: "Markets",    icon: TrendingUp,      status: "Not connected", delay: "0.8s" },
            { label: "YouTube",    icon: Youtube,         status: "Not connected", delay: "1.6s" },
            { label: "Alerts",     icon: AlertCircle,     status: "None",          delay: "2.4s" },
          ].map(({ label, icon: Icon, status, delay }) => (
            <div
              key={label}
              className="holo-card rounded-xl border border-border/60 bg-card/70 p-4 flex items-center gap-3"
              style={{ animationDelay: delay }}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0 border border-border/60">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-muted-foreground">{status}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Briefing placeholder */}
        <div className="holo-card rounded-xl border border-border/60 bg-card/70">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="relative w-14 h-14 mb-5">
              <span className="ping-slow absolute inset-0 rounded-full bg-primary/20" />
              <div className="relative w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h3 className="font-semibold mb-2">No briefing yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              As you connect your restaurant, markets, and YouTube data, your daily briefing will appear here automatically.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
