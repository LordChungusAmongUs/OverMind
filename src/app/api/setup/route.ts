import { NextResponse } from "next/server";
import { Pool } from "pg";

// One-time migration route.
// Requires DATABASE_URL in .env.local — get it from:
// Supabase Dashboard → Settings → Database → Connection string (URI)
// Visit /api/setup once to create all missing tables, then you're done.

const MIGRATIONS = [
  {
    name: "vendors: add delivery_days column",
    sql: `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS delivery_days text[] DEFAULT '{}'`,
  },
  {
    name: "create storage_locations",
    sql: `CREATE TABLE IF NOT EXISTS storage_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      sort_order integer DEFAULT 0,
      created_at timestamptz DEFAULT now()
    )`,
  },
  {
    name: "create product_locations",
    sql: `CREATE TABLE IF NOT EXISTS product_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid REFERENCES products(id) ON DELETE CASCADE,
      location_id uuid REFERENCES storage_locations(id) ON DELETE CASCADE,
      UNIQUE(product_id, location_id)
    )`,
  },
  {
    name: "create order_history",
    sql: `CREATE TABLE IF NOT EXISTS order_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_name text NOT NULL,
      order_date date NOT NULL DEFAULT CURRENT_DATE,
      slot integer,
      items jsonb NOT NULL DEFAULT '[]',
      estimated_total numeric,
      created_at timestamptz DEFAULT now()
    )`,
  },
  {
    name: "rls: enable on storage_locations",
    sql: `ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "rls: enable on product_locations",
    sql: `ALTER TABLE product_locations ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "rls: enable on order_history",
    sql: `ALTER TABLE order_history ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "rls policy: storage_locations allow_all",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='storage_locations' AND policyname='allow_all') THEN
        CREATE POLICY allow_all ON storage_locations FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$`,
  },
  {
    name: "rls policy: product_locations allow_all",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_locations' AND policyname='allow_all') THEN
        CREATE POLICY allow_all ON product_locations FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$`,
  },
  {
    name: "rls policy: order_history allow_all",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_history' AND policyname='allow_all') THEN
        CREATE POLICY allow_all ON order_history FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$`,
  },
];

export async function GET() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    return NextResponse.json({
      error: "DATABASE_URL not set. Add it to .env.local — get it from Supabase → Settings → Database → Connection string (URI).",
    }, { status: 500 });
  }

  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const { name, sql } of MIGRATIONS) {
    try {
      await pool.query(sql);
      results.push({ name, ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name, ok: false, error: msg });
    }
  }

  await pool.end();

  const allOk = results.every(r => r.ok);
  const failed = results.filter(r => !r.ok);

  return NextResponse.json(
    { success: allOk, results, failed },
    { status: allOk ? 200 : 207 }
  );
}
