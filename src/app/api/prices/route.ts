import { NextRequest, NextResponse } from "next/server";

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

// Yahoo Finance ticker overrides (when symbol differs from Yahoo's format)
const YAHOO_OVERRIDES: Record<string, string> = {};

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

  // Fetch in parallel batches of 10
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 10) chunks.push(symbols.slice(i, i + 10));

  await Promise.all(
    chunks.map(async chunk => {
      await Promise.all(
        chunk.map(async sym => {
          const ticker = YAHOO_OVERRIDES[sym] ?? sym;
          try {
            const res = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
              {
                headers: { "User-Agent": "Mozilla/5.0" },
                next: { revalidate: 60 },
              }
            );
            if (!res.ok) return;
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (price != null) results[sym] = price;
          } catch {
            // skip failed symbols silently
          }
        })
      );
    })
  );

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
