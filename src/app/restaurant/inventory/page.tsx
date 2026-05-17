"use client";

/*
  SUPABASE MIGRATION — run once in the SQL Editor before deploying:

  ALTER TABLE products ADD COLUMN IF NOT EXISTS par_slot1 numeric;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS par_slot2 numeric;
  UPDATE products SET par_slot1 = par_level WHERE par_level IS NOT NULL AND par_slot1 IS NULL;
*/

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import {
  Package, ClipboardList, ShoppingCart, Settings,
  Pencil, Check, X, AlertTriangle, TrendingUp, Search,
} from "lucide-react";

type Tab = "overview" | "products" | "count" | "orders";

interface Vendor { id: string; name: string; order_frequency: string; }
interface Category { id: string; name: string; }
interface ProductVendor { id: string; vendor_id: string; vendor_name: string; price: number | null; }
interface Product {
  id: string; name: string; category_id: string; category_name: string;
  unit: string;
  par_level: number | null;   // legacy fallback
  par_slot1: number | null;   // Tue delivery (midweek)
  par_slot2: number | null;   // Fri delivery (weekend — higher)
  par_auto: boolean;
  product_vendors: ProductVendor[];
}
interface CountEntry { product_id: string; quantity: string; }

// Returns the effective par for the given delivery slot.
// Slot 2 uses par_slot2 if set, otherwise falls back to slot1/legacy.
function getEffectivePar(p: Product, slot: 1 | 2): number | null {
  if (slot === 2 && p.par_slot2 != null) return p.par_slot2;
  return p.par_slot1 ?? p.par_level;
}

function hasTwiceWeeklyVendor(p: Product, vendors: Vendor[]): boolean {
  return p.product_vendors.some(pv =>
    vendors.find(v => v.id === pv.vendor_id)?.order_frequency === "twice_weekly"
  );
}

function parDisplay(p: Product, vendors: Vendor[]): string {
  const s1 = p.par_slot1 ?? p.par_level;
  if (!hasTwiceWeeklyVendor(p, vendors) || p.par_slot2 == null) {
    return s1 != null ? String(s1) : "—";
  }
  return `Tue: ${s1 ?? "—"}  /  Fri: ${p.par_slot2}`;
}

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<Product & { prices: Record<string, string> }>>({});
  const [countEntries, setCountEntries] = useState<CountEntry[]>([]);
  const [countSlot, setCountSlot] = useState<1 | 2>(1);
  const [countSubmitting, setCountSubmitting] = useState(false);
  const [ordersSlot, setOrdersSlot] = useState<1 | 2>(1);
  const [orderData, setOrderData] = useState<Record<string, { items: (Product & { toOrder: number; price: number | null; vendor: string; par: number })[] }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: vData }, { data: cData }, { data: pData }, { data: pvData }] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("*, categories(name)").order("name"),
      supabase.from("product_vendors").select("*, vendors(name)"),
    ]);

    setVendors(vData || []);
    setCategories(cData || []);

    const pvMap: Record<string, ProductVendor[]> = {};
    (pvData || []).forEach((pv: any) => {
      if (!pvMap[pv.product_id]) pvMap[pv.product_id] = [];
      pvMap[pv.product_id].push({ id: pv.id, vendor_id: pv.vendor_id, vendor_name: pv.vendors?.name, price: pv.price });
    });

    const enriched: Product[] = (pData || []).map((p: any) => ({
      ...p,
      category_name: p.categories?.name || "",
      product_vendors: pvMap[p.id] || [],
    }));

    setProducts(enriched);
    setCountEntries(enriched.map(p => ({ product_id: p.id, quantity: "" })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── ORDER GENERATION ──────────────────────────────────────────────────────

  const generateOrders = useCallback(async (slot: 1 | 2) => {
    const { data: latestCounts } = await supabase
      .from("inventory_counts")
      .select("product_id, quantity_on_hand, count_date, order_slot")
      .order("count_date", { ascending: false });

    // Prefer counts from the matching slot; fall back to any slot
    const latestByProduct: Record<string, number> = {};
    const slotCounts: typeof latestCounts = (latestCounts || []).filter((c: any) => c.order_slot === slot);
    const anyCounts: typeof latestCounts = latestCounts || [];

    [...anyCounts].forEach((c: any) => {
      if (!(c.product_id in latestByProduct)) latestByProduct[c.product_id] = c.quantity_on_hand;
    });
    // Override with slot-specific counts where available
    slotCounts.forEach((c: any) => { latestByProduct[c.product_id] = c.quantity_on_hand; });

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
  }, [products]);

  useEffect(() => {
    if (tab === "orders") generateOrders(ordersSlot);
  }, [tab, products, ordersSlot, generateOrders]);

  // ── SAVE EDIT ─────────────────────────────────────────────────────────────

  const saveEdit = async (p: Product) => {
    await supabase.from("products").update({
      name: editBuf.name ?? p.name,
      unit: editBuf.unit ?? p.unit,
      par_level: editBuf.par_slot1 ?? p.par_slot1 ?? p.par_level,
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

    setEditingId(null);
    setEditBuf({});
    loadData();
  };

  // ── SUBMIT COUNT ──────────────────────────────────────────────────────────

  const submitCount = async () => {
    setCountSubmitting(true);
    const filled = countEntries.filter(e => e.quantity !== "");
    const today = new Date().toISOString().split("T")[0];

    for (const entry of filled) {
      const product = products.find(p => p.id === entry.product_id);
      const isTwice = product ? hasTwiceWeeklyVendor(product, vendors) : false;
      const slot = isTwice ? countSlot : 1;
      await supabase.from("inventory_counts").insert({
        product_id: entry.product_id,
        quantity_on_hand: parseFloat(entry.quantity),
        count_date: today,
        order_slot: slot,
      });
    }

    setCountSubmitting(false);
    alert(`Count submitted for ${filled.length} items.`);
    setCountEntries(products.map(p => ({ product_id: p.id, quantity: "" })));
  };

  const filtered = products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.category_name === filterCat)
  );

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview",    icon: Package      },
    { key: "products", label: "Products",    icon: Settings     },
    { key: "count",    label: "Count Entry", icon: ClipboardList },
    { key: "orders",   label: "Order Sheet", icon: ShoppingCart },
  ];

  const slotLabel = (s: 1 | 2) => s === 1 ? "Slot 1 — Tue Delivery" : "Slot 2 — Fri Delivery (Weekend)";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">King&apos;s BBQ, Burgers, &amp; More</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading inventory...</div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Products", value: products.length,                                                                icon: Package,       color: "text-primary"      },
                    { label: "With Par Set",   value: products.filter(p => p.par_slot1 ?? p.par_level).length,                       icon: TrendingUp,    color: "text-green-400"    },
                    { label: "Dual Par Items", value: products.filter(p => p.par_slot2 != null).length,                              icon: TrendingUp,    color: "text-blue-400"     },
                    { label: "Need Prices",    value: products.filter(p => p.product_vendors.every(pv => !pv.price)).length,         icon: AlertTriangle, color: "text-yellow-400"   },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-2xl font-bold">{value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader><CardTitle>Vendors</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {vendors.map(v => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                          <span className="text-sm font-medium">{v.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            v.order_frequency === "twice_weekly"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary-foreground/10 text-muted-foreground"
                          }`}>
                            {v.order_frequency === "twice_weekly" ? "2x / week" : "Weekly"}
                          </span>
                        </div>
                      ))}
                    </div>
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
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <select
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <span className="px-3 py-2 text-sm text-muted-foreground">{filtered.length} items</span>
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary border-b border-border">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Unit</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Par — Tue Delivery</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Par — Fri Delivery</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Vendors &amp; Prices</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr key={p.id} className={`border-b border-border ${i % 2 === 0 ? "bg-background" : "bg-card"}`}>
                          {editingId === p.id ? (
                            <>
                              {/* Name */}
                              <td className="px-4 py-2">
                                <input
                                  value={editBuf.name ?? p.name}
                                  onChange={e => setEditBuf(b => ({ ...b, name: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                />
                              </td>
                              {/* Category */}
                              <td className="px-4 py-2">
                                <select
                                  value={editBuf.category_id ?? p.category_id}
                                  onChange={e => setEditBuf(b => ({ ...b, category_id: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                >
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </td>
                              {/* Unit */}
                              <td className="px-4 py-2">
                                <input
                                  value={editBuf.unit ?? p.unit}
                                  onChange={e => setEditBuf(b => ({ ...b, unit: e.target.value }))}
                                  className="w-20 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                />
                              </td>
                              {/* Par Slot 1 — Tue */}
                              <td className="px-4 py-2">
                                <input
                                  type="number" step="0.5"
                                  value={(editBuf.par_slot1 !== undefined ? editBuf.par_slot1 : (p.par_slot1 ?? p.par_level)) ?? ""}
                                  onChange={e => setEditBuf(b => ({ ...b, par_slot1: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                                  placeholder="—"
                                  className="w-20 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                />
                              </td>
                              {/* Par Slot 2 — Fri */}
                              <td className="px-4 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    type="number" step="0.5"
                                    value={(editBuf.par_slot2 !== undefined ? editBuf.par_slot2 : p.par_slot2) ?? ""}
                                    onChange={e => setEditBuf(b => ({ ...b, par_slot2: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                                    placeholder="same as Tue"
                                    className="w-28 px-2 py-1 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                  />
                                  {hasTwiceWeeklyVendor(p, vendors) && (
                                    <span className="text-xs text-muted-foreground">blank = use Tue par</span>
                                  )}
                                </div>
                              </td>
                              {/* Prices */}
                              <td className="px-4 py-2">
                                <div className="space-y-1">
                                  {p.product_vendors.map(pv => (
                                    <div key={pv.id} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-28 truncate">{pv.vendor_name}</span>
                                      <span className="text-xs text-muted-foreground">$</span>
                                      <input
                                        type="number" step="0.01" placeholder="0.00"
                                        value={(editBuf.prices?.[pv.id]) ?? (pv.price?.toString() ?? "")}
                                        onChange={e => setEditBuf(b => ({ ...b, prices: { ...(b.prices || {}), [pv.id]: e.target.value } }))}
                                        className="w-20 px-2 py-0.5 text-sm rounded bg-secondary border border-ring focus:outline-none"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-2">
                                <div className="flex gap-1">
                                  <button onClick={() => saveEdit(p)} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditBuf({}); }} className="p-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 font-medium">{p.name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{p.category_name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{p.unit}</td>
                              {/* Par slot 1 */}
                              <td className="px-4 py-2.5">
                                {(p.par_slot1 ?? p.par_level) != null
                                  ? <span className="text-sm font-medium">{p.par_slot1 ?? p.par_level}</span>
                                  : <span className="text-xs text-muted-foreground">not set</span>}
                              </td>
                              {/* Par slot 2 */}
                              <td className="px-4 py-2.5">
                                {p.par_slot2 != null ? (
                                  <span className="text-sm font-medium text-blue-400">{p.par_slot2}</span>
                                ) : hasTwiceWeeklyVendor(p, vendors) ? (
                                  <span className="text-xs text-muted-foreground italic">same as Tue</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              {/* Vendors */}
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
                                <button
                                  onClick={() => { setEditingId(p.id); setEditBuf({}); }}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
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
                    <p className="text-sm text-muted-foreground">Enter on-hand quantities. Par shown for selected delivery slot.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-lg overflow-hidden border border-border">
                      {([1, 2] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setCountSlot(s)}
                          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                            countSlot === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s === 1 ? "Tue Delivery" : "Fri Delivery"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={submitCount}
                      disabled={countSubmitting}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {countSubmitting ? "Submitting..." : "Submit Count"}
                    </button>
                  </div>
                </div>

                {categories.map(cat => {
                  const catProducts = products.filter(p => p.category_name === cat.name);
                  if (catProducts.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{cat.name}</h3>
                      <div className="rounded-xl border border-border overflow-hidden">
                        {catProducts.map((p, i) => {
                          const entry = countEntries.find(e => e.product_id === p.id);
                          const par = getEffectivePar(p, countSlot);
                          const isDual = hasTwiceWeeklyVendor(p, vendors) && p.par_slot2 != null;
                          return (
                            <div key={p.id} className={`flex items-center gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-background" : "bg-card"} ${i !== catProducts.length - 1 ? "border-b border-border" : ""}`}>
                              <span className="flex-1 text-sm font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground w-12 text-right">{p.unit}</span>
                              <div className="text-right w-36">
                                <span className="text-xs text-muted-foreground">
                                  par: {par ?? "—"}
                                </span>
                                {isDual && (
                                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                                    countSlot === 2 ? "bg-blue-500/20 text-blue-400" : "bg-secondary text-muted-foreground"
                                  }`}>
                                    {countSlot === 2 ? "Fri/wknd" : "Tue"}
                                  </span>
                                )}
                              </div>
                              <input
                                type="number" step="0.5" min="0"
                                value={entry?.quantity ?? ""}
                                onChange={e => setCountEntries(prev => prev.map(ce =>
                                  ce.product_id === p.id ? { ...ce, quantity: e.target.value } : ce
                                ))}
                                placeholder="On hand"
                                className="w-24 px-2 py-1 text-sm text-right rounded bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                              />
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
                    <p className="text-sm text-muted-foreground">
                      Par for <span className="font-medium text-foreground">{slotLabel(ordersSlot)}</span> vs latest count. Lowest-price vendor per item.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-lg overflow-hidden border border-border">
                      {([1, 2] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setOrdersSlot(s)}
                          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                            ordersSlot === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s === 1 ? "Tue Delivery" : "Fri Delivery"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80"
                    >
                      Print
                    </button>
                  </div>
                </div>

                {Object.keys(orderData).length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No orders to generate.</p>
                      <p className="text-sm text-muted-foreground mt-1">Submit a count and set par levels to generate orders.</p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(orderData).map(([vendorName, { items }]) => {
                    const total = items.reduce((sum, item) => sum + (item.price ? item.price * item.toOrder : 0), 0);
                    return (
                      <Card key={vendorName} className="mb-4">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>{vendorName}</CardTitle>
                            {total > 0 && (
                              <span className="text-sm font-semibold text-primary">Est. ${total.toFixed(2)}</span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left pb-2 text-xs text-muted-foreground font-medium">Product</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">Unit</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">Par</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">On Hand</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">To Order</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">Unit Price</th>
                                <th className="text-right pb-2 text-xs text-muted-foreground font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(item => (
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
          </>
        )}
      </main>
    </div>
  );
}
