import Sidebar from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  UtensilsCrossed,
  Youtube,
  Bitcoin,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

const marketData = [
  { symbol: "BTC", price: "$—", change: "—", up: true },
  { symbol: "MSTR", price: "$—", change: "—", up: true },
  { symbol: "COIN", price: "$—", change: "—", up: false },
];

const briefingItems = [
  {
    icon: CheckCircle,
    color: "text-green-400",
    text: "Restaurant opened on time. No staff issues reported.",
  },
  {
    icon: AlertCircle,
    color: "text-yellow-400",
    text: "3 inventory items below par level — review needed.",
  },
  {
    icon: TrendingUp,
    color: "text-primary",
    text: "BTC up overnight. MSTR tracking accordingly.",
  },
  {
    icon: Clock,
    color: "text-muted-foreground",
    text: "2 YouTube videos scheduled for this week.",
  },
];

export default function BriefingPage() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">{dateStr}</p>
          <h1 className="text-3xl font-bold mt-1">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"},{" "}
            <span className="text-primary">DJ Thirsty</span>
          </h1>
          <p className="text-muted-foreground mt-1">Here&apos;s your daily briefing — {timeStr}</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Restaurant", status: "Open", ok: true, icon: UtensilsCrossed },
            { label: "Markets", status: "Watching", ok: true, icon: TrendingUp },
            { label: "YouTube", status: "Active", ok: true, icon: Youtube },
            { label: "Alerts", status: "3 items", ok: false, icon: AlertCircle },
          ].map(({ label, status, ok, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ok ? "bg-primary/10" : "bg-yellow-500/10"}`}>
                  <Icon className={`w-4 h-4 ${ok ? "text-primary" : "text-yellow-400"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Briefing */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Today&apos;s Briefing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {briefingItems.map(({ icon: Icon, color, text }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Connect your data sources to enable live AI briefings. Start with restaurant sales data and market prices.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Markets Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle>Markets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {marketData.map(({ symbol, price, change, up }) => (
                  <div key={symbol} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bitcoin className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium">{symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{price}</p>
                      <p className={`text-xs flex items-center gap-0.5 justify-end ${up ? "text-green-400" : "text-red-400"}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Live prices coming soon — connect TradingView API
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
