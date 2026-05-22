"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import {
  ExternalLink, Activity, TrendingUp, AlertTriangle, ChevronDown, ChevronRight,
  Target, RefreshCw, Bell, TrendingDown, Pencil, Trash2, Plus, X, Check, MoveRight,
} from "lucide-react";

// ── TradingView widget types ──────────────────────────────────────────────────
declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => TVWidget };
  }
}
interface TVChart  { setSymbol(sym: string, cb?: () => void): void; }
interface TVWidget {
  onChartReady(cb: () => void): void;
  activeChart(): TVChart;
  remove(): void;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Asset       { symbol: string; name: string; tvSymbol: string; }
interface WatchGroup  { category: string; assets: Asset[]; }
type HoldingEntry     = { shares: string; value: string };
type Holdings         = Record<string, HoldingEntry>;
type Prices           = Record<string, number>;
type Targets          = Record<string, string>;
type PortfolioAlert   = {
  id: string; type: "balance" | "asset-high" | "asset-low" | "spread";
  msg: string; symbol?: string; symbolB?: string; deviation?: number;
};

// ── Default watchlist ─────────────────────────────────────────────────────────
const DEFAULT_WATCHLIST: WatchGroup[] = [
  { category: "Crypto", assets: [
    { symbol: "BTC",  name: "Bitcoin",        tvSymbol: "BITSTAMP:BTCUSD"  },
    { symbol: "ETH",  name: "Ethereum",        tvSymbol: "BITSTAMP:ETHUSD"  },
    { symbol: "SOL",  name: "Solana",          tvSymbol: "COINBASE:SOLUSD"  },
    { symbol: "XRP",  name: "XRP",             tvSymbol: "BITSTAMP:XRPUSD"  },
    { symbol: "LINK", name: "Chainlink",        tvSymbol: "COINBASE:LINKUSD" },
    { symbol: "ADA",  name: "Cardano",          tvSymbol: "COINBASE:ADAUSD"  },
    { symbol: "LTC",  name: "Litecoin",         tvSymbol: "BITSTAMP:LTCUSD"  },
    { symbol: "DOGE", name: "Dogecoin",         tvSymbol: "BITSTAMP:DOGEUSD" },
    { symbol: "SAND", name: "The Sandbox",      tvSymbol: "COINBASE:SANDUSD" },
    { symbol: "MANA", name: "Decentraland",     tvSymbol: "COINBASE:MANDUSD" },
    { symbol: "MSTR", name: "MicroStrategy",    tvSymbol: "NASDAQ:MSTR"      },
    { symbol: "MARA", name: "Marathon Digital", tvSymbol: "NASDAQ:MARA"      },
    { symbol: "RIOT", name: "Riot Platforms",   tvSymbol: "NASDAQ:RIOT"      },
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
    { symbol: "SNOW", name: "Snowflake",         tvSymbol: "NYSE:SNOW"   },
    { symbol: "PLTR", name: "Palantir",           tvSymbol: "NYSE:PLTR"   },
    { symbol: "NET",  name: "Cloudflare",         tvSymbol: "NYSE:NET"    },
    { symbol: "DDOG", name: "Datadog",            tvSymbol: "NASDAQ:DDOG" },
    { symbol: "MDB",  name: "MongoDB",            tvSymbol: "NASDAQ:MDB"  },
    { symbol: "HOOD", name: "Robinhood",          tvSymbol: "NASDAQ:HOOD" },
    { symbol: "COIN", name: "Coinbase",           tvSymbol: "NASDAQ:COIN" },
    { symbol: "ADBE", name: "Adobe",              tvSymbol: "NASDAQ:ADBE" },
    { symbol: "CRM",  name: "Salesforce",         tvSymbol: "NYSE:CRM"    },
    { symbol: "NOW",  name: "ServiceNow",         tvSymbol: "NYSE:NOW"    },
    { symbol: "PANW", name: "Palo Alto Networks", tvSymbol: "NASDAQ:PANW" },
  ]},
  { category: "Semiconductors", assets: [
    { symbol: "NVDA", name: "NVIDIA",    tvSymbol: "NASDAQ:NVDA" },
    { symbol: "AMD",  name: "AMD",       tvSymbol: "NASDAQ:AMD"  },
    { symbol: "TSM",  name: "TSMC",      tvSymbol: "NYSE:TSM"    },
    { symbol: "MU",   name: "Micron",    tvSymbol: "NASDAQ:MU"   },
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
    { symbol: "NEE",  name: "NextEra", tvSymbol: "NYSE:NEE"  },
    { symbol: "NRG",  name: "NRG",     tvSymbol: "NYSE:NRG"  },
    { symbol: "VST",  name: "Vistra",  tvSymbol: "NYSE:VST"  },
    { symbol: "GE",   name: "GE",      tvSymbol: "NYSE:GE"   },
    { symbol: "CCJ",  name: "Cameco",  tvSymbol: "NYSE:CCJ"  },
  ]},
  { category: "Finance", assets: [
    { symbol: "BLK", name: "BlackRock",     tvSymbol: "NYSE:BLK"   },
    { symbol: "MS",  name: "Morgan Stanley", tvSymbol: "NYSE:MS"    },
    { symbol: "CME", name: "CME Group",     tvSymbol: "NASDAQ:CME" },
  ]},
  { category: "Biotech & Quantum", assets: [
    { symbol: "CRSP", name: "CRISPR",   tvSymbol: "NASDAQ:CRSP" },
    { symbol: "IONQ", name: "IonQ",     tvSymbol: "NYSE:IONQ"   },
    { symbol: "RGTI", name: "Rigetti",  tvSymbol: "NASDAQ:RGTI" },
  ]},
  { category: "REITs & ETFs", assets: [
    { symbol: "DLR", name: "Digital Realty",  tvSymbol: "NYSE:DLR"  },
    { symbol: "VNQ", name: "Vanguard RE ETF", tvSymbol: "AMEX:VNQ"  },
    { symbol: "GLD", name: "SPDR Gold",       tvSymbol: "AMEX:GLD"  },
    { symbol: "SLV", name: "iShares Silver",  tvSymbol: "AMEX:SLV"  },
  ]},
  { category: "Enterprise & Other", assets: [
    { symbol: "IBM",  name: "IBM",    tvSymbol: "NYSE:IBM"  },
    { symbol: "ORCL", name: "Oracle", tvSymbol: "NYSE:ORCL" },
    { symbol: "SNAP", name: "Snap",   tvSymbol: "NYSE:SNAP" },
  ]},
];

// ── Color palette — cycles for new groups ─────────────────────────────────────
const COLOR_PALETTE = [
  "text-yellow-400  border-yellow-400/30  bg-yellow-400/5",
  "text-green-300   border-green-300/30   bg-green-300/5",
  "text-cyan-400    border-cyan-400/30    bg-cyan-400/5",
  "text-green-400   border-green-400/30   bg-green-400/5",
  "text-lime-400    border-lime-400/30    bg-lime-400/5",
  "text-orange-400  border-orange-400/30  bg-orange-400/5",
  "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  "text-red-400     border-red-400/30     bg-red-400/5",
  "text-amber-400   border-amber-400/30   bg-amber-400/5",
  "text-green-600   border-green-600/30   bg-green-600/5",
  "text-sky-400     border-sky-400/30     bg-sky-400/5",
  "text-pink-400    border-pink-400/30    bg-pink-400/5",
  "text-violet-400  border-violet-400/30  bg-violet-400/5",
  "text-teal-400    border-teal-400/30    bg-teal-400/5",
];

function getGroupColor(watchlist: WatchGroup[], category: string): string {
  const idx = watchlist.findIndex(g => g.category === category);
  return COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

// ── Portfolio helpers ─────────────────────────────────────────────────────────
function resolveVal(h: HoldingEntry | undefined, price?: number): number {
  if (!h) return 0;
  // Only treat as a manual override if user actually entered a positive number.
  // "0", "", undefined, or NaN all fall through to the shares × price calc.
  const manualVal = parseFloat((h.value ?? "").trim());
  if (manualVal > 0) return manualVal;
  const shares = parseFloat(h.shares ?? "") || 0;
  if (shares > 0 && price != null) return shares * price;
  return 0;
}
function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPrice(n: number): string {
  if (n >= 1) return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toFixed(6);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const [chartLabel,   setChartLabel]   = useState("BTC");
  const [activeSymbol, setActiveSymbol] = useState("BITSTAMP:BTCUSD");

  const tvRef       = useRef<TVWidget | null>(null);
  const tvReadyRef  = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    const createWidget = () => {
      if (!window.TradingView) return;
      tvRef.current = new window.TradingView.widget({
        autosize: true, symbol: "BITSTAMP:BTCUSD", interval: "D",
        timezone: "America/New_York", theme: "dark", style: "1", locale: "en",
        withdateranges: true, hide_side_toolbar: false,
        allow_symbol_change: true, save_image: true,
        container_id: "tv_chart_main", height: 460,
      });
      tvRef.current.onChartReady(() => { tvReadyRef.current = true; });
    };
    if (window.TradingView) { createWidget(); }
    else {
      const s = document.createElement("script");
      s.id = "tv-script"; s.src = "https://s3.tradingview.com/tv.js"; s.async = true;
      s.onload = createWidget;
      if (!document.getElementById("tv-script")) document.head.appendChild(s);
    }
    return () => { tvReadyRef.current = false; tvRef.current?.remove(); tvRef.current = null; };
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const change = () => tvRef.current?.activeChart().setSymbol(activeSymbol);
    if (tvReadyRef.current) change(); else tvRef.current?.onChartReady(change);
  }, [activeSymbol]);

  const openChart = (asset: Asset) => {
    setActiveSymbol(asset.tvSymbol);
    setChartLabel(asset.symbol);
    document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Watchlist state (dynamic, persisted) ─────────────────────────────────────
  const [watchlist, setWatchlist] = useState<WatchGroup[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WATCHLIST;
    try {
      const saved = localStorage.getItem("om_watchlist");
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch { return DEFAULT_WATCHLIST; }
  });
  useEffect(() => { localStorage.setItem("om_watchlist", JSON.stringify(watchlist)); }, [watchlist]);

  // ── Edit mode state ────────────────────────────────────────────────────────
  const [editMode,        setEditMode]        = useState(false);
  const [renamingGroup,   setRenamingGroup]   = useState<string | null>(null);
  const [renameVal,       setRenameVal]       = useState("");
  const [addingAssetTo,   setAddingAssetTo]   = useState<string | null>(null);
  const [newAssetSym,     setNewAssetSym]     = useState("");
  const [newAssetName,    setNewAssetName]    = useState("");
  const [newAssetTV,      setNewAssetTV]      = useState("");
  const [addingGroup,     setAddingGroup]     = useState(false);
  const [newGroupName,    setNewGroupName]    = useState("");
  const [movingAsset,     setMovingAsset]     = useState<{ symbol: string; fromGroup: string } | null>(null);

  // ── Watchlist mutations ────────────────────────────────────────────────────
  const addGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name || watchlist.some(g => g.category === name)) return;
    setWatchlist(prev => [...prev, { category: name, assets: [] }]);
    setNewGroupName(""); setAddingGroup(false);
  }, [newGroupName, watchlist]);

  const removeGroup = useCallback((category: string) => {
    if (!confirm(`Remove group "${category}"? Assets inside will be removed from the watchlist.`)) return;
    setWatchlist(prev => prev.filter(g => g.category !== category));
  }, []);

  const renameGroup = useCallback((oldName: string, newName: string) => {
    const n = newName.trim();
    if (!n || n === oldName || watchlist.some(g => g.category === n)) return;
    setWatchlist(prev => prev.map(g => g.category === oldName ? { ...g, category: n } : g));
    setRenamingGroup(null);
  }, [watchlist]);

  const addAsset = useCallback((category: string) => {
    const sym  = newAssetSym.trim().toUpperCase();
    const name = newAssetName.trim() || sym;
    if (!sym) return;
    // Auto-build tvSymbol if blank: guess exchange from common crypto symbols
    const CRYPTO_SYMS = new Set(["BTC","ETH","SOL","XRP","LINK","ADA","LTC","DOGE","SAND","MANA","BNB","AVAX","DOT","MATIC","SHIB"]);
    let tvSym = newAssetTV.trim();
    if (!tvSym) {
      tvSym = CRYPTO_SYMS.has(sym)
        ? `COINBASE:${sym}USD`
        : `NASDAQ:${sym}`;
    }
    // Check for duplicate symbol across all groups
    const duplicate = watchlist.some(g => g.assets.some(a => a.symbol === sym));
    if (duplicate) { alert(`${sym} already exists in the watchlist.`); return; }
    setWatchlist(prev => prev.map(g =>
      g.category === category
        ? { ...g, assets: [...g.assets, { symbol: sym, name, tvSymbol: tvSym }] }
        : g
    ));
    setNewAssetSym(""); setNewAssetName(""); setNewAssetTV(""); setAddingAssetTo(null);
  }, [newAssetSym, newAssetName, newAssetTV, watchlist]);

  const removeAsset = useCallback((category: string, symbol: string) => {
    setWatchlist(prev => prev.map(g =>
      g.category === category ? { ...g, assets: g.assets.filter(a => a.symbol !== symbol) } : g
    ));
  }, []);

  const moveAsset = useCallback((symbol: string, fromGroup: string, toGroup: string) => {
    if (fromGroup === toGroup) { setMovingAsset(null); return; }
    setWatchlist(prev => {
      const asset = prev.find(g => g.category === fromGroup)?.assets.find(a => a.symbol === symbol);
      if (!asset) return prev;
      return prev.map(g => {
        if (g.category === fromGroup) return { ...g, assets: g.assets.filter(a => a.symbol !== symbol) };
        if (g.category === toGroup)   return { ...g, assets: [...g.assets, asset] };
        return g;
      });
    });
    setMovingAsset(null);
  }, []);

  // ── Live prices ────────────────────────────────────────────────────────────
  const [prices,            setPrices]            = useState<Prices>({});
  const [pricesLoading,     setPricesLoading]     = useState(false);
  const [pricesLastUpdated, setPricesLastUpdated] = useState<Date | null>(null);
  const [pricesFetched,     setPricesFetched]     = useState(false); // true after first fetch completes

  const allSymbols = useMemo(() => watchlist.flatMap(g => g.assets.map(a => a.symbol)), [watchlist]);

  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) return;
    setPricesLoading(true);
    try {
      const res  = await fetch(`/api/prices?symbols=${allSymbols.join(",")}`);
      const data = await res.json();
        if (data.prices) { setPrices(data.prices); setPricesLastUpdated(new Date()); }
    } catch (e) { console.error("Price fetch:", e); }
    finally { setPricesLoading(false); setPricesFetched(true); }
  }, [allSymbols]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // ── Portfolio state ────────────────────────────────────────────────────────
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

  useEffect(() => { localStorage.setItem("om_holdings",       JSON.stringify(holdings));   }, [holdings]);
  useEffect(() => { localStorage.setItem("om_target_balance", targetBalance);               }, [targetBalance]);
  useEffect(() => { localStorage.setItem("om_targets",        JSON.stringify(targets));     }, [targets]);

  const setHolding = useCallback((symbol: string, field: keyof HoldingEntry, val: string) => {
    setHoldings(prev => ({ ...prev, [symbol]: { ...(prev[symbol] ?? { shares: "", value: "" }), [field]: val } }));
  }, []);
  const setTarget = useCallback((symbol: string, val: string) => {
    setTargets(prev => ({ ...prev, [symbol]: val }));
  }, []);

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
  }, [watchlist, resolveHoldingVal]);

  const target = parseFloat(targetBalance.replace(/,/g, "")) || 0;

  const catsWithHoldings = useMemo(
    () => watchlist.filter(({ category }) => categoryTotals[category] > 0),
    [watchlist, categoryTotals]
  );
  const expectedCatPct = catsWithHoldings.length > 0 ? 100 / catsWithHoldings.length : 0;

  const alerts = useMemo((): PortfolioAlert[] => {
    const list: PortfolioAlert[] = [];
    if (totalValue === 0) return list;

    if (target > 0) {
      const diff = ((totalValue - target) / target) * 100;
      if (Math.abs(diff) >= 5)
        list.push({ id: "balance", type: diff > 0 ? "asset-high" : "asset-low", deviation: diff,
          msg: `Portfolio ${diff > 0 ? "+" : ""}${diff.toFixed(1)}% vs desired balance of ${fmtUSD(target)}` });
    }

    const tracked: { symbol: string; targetPct: number; actualVal: number; targetVal: number; deviation: number }[] = [];
    for (const { assets } of watchlist) {
      for (const asset of assets) {
        const tgtPct = parseFloat(targets[asset.symbol]) || 0;
        if (tgtPct <= 0) continue;
        const actualVal = resolveHoldingVal(asset.symbol);
        if (actualVal <= 0) continue;
        const targetVal = (tgtPct / 100) * totalValue;
        const deviation = targetVal > 0 ? ((actualVal - targetVal) / targetVal) * 100 : 0;
        tracked.push({ symbol: asset.symbol, targetPct: tgtPct, actualVal, targetVal, deviation });
        if (Math.abs(deviation) >= 5) {
          const over = deviation > 0;
          list.push({
            id: `asset-${asset.symbol}`, type: over ? "asset-high" : "asset-low",
            symbol: asset.symbol, deviation,
            msg: `${asset.symbol} is ${over ? "+" : ""}${deviation.toFixed(1)}% ${over ? "above" : "below"} target — ${fmtUSD(actualVal)} vs ${fmtUSD(targetVal)} target (${tgtPct}%)`,
          });
        }
      }
    }

    const seen = new Set<string>();
    for (let i = 0; i < tracked.length; i++) {
      for (let j = i + 1; j < tracked.length; j++) {
        const a = tracked[i], b = tracked[j];
        const spread = a.deviation - b.deviation;
        if (Math.abs(spread) >= 5) {
          const key = [a.symbol, b.symbol].sort().join("-");
          if (seen.has(key)) continue; seen.add(key);
          const hi = spread > 0 ? a : b, lo = spread > 0 ? b : a;
          list.push({
            id: `spread-${key}`, type: "spread", symbol: hi.symbol, symbolB: lo.symbol, deviation: Math.abs(spread),
            msg: `Spread: ${hi.symbol} ${hi.deviation >= 0 ? "+" : ""}${hi.deviation.toFixed(1)}% / ${lo.symbol} ${lo.deviation >= 0 ? "+" : ""}${lo.deviation.toFixed(1)}% vs target — ${Math.abs(spread).toFixed(1)}% apart`,
          });
        }
      }
    }
    return list;
  }, [watchlist, resolveHoldingVal, totalValue, target, targets]);

  const toggleCat = (cat: string) =>
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  const totalAssets = allSymbols.length;
  const totalGroups = watchlist.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* ── Header ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
              <span className="text-red-500">&gt;</span> market_feed.exe
            </p>
            <h1 className="text-3xl font-black font-mono text-green-300">Markets</h1>
            <p className="text-green-700 text-sm font-mono mt-1">
              {totalAssets} assets · {totalGroups} groups · live prices
              {pricesLastUpdated && <span className="text-green-900 ml-2">updated {pricesLastUpdated.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setEditMode(p => !p); setAddingGroup(false); setAddingAssetTo(null); setRenamingGroup(null); setMovingAsset(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-all
                ${editMode
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                  : "border-green-500/30 bg-green-500/5 text-green-600 hover:text-green-400 hover:border-green-500/50"}`}>
              <Pencil className="w-3.5 h-3.5" />
              {editMode ? "Done Editing" : "Edit Groups"}
            </button>
            <button onClick={() => setShowPortfolio(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-all
                ${showPortfolio
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                  : "border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"}`}>
              <TrendingUp className="w-3.5 h-3.5" />
              Portfolio
              {alerts.length > 0 && (
                <span className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                  {alerts.length}
                </span>
              )}
            </button>
            <button onClick={fetchPrices} disabled={pricesLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5 text-green-600 text-xs font-mono hover:text-green-400 hover:border-green-500/50 transition-all disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${pricesLoading ? "animate-spin" : ""}`} />
              {pricesLoading ? "fetching…" : "refresh"}
            </button>
            <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/5 text-green-400 text-sm font-mono font-medium hover:bg-green-500/10 hover:border-green-500/50 transition-all">
              TradingView <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Alerts banner ── */}
        {alerts.length > 0 && (
          <div className="mb-5 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-600 font-mono uppercase tracking-widest">Portfolio Alerts ({alerts.length})</span>
            </div>
            {alerts.map(alert => {
              const isSpread = alert.type === "spread";
              const isHigh   = alert.type === "asset-high";
              const cls = isSpread ? "border-purple-500/40 bg-purple-500/5 text-purple-300"
                        : isHigh   ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
                        :            "border-red-500/40 bg-red-500/5 text-red-300";
              const Icon = isSpread ? AlertTriangle : isHigh ? TrendingUp : TrendingDown;
              return (
                <div key={alert.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-mono ${cls}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />{alert.msg}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Portfolio Tracker ── */}
        {showPortfolio && (
          <div className="mb-6 space-y-3">
            <div className="holo-card rounded-xl border border-cyan-500/20 bg-black/50 p-5">
              <div className="flex items-start gap-10 flex-wrap">
                <div>
                  <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5">Total Portfolio</p>
                  <p className="text-3xl font-black font-mono text-cyan-300">{fmtUSD(totalValue)}</p>
                  {totalValue === 0 && <p className="text-xs text-green-900 font-mono mt-1">Enter holdings on asset cards below</p>}
                </div>
                <div>
                  <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Desired Balance
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-green-600 font-mono text-xl">$</span>
                    <input type="number" min="0" value={targetBalance} onChange={e => setTargetBalance(e.target.value)}
                      placeholder="0"
                      className="bg-transparent border-b-2 border-green-500/30 focus:border-cyan-500/60 text-green-300 font-mono text-xl w-36 focus:outline-none placeholder:text-green-900 transition-colors" />
                  </div>
                </div>
                {target > 0 && totalValue > 0 && (() => {
                  const diff = ((totalValue - target) / target) * 100;
                  const over = diff >= 0; const a5 = Math.abs(diff) >= 5;
                  return (
                    <div>
                      <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-1.5">vs Target</p>
                      <p className={`text-2xl font-black font-mono ${a5 ? (over ? "text-amber-400" : "text-red-400") : "text-green-400"}`}>
                        {over ? "+" : ""}{diff.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-green-800 font-mono mt-0.5">
                        {over ? `$${(totalValue-target).toLocaleString("en-US",{maximumFractionDigits:0})} over` : `$${(target-totalValue).toLocaleString("en-US",{maximumFractionDigits:0})} under`}
                      </p>
                    </div>
                  );
                })()}
                <div className="ml-auto flex items-center gap-2 self-start">
                  <button onClick={() => setShowOnlyOwned(p => !p)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${showOnlyOwned ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-green-500/30 text-green-600 hover:text-green-400 hover:border-green-500/50"}`}>
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
                <p className="text-[10px] text-green-700 font-mono uppercase tracking-widest mb-3">Allocation by Group</p>
                <div className="space-y-2.5">
                  {catsWithHoldings.map(({ category }) => {
                    const pct = (categoryTotals[category] / totalValue) * 100;
                    const textColor = getGroupColor(watchlist, category).split(" ")[0];
                    const isAlert = Math.abs(pct - expectedCatPct) >= 5;
                    return (
                      <div key={category} className="flex items-center gap-3">
                        <span className={`w-36 text-[11px] font-mono truncate ${textColor}`}>{category}</span>
                        <div className="flex-1 h-1.5 bg-green-900/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isAlert ? "bg-amber-500/70" : "bg-cyan-500/60"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`text-[11px] font-mono w-14 text-right ${isAlert ? "text-amber-400" : "text-green-400"}`}>{pct.toFixed(1)}%</span>
                        <span className="text-[11px] font-mono w-28 text-right text-green-700">{fmtUSD(categoryTotals[category])}</span>
                        {isAlert && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-group collapsible panels */}
            <div className="space-y-2">
              {watchlist.map(({ category, assets }) => {
                const catTotal = categoryTotals[category];
                const displayedAssets = showOnlyOwned ? assets.filter(a => resolveHoldingVal(a.symbol) > 0) : assets;
                if (showOnlyOwned && displayedAssets.length === 0) return null;
                const isExpanded = expandedCats.has(category);
                const cc = getGroupColor(watchlist, category);
                const catPct = totalValue > 0 ? (catTotal / totalValue) * 100 : 0;
                const isCatAlert = catTotal > 0 && Math.abs(catPct - expectedCatPct) >= 5;
                const ownedCount = assets.filter(a => resolveHoldingVal(a.symbol) > 0).length;
                return (
                  <div key={category} className="holo-card rounded-xl border border-green-500/15 bg-black/40">
                    <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toggleCat(category)}>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-green-700 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-green-700 flex-shrink-0" />}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${cc}`}>{category}</span>
                      <span className="text-xs text-green-800 font-mono">{assets.length} assets</span>
                      {ownedCount > 0 && <span className="text-xs text-cyan-800 font-mono">{ownedCount} held</span>}
                      {catTotal > 0 && (
                        <div className="ml-auto flex items-center gap-3">
                          {isCatAlert && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          <span className={`text-xs font-mono font-bold ${isCatAlert ? "text-amber-400" : "text-cyan-400"}`}>{catPct.toFixed(1)}%</span>
                          <span className="text-xs font-mono text-green-700">{fmtUSD(catTotal)}</span>
                        </div>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-green-500/10 px-4 pb-4">
                        <div className="grid gap-x-4 gap-y-2 pt-3 items-center" style={{ gridTemplateColumns: "1fr 80px 104px 60px 60px 60px" }}>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest">Asset</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">Shares</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">$ Value</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">Target%</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">Actual%</div>
                          <div className="text-[9px] text-green-800 font-mono uppercase tracking-widest text-right">Status</div>
                          {displayedAssets.map(asset => {
                            const h   = holdings[asset.symbol] ?? { shares: "", value: "" };
                            const val = resolveHoldingVal(asset.symbol);
                            const price = prices[asset.symbol];
                            const autoVal = !h.value.trim() && h.shares && price ? (parseFloat(h.shares)||0)*price : null;
                            const tgtPct    = parseFloat(targets[asset.symbol]) || 0;
                            const actualPct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                            const tgtVal    = tgtPct > 0 ? (tgtPct / 100) * totalValue : 0;
                            const dev       = tgtVal > 0 ? ((val - tgtVal) / tgtVal) * 100 : 0;
                            const hasAlert  = tgtPct > 0 && val > 0 && Math.abs(dev) >= 5;
                            const ownedInCat = assets.filter(a => resolveHoldingVal(a.symbol) > 0);
                            const expPct = ownedInCat.length > 0 ? 100 / ownedInCat.length : 0;
                            const pctOfCat = catTotal > 0 ? (val / catTotal) * 100 : 0;
                            const isAssetAlert = val > 0 && ownedInCat.length > 1 && Math.abs(pctOfCat - expPct) >= 5;
                            return (
                              <React.Fragment key={asset.symbol}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {(isAssetAlert || hasAlert) && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                                  <span className={`text-sm font-mono font-bold flex-shrink-0 ${isAssetAlert||hasAlert ? "text-amber-400" : val > 0 ? "text-green-300" : "text-green-800"}`}>{asset.symbol}</span>
                                  <span className="text-[10px] text-green-900 font-mono truncate">{asset.name}</span>
                                  {price && <span className="text-[10px] text-green-800 font-mono ml-auto flex-shrink-0">{fmtPrice(price)}</span>}
                                </div>
                                <input type="number" min="0" step="any" value={h.shares} onChange={e => setHolding(asset.symbol, "shares", e.target.value)} placeholder="0"
                                  className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-green-400/60 text-green-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors" />
                                <div className="relative">
                                  <input type="number" min="0" step="any" value={h.value} onChange={e => setHolding(asset.symbol, "value", e.target.value)}
                                    placeholder={autoVal != null ? autoVal.toFixed(2) : "0.00"}
                                    className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-cyan-500/60 text-cyan-400 font-mono text-xs focus:outline-none placeholder:text-cyan-900 py-0.5 transition-colors" />
                                  {autoVal != null && !h.value.trim() && (
                                    <span className="absolute inset-0 flex items-end justify-end text-xs font-mono text-cyan-700 pointer-events-none pb-0.5">{fmtUSD(autoVal)}</span>
                                  )}
                                </div>
                                <div className="relative">
                                  <input type="number" min="0" max="100" step="any" value={targets[asset.symbol] ?? ""} onChange={e => setTarget(asset.symbol, e.target.value)} placeholder="0"
                                    className="w-full text-right bg-transparent border-b border-purple-500/20 focus:border-purple-400/50 text-purple-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors pr-3" />
                                  <span className="absolute right-0 bottom-0.5 text-purple-700 font-mono text-[10px] pointer-events-none">%</span>
                                </div>
                                <div className="text-xs font-mono text-right text-green-600">{val > 0 ? `${actualPct.toFixed(1)}%` : "—"}</div>
                                <div className={`text-xs font-mono text-right ${!tgtPct || !val ? "text-green-900" : hasAlert ? (dev > 0 ? "text-amber-400" : "text-red-400") : "text-green-500"}`}>
                                  {tgtPct > 0 && val > 0 ? (hasAlert ? (dev > 0 ? `▲${dev.toFixed(1)}%` : `▼${Math.abs(dev).toFixed(1)}%`) : "✓ ok") : "—"}
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
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 ping-slow" />
              <span className="text-xs text-green-600 font-mono">LIVE</span>
            </span>
          </div>
          <div id="tv_chart_main" style={{ height: 460, width: "100%" }} />
        </div>

        {/* ── Watchlist ── */}
        <div className="space-y-3">
          {watchlist.map(({ category, assets }) => {
            const cc = getGroupColor(watchlist, category);
            const catTotal = categoryTotals[category];
            const isRenamingThis = renamingGroup === category;
            const isAddingToThis = addingAssetTo === category;
            return (
              <div key={category} className={`holo-card rounded-xl border bg-black/40 p-4 ${editMode ? "border-amber-500/20" : "border-green-500/15"}`}>

                {/* Group header */}
                <div className="flex items-center gap-2 mb-3">
                  {isRenamingThis ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameGroup(category, renameVal); if (e.key === "Escape") setRenamingGroup(null); }}
                        className="bg-transparent border-b border-amber-500/50 text-amber-300 font-mono text-sm focus:outline-none flex-1" />
                      <button onClick={() => renameGroup(category, renameVal)} className="text-green-400 hover:text-green-300"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setRenamingGroup(null)} className="text-green-800 hover:text-green-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${cc}`}>{category}</span>
                      <span className="text-xs text-green-800 font-mono">{assets.length} assets</span>
                      {catTotal > 0 && <span className="text-xs text-cyan-700 font-mono ml-auto">{fmtUSD(catTotal)}</span>}
                      {editMode && (
                        <div className={`flex items-center gap-1.5 ${catTotal > 0 ? "" : "ml-auto"}`}>
                          <button onClick={() => { setRenamingGroup(category); setRenameVal(category); }}
                            className="p-1 rounded text-green-700 hover:text-amber-400 transition-colors" title="Rename group">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeGroup(category)}
                            className="p-1 rounded text-green-900 hover:text-red-500 transition-colors" title="Remove group">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Asset grid */}
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {assets.map(asset => {
                    const h         = holdings[asset.symbol] ?? { shares: "", value: "" };
                    const val       = resolveHoldingVal(asset.symbol);
                    const price     = prices[asset.symbol];
                    const autoVal   = !h.value.trim() && h.shares && price ? (parseFloat(h.shares)||0)*price : null;
                    const isActive  = activeSymbol === asset.tvSymbol;
                    const tgtPct    = parseFloat(targets[asset.symbol]) || 0;
                    const actualPct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                    const tgtVal    = tgtPct > 0 ? (tgtPct / 100) * totalValue : 0;
                    const dev       = tgtVal > 0 ? ((val - tgtVal) / tgtVal) * 100 : 0;
                    const hasAlert  = tgtPct > 0 && val > 0 && Math.abs(dev) >= 5;
                    const isMovingThis = movingAsset?.symbol === asset.symbol && movingAsset?.fromGroup === category;

                    return (
                      <div key={asset.symbol}
                        className={`rounded-lg border transition-all p-2.5
                          ${isActive    ? "border-green-400/40 bg-green-400/5 shadow-[0_0_8px_rgba(0,255,65,0.1)]"
                          : hasAlert    ? "border-amber-500/25 bg-amber-500/5"
                          : val > 0     ? "border-cyan-500/20 bg-cyan-500/5"
                          : editMode    ? "border-amber-500/10 bg-black/20"
                          :               "border-green-500/15 bg-black/20"}`}>

                        {/* Symbol row */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <button onClick={() => openChart(asset)} title={`Chart ${asset.name}`}
                            className={`text-sm font-mono font-bold transition-colors ${isActive ? "text-green-300" : val > 0 ? "text-cyan-400" : "text-green-700 hover:text-green-400"}`}>
                            {asset.symbol}
                          </button>
                          <span className="text-[10px] text-green-900 font-mono truncate flex-1">{asset.name}</span>
                          {!editMode && (
                            <a href={`https://www.tradingview.com/chart/?symbol=${asset.tvSymbol}`} target="_blank" rel="noopener noreferrer"
                              className="text-green-900 hover:text-green-600 transition-colors flex-shrink-0">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {editMode && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setMovingAsset(isMovingThis ? null : { symbol: asset.symbol, fromGroup: category })}
                                className={`p-0.5 rounded transition-colors ${isMovingThis ? "text-amber-400" : "text-green-800 hover:text-amber-400"}`} title="Move to group">
                                <MoveRight className="w-3 h-3" />
                              </button>
                              <button onClick={() => removeAsset(category, asset.symbol)}
                                className="p-0.5 rounded text-green-900 hover:text-red-500 transition-colors" title="Remove asset">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Move-to dropdown */}
                        {isMovingThis && (
                          <div className="mb-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
                            <p className="text-[9px] text-amber-600 font-mono uppercase tracking-widest mb-1.5">Move to group</p>
                            <div className="space-y-1">
                              {watchlist.filter(g => g.category !== category).map(g => (
                                <button key={g.category} onClick={() => moveAsset(asset.symbol, category, g.category)}
                                  className="w-full text-left text-xs font-mono text-green-600 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors">
                                  → {g.category}
                                </button>
                              ))}
                              <button onClick={() => setMovingAsset(null)} className="w-full text-left text-xs font-mono text-green-900 hover:text-green-700 px-2 py-0.5">cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Live price */}
                        {!editMode && (price != null
                          ? <p className="text-[10px] text-green-700 font-mono mb-2">{fmtPrice(price)}<span className="text-green-900 ml-1">live</span></p>
                          : pricesFetched
                            ? <p className="text-[10px] text-red-900 font-mono mb-2">no price — enter $ manually</p>
                            : <p className="text-[10px] text-green-900 font-mono mb-2">fetching…</p>
                        )}

                        {/* Inputs (hidden in edit mode) */}
                        {!editMode && (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1">
                                <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">Shares</p>
                                <input type="number" min="0" step="any" value={h.shares} onChange={e => setHolding(asset.symbol, "shares", e.target.value)} placeholder="0"
                                  className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-green-400/50 text-green-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">{autoVal != null ? "$ auto" : "$ value"}</p>
                                <div className="relative">
                                  <input type="number" min="0" step="any" value={h.value} onChange={e => setHolding(asset.symbol, "value", e.target.value)}
                                    placeholder={autoVal != null ? autoVal.toFixed(2) : "0.00"}
                                    className="w-full text-right bg-transparent border-b border-green-500/20 focus:border-cyan-500/50 text-cyan-400 font-mono text-xs focus:outline-none placeholder:text-cyan-900 py-0.5 transition-colors" />
                                  {autoVal != null && !h.value.trim() && (
                                    <span className="absolute inset-0 flex items-end justify-end text-xs font-mono text-cyan-600 pointer-events-none pb-0.5">{fmtUSD(autoVal)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <p className="text-[9px] text-green-900 font-mono uppercase tracking-widest mb-0.5">Target %</p>
                                <div className="flex items-center">
                                  <input type="number" min="0" max="100" step="any" value={targets[asset.symbol] ?? ""} onChange={e => setTarget(asset.symbol, e.target.value)} placeholder="0"
                                    className="w-full text-right bg-transparent border-b border-purple-500/20 focus:border-purple-400/50 text-purple-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5 transition-colors" />
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
                            {val > 0 && <p className="text-[10px] text-right text-cyan-700 font-mono mt-1.5 font-bold">{fmtUSD(val)}</p>}
                          </>
                        )}

                        {/* Edit mode: show TV symbol for reference */}
                        {editMode && (
                          <p className="text-[9px] text-green-900 font-mono mt-1">{asset.tvSymbol}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Asset card */}
                  {editMode && (
                    isAddingToThis ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                        <p className="text-[9px] text-amber-600 font-mono uppercase tracking-widest">New Asset</p>
                        <input autoFocus value={newAssetSym} onChange={e => setNewAssetSym(e.target.value.toUpperCase())}
                          placeholder="Symbol (e.g. AAPL)"
                          className="w-full bg-transparent border-b border-amber-500/30 focus:border-amber-400/60 text-amber-300 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5" />
                        <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)}
                          placeholder="Name (optional)"
                          className="w-full bg-transparent border-b border-green-500/20 focus:border-green-400/50 text-green-400 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5" />
                        <input value={newAssetTV} onChange={e => setNewAssetTV(e.target.value)}
                          placeholder="TV symbol (e.g. NASDAQ:AAPL)"
                          className="w-full bg-transparent border-b border-green-500/20 focus:border-green-400/50 text-green-600 font-mono text-xs focus:outline-none placeholder:text-green-900 py-0.5" />
                        <p className="text-[8px] text-green-900 font-mono">Leave TV symbol blank to auto-guess</p>
                        <div className="flex gap-2">
                          <button onClick={() => addAsset(category)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs font-mono transition-colors">
                            <Check className="w-3 h-3" /> Add
                          </button>
                          <button onClick={() => { setAddingAssetTo(null); setNewAssetSym(""); setNewAssetName(""); setNewAssetTV(""); }}
                            className="flex items-center justify-center px-2 py-1 rounded border border-green-500/15 text-green-800 hover:text-green-600 text-xs font-mono transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingAssetTo(category); setNewAssetSym(""); setNewAssetName(""); setNewAssetTV(""); }}
                        className="rounded-lg border border-dashed border-amber-500/20 bg-transparent hover:border-amber-500/40 hover:bg-amber-500/5 p-2.5 flex items-center justify-center gap-2 text-green-800 hover:text-amber-400 transition-all text-xs font-mono">
                        <Plus className="w-4 h-4" /> Add Asset
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Add Group ── */}
          {editMode && (
            <div className="mt-2">
              {addingGroup ? (
                <div className="holo-card rounded-xl border border-amber-500/30 bg-black/40 p-4 flex items-center gap-3">
                  <Plus className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") setAddingGroup(false); }}
                    placeholder="Group name…"
                    className="flex-1 bg-transparent border-b border-amber-500/30 focus:border-amber-400/60 text-amber-300 font-mono text-sm focus:outline-none placeholder:text-green-900" />
                  <button onClick={addGroup} className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setAddingGroup(false)} className="text-green-800 hover:text-green-600 p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => setAddingGroup(true)}
                  className="w-full rounded-xl border border-dashed border-amber-500/20 hover:border-amber-500/40 bg-transparent hover:bg-amber-500/5 p-4 flex items-center justify-center gap-2 text-green-800 hover:text-amber-400 transition-all font-mono text-sm">
                  <Plus className="w-4 h-4" /> Add Group
                </button>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
