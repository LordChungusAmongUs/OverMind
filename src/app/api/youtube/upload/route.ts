import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/youtube-auth";
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
    // Get stored tokens
    const { data: tokenRow } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("service", "youtube")
      .single();

    if (!tokenRow) {
      return NextResponse.json({ error: "YouTube not connected. Please authorize first." }, { status: 401 });
    }

    const oauth = getOAuthClient();
    oauth.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
    });

    // Refresh token if expired
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      const { credentials } = await oauth.refreshAccessToken();
      oauth.setCredentials(credentials);
      await supabase.from("oauth_tokens").update({
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("service", "youtube");
    }

    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    if (!videoFile || !title) {
      return NextResponse.json({ error: "Missing video or title" }, { status: 400 });
    }

    const youtube = google.youtube({ version: "v3", auth: oauth });
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

    return NextResponse.json({
      success: true,
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
