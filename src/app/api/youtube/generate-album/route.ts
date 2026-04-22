import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function applyTemplate(tmpl: string, vars: Record<string, string>) {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const { persona_name, genre = "", theme = "", track_count = 10 } = await req.json();
    if (!persona_name) return NextResponse.json({ error: "persona_name required" }, { status: 400 });

    // Load the artist's album_title prompt template
    const { data: config } = await supabase
      .from("artist_prompt_configs")
      .select("template")
      .eq("persona_name", persona_name)
      .eq("prompt_type", "album_title")
      .single();

    const fallback = `Generate a 2-4 word album title for a ${genre || "bass music"} artist exploring themes of ${theme || "darkness and energy"}. Return ONLY the title, no quotes, no explanation.`;
    const template = config?.template || fallback;
    const prompt = applyTemplate(template, { genre, theme, track_count: String(track_count), persona_name });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 30,
      system: `You generate album titles for the music artist "${persona_name}". Return ONLY the title — no quotes, no explanation, nothing else.`,
      messages: [{ role: "user", content: prompt }],
    });

    const title = ((message.content[0] as { text: string }).text).trim().replace(/^["']|["']$/g, "");
    if (!title) return NextResponse.json({ error: "No title generated" }, { status: 500 });

    // Create album in DB
    const { data: album, error } = await supabase.from("albums").insert({
      title,
      persona_name,
      status: "in_progress",
      auto_generated: true,
      max_tracks: track_count,
    }).select().single();

    if (error || !album) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

    // Set as current album for this artist
    await supabase.from("artist_channels").update({ current_album_id: album.id }).eq("persona_name", persona_name);

    return NextResponse.json({ album });
  } catch (err: unknown) {
    console.error("generate-album error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
