import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not parse form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const supabase = getSupabase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `user-photos/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: storageError } = await supabase.storage
    .from("pipeline-assets")
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });

  if (storageError) {
    return NextResponse.json({
      error: `Storage upload failed: ${storageError.message}. Check that the "pipeline-assets" bucket exists in Supabase Storage and add SUPABASE_SERVICE_ROLE_KEY to your Vercel env vars.`,
    }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("pipeline-assets").getPublicUrl(path);
  const url = urlData.publicUrl;

  const { data, error: dbError } = await supabase
    .from("user_photos")
    .insert({ url })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({
      error: `DB insert failed: ${dbError.message}`,
    }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, url });
}
