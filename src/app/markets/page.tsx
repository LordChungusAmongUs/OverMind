"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import { ExternalLink, Activity, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Target, RefreshCw, Bell, TrendingDown } from "lucide-react";

// ── TradingView widget types ──────────────────────────────────────────────────
declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => TVWidget;
    };
  }
}
interface TVChart  { setSymbol(sym: string, cb?: () => void): void; }
interface TVWidget {
  onChartReady(cb: () => void): void;
  activeChart(): TVChart;
  remove(): void;
}
// ─────────────────────────────────────────────────────────────────────────────

interface Asset { symbol: string; name: string; tvSymbol: string; }
// shares = number you own; value = manual $ override (empty = auto from price × shares)
type HoldingEntry = { shares: string; value: string };
type Holdings     = Record<string, HoldingEntry>;
type Prices       = Record<string, number>; // symbol → current USD price
type Targets      = Record<string, string>; // symbol → target % string (e.g. "40")

type PortfolioAlert = {
  id: string;
  type: "balance" | "asset-high" | "asset-low" | "spread";
  msg: string;
  symbol?: string;
  symbolB?: string;
  deviation?: number;
};

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
    { symbol: "SNOW", name: "Snowflake",         tvSymbol: "NYSE:SNOW"    },
    { symbol: "PLTR", name: "Palantir",           tvSymbol: "NYSE:PLTR"    },
    { symbol: "NET",  name: "Cloudflare",         tvSymbol: "NYSE:NET"     },
    { symbol: "DDOG", name: "Datadog",            tvSymbol: "NASDAQ:DDOG"  },
    { symbol: "MDB",  name: "MongoDB",            tvSymbol: "NASDAQ:MDB"   },
    { symbol: "TWLO", name: "Twilio",             tvSymbol: "NYSE:TWLO"    },
    { symbol: "DOCN", name: "DigitalOcean",       tvSymbol: "NYSE:DOCN"    },
    { symbol: "ESTC", name: "Elastic",            tvSymbol: "NYSE:ESTC"    },
    { symbol: "ZS",   name: "Zscaler",            tvSymbol: "NASDAQ:ZS"    },
    { symbol: "HOOD", name: "Robinhood",          tvSymbol: "NASDAQ:HOOD"  },
    { symbol: "COIN", name: "Coinbase",           tvSymbol: "NASDAQ:COIN"  },
    { symbol: "ADBE", name: "Adobe",              tvSymbol: "NASDAQ:ADBE"  },
    { symbol: "CRM",  name: "Salesforce",         tvSymbol: "NYSE:CRM"     },
    { symbol: "NOW",  name: "ServiceNow",         tvSymbol: "NYSE:NOW"     },
    { symbol: "AKAM", name: "Akamai",             tvSymbol: "NASDAQ:AKAM"  },
    { symbol: "PANW", name: "Palo Alto Networks", tvSymbol: "NASDAQ:PANW"  },
  ]},
  { category: "Semiconductors", assets: [
    { symbol: "NVDA", name: "NVIDIA",    tvSymbol: "NASDAQ:NVDA" },
    { symbol: "AMD",  name: "AMD",       tvSymbol: "NASDAQ:AMD"  },
    { symbol: "TSM",  name: "TSMC",      tvSymbol: "NYSE:TSM"    },
    { symbol: "MU",   name: "Micron",    tvSymbol: "NASDAQ:MU"   },
    { symbol: "MCHP", name: "Microchip", tvSymbol: "NASDAQ:MCHP" },
    { symbol: "MRVL", name: "Marvell",   tvSymbol: "NASDAQ:MRVL" },
    { symbol: "AVGO", name: "Broadcom",  tvSymbol: "NASDAQ:AVGO" },
    { symbol: "ASML", name: "ASML",      tvSymbol: "NASDAQ:ASML" },
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
    { symbol: "BLK", name: "BlackRock",      tvSymbol: "NYSE:BLK"   },
    { symbol: "MS",  name: "Morgan Stanley",  tvSymbol: "NYSE:MS"    },
    { symbol: "ICE", name: "ICE",            tvSymbol: "NYSE:ICE"   },
    { symbol: "CME", name: "CME Group",      tvSymbol: "NASDAQ:CME" },
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
    { symbol: "IBM",  name: "IBM",     tvSymbol: "NYSE:IBM"    },
    { symbol: "ORCL", name: "Oracle",  tvSymbol: "NYSE:ORCL"   },
    { symbol: "SNAP", name: "Snap",    tvSymbol: "NYSE:SNAP"   },
    { symbol: "HUBB", name: "Hubbell", tvSymbol: "NYSE:HUBB"   },
    { symbol: "XYZ",  name: "XYZ",    tvSymbol: "NASDAQ:XYZ"  },
    { symbol: "INCT", name: "INCT",    tvSymbol: "NASDAQ:INCT" },
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

// ── Portfolio helpers ─────────────────────────────────────────────────────────
/** Resolve the dollar value of a holding.
 *  If the user typed a manual $ override, use that.
 *  Otherwise compute shares × live price. */
function resolveVal(h: HoldingEntry | undefined, price?: number): number {
  if (!h) return 0;
  if (h.value.trim()) return Math.max(0, parseFloat(h.value) || 0);
  const shares = parseFloat(h.shares) || 0;
  if (shares > 0 && price != null) return shares * price;
  return 0;
}
function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPrice(n: number): string {
  if (n >= 1) return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toFixed(6); // tiny prices like DOGE, ADA
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const [chartLabel,   setChartLabel]   = useState("BTC");
  const [activeSymbol, setActiveSymbol] = useState("BITSTAMP:BTCUSD");

  // TradingView widget ref — created once, never recreated on symbol click
  const tvRef      = useRef<TVWidget | null>(null);
  const tvReadyRef = useRef(false);
  const firstRender = useRef(true);

  // Initialize TradingView widget once on mount
  useEffect(() => {
    const CONTAINER = "tv_chart_main";

    const createWidget = () => {
      if (!window.TradingView) return;
      tvRef.current = new window.TradingView.widget({
        autosize:           true,
        symbol:             "BITSTAMP:BTCUSD",
        interval:           "D",
        timezone:           "America/New_York",
        theme:              "dark",
        style:              "1",
        locale:             "en",
        withdateranges:     true,
        hide_side_toolbar:  false,
        allow_symbol_change: true,
        save_image:         true,
        container_id:       CONTAINER,
        height:             460,
      });
      tvRef.current.onChartReady(() => { tvReadyRef.current = true; });
    };

    if (window.TradingView) {
      createWidget();
    } else {
      const script = document.createElement("script");
      script.id    = "tv-script";
      script.src   = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = createWidget;
      if (!document.getElementById("tv-script")) document.head.appendChild(script);
    }

    return () => {
      tvReadyRef.current = false;
      tvRef.current?.remove();
      tvRef.current = null;
    };
  }, []);

  // Change symbol without recreating the widget — indicators are preserved
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const change = () => tvRef.current?.activeChart().setSymbol(activeSymbol);
    if (tvReadyRef.current) {
      change();
    } else {
      tvRef.current?.onChartReady(change);
    }
  }, [activeSymbol]);

  const openChart = (asset: Asset) => {
    setActiveSymbol(asset.tvSymbol);
    setChartLabel(asset.symbol);
    document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Live prices ────────────────────────────────────────────────────────────
  const [prices,       setPrices]       = useState<Prices>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesLastUpdated, setPricesLastUpdated] = useState<Date | null>(null);

  const allSymbols = useMemo(
    () => watchlist.flatMap(({ assets }) => assets.map(a => a.symbol)),
    []
  );

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await fetch(`/api/prices?symbols=${allSymbols.join(",")}`);
      const data = await res.json();
      if (data.prices) {
        setPrices(data.prices);
        setPricesLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Price fetch error:", e);
    } finally {
      setPricesLoading(false);
    }
  }, [allSymbols]);

  // Fetch on mount, then every 60 seconds
  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // ── Portfolio state ─────────────────────────────────────────────────────────
  const [showPortfolio,  setShowPortfolio]  = useState(false);
  const [showOnlyOwned,  setShowOnlyOwned]  = useState(false);
  const [expandedCats,   setExpandedCats]   = useState<Set<string>>(new Set());

  const [holdings, setHoldings] = useState<Holdings>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("om_holdings") || "{}"); } catch { return {}; }
  });
  const [targetBalance, setTargetBalance] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("om_target_balance") || "";
  });

  const [targets, setTargets] = useState<Targets>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("om_targets") || "{}"); } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem("om_holdings",       JSON.stringify(holdings)); }, [holdings]);
  useEffect(() => { localStorage.setItem("om_target_balance", targetBalance);             }, [targetBalance]);
  useEffect(() => { localStorage.setItem("om_targets",        JSON.stringify(targets));   }, [targets]);

  const setHolding = useCallback((symbol: string, field: keyof HoldingEntry, val: string) => {
    setHoldings(prev => ({
      ...prev,
      [symbol]: { ...(prev[symbol] ?? { shares: "", value: "" }), [field]: val },
    }));
  }, []);

  const setTarget = useCallback((symbol: string, val: string) => {
    setTargets(prev => ({ ...prev, [symbol]: val }));
  }, []);

  // Value = manual override if set, else shares × live price
  const resolveHoldingVal = useCallback(
    (symbol: string) => resolveVal(holdings[symbol], prices[symbol]),
    [holdings, prices]
  );

  const totalValue = useMemo(
    () => allSymbols.reduce((s, sym) => s + resolveHoldingVal(sym), 0),
    [allSymbols, resolveHoldingVal]
  );

  const categoryTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const { category, assets } of watchlist)
      t[category] = assets.reduce((s, a) => s + resolveHoldingVal(a.symbol), 0);
    return t;
  }, [resolveHoldingVal]);

  const target = parseFloat(targetBalance.replace(/,/g, "")) || 0;

  const catsWithHoldings = useMemo(
    () => watchlist.filter(({ category }) => categoryTotals[category] > 0),
    [categoryTotals]
  );
  const expectedCatPct = catsWithHoldings.length > 0 ? 100 / catsWithHoldings.length : 0;

  const alerts = useMemo((): PortfolioAlert[] => {
    const list: PortfolioAlert[] = [];
    if (totalValue === 0) return list;

    // ── 1. Total portfolio vs desired balance ────────────────────────────────
    if (target > 0) {
      const diff = ((totalValue - target) / target) * 100;
      if (Math.abs(diff) >= 5)
        list.push({
          id: "balance",
          type: diff > 0 ? "asset-high" : "asset-low",
          msg: `Portfolio ${diff > 0 ? "+" : ""}${diff.toFixed(1)}% vs desired balance of ${fmtUSD(target)}`,
          deviation: diff,
        });
    }

    // ── 2. Per-asset target % alerts ─────────────────────────────────────────
    // Collect assets that have a target % AND a held value
    const trackedAssets: { symbol: string; targetPct: number; actualVal: number; targetVal: number; deviation: number }[] = [];

    for (const { assets } of watchlist) {
      for (const asset of assets) {
        const tgtPct = parseFloat(targets[asset.symbol]) || 0;
        if (tgtPct <= 0) continue;
        const actualVal  = resolveHoldingVal(asset.symbol);
        if (actualVal <= 0) continue;
        const targetVal  = (tgtPct / 100) * totalValue;
        const deviation  = targetVal > 0 ? ((actualVal - targetVal) / targetVal) * 100 : 0;
        trackedAssets.push({ symbol: asset.symbol, targetPct: tgtPct, actualVal, targetVal, deviation });

        if (Math.abs(deviation) >= 5) {
          const over = deviation > 0;
          list.push({
            id: `asset-${asset.symbol}`,
            type: over ? "asset-high" : "asset-low",
            symbol: asset.symbol,
            deviation,
            msg: `${asset.symbol} is ${over ? "+" : ""}${deviation.toFixed(1)}% ${over ? "above" : "below"} target — ${fmtUSD(actualVal)} vs ${fmtUSD(targetVal)} target (${tgtPct}%)`,
          });
        }
      }
    }

    // ── 3. Cross-asset spread alerts ─────────────────────────────────────────
    // Find pairs where the difference in their deviation from target is ≥ 5%
    const spreadSeen = new Set<string>();
    for (let i = 0; i < trackedAssets.length; i++) {
      for (let j = i + 1; j < trackedAssets.length; j++) {
        const a = trackedAssets[i];
        const b = trackedAssets[j];
        const spread = a.deviation - b.deviation;
        if (Math.abs(spread) >= 5) {
          const key = [a.symbol, b.symbol].sort().join("-");
          if (spreadSeen.has(key)) continue;
          spreadSeen.add(key);
          const high = spread > 0 ? a : b;
          const low  = spread > 0 ? b : a;
          list.push({
            id: `spread-${key}`,
            type: "spread",
            symbol: high.symbol,
            symbolB: low.symbol,
            deviation: Math.abs(spread),
            msg: `Spread: ${high.symbol} ${high.deviation >= 0 ? "+" : ""}${high.deviation.toFixed(1)}% vs target / ${low.symbol} ${low.deviation >= 0 ? "+" : ""}${low.deviation.toFixed(1)}% vs target — ${Math.abs(spread).toFixed(1)}% apart`,
          });
        }
      }
    }

    return list;
  }, [resolveHoldingVal, totalValue, target, targets]);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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
            <p className="text-green-700 text-sm font-mono mt-1">
              79 assets · 10 sectors · live prices
              {pricesLastUpdated && (
                <span className="text-green-900 ml-2">
                  updated {pricesLastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPortfolio(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-all
                ${showPortfolio
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                  : "border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                }`}>
              <TrendingUp className="w-3.5 h-3.5" />
              Portfolio Tracker
              {alerts.length > 0 && (
                <span className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                  {alerts.length}
                </span>
              )}
            </button>
            <button onClick={fetchPrices} disabled={pricesLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5 text-green-600 text-xs font-mono hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-400 transition-all disabled:opacity-50"
              title="Refresh prices">
              <RefreshCw className={`w-3.5 h-3.5 ${pricesLoading ? "animate-spin" : ""}`} />
              {pricesLoading ? "fetching…" : "refresh"}
            </button>
            <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/5 text-green-400 text-sm font-mono font-medium hover:bg-green-500/10 hover:border-green-500/50 transition-all">
              TradingView <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Always-visible alerts banner ── */}
        {alerts.length > 0 && (
          <div className="mb-5 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-600 font-mono uppercase tracking-widest">Portfolio Alerts ({alerts.length})</span>
            </div>
            {alerts.map(alert => {
              const isSpread = alert.type === "spread";
              const isHigh   = alert.type === "asset-high";
              const isLow    = alert.type === "asset-low";
              const border   = isSpread ? "border-purple-500/40 bg-purple-500/5 text-purple-300"
                             : isHigh   ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
                             :            "border-red-500/40 bg-red-500/5 text-red-300";
              const Icon = isSpread ? AlertTriangle : isHigh ? TrendingUp : TrendingDown;
              return (
                <div key={alert.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-mono ${border}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {alert.msg}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Portfolio Tracker ── */}
        {showPortfolio && (
          <div className="mb-6 space-y-3">

            {/* Summary */}
            <div className="holo-card rounded-xl border border-cyan-500/20 bg-black/50 p-5">
              <div className="flex items-start gap-10 flex-wrap">
                <div>
                  <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5">Total Portfolio</p>
                  <p className="text-3xl font-black font-mono text-cyan-300">{fmtUSD(totalValue)}</p>
                  {totalValue === 0 && (
                    <p className="text-xs text-green-900 font-mono mt-1">Expand a sector below to enter holdings</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Desired Balance
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-green-600 font-mono text-xl">$</span>
                    <input
                      type="number" min="0" value={targetBalance}
                      onChange={e => setTargetBalance(e.target.value)}
                      placeholder="0"
                      className="bg-transparent border-b-2 border-green-500/30 focus:border-cyan-500/60 text-green-300 font-mono text-xl w-36 focus:outline-none placeholder:text-green-900 transition-colors"
                    />
                  </div>
                </div>

                {target > 0 && totalValue > 0 && (() => {
                  const diff = ((totalValue - target) / target) * 100;
                  const over = diff >= 0;
                  const alert5 = Math.abs(diff) >= 5;
                  return (
                    <div>
                      <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5">vs Target</p>
                      <p className={`text-2xl font-black font-mono ${alert5 ? (over ? "text-amber-400" : "text-red-400") : "text-green-400"}`}>
                        {over ? "+" : ""}{diff.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-green-800 font-mono mt-0.5">
                        {over
                          ? `$${(totalValue - target).toLocaleString("en-US", { maximumFractionDigits: 0 })} over target`
                          : `$${(target - totalValue).toLocaleString("en-US", { maximumFractionDigits: 0 })} under target`}
                      </p>
                    </div>
                  );
                })()}

                <div className="ml-auto flex items-center gap-2 self-start">
                  <button onClick={() => setShowOnlyOwned(p => !p)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all
                      ${showOnlyOwned
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                        : "border-green-500/30 text-green-600 hover:text-green-400 hover:border-green-500/50"
                      }`}>
                    {showOnlyOwned ? "SHOW ALL" : "OWNED ONLY"}
                  </button>
                  <button onClick={() => { setHoldings({}); setTargetBalance(""); }}
                    className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-800 hover:text-red-500 hover:border-red-500/40 text-xs font-mono transition-all">
                    CLEAR ALL
                  </button>
                </div>
              </div>
            </div>

            {/* Sector allocation bars */}
            {totalValue > 0 && catsWithHoldings.length > 0 && (
              <div className="holo-card rounded-xl border border-green-500/15 bg-black/40 p-4">
                <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-3">Allocation by Sector</p>
                <div className="space-y-2.5">
                  {catsWithHoldings.map(({ category }) => {
                    const pct = (categoryTotals[category] / totalValue) * 100;
                    const textColor = categoryColor[category]?.split(" ")[0] ?? "text-green-500";
                    const isAlert = Math.abs(pct - expectedCatPct) >= 5;
                    return (
                      <div key={category} className="flex items-center gap-3">
                        <span className={`w-32 text-[11px] font-mono truncate ${textColor}`}>{category}</span>
                        <div className="flex-1 h-1.5 bg-green-900/20 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isAlert ? "bg-amber-500/70" : "bg-cyan-500/60"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-mono w-14 text-right ${isAlert ? "text-amber-400" : "text-green-400"}`}>
                          {pct.toFixed(1)}%
                        </span>
                        <span className="text-[11px] font-mono w-28 text-right text-green-700">
                          {fmtUSD(categoryTotals[category])}
                        </span>
                        {isAlert && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-sector collapsible input panels */}
            <div className="space-y-2">
              {watchlist.map(({ category, assets }) => {
                const catTotal     = categoryTotals[category];
                const displayedAssets = showOnlyOwned
                  ? assets.filter(a => resolveHoldingVal(a.symbol) > 0)
                  : assets;
                if (showOnlyOwned && displayedAssets.length === 0) return null;

                const isExpanded  = expandedCats.has(category);
                const cc          = categoryColor[category] ?? "text-green-500 border-green-500/20 bg-green-500/5";
                const catPct      = totalValue > 0 ? (catTotal / totalValue) * 100 : 0;
                const isCatAlert  = catTotal > 0 && Math.abs(catPct - expectedCatPct) >= 5;
                const ownedCount  = assets.filter(a => resolveHoldingVal(a.symbol) > 0).length;

                return (
                  <div key={category} className="holo-card rounded-xl border border-green-500/15 bg-black/40">
                    <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toggleCat(category)}>
                      {isExpanded
                        ? <ChevronDown  className="w-4 h-4 text-green-700 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-green-700 flex-shrink-0" />}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${cc}`}>
                        {category}
                      </span>
                      <span className="text-xs text-green-800 font-mono">{assets.length} assets</span>
                      {ownedCount > 0 && (
                        <span className="text-xs text-cyan-800 font-mono">{ownedCount} held</span>
                      )}
                      {catTotal > 0 && (
                        <div className="ml-auto flex items-center gap-3">
                          {isCatAlert && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          <span className={`text-xs font-mono font-bold ${isCatAlert ? "text-amber-400" : "text-cyan-400"}`}>
                            {catPct.toFixed(1)}%
                          </span>
                          <span className="text-xs font-mono text-green-700">{fmtUSD(catTotal)}</span>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-green-500/10 px-4 pb-4">
                        <div
                          className="grid gap-x-4 gap-y-2 pt-3 items-center"
                          style={{ gridTemplateColumns: "1fr 80px 104px 70px 70px" }}
                        >
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest">Asset</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">Shares</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">$ Value</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">% Sector</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">% Total</div>

                          {displayedAssets.map(asset => {
                            const h = holdings[asset.symbol] ?? { shares: "", value: "" };
                            const val = resolveHoldingVal(asset.symbol);
                            const price = prices[asset.symbol];
                            const autoVal = !h.value.trim() && h.shares && price
                              ? (parseFloat(h.shares) || 0) * price : null;
                            const pctOfCat   = catTotal > 0 ? (val / catTotal) * 100 : 0;
                            const pctOfTotal = totalValue > 0 ? (val / totalValue) * 100 : 0;
                            const ownedInCat = assets.filter(a => resolveHoldingVal(a.symbol) > 0);
                            const expectedAssetPct = ownedInCat.length > 0 ? 100 / ownedInCat.length : 0;
                            const isAssetAlert = val > 0 && ownedInCat.length > 1 && Math.abs(pctOfCat - expectedAssetPct) >= 5;

                            return (
                              <React.Fragment key={asset.symbol}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isAssetAlert && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                                  <span className={`text-sm font-mono font-bold flex-shrink-0 ${isAssetAlert ? "text-amber-400" : val > 0 ? "text-green-300" : "text-green-800"}`}>
                                    {asset.symbol}
                                  </span>
                                  <span className="text-[10px] text-green-900 font-mono truncate">{asset.name}</span>
                                  {price && <span className="text-[10px] text-green-800 font-mono ml-auto flex-shrink-0">{fmtPrice(price)}</span>}
                                </div>
                                <input type="number" min="0" step="any"
                                  value={h.shares}
                                  onChange={e => setHolding(asset.symbol, "shares", e.target.value)}
                                  placeholder="0"
                                  className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-green-400/60 text-green-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors"
                                />
                                <div className="relative">
                                  <input type="number" min="0" step="any"
                                    value={h.value}
                                    onChange={e => setHolding(asset.symbol, "value", e.target.value)}
                                    placeholder={autoVal != null ? autoVal.toFixed(2) : "0.00"}
                                    className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-cyan-500/60 text-cyan-400 font-mono text-xs focus:outline-none placeholder:text-cyan-900 py-0.5 transition-colors"
                                  />
                                  {autoVal != null && !h.value.trim() && (
                                    <span className="absolute inset-0 flex items-center justify-end text-xs font-mono text-cyan-700 pointer-events-none pr-0.5">
                                      {fmtUSD(autoVal)}
                                    </span>
                                  )}
                                </div>
                                <div className={`text-xs font-mono text-right ${isAssetAlert ? "text-amber-400" : "text-green-600"}`}>
                                  {val > 0 ? `${pctOfCat.toFixed(1)}%` : "—"}
                                </div>
                                <div className="text-xs font-mono text-green-800 text-right">
                                  {val > 0 ? `${pctOfTotal.toFixed(2)}%` : "—"}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        <div id="chart-section" className="holo-card rounded-xl border border-green-500/20 bg-black/50 mb-6 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-green-500/20">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="font-mono font-bold text-green-300">{chartLabel}</span>
            <span className="text-xs text-green-700 font-mono">— LIVE CHART</span>
            <span className="text-xs text-green-800 font-mono ml-2">indicators persist across symbols</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 ping-slow" />
              <span className="text-xs text-green-600 font-mono">LIVE</span>
            </span>
          </div>
          {/* Single persistent widget div — never remounted, so indicators survive */}
          <div id="tv_chart_main" style={{ height: 460, width: "100%" }} />
        </div>

        {/* ── Watchlist ── */}
        <div className="space-y-3">
          {watchlist.map(({ category, assets }) => {
            const cc = categoryColor[category] ?? "text-green-500 border-green-500/20 bg-green-500/5";
            const catTotal = categoryTotals[category];
            return (
              <div key={category} className="holo-card rounded-xl border border-green-500/15 bg-black/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${cc}`}>
                    {category}
                  </span>
                  <span className="text-xs text-green-800 font-mono">{assets.length} assets</span>
                  {catTotal > 0 && (
                    <span className="text-xs text-cyan-700 font-mono ml-auto">{fmtUSD(catTotal)}</span>
                  )}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {assets.map(asset => {
                    const h = holdings[asset.symbol] ?? { shares: "", value: "" };
                    const val = resolveHoldingVal(asset.symbol);
                    const price = prices[asset.symbol];
                    const autoVal = !h.value.trim() && h.shares && price
                      ? (parseFloat(h.shares) || 0) * price : null;
                    const isActive = activeSymbol === asset.tvSymbol;
                    return (
                      <div key={asset.symbol}
                        className={`rounded-lg border transition-all p-2.5
                          ${isActive
                            ? "border-green-400/40 bg-green-400/5 shadow-[0_0_8px_rgba(0,255,65,0.1)]"
                            : val > 0
                              ? "border-cyan-500/20 bg-cyan-500/5"
                              : "border-green-500/15 bg-black/20"
                          }`}>
                        {/* Symbol + price row */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <button onClick={() => openChart(asset)} title={`Open ${asset.name} chart`}
                            className={`flex items-center gap-1 text-sm font-mono font-bold transition-colors
                              ${isActive ? "text-green-300" : val > 0 ? "text-cyan-400" : "text-green-700 hover:text-green-400"}`}>
                            {asset.symbol}
                          </button>
                          <span className="text-[10px] text-green-900 font-mono truncate flex-1">{asset.name}</span>
                          <a href={`https://www.tradingview.com/chart/?symbol=${asset.tvSymbol}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-green-900 hover:text-green-600 transition-colors flex-shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {/* Live price */}
                        {price != null ? (
                          <p className="text-[10px] text-green-700 font-mono mb-2">{fmtPrice(price)}<span className="text-green-900 ml-1">live</span></p>
                        ) : (
                          <p className="text-[10px] text-green-900 font-mono mb-2">fetching…</p>
                        )}
                        {/* Owned inputs — row 1: Shares + $ Value */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">Shares</p>
                            <input
                              type="number" min="0" step="any"
                              value={h.shares}
                              onChange={e => setHolding(asset.symbol, "shares", e.target.value)}
                              placeholder="0"
                              className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-green-400/50 text-green-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">
                              {autoVal != null ? "$ auto" : "$ value"}
                            </p>
                            <div className="relative">
                              <input
                                type="number" min="0" step="any"
                                value={h.value}
                                onChange={e => setHolding(asset.symbol, "value", e.target.value)}
                                placeholder={autoVal != null ? autoVal.toFixed(2) : "0.00"}
                                className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-cyan-500/50 text-cyan-400 font-mono text-xs focus:outline-none placeholder:text-cyan-900 py-0.5 transition-colors"
                              />
                              {autoVal != null && !h.value.trim() && (
                                <span className="absolute inset-0 flex items-end justify-end text-xs font-mono text-cyan-600 pointer-events-none pb-0.5">
                                  {fmtUSD(autoVal)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Row 2: Target % + actual % */}
                        {(() => {
                          const tgtPct    = parseFloat(targets[asset.symbol]) || 0;
                          const actualPct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                          const tgtVal    = tgtPct > 0 ? (tgtPct / 100) * totalValue : 0;
                          const dev       = tgtVal > 0 ? ((val - tgtVal) / tgtVal) * 100 : 0;
                          const hasAlert  = tgtPct > 0 && val > 0 && Math.abs(dev) >= 5;
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">Target %</p>
                                <div className="flex items-center">
                                  <input
                                    type="number" min="0" max="100" step="any"
                                    value={targets[asset.symbol] ?? ""}
                                    onChange={e => setTarget(asset.symbol, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-right bg-transparent border-b border-purple-500/20 focus:border-purple-400/50 text-purple-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors"
                                  />
                                  <span className="text-purple-700 font-mono text-xs ml-0.5">%</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">Actual %</p>
                                <p className={`text-xs font-mono text-right py-0.5 ${hasAlert ? (dev > 0 ? "text-amber-400" : "text-red-400") : "text-green-700"}`}>
                                  {val > 0 ? `${actualPct.toFixed(1)}%` : "—"}
                                  {hasAlert && <span className="ml-1">{dev > 0 ? "▲" : "▼"}{Math.abs(dev).toFixed(1)}%</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Total value row */}
                        {val > 0 && (
                          <p className="text-[10px] text-right text-cyan-700 font-mono mt-1.5 font-bold">{fmtUSD(val)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
