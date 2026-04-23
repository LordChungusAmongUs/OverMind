-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS wardrobe_split_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',         -- pending | running | complete | error
  source_image_url TEXT NOT NULL,
  source_image_b64 TEXT,                 -- base64 data URL stored by API so extension skips download
  item_name TEXT,
  item_type TEXT,
  item_brand TEXT,
  item_color TEXT,
  item_occasions TEXT[] DEFAULT '{}',
  item_size TEXT,
  item_notes TEXT,
  result_items JSONB DEFAULT '[]',       -- [{name, type, color, brand, occasions, image_url}]
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add base64 column to existing tables
ALTER TABLE wardrobe_split_jobs ADD COLUMN IF NOT EXISTS source_image_b64 TEXT;

-- Also add image_url to wardrobe_items if not already there
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Required: disable RLS so the anon key can read/write
ALTER TABLE wardrobe_split_jobs DISABLE ROW LEVEL SECURITY;
