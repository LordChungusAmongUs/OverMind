import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  if (!cleanItems || cleanItems.length === 0) {
    return NextResponse.json({ error: "No clean items available." }, { status: 400 });
  }

  const weatherSummary = weather ? `${weather.temp}°F, ${weather.condition}` : null;

  const { data, error } = await supabase.from("stylist_jobs").insert({
    activities,
    weather_summary: weatherSummary,
    clean_items: cleanItems,
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobId: data.id });
}
