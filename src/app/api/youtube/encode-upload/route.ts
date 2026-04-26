import { NextRequest, NextResponse } from "next/server";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import path from "path";

export const maxDuration = 300;

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  const base = path.join(process.cwd(), "node_modules/@ffmpeg/core/dist/esm");
  const toFileUrl = (p: string) => `file://${p.replace(/\\/g, "/")}`;
  await ffmpeg.load({
    coreURL: toFileUrl(path.join(base, "ffmpeg-core.js")),
    wasmURL: toFileUrl(path.join(base, "ffmpeg-core.wasm")),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function POST(req: NextRequest) {
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

    const ffmpeg = await getFFmpeg();

    // Write audio to FFmpeg virtual FS
    await ffmpeg.writeFile("audio", await fetchFile(audioUrl));

    let videoArgs: string[];
    if (imageUrl) {
      await ffmpeg.writeFile("image.jpg", await fetchFile(imageUrl));
      videoArgs = [
        "-loop", "1", "-i", "image.jpg",
        "-i", "audio",
        "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-r", "1",
        "-shortest",
        "-movflags", "+faststart",
        "output.mp4",
      ];
    } else {
      // No art: black frame video
      videoArgs = [
        "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=1",
        "-i", "audio",
        "-c:v", "libx264", "-preset", "ultrafast",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-movflags", "+faststart",
        "output.mp4",
      ];
    }

    await ffmpeg.exec(videoArgs);
    const videoData = await ffmpeg.readFile("output.mp4") as Uint8Array;

    // Clean up virtual FS
    await ffmpeg.deleteFile("audio").catch(() => {});
    await ffmpeg.deleteFile("image.jpg").catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});

    // Init YouTube resumable upload
    const videoSize = videoData.byteLength;
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
      return NextResponse.json({ error: `YouTube init: ${initRes.status} ${text.slice(0, 200)}` }, { status: 500 });
    }
    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) return NextResponse.json({ error: "No upload URL from YouTube" }, { status: 500 });

    // Upload video
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
      return NextResponse.json({ error: `YouTube upload: ${uploadRes.status} ${text.slice(0, 200)}` }, { status: 500 });
    }
    const uploadData = await uploadRes.json() as { id?: string };
    const videoId = uploadData.id;
    if (!videoId) return NextResponse.json({ error: `No video ID: ${JSON.stringify(uploadData).slice(0, 120)}` }, { status: 500 });

    return NextResponse.json({ videoUrl: `https://www.youtube.com/watch?v=${videoId}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `encode-upload: ${msg}` }, { status: 500 });
  }
}
