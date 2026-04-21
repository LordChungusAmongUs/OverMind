import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/youtube-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // Parse persona from state param (format: "persona:PersonaName")
  const persona = state.startsWith("persona:") ? state.slice("persona:".length) : null;
  const service = persona ? `youtube_${persona}` : "youtube";

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  await supabase.from("oauth_tokens").upsert(
    {
      service,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service" }
  );

  const redirectTo = persona
    ? `/music/label?connected=${encodeURIComponent(persona)}`
    : "/youtube?connected=true";

  return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
}
