import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, copyFile, chmod } from "fs/promises";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
export const maxDuration = 60;

// On Vercel Lambda, binaries in node_modules may lose their executable bit during
// deployment packaging. Copy to /tmp (always writable) and chmod 755 once per instance.
const FFMPEG_TMP_PATH = "/tmp/ffmpeg-bin";
let ffmpegReady: Promise<string> | null = null;

function ensureFfmpeg(): Promise<string> {
  if (!ffmpegReady) {
    ffmpegReady = (async () => {
      const mod = await import("ffmpeg-static");
      const src = ((mod as { default?: string }).default ?? mod) as string;
      await copyFile(src, FFMPEG_TMP_PATH);
      await chmod(FFMPEG_TMP_PATH, 0o755);
      return FFMPEG_TMP_PATH;
    })().catch((err) => {
      ffmpegReady = null; // allow retry on next request if copy failed
      throw err;
    });
  }
  return ffmpegReady;
}

export async function POST(req: NextRequest) {
  const id = randomUUID();
  const audioPath = `/tmp/audio-${id}`;
  const imagePath = `/tmp/image-${id}.jpg`;
  const videoPath = `/tmp/video-${id}.mp4`;

  try {
    const { audioUrl, imageUrl, title, description, tags, accessToken } = await req.json() as {
      audioUrl: string;
      imageUrl: string | null;
      title: string;
      description: string;
      tags?: string[];
      accessToken: string;
    };

    if (!audioUrl) return NextResponse.json({ error: "audioUrl required" }, { status: 400 });
    if (!accessToken) return NextResponse.json({ error: "accessToken required" }, { status: 400 });

    const ffmpegPath = await ensureFfmpeg();

    // Download audio and optional image to /tmp
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Audio fetch: HTTP ${audioRes.status}`);
    await writeFile(audioPath, Buffer.from(await audioRes.arrayBuffer()));

    let hasImage = false;
    if (imageUrl) {
      const imgRes = await fetch(imageUrl).catch(() => null);
      if (imgRes?.ok) {
        await writeFile(imagePath, Buffer.from(await imgRes.arrayBuffer()));
        hasImage = true;
      }
    }

    // Encode: static image looped over audio → H.264/AAC MP4
    const ffmpegArgs = hasImage
      ? [
          "-loop", "1", "-i", imagePath,
          "-i", audioPath,
          "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
          "-c:a", "aac", "-b:a", "192k",
          "-pix_fmt", "yuv420p",
          "-r", "1",
          "-shortest",
          "-movflags", "+faststart",
          "-y", videoPath,
        ]
      : [
          "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=1",
          "-i", audioPath,
          "-c:v", "libx264", "-preset", "ultrafast",
          "-c:a", "aac", "-b:a", "192k",
          "-pix_fmt", "yuv420p",
          "-shortest",
          "-movflags", "+faststart",
          "-y", videoPath,
        ];

    await execFileAsync(ffmpegPath, ffmpegArgs, { maxBuffer: 10 * 1024 * 1024 });

    const videoData = await readFile(videoPath);
    const videoSize = videoData.byteLength;

    // Init YouTube resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoSize),
        },
        body: JSON.stringify({
          snippet: {
            title: title || "New Track",
            description: description || "",
            tags: tags ?? ["drum and bass", "dnb", "djthirstyboy", "music"],
            categoryId: "10",
          },
          status: { privacyStatus: "public", madeForKids: false },
        }),
      }
    );
    if (!initRes.ok) {
      const text = await initRes.text();
      throw new Error(`YouTube init: ${initRes.status} ${text.slice(0, 200)}`);
    }
    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) throw new Error("No upload URL from YouTube");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoData,
    });
    if (!uploadRes.ok && uploadRes.status !== 201) {
      const text = await uploadRes.text();
      throw new Error(`YouTube upload: ${uploadRes.status} ${text.slice(0, 200)}`);
    }

    const uploadData = await uploadRes.json() as { id?: string };
    const videoId = uploadData.id;
    if (!videoId) throw new Error(`No video ID: ${JSON.stringify(uploadData).slice(0, 120)}`);

    return NextResponse.json({ videoUrl: `https://www.youtube.com/watch?v=${videoId}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `encode-upload: ${msg}` }, { status: 500 });
  } finally {
    await Promise.all([audioPath, imagePath, videoPath].map(p => unlink(p).catch(() => {})));
  }
}
