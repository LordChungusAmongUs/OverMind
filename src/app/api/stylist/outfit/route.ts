import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15000,
  maxRetries: 0,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CleanItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  brand: string | null;
  occasions: string[];
}

export async function POST(req: Request) {
  const { activities, cleanItems, weather } = await req.json() as {
    activities: string[];
    cleanItems: CleanItem[];
    weather: { temp: number; condition: string } | null;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables." }, { status: 500 });
  }

  if (!cleanItems || cleanItems.length === 0) {
    return NextResponse.json({ suggestion: "No clean items available — time to do laundry!" });
  }

  const itemsList = cleanItems
    .map(i => `- [${i.type}] ${i.name}${i.color ? ` (${i.color})` : ""}${i.brand ? ` by ${i.brand}` : ""}${i.occasions?.length ? ` — occasions: ${i.occasions.join(", ")}` : ""}`)
    .join("\n");

  const weatherLine = weather
    ? `Weather: ${weather.temp}°F, ${weather.condition}`
    : "Weather: unknown";

  const prompt = `You are a personal AI stylist. Suggest a complete outfit from the user's available clean clothes.

Available clean items:
${itemsList}

Context:
- Activities today: ${activities.join(", ")}
- ${weatherLine}

Pick specific items from the list above to form a practical, stylish outfit. Format your response as:

**[Item Name]** (type) — why it works
**[Item Name]** (type) — why it works
... (include all necessary pieces: top, bottom, shoes, outerwear if needed, etc.)

**Style note:** One sentence on the overall vibe.

Only pick items from the available list. Be concise and direct.`;

  let suggestion: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    suggestion = (message.content[0] as { text: string }).text;
  } catch (e) {
    console.error("[outfit] Claude error:", e);
    return NextResponse.json({ error: "AI request failed. Check ANTHROPIC_API_KEY in Vercel env vars." }, { status: 500 });
  }

  const weatherSummary = weather ? `${weather.temp}°F, ${weather.condition}` : null;

  await supabase.from("outfit_history").insert({
    activities,
    weather_summary: weatherSummary,
    ai_suggestion: suggestion,
  });

  return NextResponse.json({ suggestion });
}
