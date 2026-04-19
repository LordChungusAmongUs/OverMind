-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stylist_jobs ADD COLUMN IF NOT EXISTS reference_photo_url TEXT;
