"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface Asset {
  symbol: string;
  name: string;
  tvSymbol: string;
}

const watchlist: { category: string; assets: Asset[] }[] = [
  {
    category: "Crypto",
    assets: [
      { symbol: "BTC", name: "Bitcoin", tvSymbol: "BITSTAMP:BTCUSD" },
      { symbol: "ETH", name: "Ethereum", tvSymbol: "BITSTAMP:ETHUSD" },
      { symbol: "SOL", name: "Solana", tvSymbol: "COINBASE:SOLUSD" },
      { symbol: "XRP", name: "XRP", tvSymbol: "BITSTAMP:XRPUSD" },
      { symbol: "LINK", name: "Chainlink", tvSymbol: "COINBASE:LINKUSD" },
      { symbol: "ADA", name: "Cardano", tvSymbol: "COINBASE:ADAUSD" },
      { symbol: "LTC", name: "Litecoin", tvSymbol: "BITSTAMP:LTCUSD" },
      { symbol: "DOGE", name: "Dogecoin", tvSymbol: "BITSTAMP:DOGEUSD" },
      { symbol: "SAND", name: "The Sandbox", tvSymbol: "COINBASE:SANDUSD" },
      { symbol: "MANA", name: "Decentraland", tvSymbol: "COINBASE:MANAUSD" },
      { symbol: "MSTR", name: "MicroStrategy", tvSymbol: "NASDAQ:MSTR" },
      { symbol: "MARA", name: "Marathon Digital", tvSymbol: "NASDAQ:MARA" },
      { symbol: "RIOT", name: "Riot Platforms", tvSymbol: "NASDAQ:RIOT" },
    ],
  },
  {
    category: "Big Tech",
    assets: [
      { symbol: "AAPL", name: "Apple", tvSymbol: "NASDAQ:AAPL" },
      { symbol: "MSFT", name: "Microsoft", tvSymbol: "NASDAQ:MSFT" },
      { symbol: "GOOG", name: "Alphabet", tvSymbol: "NASDAQ:GOOG" },
      { symbol: "AMZN", name: "Amazon", tvSymbol: "NASDAQ:AMZN" },
      { symbol: "META", name: "Meta", tvSymbol: "NASDAQ:META" },
      { symbol: "NFLX", name: "Netflix", tvSymbol: "NASDAQ:NFLX" },
      { symbol: "BABA", name: "Alibaba", tvSymbol: "NYSE:BABA" },
      { symbol: "SONY", name: "Sony", tvSymbol: "NYSE:SONY" },
    ],
  },
  {
    category: "Cloud & SaaS",
    assets: [
      { symbol: "SNOW", name: "Snowflake", tvSymbol: "NYSE:SNOW" },
      { symbol: "PLTR", name: "Palantir", tvSymbol: "NYSE:PLTR" },
      { symbol: "NET", name: "Cloudflare", tvSymbol: "NYSE:NET" },
      { symbol: "DDOG", name: "Datadog", tvSymbol: "NASDAQ:DDOG" },
      { symbol: "MDB", name: "MongoDB", tvSymbol: "NASDAQ:MDB" },
      { symbol: "TWLO", name: "Twilio", tvSymbol: "NYSE:TWLO" },
      { symbol: "DOCN", name: "DigitalOcean", tvSymbol: "NYSE:DOCN" },
      { symbol: "ESTC", name: "Elastic", tvSymbol: "NYSE:ESTC" },
      { symbol: "ZS", name: "Zscaler", tvSymbol: "NASDAQ:ZS" },
      { symbol: "HOOD", name: "Robinhood", tvSymbol: "NASDAQ:HOOD" },
      { symbol: "COIN", name: "Coinbase", tvSymbol: "NASDAQ:COIN" },
      { symbol: "ADBE", name: "Adobe", tvSymbol: "NASDAQ:ADBE" },
      { symbol: "CRM", name: "Salesforce", tvSymbol: "NYSE:CRM" },
      { symbol: "NOW", name: "ServiceNow", tvSymbol: "NYSE:NOW" },
      { symbol: "AKAM", name: "Akamai", tvSymbol: "NASDAQ:AKAM" },
      { symbol: "PANW", name: "Palo Alto Networks", tvSymbol: "NASDAQ:PANW" },
    ],
  },
  {
    category: "Semiconductors",
    assets: [
      { symbol: "NVDA", name: "NVIDIA", tvSymbol: "NASDAQ:NVDA" },
      { symbol: "AMD", name: "AMD", tvSymbol: "NASDAQ:AMD" },
      { symbol: "TSM", name: "TSMC", tvSymbol: "NYSE:TSM" },
      { symbol: "MU", name: "Micron", tvSymbol: "NASDAQ:MU" },
      { symbol: "MCHP", name: "Microchip Tech", tvSymbol: "NASDAQ:MCHP" },
      { symbol: "MRVL", name: "Marvell", tvSymbol: "NASDAQ:MRVL" },
      { symbol: "AVGO", name: "Broadcom", tvSymbol: "NASDAQ:AVGO" },
      { symbol: "ASML", name: "ASML", tvSymbol: "NASDAQ:ASML" },
    ],
  },
  {
    category: "Mobility & Delivery",
    assets: [
      { symbol: "TSLA", name: "Tesla", tvSymbol: "NASDAQ:TSLA" },
      { symbol: "UBER", name: "Uber", tvSymbol: "NYSE:UBER" },
      { symbol: "LYFT", name: "Lyft", tvSymbol: "NASDAQ:LYFT" },
      { symbol: "DASH", name: "DoorDash", tvSymbol: "NYSE:DASH" },
      { symbol: "RIVN", name: "Rivian", tvSymbol: "NASDAQ:RIVN" },
    ],
  },
  {
    category: "Energy",
    assets: [
      { symbol: "NEE", name: "NextEra Energy", tvSymbol: "NYSE:NEE" },
      { symbol: "NRG", name: "NRG Energy", tvSymbol: "NYSE:NRG" },
      { symbol: "VST", name: "Vistra", tvSymbol: "NYSE:VST" },
      { symbol: "AES", name: "AES Corp", tvSymbol: "NYSE:AES" },
      { symbol: "GE", name: "GE Vernova", tvSymbol: "NYSE:GE" },
      { symbol: "EMR", name: "Emerson", tvSymbol: "NYSE:EMR" },
      { symbol: "CCJ", name: "Cameco", tvSymbol: "NYSE:CCJ" },
      { symbol: "GNRC", name: "Generac", tvSymbol: "NYSE:GNRC" },
    ],
  },
  {
    category: "Finance",
    assets: [
      { symbol: "BLK", name: "BlackRock", tvSymbol: "NYSE:BLK" },
      { symbol: "MS", name: "Morgan Stanley", tvSymbol: "NYSE:MS" },
      { symbol: "ICE", name: "ICE", tvSymbol: "NYSE:ICE" },
      { symbol: "CME", name: "CME Group", tvSymbol: "NASDAQ:CME" },
    ],
  },
  {
    category: "Biotech & Quantum",
    assets: [
      { symbol: "CRSP", name: "CRISPR Therapeutics", tvSymbol: "NASDAQ:CRSP" },
      { symbol: "NTLA", name: "Intellia", tvSymbol: "NASDAQ:NTLA" },
      { symbol: "IONQ", name: "IonQ", tvSymbol: "NYSE:IONQ" },
      { symbol: "RGTI", name: "Rigetti", tvSymbol: "NASDAQ:RGTI" },
      { symbol: "U", name: "Unity Software", tvSymbol: "NYSE:U" },
    ],
  },
  {
    category: "REITs & ETFs",
    assets: [
      { symbol: "DLR", name: "Digital Realty", tvSymbol: "NYSE:DLR" },
      { symbol: "PLD", name: "Prologis", tvSymbol: "NYSE:PLD" },
      { symbol: "O", name: "Realty Income", tvSymbol: "NYSE:O" },
      { symbol: "VNQ", name: "Vanguard RE ETF", tvSymbol: "AMEX:VNQ" },
      { symbol: "GLD", name: "SPDR Gold", tvSymbol: "AMEX:GLD" },
      { symbol: "SLV", name: "iShares Silver", tvSymbol: "AMEX:SLV" },
    ],
  },
  {
    category: "Enterprise & Other",
    assets: [
      { symbol: "IBM", name: "IBM", tvSymbol: "NYSE:IBM" },
      { symbol: "ORCL", name: "Oracle", tvSymbol: "NYSE:ORCL" },
      { symbol: "SNAP", name: "Snap", tvSymbol: "NYSE:SNAP" },
      { symbol: "HUBB", name: "Hubbell", tvSymbol: "NYSE:HUBB" },
      { symbol: "XYZ", name: "XYZ", tvSymbol: "NASDAQ:XYZ" },
      { symbol: "INCT", name: "INCT", tvSymbol: "NASDAQ:INCT" },
    ],
  },
];

const categoryColors: Record<string, string> = {
  "Crypto": "text-yellow-400 bg-yellow-400/10",
  "Big Tech": "text-blue-400 bg-blue-400/10",
  "Cloud & SaaS": "text-purple-400 bg-purple-400/10",
  "Semiconductors": "text-cyan-400 bg-cyan-400/10",
  "Mobility & Delivery": "text-green-400 bg-green-400/10",
  "Energy": "text-orange-400 bg-orange-400/10",
  "Finance": "text-emerald-400 bg-emerald-400/10",
  "Biotech & Quantum": "text-pink-400 bg-pink-400/10",
  "REITs & ETFs": "text-amber-400 bg-amber-400/10",
  "Enterprise & Other": "text-slate-400 bg-slate-400/10",
};

export default function MarketsPage() {
  const [chartSymbol, setChartSymbol] = useState("BITSTAMP:BTCUSD");
  const [chartLabel, setChartLabel] = useState("BTC/USD");

  const openChart = (asset: Asset) => {
    setChartSymbol(asset.tvSymbol);
    setChartLabel(`${asset.symbol}`);
    document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Markets</h1>
            <p className="text-muted-foreground mt-1">79 assets across 10 categories</p>
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

        {/* Chart */}
        <Card className="mb-6" id="chart-section">
          <CardHeader>
            <CardTitle>{chartLabel} — Live Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden" style={{ height: 460 }}>
              <iframe
                key={chartSymbol}
                src={`https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(chartSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&locale=en`}
                style={{ width: "100%", height: "100%", border: "none" }}
                allowTransparency
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>

        {/* Watchlist by category */}
        <div className="space-y-4">
          {watchlist.map(({ category, assets }) => {
            const colorClass = categoryColors[category] ?? "text-muted-foreground bg-secondary";
            return (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{category}</span>
                    <span className="text-xs text-muted-foreground font-normal">{assets.length} assets</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {assets.map(asset => (
                      <button
                        key={asset.symbol}
                        onClick={() => openChart(asset)}
                        title={asset.name}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                          ${chartSymbol === asset.tvSymbol
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-foreground hover:border-primary/40 hover:bg-primary/5"
                          }`}
                      >
                        {asset.symbol}
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=${asset.tvSymbol}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
