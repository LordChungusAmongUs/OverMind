-- Run in Supabase SQL editor

-- Artist YouTube channel config (7 personas + Dehydration Nation master)
CREATE TABLE IF NOT EXISTS artist_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name TEXT NOT NULL UNIQUE,
  channel_name TEXT,
  youtube_channel_id TEXT,
  is_master BOOLEAN DEFAULT FALSE,
  upload_to_master BOOLEAN DEFAULT TRUE,
  auto_interact BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  emoji TEXT,
  color_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add emoji/color_key to existing artist_channels tables
ALTER TABLE artist_channels ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE artist_channels ADD COLUMN IF NOT EXISTS color_key TEXT;

-- Per-artist customizable ChatGPT prompt templates
CREATE TABLE IF NOT EXISTS artist_prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name TEXT NOT NULL,
  prompt_type TEXT NOT NULL, -- lyrics | art | title | metadata | comment_reply
  template TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_name, prompt_type)
);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  art_url TEXT,
  description TEXT,
  release_date DATE,
  status TEXT DEFAULT 'in_progress', -- in_progress | released
  youtube_playlist_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual tracks within an album
CREATE TABLE IF NOT EXISTS album_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  track_number INTEGER NOT NULL,
  title TEXT,
  pipeline_job_id TEXT,
  youtube_url TEXT,
  youtube_video_id TEXT,
  status TEXT DEFAULT 'pending', -- pending | generating | uploaded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fan interaction automation jobs
CREATE TABLE IF NOT EXISTS fan_interaction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name TEXT NOT NULL,
  video_id TEXT,
  status TEXT DEFAULT 'pending',
  comments_replied INTEGER DEFAULT 0,
  likes_given INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
