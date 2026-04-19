-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS stylist_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',   -- pending | running | complete | error
  step TEXT,
  activities TEXT[] DEFAULT '{}',
  weather_summary TEXT,
  clean_items JSONB DEFAULT '[]',
  outfit_description TEXT,
  outfit_image_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
