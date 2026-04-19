import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ITEM_TYPES = ["Top", "Bottom", "Shoes", "Outerwear", "Dress/Jumpsuit", "Accessory", "Hat", "Bag"];
const OCCASIONS = ["Casual", "Work", "Gym", "Going Out", "Date Night", "Errands", "Church", "Travel", "Formal"];

const JSON_SCHEMA = `{"name":"product name max 50 chars","brand":"brand or null","type":"one of: ${ITEM_TYPES.join(", ")}","color":"primary color or null","size":null,"occasions":["applicable values from: ${OCCASIONS.join(", ")}"],"notes":"one sentence or null"}`;

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function extractAsin(url: string): string | null {
  return url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ?? null;
}

function slugToTitle(url: string): string {
  const match = url.match(/amazon\.[^/]+\/([^/]+)\/dp\//i);
  if (!match) return "";
  return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const KNOWN_BRANDS = [
  "Under Armour","Nike","Adidas","Puma","Reebok","New Balance","Champion","Hanes","Fruit Of The Loom",
  "Levi","Calvin Klein","Ralph Lauren","Tommy Hilfiger","Gap","H&M","Zara","Uniqlo","North Face",
  "Columbia","Patagonia","Carhartt","Wrangler","Dickies","Timberland","Vans","Converse","Jordan",
];

const TYPE_KEYWORDS: [string[], string][] = [
  [["shirt","tee","t-shirt","top","blouse","tank","polo","henley","hoodie","sweatshirt","crewneck"], "Top"],
  [["pant","jean","chino","short","trouser","legging","jogger","sweatpant"], "Bottom"],
  [["shoe","sneaker","boot","sandal","loafer","slip-on","running","trainer"], "Shoes"],
  [["jacket","coat","vest","puffer","windbreaker","blazer","cardigan","fleece"], "Outerwear"],
  [["dress","jumpsuit","romper","overall"], "Dress/Jumpsuit"],
  [["hat","cap","beanie","snapback","bucket"], "Hat"],
  [["bag","backpack","tote","duffel","satchel"], "Bag"],
  [["watch","belt","wallet","sunglasses","necklace","bracelet","ring","sock","glove","scarf"], "Accessory"],
];

const COLOR_KEYWORDS = [
  "black","white","grey","gray","navy","blue","red","green","yellow","orange","purple",
  "pink","brown","beige","khaki","olive","burgundy","maroon","teal","cream","tan",
  "graphite","charcoal","heather","coral","mint","lavender","indigo","cobalt","crimson",
];

function parseSlug(title: string): Record<string, unknown> {
  const lower = title.toLowerCase();

  const brand = KNOWN_BRANDS.find(b => lower.includes(b.toLowerCase())) ?? null;

  let type = "Top";
  for (const [keywords, t] of TYPE_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) { type = t; break; }
  }

  const color = COLOR_KEYWORDS.find(c => lower.includes(c)) ?? null;
  const colorFormatted = color ? color.charAt(0).toUpperCase() + color.slice(1) : null;

  const occasions: string[] = ["Casual"];
  if (type === "Top" || type === "Bottom") occasions.push("Errands");
  if (lower.includes("gym") || lower.includes("sport") || lower.includes("athletic") || lower.includes("running") || lower.includes("training")) occasions.push("Gym");
  if (lower.includes("dress") || lower.includes("formal") || lower.includes("suit")) occasions.push("Formal");
  if (lower.includes("work") || lower.includes("office") || lower.includes("polo") || lower.includes("chino")) occasions.push("Work");

  return { name: title.slice(0, 50), brand, type, color: colorFormatted, size: null, occasions, notes: null };
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (
      text.includes("captcha") ||
      text.includes("robot check") ||
      text.includes("To discuss automated access") ||
      text.includes("Enter the characters you see below") ||
      text.length < 5000
    ) return null;
    return text;
  } catch {
    return null;
  }
}

function extractMeta(html: string) {
  const imageUrl =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i)?.[1] ??
    html.match(/data-old-hires=["']([^"']+)["']/i)?.[1] ??
    null;

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? "";

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000);

  return { imageUrl, title, desc, bodyText };
}

async function claudeParse(prompt: string): Promise<Record<string, unknown>> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = stripFences((message.content[0] as { text: string }).text.trim());
  console.log("[scrape] Claude raw response:", raw);
  return JSON.parse(raw);
}

export async function POST(req: Request) {
  const { url: rawUrl } = await req.json() as { url: string };
  if (!rawUrl) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  const url = normalizeUrl(rawUrl);
  const isAmazon = /amazon\.(com|co\.uk|ca|de|fr)/i.test(url);
  const asin = isAmazon ? extractAsin(url) : null;

  console.log("[scrape] url:", url, "isAmazon:", isAmazon, "asin:", asin);

  // ── Amazon: parse from URL slug (no fetch required), image is best-effort
  if (isAmazon) {
    const slugTitle = slugToTitle(url);
    console.log("[scrape] Amazon slug title:", slugTitle);

    if (!slugTitle) {
      return NextResponse.json({ error: "Could not read product name from URL. Try entering manually." }, { status: 422 });
    }

    // Parse slug locally — no API call needed, always works
    let parsed: Record<string, unknown> = parseSlug(slugTitle);

    // Try Claude to improve quality (optional — fall back to slug parse if it fails)
    try {
      const claudeResult = await claudeParse(
        `You are a clothing item parser. Given only a product name, return structured data.\n\nProduct: ${slugTitle}\n\nReturn ONLY raw JSON (no markdown, no explanation):\n${JSON_SCHEMA}\n\nIf not clothing: {"error":"Not a clothing item"}`
      );
      if (!claudeResult.error) parsed = claudeResult;
    } catch (e) {
      console.warn("[scrape] Claude unavailable, using slug parse:", e);
    }

    // Try to grab image (best-effort, don't block on failure)
    let imageUrl: string | null = null;
    if (asin) {
      const html = await tryFetch(`https://www.amazon.com/dp/${asin}`);
      if (html) imageUrl = extractMeta(html).imageUrl;
    }

    return NextResponse.json({ ...parsed, image_url: imageUrl });
  }

  // ── Non-Amazon: fetch the page
  const html = await tryFetch(url);
  if (!html) {
    return NextResponse.json({ error: "Could not load that page. Try a different link or enter manually." }, { status: 422 });
  }

  const { imageUrl, title, desc, bodyText } = extractMeta(html);
  console.log("[scrape] page title:", title);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = await claudeParse(
      `You are a clothing item parser. Extract structured data from this product page.\n\nTitle: ${title}\nDescription: ${desc}\nPage text: ${bodyText}\n\nReturn ONLY raw JSON (no markdown, no explanation):\n${JSON_SCHEMA}\n\nIf not clothing: {"error":"Not a clothing item"}`
    );
  } catch (e) {
    console.error("[scrape] Claude error (page):", e);
    return NextResponse.json({ error: "AI parse failed. Try entering manually." }, { status: 422 });
  }

  if (parsed.error) return NextResponse.json({ error: parsed.error as string }, { status: 422 });

  return NextResponse.json({ ...parsed, image_url: imageUrl ?? null });
}
