import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/youtube-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  // Store tokens in Supabase
  await supabase.from("oauth_tokens").upsert({
    service: "youtube",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "service" });

  return NextResponse.redirect(
    new URL("/youtube?connected=true", req.nextUrl.origin)
  );
}
