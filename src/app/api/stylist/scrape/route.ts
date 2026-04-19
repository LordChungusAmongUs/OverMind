import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ITEM_TYPES = ["Top", "Bottom", "Shoes", "Outerwear", "Dress/Jumpsuit", "Accessory", "Hat", "Bag"];
const OCCASIONS = ["Casual", "Work", "Gym", "Going Out", "Date Night", "Errands", "Church", "Travel", "Formal"];

export async function POST(req: Request) {
  const { url } = await req.json() as { url: string };

  if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  // Fetch the page with browser-like headers
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(10000),
    });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL. Try a different link." }, { status: 422 });
  }

  // Extract image from og:image or twitter:image meta tags
  const imageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  const imageUrl = imageMatch?.[1] ?? null;

  // Grab a useful slice of the HTML for Claude (title, meta description, first ~3000 chars of body text)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  const pageTitle = titleMatch?.[1]?.trim() ?? "";
  const pageDesc = descMatch?.[1]?.trim() ?? "";

  // Strip tags for a cleaner text snippet
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000);

  const prompt = `You are a clothing item parser. Extract structured clothing data from this product page content.

Page title: ${pageTitle}
Page description: ${pageDesc}
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

  let parsed: Record<string, unknown> = {};
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (message.content[0] as { text: string }).text.trim();
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Could not parse product details. Try entering manually." }, { status: 422 });
  }

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error as string }, { status: 422 });
  }

  return NextResponse.json({ ...parsed, image_url: imageUrl });
}
