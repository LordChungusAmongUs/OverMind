import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
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
    item_notes?: string;
  };

  if (!body.source_image_url) {
    return NextResponse.json({ error: "No image URL" }, { status: 400 });
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
    item_notes: body.item_notes ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobId: data.id });
}
