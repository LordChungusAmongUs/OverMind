import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">{dateStr}</p>
          <h1 className="text-3xl font-bold mt-1">
            {greeting}, <span className="text-primary">DJ Thirsty</span>
          </h1>
          <p className="text-muted-foreground mt-1">King&apos;s BBQ, Burgers, & More · Archdale, NC</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Restaurant", icon: UtensilsCrossed, status: "Not connected" },
            { label: "Markets", icon: TrendingUp, status: "Not connected" },
            { label: "YouTube", icon: Youtube, status: "Not connected" },
            { label: "Alerts", icon: AlertCircle, status: "None" },
          ].map(({ label, icon: Icon, status }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-muted-foreground">{status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Briefing placeholder */}
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No briefing yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              As you connect your restaurant, markets, and YouTube data, your daily briefing will appear here automatically.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
