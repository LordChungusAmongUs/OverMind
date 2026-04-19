-- Run in Supabase SQL editor

-- Per-artist social platform accounts
CREATE TABLE IF NOT EXISTS artist_platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name TEXT NOT NULL,
  platform TEXT NOT NULL, -- soundcloud | tiktok | instagram | facebook | twitter
  handle TEXT,
  profile_url TEXT,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_name, platform)
);

-- Queue for automated social media posts
CREATE TABLE IF NOT EXISTS platform_post_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  pipeline_job_id TEXT,
  audio_url TEXT,
  video_url TEXT,
  image_url TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  status TEXT DEFAULT 'pending', -- pending | running | complete | error
  error_message TEXT,
  post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
