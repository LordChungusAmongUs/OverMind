import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ITEM_TYPES = ["Top", "Bottom", "Shoes", "Outerwear", "Dress/Jumpsuit", "Accessory", "Hat", "Bag"];
const OCCASIONS = ["Casual", "Work", "Gym", "Going Out", "Date Night", "Errands", "Church", "Travel", "Formal"];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) ?? url.match(/\/product\/([A-Z0-9]{10})/i);
  return match?.[1] ?? null;
}

function slugToTitle(url: string): string {
  const match = url.match(/amazon\.com\/([^/]+)\/dp\//i);
  if (!match) return "";
  return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Amazon returns a robot check page — detect it
    if (text.includes("robot") || text.includes("captcha") || text.includes("To discuss automated access")) return null;
    return text;
  } catch {
    return null;
  }
}

function extractMeta(html: string) {
  const imageUrl =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ??
    // Amazon-specific: look for landingImage src
    html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i)?.[1] ??
    html.match(/data-old-hires=["']([^"']+)["']/i)?.[1] ??
    null;

  const title =
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    "";

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000);

  return { imageUrl, title, desc, bodyText };
}

async function parseWithClaude(title: string, desc: string, bodyText: string): Promise<Record<string, unknown>> {
  const prompt = `You are a clothing item parser. Extract structured clothing data from this product page content.

Page title: ${title}
Page description: ${desc}
Page text snippet: ${bodyText}

Return ONLY a valid JSON object with these exact keys (no markdown, no explanation):
{
  "name": "short product name (brand + item, max 50 chars)",
  "brand": "brand name or null",
  "type": "one of: ${ITEM_TYPES.join(", ")}",
  "color": "primary color or null",
  "size": null,
  "occasions": ["array of applicable values from: ${OCCASIONS.join(", ")}"],
  "notes": "one short sentence describing the item, or null"
}

If this is not a clothing/fashion item, return: {"error": "Not a clothing item"}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse((message.content[0] as { text: string }).text.trim());
}

export async function POST(req: Request) {
  const { url: rawUrl } = await req.json() as { url: string };
  if (!rawUrl) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  const url = normalizeUrl(rawUrl);
  const isAmazon = /amazon\.(com|co\.uk|ca|de|fr|co\.jp)/i.test(url);
  const asin = isAmazon ? extractAsin(url) : null;

  // ── Try fetching the page ──────────────────────────────────────────────────
  let html: string | null = null;

  if (isAmazon && asin) {
    // Try clean ASIN URL and mobile URL — both are more scrape-friendly
    html =
      await tryFetch(`https://www.amazon.com/dp/${asin}`) ??
      await tryFetch(`https://www.amazon.com/dp/${asin}?th=1&psc=1`);
  } else {
    html = await tryFetch(url);
  }

  // ── Amazon fallback: use URL slug + Claude when blocked ───────────────────
  if (!html && isAmazon) {
    const slugTitle = slugToTitle(url);
    const titleFromUrl = slugTitle || (asin ? `Amazon product ${asin}` : "Amazon clothing item");

    let parsed: Record<string, unknown> = {};
    try {
      parsed = await parseWithClaude(titleFromUrl, "", "");
    } catch {
      return NextResponse.json({ error: "Could not parse product details. Try entering manually." }, { status: 422 });
    }

    if (parsed.error) return NextResponse.json({ error: parsed.error as string }, { status: 422 });

    // No image available when blocked, but return the rest
    return NextResponse.json({ ...parsed, image_url: null });
  }

  if (!html) {
    return NextResponse.json({ error: "Could not fetch that URL. Try a different link or enter manually." }, { status: 422 });
  }

  // ── Parse fetched HTML ────────────────────────────────────────────────────
  const { imageUrl, title, desc, bodyText } = extractMeta(html);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = await parseWithClaude(title, desc, bodyText);
  } catch {
    return NextResponse.json({ error: "Could not parse product details. Try entering manually." }, { status: 422 });
  }

  if (parsed.error) return NextResponse.json({ error: parsed.error as string }, { status: 422 });

  return NextResponse.json({ ...parsed, image_url: imageUrl ?? null });
}
