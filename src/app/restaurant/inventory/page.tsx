"use client";

/*
  SUPABASE MIGRATIONS — run in SQL Editor:

  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS delivery_days text[] DEFAULT '{}';

  CREATE TABLE IF NOT EXISTS storage_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS product_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    location_id uuid REFERENCES storage_locations(id) ON DELETE CASCADE,
    UNIQUE(product_id, location_id)
  );

  CREATE TABLE IF NOT EXISTS order_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name text NOT NULL,
    order_date date NOT NULL DEFAULT CURRENT_DATE,
    slot integer,
    items jsonb NOT NULL DEFAULT '[]',
    estimated_total numeric,
    created_at timestamptz DEFAULT now()
  );
*/

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import {
  Package, ClipboardList, ShoppingCart, Settings, Pencil, Check, X,
  AlertTriangle, TrendingUp, Search, History, ChevronDown, ChevronUp,
  Save, Plus, Trash2, ArrowUp, ArrowDown, MapPin, LayoutGrid, List,
} from "lucide-react";

type Tab = "overview" | "products" | "count" | "orders" | "history";
type HistoryView = "counts" | "orders";
type CountMode = "category" | "location";

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Vendor { id: string; name: string; order_frequency: string; delivery_days: string[]; }
interface Category { id: string; name: string; }
interface StorageLocation { id: string; name: string; sort_order: number; }
interface ProductVendor { id: string; vendor_id: string; vendor_name: string; price: number | null; }
interface Product {
  id: string; name: string; category_id: string; category_name: string;
  unit: string; par_level: number | null; par_slot1: number | null; par_slot2: number | null;
  par_auto: boolean; product_vendors: ProductVendor[]; location_ids: string[];
}
interface CountEntry { product_id: string; quantity: string; }
interface CountHistoryRow { id: string; product_id: string; quantity_on_hand: number; count_date: string; order_slot: number; }
interface OrderHistoryRow {
  id: string; vendor_name: string; order_date: string; slot: number | null;
  items: Array<{ name: string; unit: string; par: number; to_order: number; price: number | null }>;
  estimated_total: number | null; created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEffectivePar(p: Product, slot: 1 | 2): number | null {
  if (slot === 2 && p.par_slot2 != null) return p.par_slot2;
  return p.par_slot1 ?? p.par_level;
}
function getVendorForProduct(p: Product, vendors: Vendor[]): Vendor | null {
  for (const pv of p.product_vendors) {
    const v = vendors.find(vv => vv.id === pv.vendor_id && vv.order_frequency === "twice_weekly");
    if (v) return v;
  }
  for (const pv of p.product_vendors) {
    const v = vendors.find(vv => vv.id === pv.vendor_id);
    if (v) return v;
  }
  return null;
}
function slotDayLabel(v: Vendor | null, slot: 1 | 2, fallback = true): string {
  const days = v?.delivery_days ?? [];
  if (slot === 1) return days[0] ?? (fallback ? "Slot 1" : "");
  return days[1] ?? (fallback ? "Slot 2" : "");
}
function shortDay(day: string) { return day.slice(0, 3); }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // Product edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<Product & { prices: Record<string, string>; location_ids: string[] }>>({});
  const [locMode, setLocMode] = useState(false);

  // Count
  const [countEntries, setCountEntries] = useState<CountEntry[]>([]);
  const [countSlot, setCountSlot] = useState<1 | 2>(1);
  const [countMode, setCountMode] = useState<CountMode>("location");
  const [locCountEntries, setLocCountEntries] = useState<Record<string, string>>({});
  const [countSubmitting, setCountSubmitting] = useState(false);

  // Orders
  const [ordersSlot, setOrdersSlot] = useState<1 | 2>(1);
  const [orderData, setOrderData] = useState<Record<string, { items: any[] }>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  // Vendor delivery day editor
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editVendorDays, setEditVendorDays] = useState<string[]>([]);
  const [savingVendor, setSavingVendor] = useState(false);

  // Storage location editor
  const [newLocName, setNewLocName] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState("");
  const [locError, setLocError] = useState<string | null>(null);

  // History
  const [historyView, setHistoryView] = useState<HistoryView>("counts");
  const [countHistory, setCountHistory] = useState<CountHistoryRow[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: vData }, { data: cData }, { data: pData }, { data: pvData }, { data: slData }, { data: plData }] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("*, categories(name)").order("name"),
      supabase.from("product_vendors").select("*, vendors(name)"),
      supabase.from("storage_locations").select("*").order("sort_order"),
      supabase.from("product_locations").select("*"),
    ]);

    setVendors((vData || []).map((v: any) => ({ ...v, delivery_days: v.delivery_days ?? [] })));
    setCategories(cData || []);
    setStorageLocations(slData || []);

    const pvMap: Record<string, ProductVendor[]> = {};
    (pvData || []).forEach((pv: any) => {
      if (!pvMap[pv.product_id]) pvMap[pv.product_id] = [];
      pvMap[pv.product_id].push({ id: pv.id, vendor_id: pv.vendor_id, vendor_name: pv.vendors?.name, price: pv.price });
    });

    const plMap: Record<string, string[]> = {};
    (plData || []).forEach((pl: any) => {
      if (!plMap[pl.product_id]) plMap[pl.product_id] = [];
      plMap[pl.product_id].push(pl.location_id);
    });

    const enriched: Product[] = (pData || []).map((p: any) => ({
      ...p,
      category_name: p.categories?.name || "",
      product_vendors: pvMap[p.id] || [],
      location_ids: plMap[p.id] || [],
    }));

    setProducts(enriched);
    setCountEntries(enriched.map(p => ({ product_id: p.id, quantity: "" })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const [{ data: ch }, { data: oh }] = await Promise.all([
      supabase.from("inventory_counts").select("*").order("count_date", { ascending: false }).limit(500),
      supabase.from("order_history").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setCountHistory(ch ?? []);
    setOrderHistory((oh ?? []).map((r: any) => ({ ...r, items: r.items ?? [] })));
    setHistoryLoading(false);
  }, []);

  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);

  // ── Order generation ─────────────────────────────────────────────────────────

  const generateOrders = useCallback(async (slot: 1 | 2) => {
    const { data: latestCounts } = await supabase
      .from("inventory_counts").select("product_id, quantity_on_hand, count_date, order_slot")
      .order("count_date", { ascending: false });

    const latestByProduct: Record<string, number> = {};
    const all = latestCounts ?? [];
    all.forEach((c: any) => { if (!(c.product_id in latestByProduct)) latestByProduct[c.product_id] = c.quantity_on_hand; });
    all.filter((c: any) => c.order_slot === slot).forEach((c: any) => { latestByProduct[c.product_id] = c.quantity_on_hand; });

    const grouped: Record<string, { items: any[] }> = {};
    for (const product of products) {
      const par = getEffectivePar(product, slot);
      if (par == null) continue;
      const onHand = latestByProduct[product.id] ?? null;
      if (onHand === null) continue;
      const toOrder = Math.ceil(par - onHand);
      if (toOrder <= 0) continue;
      const pvWithPrice = product.product_vendors.filter(pv => pv.price !== null);
      const chosen = pvWithPrice.sort((a, b) => (a.price! - b.price!))[0];
      const vendorName = chosen?.vendor_name || (product.product_vendors[0]?.vendor_name ?? "Unknown");
      if (!grouped[vendorName]) grouped[vendorName] = { items: [] };
      grouped[vendorName].items.push({ ...product, toOrder, par, price: chosen?.price ?? null, vendor: vendorName });
    }
    setOrderData(grouped);
    setOrderSaved(false);
  }, [products]);

  useEffect(() => { if (tab === "orders") generateOrders(ordersSlot); }, [tab, products, ordersSlot, generateOrders]);

  // ── Save order ───────────────────────────────────────────────────────────────

  const saveOrder = async () => {
    setSavingOrder(true);
    const today = new Date().toISOString().split("T")[0];
    for (const [vendorName, { items }] of Object.entries(orderData)) {
      const total = items.reduce((s, i) => s + (i.price ? i.price * i.toOrder : 0), 0);
      await supabase.from("order_history").insert({
        vendor_name: vendorName, order_date: today, slot: ordersSlot,
        items: items.map(i => ({ name: i.name, unit: i.unit, par: i.par, to_order: i.toOrder, price: i.price })),
        estimated_total: total > 0 ? total : null,
      });
    }
    setSavingOrder(false);
    setOrderSaved(true);
  };

  // ── Product edit save ────────────────────────────────────────────────────────

  const saveEdit = async (p: Product) => {
    await supabase.from("products").update({
      name: editBuf.name ?? p.name,
      unit: editBuf.unit ?? p.unit,
      par_level: editBuf.par_slot1 !== undefined ? editBuf.par_slot1 : (p.par_slot1 ?? p.par_level),
      par_slot1: editBuf.par_slot1 !== undefined ? editBuf.par_slot1 : p.par_slot1,
      par_slot2: editBuf.par_slot2 !== undefined ? editBuf.par_slot2 : p.par_slot2,
      category_id: editBuf.category_id ?? p.category_id,
    }).eq("id", p.id);

    if (editBuf.prices) {
      for (const [pvId, priceStr] of Object.entries(editBuf.prices)) {
        const price = priceStr === "" ? null : parseFloat(priceStr);
        await supabase.from("product_vendors").update({ price, last_updated: new Date().toISOString() }).eq("id", pvId);
      }
    }

    if (editBuf.location_ids !== undefined) {
      const toAdd = editBuf.location_ids.filter(id => !p.location_ids.includes(id));
      const toRemove = p.location_ids.filter(id => !editBuf.location_ids!.includes(id));
      await Promise.all([
        ...toAdd.map(locId => supabase.from("product_locations").insert({ product_id: p.id, location_id: locId })),
        ...toRemove.map(locId => supabase.from("product_locations").delete().eq("product_id", p.id).eq("location_id", locId)),
      ]);
    }

    setEditingId(null);
    setEditBuf({});
    loadData();
  };

  // ── Quick location toggle (matrix view) ─────────────────────────────────────

  const toggleProductLocation = async (p: Product, locationId: string) => {
    const has = p.location_ids.includes(locationId);
    if (has) {
      await supabase.from("product_locations").delete().eq("product_id", p.id).eq("location_id", locationId);
    } else {
      await supabase.from("product_locations").insert({ product_id: p.id, location_id: locationId });
    }
    setProducts(prev => prev.map(prod =>
      prod.id === p.id
        ? { ...prod, location_ids: has ? prod.location_ids.filter(id => id !== locationId) : [...prod.location_ids, locationId] }
        : prod
    ));
  };

  // ── Vendor delivery days ─────────────────────────────────────────────────────

  const saveVendorDays = async (vendorId: string) => {
    setSavingVendor(true);
    await supabase.from("vendors").update({ delivery_days: editVendorDays }).eq("id", vendorId);
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, delivery_days: editVendorDays } : v));
    setEditingVendorId(null);
    setSavingVendor(false);
  };

  // ── Storage location CRUD ────────────────────────────────────────────────────

  const addLocation = async () => {
    if (!newLocName.trim()) return;
    setLocError(null);
    const maxOrder = storageLocations.length > 0 ? Math.max(...storageLocations.map(l => l.sort_order)) : -1;
    const { data, error } = await supabase
      .from("storage_locations")
      .insert({ name: newLocName.trim(), sort_order: maxOrder + 1 })
      .select()
      .single();
    if (error) {
      console.error("addLocation error:", error);
      setLocError(error.message);
      return; // keep the form open so user sees the error
    }
    if (data) setStorageLocations(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
    setNewLocName("");
    setAddingLoc(false);
  };

  const saveLocName = async (id: string) => {
    if (!editLocName.trim()) return;
    await supabase.from("storage_locations").update({ name: editLocName.trim() }).eq("id", id);
    setStorageLocations(prev => prev.map(l => l.id === id ? { ...l, name: editLocName.trim() } : l));
    setEditingLocId(null);
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location? Products won't be deleted, just unassigned from here.")) return;
    await supabase.from("storage_locations").delete().eq("id", id);
    setStorageLocations(prev => prev.filter(l => l.id !== id));
  };

  const moveLocation = async (id: string, dir: "up" | "down") => {
    const idx = storageLocations.findIndex(l => l.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= storageLocations.length) return;
    const a = storageLocations[idx];
    const b = storageLocations[swapIdx];
    await Promise.all([
      supabase.from("storage_locations").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("storage_locations").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    const next = [...storageLocations];
    next[idx] = { ...a, sort_order: b.sort_order };
    next[swapIdx] = { ...b, sort_order: a.sort_order };
    setStorageLocations(next.sort((x, y) => x.sort_order - y.sort_order));
  };

  // ── Count submit ─────────────────────────────────────────────────────────────

  const submitCount = async () => {
    setCountSubmitting(true);
    const today = new Date().toISOString().split("T")[0];

    if (countMode === "location") {
      // Sum quantities per product across all locations
      const productTotals: Record<string, number> = {};
      for (const [key, qty] of Object.entries(locCountEntries)) {
        if (!qty) continue;
        const [productId] = key.split("::");
        productTotals[productId] = (productTotals[productId] ?? 0) + parseFloat(qty);
      }
      let count = 0;
      for (const [productId, total] of Object.entries(productTotals)) {
        const product = products.find(p => p.id === productId);
        const v = product ? getVendorForProduct(product, vendors) : null;
        const isTwice = v?.order_frequency === "twice_weekly";
        await supabase.from("inventory_counts").insert({
          product_id: productId, quantity_on_hand: total, count_date: today,
          order_slot: isTwice ? countSlot : 1,
        });
        count++;
      }
      alert(`Count submitted for ${count} items.`);
      setLocCountEntries({});
    } else {
      const filled = countEntries.filter(e => e.quantity !== "");
      for (const entry of filled) {
        const product = products.find(p => p.id === entry.product_id);
        const v = product ? getVendorForProduct(product, vendors) : null;
        const isTwice = v?.order_frequency === "twice_weekly";
        await supabase.from("inventory_counts").insert({
          product_id: entry.product_id, quantity_on_hand: parseFloat(entry.quantity),
          count_date: today, order_slot: isTwice ? countSlot : 1,
        });
      }
      alert(`Count submitted for ${filled.length} items.`);
      setCountEntries(products.map(p => ({ product_id: p.id, quantity: "" })));
    }
    setCountSubmitting(false);
  };

  // ── Misc ─────────────────────────────────────────────────────────────────────

  const filtered = products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.category_name === filterCat)
  );

  const countsByDate = countHistory.reduce<Record<string, CountHistoryRow[]>>((acc, r) => {
    (acc[r.count_date] ??= []).push(r); return acc;
  }, {});

  const twiceVendors = vendors.filter(v => v.order_frequency === "twice_weekly" && (v.delivery_days ?? []).length > 0);
  function slotToggleLabel(s: 1 | 2) {
    const label = twiceVendors.map(v => shortDay(slotDayLabel(v, s, false))).filter(Boolean).join("/") || `Slot ${s}`;
    return `${label} Delivery`;
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview",    icon: Package       },
    { key: "products", label: "Products",    icon: Settings      },
    { key: "count",    label: "Count Entry", icon: ClipboardList },
    { key: "orders",   label: "Order Sheet", icon: ShoppingCart  },
    { key: "history",  label: "History",     icon: History       },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">King&apos;s BBQ, Burgers, &amp; More</p>
        </div>

        <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading inventory...</div>
        ) : (<>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Products", value: products.length,                                                        icon: Package,       color: "text-primary"    },
                  { label: "With Par Set",   value: products.filter(p => p.par_slot1 ?? p.par_level).length,               icon: TrendingUp,    color: "text-green-400"  },
                  { label: "Dual Par Items", value: products.filter(p => p.par_slot2 != null).length,                      icon: TrendingUp,    color: "text-blue-400"   },
                  { label: "Need Prices",    value: products.filter(p => p.product_vendors.every(pv => !pv.price)).length, icon: AlertTriangle, color: "text-yellow-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label}><CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
                  </CardContent></Card>
                ))}
              </div>

              {/* Storage Locations */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Storage Locations</CardTitle>
                    <button onClick={() => setAddingLoc(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                      <Plus className="w-3.5 h-3.5" /> Add Location
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Order these top-to-bottom to define your walk-route. Items in Count Entry will follow this order.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {locError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-0.5">Failed to save location</p>
                        <p className="text-red-300/80">{locError}</p>
                        {locError.includes("does not exist") || locError.includes("relation") ? (
                          <p className="mt-1 text-red-300/60">The <code>storage_locations</code> table hasn&apos;t been created yet. Run the SQL migration in your Supabase dashboard → SQL Editor.</p>
                        ) : null}
                      </div>
                      <button onClick={() => setLocError(null)} className="ml-auto flex-shrink-0 text-red-400/60 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                  {addingLoc && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <input value={newLocName} onChange={e => setNewLocName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addLocation(); if (e.key === "Escape") setAddingLoc(false); }}
                        placeholder="e.g. Walk-In Cooler, Dry Storage, Line..."
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                      <button onClick={addLocation} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setAddingLoc(false); setNewLocName(""); }} className="p-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {storageLocations.length === 0 && !addingLoc && (
                    <p className="text-sm text-muted-foreground italic py-2">No locations yet. Add your walk-route stops above.</p>
                  )}

                  {storageLocations.map((loc, idx) => (
                    <div key={loc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveLocation(loc.id, "up")} disabled={idx === 0}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => moveLocation(loc.id, "down")} disabled={idx === storageLocations.length - 1}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground w-5 text-center font-mono">{idx + 1}</span>
                      {editingLocId === loc.id ? (
                        <>
                          <input value={editLocName} onChange={e => setEditLocName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveLocName(loc.id); if (e.key === "Escape") setEditingLocId(null); }}
                            autoFocus className="flex-1 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                          <button onClick={() => saveLocName(loc.id)} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingLocId(null)} className="p-1.5 rounded bg-secondary text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium">{loc.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {products.filter(p => p.location_ids.includes(loc.id)).length} items
                          </span>
                          <button onClick={() => { setEditingLocId(loc.id); setEditLocName(loc.name); }}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteLocation(loc.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-secondary">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Vendors */}
              <Card>
                <CardHeader><CardTitle>Vendors &amp; Delivery Days</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {vendors.map(v => (
                    <div key={v.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{v.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${v.order_frequency === "twice_weekly" ? "bg-primary/10 text-primary" : "bg-secondary-foreground/10 text-muted-foreground"}`}>
                            {v.order_frequency === "twice_weekly" ? "2× / week" : "Weekly"}
                          </span>
                        </div>
                        {editingVendorId === v.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveVendorDays(v.id)} disabled={savingVendor} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingVendorId(null)} className="p-1.5 rounded bg-secondary text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingVendorId(v.id); setEditVendorDays(v.delivery_days ?? []); }} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                      {editingVendorId === v.id ? (
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map(day => {
                            const on = editVendorDays.includes(day);
                            return (
                              <button key={day} onClick={() => setEditVendorDays(prev =>
                                on ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b))
                              )} className={`px-3 py-1 text-xs rounded-full border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(v.delivery_days ?? []).length > 0
                            ? v.delivery_days.map(day => <span key={day} className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{day}</span>)
                            : <span className="text-xs text-muted-foreground italic">No delivery days set</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── PRODUCTS ── */}
          {tab === "products" && (
            <div>
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <span className="px-3 py-2 text-sm text-muted-foreground">{filtered.length} items</span>
                <button
                  onClick={() => { setLocMode(m => !m); setEditingId(null); setEditBuf({}); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    locMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {locMode ? "Done assigning" : "Assign Locations"}
                </button>
              </div>

              {/* ── LOCATION ASSIGNMENT MATRIX ── */}
              {locMode && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">Click a checkbox to assign a product to a storage location. Changes save instantly.</p>
                    {storageLocations.length === 0 && (
                      <span className="text-sm text-muted-foreground italic">— add locations in Overview first</span>
                    )}
                  </div>
                  {storageLocations.length > 0 && (
                    <div className="rounded-xl border border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary border-b border-border">
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground sticky left-0 bg-secondary z-10 min-w-[160px]">Product</th>
                            <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Category</th>
                            {storageLocations.map(loc => (
                              <th key={loc.id} className="px-4 py-3 text-xs font-medium text-center" style={{ minWidth: "110px" }}>
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-muted-foreground">{loc.name}</span>
                                  <span className="text-xs text-muted-foreground/50">
                                    {filtered.filter(p => p.location_ids.includes(loc.id)).length} items
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((p, i) => (
                            <tr key={p.id} className={`border-b border-border ${i % 2 === 0 ? "bg-background" : "bg-card"}`}>
                              <td className={`px-4 py-2.5 font-medium sticky left-0 z-10 ${i % 2 === 0 ? "bg-background" : "bg-card"}`}>
                                {p.name}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.category_name}</td>
                              {storageLocations.map(loc => {
                                const checked = p.location_ids.includes(loc.id);
                                return (
                                  <td key={loc.id} className="px-4 py-2.5 text-center">
                                    <button
                                      onClick={() => toggleProductLocation(p, loc.id)}
                                      className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                        checked
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-border bg-secondary hover:border-primary/50"
                                      }`}
                                    >
                                      {checked && <Check className="w-3 h-3" />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Par — Del. 1</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Par — Del. 2</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Storage</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Vendors</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const pVendor = getVendorForProduct(p, vendors);
                      const isTwice = pVendor?.order_frequency === "twice_weekly";
                      const d1 = slotDayLabel(pVendor, 1);
                      const d2 = slotDayLabel(pVendor, 2);
                      const pLocations = storageLocations.filter(l => p.location_ids.includes(l.id));

                      return (
                        <tr key={p.id} className={`border-b border-border ${i % 2 === 0 ? "bg-background" : "bg-card"}`}>
                          {editingId === p.id ? (
                            <>
                              <td className="px-4 py-2">
                                <input value={editBuf.name ?? p.name} onChange={e => setEditBuf(b => ({ ...b, name: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <select value={editBuf.category_id ?? p.category_id} onChange={e => setEditBuf(b => ({ ...b, category_id: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none">
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input value={editBuf.unit ?? p.unit} onChange={e => setEditBuf(b => ({ ...b, unit: e.target.value }))}
                                  className="w-20 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">{d1}</span>
                                  <input type="number" step="0.5"
                                    value={(editBuf.par_slot1 !== undefined ? editBuf.par_slot1 : (p.par_slot1 ?? p.par_level)) ?? ""}
                                    onChange={e => setEditBuf(b => ({ ...b, par_slot1: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                                    placeholder="—" className="w-20 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">{isTwice ? d2 : "Weekly vendor"}</span>
                                  {isTwice ? (
                                    <>
                                      <input type="number" step="0.5"
                                        value={(editBuf.par_slot2 !== undefined ? editBuf.par_slot2 : p.par_slot2) ?? ""}
                                        onChange={e => setEditBuf(b => ({ ...b, par_slot2: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                                        placeholder="same as del. 1" className="w-28 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                                      <span className="text-xs text-muted-foreground">blank = use del. 1 par</span>
                                    </>
                                  ) : <span className="text-xs text-muted-foreground italic">N/A</span>}
                                </div>
                              </td>
                              {/* Location checkboxes */}
                              <td className="px-4 py-2">
                                {storageLocations.length === 0 ? (
                                  <span className="text-xs text-muted-foreground italic">No locations set up</span>
                                ) : (
                                  <div className="space-y-1">
                                    {storageLocations.map(loc => {
                                      const currentIds = editBuf.location_ids ?? p.location_ids;
                                      const checked = currentIds.includes(loc.id);
                                      return (
                                        <label key={loc.id} className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="checkbox" checked={checked}
                                            onChange={() => setEditBuf(b => {
                                              const ids = b.location_ids ?? p.location_ids;
                                              return { ...b, location_ids: checked ? ids.filter(id => id !== loc.id) : [...ids, loc.id] };
                                            })}
                                            className="rounded" />
                                          <span className="text-xs text-muted-foreground">{loc.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <div className="space-y-1">
                                  {p.product_vendors.map(pv => (
                                    <div key={pv.id} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-24 truncate">{pv.vendor_name}</span>
                                      <span className="text-xs text-muted-foreground">$</span>
                                      <input type="number" step="0.01" placeholder="0.00"
                                        value={(editBuf.prices?.[pv.id]) ?? (pv.price?.toString() ?? "")}
                                        onChange={e => setEditBuf(b => ({ ...b, prices: { ...(b.prices || {}), [pv.id]: e.target.value } }))}
                                        className="w-18 px-2 py-0.5 text-sm rounded bg-secondary border border-ring focus:outline-none" />
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex gap-1">
                                  <button onClick={() => saveEdit(p)} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => { setEditingId(null); setEditBuf({}); }} className="p-1.5 rounded bg-secondary text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 font-medium">{p.name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{p.category_name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{p.unit}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-col gap-0.5">
                                  {(p.par_slot1 ?? p.par_level) != null
                                    ? <span className="text-sm font-medium">{p.par_slot1 ?? p.par_level}</span>
                                    : <span className="text-xs text-muted-foreground">not set</span>}
                                  {pVendor && d1 !== "Slot 1" && <span className="text-xs text-muted-foreground">{shortDay(d1)}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {isTwice ? (
                                  p.par_slot2 != null ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-sm font-medium text-blue-400">{p.par_slot2}</span>
                                      {d2 !== "Slot 2" && <span className="text-xs text-muted-foreground">{shortDay(d2)}</span>}
                                    </div>
                                  ) : <span className="text-xs text-muted-foreground italic">same as del. 1</span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {pLocations.length > 0
                                    ? pLocations.map(l => (
                                      <span key={l.id} className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">{l.name}</span>
                                    ))
                                    : <span className="text-xs text-muted-foreground">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {p.product_vendors.map(pv => (
                                    <span key={pv.id} className={`text-xs px-1.5 py-0.5 rounded ${pv.price ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                                      {pv.vendor_name}{pv.price ? ` $${pv.price.toFixed(2)}` : ""}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => { setEditingId(p.id); setEditBuf({}); }}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COUNT ENTRY ── */}
          {tab === "count" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Count Entry</h2>
                  <p className="text-sm text-muted-foreground">
                    {countMode === "location"
                      ? "Grouped by storage location — follow the route top to bottom."
                      : "Grouped by category."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mode toggle */}
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    <button onClick={() => setCountMode("location")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${countMode === "location" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      <MapPin className="w-3.5 h-3.5" /> By Location
                    </button>
                    <button onClick={() => setCountMode("category")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${countMode === "category" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      <LayoutGrid className="w-3.5 h-3.5" /> By Category
                    </button>
                  </div>
                  {/* Delivery slot */}
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {([1, 2] as const).map(s => (
                      <button key={s} onClick={() => setCountSlot(s)}
                        className={`px-4 py-1.5 text-sm font-medium transition-colors ${countSlot === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {slotToggleLabel(s)}
                      </button>
                    ))}
                  </div>
                  <button onClick={submitCount} disabled={countSubmitting}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {countSubmitting ? "Submitting..." : "Submit Count"}
                  </button>
                </div>
              </div>

              {/* BY LOCATION */}
              {countMode === "location" && (
                <div>
                  {storageLocations.length === 0 && (
                    <Card><CardContent className="p-6 text-center text-muted-foreground">
                      No storage locations set up yet. Go to Overview → Storage Locations to add your walk-route.
                    </CardContent></Card>
                  )}

                  {storageLocations.map((loc, locIdx) => {
                    const locProducts = products.filter(p => p.location_ids.includes(loc.id));
                    if (locProducts.length === 0) return null;
                    return (
                      <div key={loc.id} className="mb-5">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">{locIdx + 1}</span>
                          <h3 className="text-sm font-semibold uppercase tracking-wide">{loc.name}</h3>
                          <span className="text-xs text-muted-foreground">{locProducts.length} items</span>
                        </div>
                        <div className="rounded-xl border border-border overflow-hidden">
                          {locProducts.map((p, i) => {
                            const key = `${p.id}::${loc.id}`;
                            const par = getEffectivePar(p, countSlot);
                            const otherLocs = storageLocations.filter(l => l.id !== loc.id && p.location_ids.includes(l.id));
                            const pVendor = getVendorForProduct(p, vendors);
                            const isTwice = pVendor?.order_frequency === "twice_weekly";
                            const dayLabel = isTwice ? slotDayLabel(pVendor, countSlot) : (pVendor?.delivery_days?.[0] ?? "");
                            return (
                              <div key={key}
                                className={`flex items-center gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-background" : "bg-card"} ${i !== locProducts.length - 1 ? "border-b border-border" : ""}`}>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium">{p.name}</span>
                                  {otherLocs.length > 0 && (
                                    <span className="ml-2 text-xs text-orange-400">+{otherLocs.map(l => l.name).join(", ")}</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">{p.unit}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-xs text-muted-foreground">par: {par ?? "—"}</span>
                                  {dayLabel && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isTwice && countSlot === 2 ? "bg-blue-500/20 text-blue-400" : "bg-secondary text-muted-foreground"}`}>
                                      {shortDay(dayLabel)}
                                    </span>
                                  )}
                                </div>
                                <input type="number" step="0.5" min="0"
                                  value={locCountEntries[key] ?? ""}
                                  onChange={e => setLocCountEntries(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="qty here"
                                  className="w-24 px-2 py-1 text-sm text-right rounded bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned products */}
                  {(() => {
                    const unassigned = products.filter(p => p.location_ids.length === 0);
                    if (unassigned.length === 0) return null;
                    return (
                      <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <List className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Unassigned</h3>
                          <span className="text-xs text-muted-foreground">{unassigned.length} items — assign storage locations in Products tab</span>
                        </div>
                        <div className="rounded-xl border border-border overflow-hidden opacity-60">
                          {unassigned.map((p, i) => {
                            const key = `${p.id}::none`;
                            const par = getEffectivePar(p, countSlot);
                            return (
                              <div key={key}
                                className={`flex items-center gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-background" : "bg-card"} ${i !== unassigned.length - 1 ? "border-b border-border" : ""}`}>
                                <span className="flex-1 text-sm font-medium">{p.name}</span>
                                <span className="text-xs text-muted-foreground w-12 text-right">{p.unit}</span>
                                <span className="text-xs text-muted-foreground">par: {par ?? "—"}</span>
                                <input type="number" step="0.5" min="0"
                                  value={locCountEntries[key] ?? ""}
                                  onChange={e => setLocCountEntries(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="qty here"
                                  className="w-24 px-2 py-1 text-sm text-right rounded bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* BY CATEGORY */}
              {countMode === "category" && categories.map(cat => {
                const catProducts = products.filter(p => p.category_name === cat.name);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{cat.name}</h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {catProducts.map((p, i) => {
                        const entry = countEntries.find(e => e.product_id === p.id);
                        const par = getEffectivePar(p, countSlot);
                        return (
                          <div key={p.id}
                            className={`flex items-center gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-background" : "bg-card"} ${i !== catProducts.length - 1 ? "border-b border-border" : ""}`}>
                            <span className="flex-1 text-sm font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground w-12 text-right">{p.unit}</span>
                            <span className="text-xs text-muted-foreground">par: {par ?? "—"}</span>
                            <input type="number" step="0.5" min="0"
                              value={entry?.quantity ?? ""}
                              onChange={e => setCountEntries(prev => prev.map(ce => ce.product_id === p.id ? { ...ce, quantity: e.target.value } : ce))}
                              placeholder="On hand"
                              className="w-24 px-2 py-1 text-sm text-right rounded bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ORDER SHEET ── */}
          {tab === "orders" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Order Sheet</h2>
                  <p className="text-sm text-muted-foreground">Par vs latest count. Lowest-price vendor per item.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg overflow-hidden border border-border">
                    {([1, 2] as const).map(s => (
                      <button key={s} onClick={() => setOrdersSlot(s)}
                        className={`px-4 py-1.5 text-sm font-medium transition-colors ${ordersSlot === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {slotToggleLabel(s)}
                      </button>
                    ))}
                  </div>
                  <button onClick={saveOrder} disabled={savingOrder || orderSaved || Object.keys(orderData).length === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${orderSaved ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"}`}>
                    <Save className="w-3.5 h-3.5" />
                    {savingOrder ? "Saving..." : orderSaved ? "Saved" : "Save Order"}
                  </button>
                  <button onClick={() => window.print()} className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80">Print</button>
                </div>
              </div>

              {Object.keys(orderData).length === 0 ? (
                <Card><CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No orders to generate.</p>
                  <p className="text-sm text-muted-foreground mt-1">Submit a count and set par levels to generate orders.</p>
                </CardContent></Card>
              ) : (
                Object.entries(orderData).map(([vendorName, { items }]) => {
                  const total = items.reduce((sum, item) => sum + (item.price ? item.price * item.toOrder : 0), 0);
                  const v = vendors.find(vv => vv.name === vendorName);
                  return (
                    <Card key={vendorName} className="mb-4">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CardTitle>{vendorName}</CardTitle>
                            {v && (v.delivery_days ?? []).length > 0 && (
                              <span className="text-xs text-muted-foreground">Delivers: {v.delivery_days.join(", ")}</span>
                            )}
                          </div>
                          {total > 0 && <span className="text-sm font-semibold text-primary">Est. ${total.toFixed(2)}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              {["Product","Unit","Par","On Hand","To Order","Unit Price","Total"].map(h => (
                                <th key={h} className={`pb-2 text-xs text-muted-foreground font-medium ${h === "Product" ? "text-left" : "text-right"}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any) => (
                              <tr key={item.id} className="border-b border-border/50">
                                <td className="py-2 font-medium">{item.name}</td>
                                <td className="py-2 text-right text-muted-foreground">{item.unit}</td>
                                <td className="py-2 text-right text-muted-foreground">{item.par}</td>
                                <td className="py-2 text-right text-muted-foreground">—</td>
                                <td className="py-2 text-right font-bold text-primary">{item.toOrder}</td>
                                <td className="py-2 text-right text-muted-foreground">{item.price ? `$${item.price.toFixed(2)}` : "—"}</td>
                                <td className="py-2 text-right">{item.price ? `$${(item.price * item.toOrder).toFixed(2)}` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && (
            <div>
              <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
                {(["counts","orders"] as HistoryView[]).map(v => (
                  <button key={v} onClick={() => setHistoryView(v)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${historyView === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {v === "counts" ? "Count History" : "Order History"}
                  </button>
                ))}
              </div>

              {historyLoading ? (
                <div className="text-center text-muted-foreground py-12">Loading history...</div>
              ) : historyView === "counts" ? (
                <div className="space-y-3">
                  {Object.keys(countsByDate).length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">No counts submitted yet.</CardContent></Card>
                  ) : Object.entries(countsByDate).map(([date, rows]) => {
                    const isOpen = expandedDates.has(date);
                    return (
                      <Card key={date}>
                        <button className="w-full text-left" onClick={() => setExpandedDates(prev => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; })}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CardTitle className="text-base">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</CardTitle>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{rows.length} items</span>
                              </div>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </CardHeader>
                        </button>
                        {isOpen && (
                          <CardContent className="pt-0">
                            <table className="w-full text-sm">
                              <thead><tr className="border-b border-border">
                                <th className="text-left pb-2 text-xs text-muted-foreground font-medium">Product</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">On Hand</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">Delivery</th>
                              </tr></thead>
                              <tbody>
                                {rows.map(r => {
                                  const prod = products.find(p => p.id === r.product_id);
                                  return (
                                    <tr key={r.id} className="border-b border-border/40">
                                      <td className="py-1.5 font-medium">{prod?.name ?? r.product_id}</td>
                                      <td className="py-1.5 text-right">{r.quantity_on_hand} {prod?.unit ?? ""}</td>
                                      <td className="py-1.5 text-right text-muted-foreground text-xs">Slot {r.order_slot}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">No saved orders yet. Use "Save Order" on the Order Sheet tab.</CardContent></Card>
                  ) : orderHistory.map(order => {
                    const isOpen = expandedOrders.has(order.id);
                    return (
                      <Card key={order.id}>
                        <button className="w-full text-left" onClick={() => setExpandedOrders(prev => { const n = new Set(prev); n.has(order.id) ? n.delete(order.id) : n.add(order.id); return n; })}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CardTitle className="text-base">{order.vendor_name}</CardTitle>
                                <span className="text-xs text-muted-foreground">{new Date(order.order_date + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Slot {order.slot} · {order.items.length} items</span>
                                {order.estimated_total && <span className="text-xs font-semibold text-primary">Est. ${order.estimated_total.toFixed(2)}</span>}
                              </div>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </CardHeader>
                        </button>
                        {isOpen && (
                          <CardContent className="pt-0">
                            <table className="w-full text-sm">
                              <thead><tr className="border-b border-border">
                                {["Product","Unit","Par","Ordered","Unit $","Line $"].map(h => (
                                  <th key={h} className={`pb-2 text-xs text-muted-foreground font-medium ${h === "Product" ? "text-left" : "text-right"}`}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {order.items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-border/40">
                                    <td className="py-1.5 font-medium">{item.name}</td>
                                    <td className="py-1.5 text-right text-muted-foreground">{item.unit}</td>
                                    <td className="py-1.5 text-right text-muted-foreground">{item.par}</td>
                                    <td className="py-1.5 text-right font-bold text-primary">{item.to_order}</td>
                                    <td className="py-1.5 text-right text-muted-foreground">{item.price ? `$${item.price.toFixed(2)}` : "—"}</td>
                                    <td className="py-1.5 text-right">{item.price ? `$${(item.price * item.to_order).toFixed(2)}` : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </>)}
      </main>
    </div>
  );
}
