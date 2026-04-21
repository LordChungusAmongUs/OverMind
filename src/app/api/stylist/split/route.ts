import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15000, maxRetries: 0 });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function analyzeProductWithClaude(
  item_name: string,
  item_type: string | null,
  item_brand: string | null,
): Promise<{ count: number; items: object[] } | null> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are analyzing a clothing product for a wardrobe catalog app. Given the product name, determine all individual items to add.

Product: ${item_name}
Category: ${item_type ?? "unknown"}
Brand: ${item_brand ?? "unknown"}

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "count": <total individual pieces in this purchase>,
  "items": [
    {
      "item_type": "<specific singular item e.g. boxer brief, t-shirt, crew sock, sneaker>",
      "color": "<specific color e.g. Black, White, Navy Blue, Heather Grey>",
      "brand": "<brand or null>",
      "occasions": [<from: Casual, Work, Gym, Going Out, Date Night, Errands, Church, Travel, Formal>],
      "style_notes": "<one sentence about fit, cut, or material>"
    }
  ]
}

Rules:
- For a multi-pack with different colors, create one items[] entry per unique color
- For a multi-pack of identical color, set count > 1 and one items[] entry
- For a variety/assorted pack where specific colors are not listed, infer the most common colors sold for this item type
- count = total number of individual pieces across all colors
- Keep item_type singular and specific`,
      }],
    });
    const text = (msg.content[0] as { text: string }).text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json() as {
    source_image_url: string;
    item_name?: string;
    item_type?: string;
    item_brand?: string;
    item_color?: string;
    item_occasions?: string[];
    item_size?: string;
  };

  if (!body.source_image_url) {
    return NextResponse.json({ error: "No image URL" }, { status: 400 });
  }

  // If we have a product name, analyze with Claude server-side so the extension
  // can skip the ChatGPT analysis tab and go straight to image generation.
  let pre_analyzed: string | null = null;
  if (body.item_name) {
    const result = await analyzeProductWithClaude(body.item_name, body.item_type ?? null, body.item_brand ?? null);
    if (result) pre_analyzed = JSON.stringify(result);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("wardrobe_split_jobs").insert({
    source_image_url: body.source_image_url,
    item_name: body.item_name ?? null,
    item_type: body.item_type ?? null,
    item_brand: body.item_brand ?? null,
    item_color: body.item_color ?? null,
    item_occasions: body.item_occasions ?? [],
    item_size: body.item_size ?? null,
    item_notes: pre_analyzed,  // JSON string of pre-analyzed items, or null
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobId: data.id });
}
