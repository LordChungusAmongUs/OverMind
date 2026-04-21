import { NextRequest, NextResponse } from "next/server";
import { getYouTubeClient } from "@/lib/youtube-auth";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST — create a YouTube playlist
export async function POST(req: NextRequest) {
  try {
    const { title, description, privacy = "public", persona_name } = await req.json();
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const result = await getYouTubeClient(supabase, persona_name);
    if (!result) return NextResponse.json({ error: "YouTube not connected" }, { status: 401 });

    const youtube = google.youtube({ version: "v3", auth: result.oauth });
    const res = await youtube.playlists.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title, description: description ?? "" },
        status: { privacyStatus: privacy },
      },
    });

    return NextResponse.json({
      playlistId: res.data.id,
      url: `https://www.youtube.com/playlist?list=${res.data.id}`,
    });
  } catch (err: any) {
    console.error("Create playlist error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — add a video to a playlist
export async function PATCH(req: NextRequest) {
  try {
    const { playlist_id, video_id, persona_name } = await req.json();
    if (!playlist_id || !video_id) {
      return NextResponse.json({ error: "playlist_id and video_id required" }, { status: 400 });
    }

    const result = await getYouTubeClient(supabase, persona_name);
    if (!result) return NextResponse.json({ error: "YouTube not connected" }, { status: 401 });

    const youtube = google.youtube({ version: "v3", auth: result.oauth });
    await youtube.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          playlistId: playlist_id,
          resourceId: { kind: "youtube#video", videoId: video_id },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Add to playlist error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
