import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface CleanItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  brand: string | null;
  occasions: string[];
  image_url: string | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      activities: string[];
      cleanItems: CleanItem[];
      weather: { temp: number; condition: string } | null;
      referencePhotoUrl: string | null;
    };

    const { activities, cleanItems, weather } = body;

    if (!cleanItems || cleanItems.length === 0) {
      return NextResponse.json({ error: "No clean items available." }, { status: 400 });
    }

    const weatherSummary = weather ? `${weather.temp}°F, ${weather.condition}` : null;
    const supabase = getSupabase();

    const { data, error } = await supabase.from("stylist_jobs").insert({
      activities,
      weather_summary: weatherSummary,
      clean_items: cleanItems,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobId: data.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `outfit route error: ${msg}` }, { status: 500 });
  }
}
