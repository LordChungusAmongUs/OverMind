import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

// Crypto symbol → CoinGecko ID map
const COINGECKO_IDS: Record<string, string> = {
  BTC:  "bitcoin",
  ETH:  "ethereum",
  SOL:  "solana",
  XRP:  "ripple",
  LINK: "chainlink",
  ADA:  "cardano",
  LTC:  "litecoin",
  DOGE: "dogecoin",
  SAND: "the-sandbox",
  MANA: "decentraland",
};

// Symbols that are pure crypto (use CoinGecko, not Yahoo Finance)
const CRYPTO_SYMBOLS = new Set(Object.keys(COINGECKO_IDS));

async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols.map(s => COINGECKO_IDS[s]).filter(Boolean).join(",");
  if (!ids) return {};

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();

    const result: Record<string, number> = {};
    for (const sym of symbols) {
      const id = COINGECKO_IDS[sym];
      if (id && data[id]?.usd != null) result[sym] = data[id].usd;
    }
    return result;
  } catch (e) {
    console.error("CoinGecko error:", e);
    return {};
  }
}

async function fetchStockPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const results: Record<string, number> = {};

  try {
    // yahoo-finance2 handles cookies/crumbs automatically — much more reliable than raw fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (await yahooFinance.quote(symbols as [string, ...string[]])) as any[];
    for (const q of quotes) {
      if (q?.symbol && q?.regularMarketPrice != null) {
        results[q.symbol] = q.regularMarketPrice;
      }
    }
  } catch (e) {
    console.error("yahoo-finance2 batch error — falling back to individual fetches:", e);

    // Fallback: try symbols one by one if batch fails
    await Promise.all(
      symbols.map(async sym => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const q = (await yahooFinance.quote(sym)) as any;
          if (q?.regularMarketPrice != null) {
            results[sym] = q.regularMarketPrice;
          }
        } catch {
          // skip failed symbols silently
        }
      })
    );
  }

  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const cryptoSyms = symbols.filter(s => CRYPTO_SYMBOLS.has(s));
  const stockSyms  = symbols.filter(s => !CRYPTO_SYMBOLS.has(s));

  const [cryptoPrices, stockPrices] = await Promise.all([
    fetchCryptoPrices(cryptoSyms),
    fetchStockPrices(stockSyms),
  ]);

  return NextResponse.json({ prices: { ...cryptoPrices, ...stockPrices } });
}
