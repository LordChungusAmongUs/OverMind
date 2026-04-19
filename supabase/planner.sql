-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS planner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  scheduled_date DATE,           -- null = someday/inbox
  scheduled_time TEXT,           -- '09:00' format, optional
  duration_minutes INTEGER DEFAULT 60,
  recurrence TEXT DEFAULT 'none', -- none | daily | weekly | monthly
  completed_dates TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
