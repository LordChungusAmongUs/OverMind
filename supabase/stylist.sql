-- Run this in your Supabase SQL editor to set up the stylist module

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  size TEXT,
  occasions TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wear_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  worn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laundry_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outfit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activities TEXT[] DEFAULT '{}',
  weather_summary TEXT,
  ai_suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
