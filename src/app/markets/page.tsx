import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

const watchlist = [
  { symbol: "BTC", name: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT" },
  { symbol: "MSTR", name: "MicroStrategy", tvSymbol: "NASDAQ:MSTR" },
  { symbol: "COIN", name: "Coinbase", tvSymbol: "NASDAQ:COIN" },
];

export default function MarketsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Markets</h1>
            <p className="text-muted-foreground mt-1">BTC · MSTR · COIN</p>
          </div>
          <a
            href="https://www.tradingview.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            Open TradingView <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Watchlist */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {watchlist.map(({ symbol, name, tvSymbol }) => (
            <Card key={symbol}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-lg">{symbol}</p>
                    <p className="text-sm text-muted-foreground">{name}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <a
                  href={`https://www.tradingview.com/chart/?symbol=${tvSymbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View chart <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* TradingView Chart */}
        <Card>
          <CardHeader>
            <CardTitle>BTC/USD — Live Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden" style={{ height: 500 }}>
              <iframe
                src="https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=BINANCE%3ABTCUSDT&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=1e1e2e&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=1&locale=en"
                style={{ width: "100%", height: "100%", border: "none" }}
                allowTransparency
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
