import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

export function getAuthUrl(persona?: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    prompt: "consent",
    state: persona ? `persona:${persona}` : undefined,
  });
}

// Returns { oauth, tokenRow } using artist-specific token, falling back to master "youtube" token.
// Also handles token refresh if expired.
export async function getYouTubeClient(supabase: SupabaseClient, persona?: string | null) {
  let tokenRow: Record<string, string> | null = null;

  if (persona) {
    const { data } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("service", `youtube_${persona}`)
      .single();
    tokenRow = data;
  }
  if (!tokenRow) {
    const { data } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("service", "youtube")
      .single();
    tokenRow = data;
  }
  if (!tokenRow) return null;

  const oauth = getOAuthClient();
  oauth.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  });

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    const { credentials } = await oauth.refreshAccessToken();
    oauth.setCredentials(credentials);
    await supabase
      .from("oauth_tokens")
      .update({
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("service", tokenRow.service);
  }

  return { oauth, tokenRow };
}
