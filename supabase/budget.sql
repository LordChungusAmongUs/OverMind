-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS budget_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_day INTEGER,                   -- day of month 1–31
  category TEXT DEFAULT 'Other',
  last_paid_month TEXT,              -- 'YYYY-MM' — auto-resets display each new month
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT DEFAULT 'monthly', -- monthly | biweekly | weekly | annual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target NUMERIC NOT NULL DEFAULT 0,
  saved NUMERIC NOT NULL DEFAULT 0,
  emoji TEXT DEFAULT '🎯',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
