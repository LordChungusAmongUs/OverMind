import { NextRequest, NextResponse } from "next/server";
import { getYouTubeClient } from "@/lib/youtube-auth";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";

export const maxDuration = 300; // 5 min timeout for large uploads

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const personaName = formData.get("persona_name") as string | null;
    const playlistId = formData.get("playlist_id") as string | null;

    if (!videoFile || !title) {
      return NextResponse.json({ error: "Missing video or title" }, { status: 400 });
    }

    const result = await getYouTubeClient(supabase, personaName);
    if (!result) {
      return NextResponse.json(
        { error: "YouTube not connected. Please authorize first." },
        { status: 401 }
      );
    }

    const youtube = google.youtube({ version: "v3", auth: result.oauth });
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const stream = Readable.from(buffer);

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description: description || "",
          tags: ["drum and bass", "dnb", "djthirstyboy", "music"],
          categoryId: "10", // Music
        },
        status: {
          privacyStatus: "public",
        },
      },
      media: {
        mimeType: "video/mp4",
        body: stream,
      },
    });

    const videoId = response.data.id!;

    // Auto-add to playlist if provided
    if (playlistId && videoId) {
      try {
        await youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: { kind: "youtube#video", videoId },
            },
          },
        });
      } catch (e) {
        console.error("Playlist add after upload error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
