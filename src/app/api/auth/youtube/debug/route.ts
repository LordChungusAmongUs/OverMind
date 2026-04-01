import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/youtube-auth";

export async function GET() {
  const url = getAuthUrl();
  const parsed = new URL(url);
  return NextResponse.json({
    full_url: url,
    client_id: parsed.searchParams.get("client_id"),
    redirect_uri: parsed.searchParams.get("redirect_uri"),
    scope: parsed.searchParams.get("scope"),
    env_client_id: process.env.YOUTUBE_CLIENT_ID ? "SET" : "MISSING",
    env_secret: process.env.YOUTUBE_CLIENT_SECRET ? "SET" : "MISSING",
    env_redirect: process.env.YOUTUBE_REDIRECT_URI ?? "MISSING",
  });
}
