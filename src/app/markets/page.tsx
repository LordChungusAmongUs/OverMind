"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { ExternalLink, Activity } from "lucide-react";

interface Asset { symbol: string; name: string; tvSymbol: string; }

const watchlist: { category: string; assets: Asset[] }[] = [
  { category: "Crypto", assets: [
    { symbol: "BTC",  name: "Bitcoin",          tvSymbol: "BITSTAMP:BTCUSD"  },
    { symbol: "ETH",  name: "Ethereum",          tvSymbol: "BITSTAMP:ETHUSD"  },
    { symbol: "SOL",  name: "Solana",            tvSymbol: "COINBASE:SOLUSD"  },
    { symbol: "XRP",  name: "XRP",               tvSymbol: "BITSTAMP:XRPUSD"  },
    { symbol: "LINK", name: "Chainlink",          tvSymbol: "COINBASE:LINKUSD" },
    { symbol: "ADA",  name: "Cardano",            tvSymbol: "COINBASE:ADAUSD"  },
    { symbol: "LTC",  name: "Litecoin",           tvSymbol: "BITSTAMP:LTCUSD"  },
    { symbol: "DOGE", name: "Dogecoin",           tvSymbol: "BITSTAMP:DOGEUSD" },
    { symbol: "SAND", name: "The Sandbox",        tvSymbol: "COINBASE:SANDUSD" },
    { symbol: "MANA", name: "Decentraland",       tvSymbol: "COINBASE:MANDUSD" },
    { symbol: "MSTR", name: "MicroStrategy",      tvSymbol: "NASDAQ:MSTR"      },
    { symbol: "MARA", name: "Marathon Digital",   tvSymbol: "NASDAQ:MARA"      },
    { symbol: "RIOT", name: "Riot Platforms",     tvSymbol: "NASDAQ:RIOT"      },
  ]},
  { category: "Big Tech", assets: [
    { symbol: "AAPL", name: "Apple",     tvSymbol: "NASDAQ:AAPL" },
    { symbol: "MSFT", name: "Microsoft", tvSymbol: "NASDAQ:MSFT" },
    { symbol: "GOOG", name: "Alphabet",  tvSymbol: "NASDAQ:GOOG" },
    { symbol: "AMZN", name: "Amazon",    tvSymbol: "NASDAQ:AMZN" },
    { symbol: "META", name: "Meta",      tvSymbol: "NASDAQ:META" },
    { symbol: "NFLX", name: "Netflix",   tvSymbol: "NASDAQ:NFLX" },
    { symbol: "BABA", name: "Alibaba",   tvSymbol: "NYSE:BABA"   },
    { symbol: "SONY", name: "Sony",      tvSymbol: "NYSE:SONY"   },
  ]},
  { category: "Cloud & SaaS", assets: [
    { symbol: "SNOW", name: "Snowflake",          tvSymbol: "NYSE:SNOW"    },
    { symbol: "PLTR", name: "Palantir",            tvSymbol: "NYSE:PLTR"    },
    { symbol: "NET",  name: "Cloudflare",          tvSymbol: "NYSE:NET"     },
    { symbol: "DDOG", name: "Datadog",             tvSymbol: "NASDAQ:DDOG"  },
    { symbol: "MDB",  name: "MongoDB",             tvSymbol: "NASDAQ:MDB"   },
    { symbol: "TWLO", name: "Twilio",              tvSymbol: "NYSE:TWLO"    },
    { symbol: "DOCN", name: "DigitalOcean",        tvSymbol: "NYSE:DOCN"    },
    { symbol: "ESTC", name: "Elastic",             tvSymbol: "NYSE:ESTC"    },
    { symbol: "ZS",   name: "Zscaler",             tvSymbol: "NASDAQ:ZS"    },
    { symbol: "HOOD", name: "Robinhood",           tvSymbol: "NASDAQ:HOOD"  },
    { symbol: "COIN", name: "Coinbase",            tvSymbol: "NASDAQ:COIN"  },
    { symbol: "ADBE", name: "Adobe",               tvSymbol: "NASDAQ:ADBE"  },
    { symbol: "CRM",  name: "Salesforce",          tvSymbol: "NYSE:CRM"     },
    { symbol: "NOW",  name: "ServiceNow",          tvSymbol: "NYSE:NOW"     },
    { symbol: "AKAM", name: "Akamai",              tvSymbol: "NASDAQ:AKAM"  },
    { symbol: "PANW", name: "Palo Alto Networks",  tvSymbol: "NASDAQ:PANW"  },
  ]},
  { category: "Semiconductors", assets: [
    { symbol: "NVDA", name: "NVIDIA",        tvSymbol: "NASDAQ:NVDA" },
    { symbol: "AMD",  name: "AMD",           tvSymbol: "NASDAQ:AMD"  },
    { symbol: "TSM",  name: "TSMC",          tvSymbol: "NYSE:TSM"    },
    { symbol: "MU",   name: "Micron",        tvSymbol: "NASDAQ:MU"   },
    { symbol: "MCHP", name: "Microchip",     tvSymbol: "NASDAQ:MCHP" },
    { symbol: "MRVL", name: "Marvell",       tvSymbol: "NASDAQ:MRVL" },
    { symbol: "AVGO", name: "Broadcom",      tvSymbol: "NASDAQ:AVGO" },
    { symbol: "ASML", name: "ASML",          tvSymbol: "NASDAQ:ASML" },
  ]},
  { category: "Mobility & Delivery", assets: [
    { symbol: "TSLA", name: "Tesla",    tvSymbol: "NASDAQ:TSLA" },
    { symbol: "UBER", name: "Uber",     tvSymbol: "NYSE:UBER"   },
    { symbol: "LYFT", name: "Lyft",     tvSymbol: "NASDAQ:LYFT" },
    { symbol: "DASH", name: "DoorDash", tvSymbol: "NYSE:DASH"   },
    { symbol: "RIVN", name: "Rivian",   tvSymbol: "NASDAQ:RIVN" },
  ]},
  { category: "Energy", assets: [
    { symbol: "NEE",  name: "NextEra",  tvSymbol: "NYSE:NEE"  },
    { symbol: "NRG",  name: "NRG",      tvSymbol: "NYSE:NRG"  },
    { symbol: "VST",  name: "Vistra",   tvSymbol: "NYSE:VST"  },
    { symbol: "AES",  name: "AES",      tvSymbol: "NYSE:AES"  },
    { symbol: "GE",   name: "GE",       tvSymbol: "NYSE:GE"   },
    { symbol: "EMR",  name: "Emerson",  tvSymbol: "NYSE:EMR"  },
    { symbol: "CCJ",  name: "Cameco",   tvSymbol: "NYSE:CCJ"  },
    { symbol: "GNRC", name: "Generac",  tvSymbol: "NYSE:GNRC" },
  ]},
  { category: "Finance", assets: [
    { symbol: "BLK", name: "BlackRock",    tvSymbol: "NYSE:BLK"    },
    { symbol: "MS",  name: "Morgan Stanley",tvSymbol: "NYSE:MS"     },
    { symbol: "ICE", name: "ICE",          tvSymbol: "NYSE:ICE"    },
    { symbol: "CME", name: "CME Group",    tvSymbol: "NASDAQ:CME"  },
  ]},
  { category: "Biotech & Quantum", assets: [
    { symbol: "CRSP", name: "CRISPR",   tvSymbol: "NASDAQ:CRSP" },
    { symbol: "NTLA", name: "Intellia", tvSymbol: "NASDAQ:NTLA" },
    { symbol: "IONQ", name: "IonQ",     tvSymbol: "NYSE:IONQ"   },
    { symbol: "RGTI", name: "Rigetti",  tvSymbol: "NASDAQ:RGTI" },
    { symbol: "U",    name: "Unity",    tvSymbol: "NYSE:U"      },
  ]},
  { category: "REITs & ETFs", assets: [
    { symbol: "DLR", name: "Digital Realty",  tvSymbol: "NYSE:DLR"  },
    { symbol: "PLD", name: "Prologis",        tvSymbol: "NYSE:PLD"  },
    { symbol: "O",   name: "Realty Income",   tvSymbol: "NYSE:O"    },
    { symbol: "VNQ", name: "Vanguard RE ETF", tvSymbol: "AMEX:VNQ"  },
    { symbol: "GLD", name: "SPDR Gold",       tvSymbol: "AMEX:GLD"  },
    { symbol: "SLV", name: "iShares Silver",  tvSymbol: "AMEX:SLV"  },
  ]},
  { category: "Enterprise & Other", assets: [
    { symbol: "IBM",  name: "IBM",    tvSymbol: "NYSE:IBM"    },
    { symbol: "ORCL", name: "Oracle", tvSymbol: "NYSE:ORCL"   },
    { symbol: "SNAP", name: "Snap",   tvSymbol: "NYSE:SNAP"   },
    { symbol: "HUBB", name: "Hubbell",tvSymbol: "NYSE:HUBB"   },
    { symbol: "XYZ",  name: "XYZ",   tvSymbol: "NASDAQ:XYZ"  },
    { symbol: "INCT", name: "INCT",   tvSymbol: "NASDAQ:INCT" },
  ]},
];

const categoryColor: Record<string, string> = {
  "Crypto":              "text-yellow-400  border-yellow-400/30  bg-yellow-400/5",
  "Big Tech":            "text-green-300   border-green-300/30   bg-green-300/5",
  "Cloud & SaaS":        "text-cyan-400    border-cyan-400/30    bg-cyan-400/5",
  "Semiconductors":      "text-green-400   border-green-400/30   bg-green-400/5",
  "Mobility & Delivery": "text-lime-400    border-lime-400/30    bg-lime-400/5",
  "Energy":              "text-orange-400  border-orange-400/30  bg-orange-400/5",
  "Finance":             "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  "Biotech & Quantum":   "text-red-400     border-red-400/30     bg-red-400/5",
  "REITs & ETFs":        "text-amber-400   border-amber-400/30   bg-amber-400/5",
  "Enterprise & Other":  "text-green-600   border-green-600/30   bg-green-600/5",
};

export default function MarketsPage() {
  const [chartSymbol, setChartSymbol] = useState("BITSTAMP:BTCUSD");
  const [chartLabel, setChartLabel]   = useState("BTC");

  const openChart = (asset: Asset) => {
    setChartSymbol(asset.tvSymbol);
    setChartLabel(asset.symbol);
    document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
              <span className="text-red-500">&gt;</span> market_feed.exe
            </p>
            <h1 className="text-3xl font-black font-mono text-green-300">Markets</h1>
            <p className="text-green-700 text-sm font-mono mt-1">79 assets · 10 sectors · live data</p>
          </div>
          <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/5 text-green-400 text-sm font-mono font-medium hover:bg-green-500/10 hover:border-green-500/50 transition-all">
            TradingView <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Chart */}
        <div id="chart-section" className="holo-card rounded-xl border border-green-500/20 bg-black/50 mb-6 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-green-500/20">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="font-mono font-bold text-green-300">{chartLabel}</span>
            <span className="text-xs text-green-700 font-mono">— LIVE CHART</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 ping-slow" />
              <span className="text-xs text-green-600 font-mono">LIVE</span>
            </span>
          </div>
          <div style={{ height: 460 }}>
            <iframe
              key={chartSymbol}
              src={`https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(chartSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&locale=en`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allowTransparency allowFullScreen
            />
          </div>
        </div>

        {/* Watchlist */}
        <div className="space-y-3">
          {watchlist.map(({ category, assets }) => {
            const cc = categoryColor[category] ?? "text-green-500 border-green-500/20 bg-green-500/5";
            return (
              <div key={category} className="holo-card rounded-xl border border-green-500/15 bg-black/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${cc}`}>
                    {category}
                  </span>
                  <span className="text-xs text-green-800 font-mono">{assets.length} assets</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assets.map(asset => (
                    <button key={asset.symbol} onClick={() => openChart(asset)} title={asset.name}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all
                        ${chartSymbol === asset.tvSymbol
                          ? "border-green-400/60 bg-green-400/10 text-green-300 shadow-[0_0_8px_rgba(0,255,65,0.2)]"
                          : "border-green-500/20 bg-black/30 text-green-600 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/5"
                        }`}>
                      {asset.symbol}
                      <a href={`https://www.tradingview.com/chart/?symbol=${asset.tvSymbol}`}
                        target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-3 h-3 text-green-700" />
                      </a>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
