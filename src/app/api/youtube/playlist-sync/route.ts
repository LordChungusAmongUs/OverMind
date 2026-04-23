import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getYouTubeClient } from "@/lib/youtube-auth";
import { google } from "googleapis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { persona_name } = body as { persona_name?: string };

  const personas = persona_name ? [persona_name] : await getAllPersonas();
  const results: Record<string, unknown> = {};
  for (const p of personas) {
    results[p] = await syncPersona(p).catch(e => ({ error: String(e) }));
  }
  return NextResponse.json({ results });
}

// Vercel cron trigger — runs daily, only syncs artists with auto_sync enabled
export async function GET() {
  const personas = await getAllPersonas(true);
  const results: Record<string, unknown> = {};
  for (const p of personas) {
    results[p] = await syncPersona(p).catch(e => ({ error: String(e) }));
  }
  return NextResponse.json({ results });
}

// POST (manual) syncs whoever you pass; GET (cron) only syncs artists with auto-sync enabled
async function getAllPersonas(autoSyncOnly = false): Promise<string[]> {
  let query = supabase.from("artist_channels").select("persona_name").eq("active", true);
  if (autoSyncOnly) query = query.eq("playlist_auto_sync", true);
  const { data } = await query;
  return (data ?? []).map((r: { persona_name: string }) => r.persona_name);
}

async function syncPersona(persona: string): Promise<{ tracked: number; statsUpdated: number; added: number }> {
  const { data: playlists } = await supabase
    .from("artist_playlists")
    .select("*")
    .eq("persona_name", persona)
    .not("youtube_playlist_id", "is", null);

  const { data: tracks } = await supabase
    .from("artist_track_names")
    .select("*")
    .eq("persona_name", persona)
    .not("youtube_video_id", "is", null);

  if (!tracks?.length) return { tracked: 0, statsUpdated: 0, added: 0 };

  const ytResult = await getYouTubeClient(supabase, persona);
  if (!ytResult) return { tracked: tracks.length, statsUpdated: 0, added: 0 };

  const youtube = google.youtube({ version: "v3", auth: ytResult.oauth });
  const videoIds: string[] = tracks.map((t: { youtube_video_id: string }) => t.youtube_video_id);
  const statsMap: Record<string, { views: number; likes: number }> = {};

  // YouTube allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    try {
      const res = await youtube.videos.list({ part: ["statistics"], id: videoIds.slice(i, i + 50) });
      for (const item of res.data.items ?? []) {
        statsMap[item.id!] = {
          views: parseInt(item.statistics?.viewCount ?? "0"),
          likes: parseInt(item.statistics?.likeCount ?? "0"),
        };
      }
    } catch {}
  }

  // Update stats in DB
  let statsUpdated = 0;
  for (const track of tracks) {
    const s = statsMap[track.youtube_video_id];
    if (s) {
      await supabase.from("artist_track_names").update({
        view_count: s.views,
        like_count: s.likes,
        last_stats_synced_at: new Date().toISOString(),
      }).eq("id", track.id);
      statsUpdated++;
    }
  }

  // Route tracks to playlists
  let added = 0;
  type EnrichedTrack = { youtube_video_id: string; tags: string[]; view_count: number; like_count: number; [k: string]: unknown };
  const enriched = tracks.map((t: Record<string, unknown>) => ({
    ...t,
    view_count: statsMap[t.youtube_video_id as string]?.views ?? (t.view_count as number) ?? 0,
    like_count: statsMap[t.youtube_video_id as string]?.likes ?? (t.like_count as number) ?? 0,
  })) as EnrichedTrack[];

  for (const pl of playlists ?? []) {
    let targetIds: string[] = [];

    if (pl.playlist_type === "top_views") {
      targetIds = [...enriched]
        .sort((a, b) => (b.view_count as number) - (a.view_count as number))
        .slice(0, pl.top_n ?? 50)
        .map(t => t.youtube_video_id as string);
    } else if (pl.playlist_type === "top_likes") {
      targetIds = [...enriched]
        .sort((a, b) => (b.like_count as number) - (a.like_count as number))
        .slice(0, pl.top_n ?? 50)
        .map(t => t.youtube_video_id as string);
    } else if (pl.playlist_type === "tag_match" && (pl.auto_tags ?? []).length > 0) {
      targetIds = enriched
        .filter(t => (t.tags as string[] ?? []).some(tag => pl.auto_tags.includes(tag)))
        .map(t => t.youtube_video_id as string);
    }

    for (const videoId of targetIds) {
      try {
        await youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId: pl.youtube_playlist_id,
              resourceId: { kind: "youtube#video", videoId },
            },
          },
        });
        added++;
      } catch (e: unknown) {
        const msg = JSON.stringify((e as { errors?: unknown; message?: string })?.errors ?? (e as { message?: string })?.message ?? "");
        if (!msg.includes("VIDEO_ALREADY_IN_PLAYLIST") && !msg.includes("already in playlist")) {
          console.error(`playlist-sync: add ${videoId} to ${pl.youtube_playlist_id}:`, msg.slice(0, 200));
        }
      }
    }
  }

  return { tracked: tracks.length, statsUpdated, added };
}
