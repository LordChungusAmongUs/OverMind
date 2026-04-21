import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// Download an image and re-host it in Supabase so the extension can reliably fetch it.
// Amazon CDN URLs often block extension service worker fetches; our own storage doesn't.
async function reHostImage(imageUrl: string, jobId: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.amazon.com/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `scraped-images/${jobId}.${ext}`;
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from("pipeline-assets")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("pipeline-assets").getPublicUrl(path);
    return data.publicUrl;
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

  const supabase = getSupabase();

  // Create the job first to get an ID for the image path
  const { data, error } = await supabase.from("wardrobe_split_jobs").insert({
    source_image_url: body.source_image_url,
    item_name: body.item_name ?? null,
    item_type: body.item_type ?? null,
    item_brand: body.item_brand ?? null,
    item_color: body.item_color ?? null,
    item_occasions: body.item_occasions ?? [],
    item_size: body.item_size ?? null,
    item_notes: null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-host image to Supabase so the extension can reliably download it
  const hostedUrl = await reHostImage(body.source_image_url, data.id);
  if (hostedUrl) {
    await supabase.from("wardrobe_split_jobs")
      .update({ source_image_url: hostedUrl })
      .eq("id", data.id);
  }

  return NextResponse.json({ jobId: data.id });
}
