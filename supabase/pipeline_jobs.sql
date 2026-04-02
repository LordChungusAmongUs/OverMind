-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','complete','error')),
  step TEXT,
  style_tags TEXT,
  track_theme TEXT,
  lyrics_prompt TEXT,
  art_prompt TEXT,
  metadata_prompt TEXT,
  lyrics TEXT,
  art_url TEXT,
  audio_url TEXT,
  title TEXT,
  description TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
