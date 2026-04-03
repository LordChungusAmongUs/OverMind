import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/youtube-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data: tokenRow } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("service", "youtube")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "YouTube not connected." }, { status: 401 });
  }

  const oauth = getOAuthClient();
  oauth.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  });

  // Refresh if expired
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    const { credentials } = await oauth.refreshAccessToken();
    oauth.setCredentials(credentials);
    await supabase.from("oauth_tokens").update({
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }).eq("service", "youtube");
    return NextResponse.json({ access_token: credentials.access_token });
  }

  return NextResponse.json({ access_token: tokenRow.access_token });
}
