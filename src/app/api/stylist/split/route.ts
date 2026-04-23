import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function downloadImage(imageUrl: string) {
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
    return { buffer, contentType, ext };
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

  // Download image once: re-host to Supabase storage (reliable URL) AND store as base64
  // so the extension reads it directly from the DB without needing to fetch it again.
  const imageData = await downloadImage(body.source_image_url);
  if (imageData) {
    const { buffer, contentType, ext } = imageData;
    const updates: Record<string, string> = {
      source_image_b64: `data:${contentType};base64,${buffer.toString("base64")}`,
    };

    const path = `scraped-images/${data.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("pipeline-assets")
      .upload(path, buffer, { contentType, upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from("pipeline-assets").getPublicUrl(path);
      updates.source_image_url = urlData.publicUrl;
    }

    await supabase.from("wardrobe_split_jobs").update(updates).eq("id", data.id);
  }

  return NextResponse.json({ jobId: data.id });
}
