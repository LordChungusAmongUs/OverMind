import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TYPE_LABELS: Record<string, string> = {
  top_views:  "the artist's most-viewed tracks",
  top_likes:  "the artist's most-liked tracks",
  tag_match:  "tracks matching specific tags",
  general:    "a curated collection",
};

export async function POST(req: NextRequest) {
  try {
    const { persona_name, playlist_type = "general", tags = "", vibe = "" } = await req.json();
    if (!persona_name) return NextResponse.json({ error: "persona_name required" }, { status: 400 });

    // Pull the artist's metadata prompt for style context
    const { data: configs } = await supabase
      .from("artist_prompt_configs")
      .select("template")
      .eq("persona_name", persona_name)
      .eq("prompt_type", "metadata")
      .single();

    const styleContext = configs?.template?.slice(0, 300) ?? "";
    const typeLabel = TYPE_LABELS[playlist_type] ?? playlist_type;
    const tagNote = tags ? ` Tags: ${tags}.` : "";
    const vibeNote = vibe ? ` Vibe/notes: ${vibe}.` : "";

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `You name YouTube playlists for the music artist "${persona_name}".${styleContext ? ` Artist style context: ${styleContext}` : ""} Names should be creative, evocative, and match the artist's persona — not generic.`,
      messages: [{
        role: "user",
        content: `Create a YouTube playlist name and short description for a playlist featuring ${typeLabel}.${tagNote}${vibeNote}

Return ONLY valid JSON, no markdown:
{
  "name": "<creative playlist name, 3-7 words>",
  "description": "<one compelling sentence, 10-25 words>"
}`,
      }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });

    const { name, description } = JSON.parse(match[0]);
    return NextResponse.json({ name: name ?? "", description: description ?? "" });
  } catch (err: unknown) {
    console.error("generate-playlist error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
