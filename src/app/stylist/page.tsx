"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  Shirt, RefreshCw, Calendar, Plus, X, Sparkles,
  Loader2, CloudSun, History, Zap, ChevronDown, ChevronUp, Link, Trash2, Eye, Pencil, Settings,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SplitResultItem {
  name: string;
  type: string;
  color: string;
  brand: string | null;
  occasions: string[];
  image_url: string | null;
}

interface WardrobeItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  brand: string | null;
  size: string | null;
  occasions: string[];
  notes: string | null;
  image_url: string | null;
  created_at: string;
}

interface PromptTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
}

interface WearLog {
  id: string;
  item_id: string;
  worn_date: string;
}

interface OutfitRecord {
  id: string;
  worn_date: string;
  activities: string[];
  weather_summary: string | null;
  ai_suggestion: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_TYPES = ["Top", "Bottom", "Shoes", "Outerwear", "Dress/Jumpsuit", "Accessory", "Hat", "Bag"];
const NEVER_DIRTY_TYPES = new Set(["Shoes", "Accessory", "Hat", "Bag"]);
const OUTERWEAR_WEAR_LIMIT = 3;
const OCCASIONS = ["Casual", "Work", "Gym", "Going Out", "Date Night", "Errands", "Church", "Travel", "Formal"];
const ACTIVITIES = ["Work", "Gym", "Going Out", "Date Night", "Errands", "Casual Day", "Church", "Travel"];

const BLANK_ITEM = {
  name: "", type: "Top", color: "", brand: "", size: "",
  occasions: [] as string[], notes: "", image_url: "",
};

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-all ${
        active
          ? "border-green-400 text-green-300 bg-green-500/20"
          : "border-green-500/20 text-green-700 hover:border-green-500/40 hover:text-green-600"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item, isDirty, onMarkWorn, onMarkClean, onDelete, onEdit }: {
  item: WardrobeItem;
  isDirty: boolean;
  onMarkWorn: (id: string) => void;
  onMarkClean: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: WardrobeItem) => void;
}) {
  return (
    <div className={`holo-card rounded-xl border overflow-hidden transition-all ${
      isDirty ? "border-red-500/20 bg-red-500/5" : "border-green-500/20 bg-black/40"
    }`}>
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-36 object-cover object-top"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-bold text-green-300 truncate">{item.name}</p>
            {item.brand && <p className="text-xs text-green-700 font-mono">{item.brand}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button
              onClick={() => onEdit(item)}
              className="text-green-900 hover:text-green-400 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="text-green-900 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-xs px-1.5 py-0.5 rounded border border-green-500/20 text-green-700 font-mono">{item.type}</span>
          {item.color && <span className="text-xs px-1.5 py-0.5 rounded border border-green-500/15 text-green-800 font-mono">{item.color}</span>}
          {item.size && <span className="text-xs px-1.5 py-0.5 rounded border border-green-500/15 text-green-800 font-mono">{item.size}</span>}
        </div>

        {item.occasions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.occasions.map(o => (
              <span key={o} className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 font-mono">{o}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-green-500/10">
          {NEVER_DIRTY_TYPES.has(item.type) ? (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/10">
              CLEAN
            </span>
          ) : (
            <>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                isDirty
                  ? "border-red-500/30 text-red-400 bg-red-500/10"
                  : "border-green-500/30 text-green-400 bg-green-500/10"
              }`}>
                {isDirty ? "DIRTY" : "CLEAN"}
              </span>
              <button
                onClick={() => isDirty ? onMarkClean(item.id) : onMarkWorn(item.id)}
                className="text-xs font-mono font-semibold text-green-700 hover:text-green-400 transition-colors"
              >
                {isDirty ? "↺ mark clean" : "✓ mark worn"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StylistPage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [wearLog, setWearLog] = useState<WearLog[]>([]);
  const [lastLaundry, setLastLaundry] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"import" | "manual">("import");
  const [importUrl, setImportUrl] = useState("");
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ ...BLANK_ITEM });
  const [saving, setSaving] = useState(false);

  const [activities, setActivities] = useState<string[]>(["Casual Day"]);
  const [generating, setGenerating] = useState(false);
  const [todayOutfit, setTodayOutfit] = useState<string | null>(null);
  const [weather, setWeather] = useState<{ temp: number; condition: string } | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [laundryConfirm, setLaundryConfirm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [outfitError, setOutfitError] = useState<string | null>(null);
  const [outfitJobId, setOutfitJobId] = useState<string | null>(null);
  const [outfitImage, setOutfitImage] = useState<string | null>(null);
  const [userPhotos, setUserPhotos] = useState<{ id: string; url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [splitJobId, setSplitJobId] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitItems, setSplitItems] = useState<SplitResultItem[] | null>(null);
  const [productMeta, setProductMeta] = useState<{ name?: string; type?: string; brand?: string; color?: string } | null>(null);

  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [promptEdits, setPromptEdits] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(false);

  const [autoApproveOutfit, setAutoApproveOutfit] = useState(false);
  const [outfitItemIds, setOutfitItemIds] = useState<string[]>([]);
  const [outfitApproved, setOutfitApproved] = useState(false);
  const [autoAdd, setAutoAdd] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: itemsData }, { data: resets }, { data: historyData }] = await Promise.all([
      supabase.from("wardrobe_items").select("*").order("created_at", { ascending: false }),
      supabase.from("laundry_resets").select("*").order("reset_at", { ascending: false }).limit(1),
      supabase.from("outfit_history").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

    const lastReset = resets?.[0]?.reset_at ?? null;
    setLastLaundry(lastReset);

    let wearQuery = supabase.from("wear_log").select("*");
    if (lastReset) wearQuery = wearQuery.gte("worn_date", lastReset.split("T")[0]);
    const { data: wears } = await wearQuery;

    const { data: photosData } = await supabase.from("user_photos").select("*").order("created_at", { ascending: false });
    const { data: promptsData } = await supabase.from("prompt_templates").select("*").order("created_at", { ascending: true });

    setItems(itemsData ?? []);
    setWearLog(wears ?? []);
    setOutfitHistory(historyData ?? []);
    setUserPhotos(photosData ?? []);
    if (promptsData?.length) {
      setPrompts(promptsData);
      const edits: Record<string, string> = {};
      promptsData.forEach(p => { edits[p.key] = p.body; });
      setPromptEdits(edits);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { setAutoAnalyze(localStorage.getItem("wardrobeAutoAnalyze") === "true"); }, []);
  useEffect(() => { setAutoApproveOutfit(localStorage.getItem("outfitAutoApprove") === "true"); }, []);
  useEffect(() => { setAutoAdd(localStorage.getItem("wardrobeAutoAdd") === "true"); }, []);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=35.9065&longitude=-80.0065&current_weather=true&temperature_unit=fahrenheit&timezone=America/New_York")
      .then(r => r.json())
      .then(data => {
        const code = data.current_weather?.weathercode ?? 0;
        const label =
          code === 0 ? "Clear" : code <= 3 ? "Partly Cloudy" : code <= 48 ? "Foggy" :
          code <= 67 ? "Rainy" : code <= 77 ? "Snowy" : code <= 82 ? "Showers" : "Stormy";
        setWeather({ temp: Math.round(data.current_weather?.temperature ?? 70), condition: label });
      })
      .catch(() => null);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const wearCounts: Record<string, number> = {};
  wearLog.forEach(w => { wearCounts[w.item_id] = (wearCounts[w.item_id] ?? 0) + 1; });
  const dirtyIds = new Set(
    items.filter(item => {
      if (NEVER_DIRTY_TYPES.has(item.type)) return false;
      const count = wearCounts[item.id] ?? 0;
      if (item.type === "Outerwear") return count >= OUTERWEAR_WEAR_LIMIT;
      return count >= 1;
    }).map(i => i.id)
  );
  const cleanItems = items.filter(i => !dirtyIds.has(i.id));
  const totalClean = cleanItems.length;
  const lastLaundryLabel = lastLaundry
    ? new Date(lastLaundry).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Never";

  // ── Actions ─────────────────────────────────────────────────────────────────

  function isDirectImageUrl(url: string) {
    return /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$)/i.test(url) ||
      /images[-.]amazon\.com|m\.media-amazon\.com|cdn\.shopify\.com|images\.unsplash/i.test(url);
  }

  async function resolveImage() {
    const raw = importUrl.trim();
    if (!raw) return;
    setScraping(true);
    setImportError(null);
    setResolvedImageUrl(null);
    setSplitItems(null);

    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    if (isDirectImageUrl(url)) {
      setResolvedImageUrl(url);
      setScraping(false);
      if (autoAnalyze) await analyzeWithChatGPT(url, null);
      return;
    }

    const res = await fetch("/api/stylist/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.error) {
      setImportError(data.error);
    } else {
      const meta = (data.name || data.type)
        ? { name: data.name, type: data.type, brand: data.brand, color: data.color }
        : null;
      if (meta) setProductMeta(meta);
      if (data.image_url) {
        setResolvedImageUrl(data.image_url);
        setScraping(false);
        if (autoAnalyze) {
          await analyzeWithChatGPT(data.image_url, meta);
          return;
        }
      } else {
        setImportError("Could not extract an image from that URL. Try right-clicking the product image → Copy image address, and paste that URL instead.");
      }
    }
    setScraping(false);
  }

  async function analyzeWithChatGPT(
    imageUrl?: string,
    meta?: { name?: string; type?: string; brand?: string; color?: string } | null,
  ) {
    const url = imageUrl ?? resolvedImageUrl;
    const m = meta !== undefined ? meta : productMeta;
    if (!url) return;
    setSplitting(true);
    setSplitError(null);
    setSplitItems(null);
    setSplitJobId(null);
    try {
      const res = await fetch("/api/stylist/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_image_url: url,
          item_name: m?.name ?? null,
          item_type: m?.type ?? null,
          item_brand: m?.brand ?? null,
          item_color: m?.color ?? null,
        }),
      });
      const data = await res.json();
      if (data.error) { setSplitError(data.error); setSplitting(false); return; }
      setSplitJobId(data.jobId);
      const poll = setInterval(async () => {
        const { data: job } = await supabase
          .from("wardrobe_split_jobs")
          .select("status, result_items, error_message")
          .eq("id", data.jobId)
          .single();
        if (!job) return;
        if (job.status === "complete") {
          clearInterval(poll);
          const resultItems = job.result_items as SplitResultItem[];
          if (localStorage.getItem("wardrobeAutoAdd") === "true") {
            await saveAllSplitItems(resultItems);
          } else {
            setSplitItems(resultItems);
            setSplitting(false);
            setSplitJobId(null);
          }
        } else if (job.status === "error") {
          clearInterval(poll);
          setSplitError(job.error_message ?? "Extension pipeline failed.");
          setSplitting(false);
          setSplitJobId(null);
        }
      }, 5000);
    } catch {
      setSplitError("Failed to start job.");
      setSplitting(false);
    }
  }

  async function saveAllSplitItems(toSave?: SplitResultItem[]) {
    const items_ = toSave ?? splitItems;
    if (!items_?.length) return;
    setSaving(true);
    const inserted: WardrobeItem[] = [];
    for (const item of items_) {
      const { data } = await supabase.from("wardrobe_items").insert({
        name: item.name,
        type: item.type,
        color: item.color || null,
        brand: item.brand || null,
        size: null,
        occasions: item.occasions,
        notes: null,
        image_url: item.image_url || null,
      }).select().single();
      if (data) inserted.push(data);
    }
    setItems(prev => [...inserted.reverse(), ...prev]);
    setSplitItems(null);
    setSplitJobId(null);
    setSplitting(false);
    setImportUrl("");
    setResolvedImageUrl(null);
    setShowAdd(false);
    setSaving(false);
  }

  async function markWorn(itemId: string) {
    const item = items.find(i => i.id === itemId);
    if (item && NEVER_DIRTY_TYPES.has(item.type)) return;
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("wear_log").insert({ item_id: itemId, worn_date: today });
    setWearLog(prev => [...prev, { id: crypto.randomUUID(), item_id: itemId, worn_date: today }]);
  }

  async function markClean(itemId: string) {
    const since = lastLaundry ? lastLaundry.split("T")[0] : "1970-01-01";
    await supabase.from("wear_log").delete().eq("item_id", itemId).gte("worn_date", since);
    setWearLog(prev => prev.filter(w => w.item_id !== itemId));
  }

  async function doLaundry() {
    setLaundryConfirm(false);
    const { data } = await supabase.from("laundry_resets").insert({}).select().single();
    setLastLaundry(data?.reset_at ?? new Date().toISOString());
    setWearLog([]);
  }

  async function addItem() {
    if (!newItem.name.trim()) return;
    setSaving(true);
    setAddError(null);
    const { data, error } = await supabase.from("wardrobe_items").insert({
      name: newItem.name.trim(),
      type: newItem.type,
      color: newItem.color || null,
      brand: newItem.brand || null,
      size: newItem.size || null,
      occasions: newItem.occasions,
      notes: newItem.notes || null,
      image_url: newItem.image_url || null,
    }).select().single();
    if (error) {
      console.error("addItem error:", error);
      setAddError(error.message);
      setSaving(false);
      return;
    }
    if (data) setItems(prev => [data, ...prev]);
    setNewItem({ ...BLANK_ITEM });
    setImportUrl("");
    setAddMode("import");
    setShowAdd(false);
    setSaving(false);
  }

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/stylist/upload-photo", { method: "POST", body: fd });
    const data = await res.json();
    if (data.error) {
      setUploadError(data.error);
    } else {
      setUserPhotos(prev => [{ id: data.id, url: data.url }, ...prev]);
    }
    setUploadingPhoto(false);
  }

  async function deletePhoto(id: string, url: string) {
    await supabase.from("user_photos").delete().eq("id", id);
    const path = url.split("/pipeline-assets/")[1];
    if (path) await supabase.storage.from("pipeline-assets").remove([path]);
    setUserPhotos(prev => prev.filter(p => p.id !== id));
  }

  function resetAddForm() {
    setShowAdd(false);
    setNewItem({ ...BLANK_ITEM });
    setImportUrl("");
    setResolvedImageUrl(null);
    setAddMode("import");
    setImportError(null);
    setSplitItems(null);
    setSplitJobId(null);
    setSplitting(false);
    setProductMeta(null);
  }

  async function deleteItem(id: string) {
    await supabase.from("wardrobe_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    setWearLog(prev => prev.filter(w => w.item_id !== id));
  }

  async function updateItem() {
    if (!editingItem) return;
    setEditSaving(true);
    const { data, error } = await supabase
      .from("wardrobe_items")
      .update({
        name: editingItem.name,
        type: editingItem.type,
        color: editingItem.color || null,
        brand: editingItem.brand || null,
        size: editingItem.size || null,
        occasions: editingItem.occasions,
        notes: editingItem.notes || null,
        image_url: editingItem.image_url || null,
      })
      .eq("id", editingItem.id)
      .select()
      .single();
    if (data) setItems(prev => prev.map(i => i.id === data.id ? data : i));
    if (error) console.error("updateItem error:", error);
    setEditSaving(false);
    setEditingItem(null);
  }

  function toggleEditOccasion(o: string) {
    if (!editingItem) return;
    setEditingItem(prev => prev ? {
      ...prev,
      occasions: prev.occasions.includes(o) ? prev.occasions.filter(x => x !== o) : [...prev.occasions, o],
    } : null);
  }

  function parseOutfitItemIds(description: string, allItems: WardrobeItem[]): string[] {
    const lines = description.split("\n")
      .map(l => l.replace(/^[\s•\-*]+/, "").trim().toLowerCase())
      .filter(Boolean);
    return allItems.filter(item =>
      lines.some(line => {
        const name = item.name.toLowerCase();
        return line === name || line.includes(name) || name.includes(line);
      })
    ).map(i => i.id);
  }

  async function approveOutfit(ids: string[]) {
    if (ids.length === 0) return;
    const trackable = ids.filter(id => {
      const item = items.find(i => i.id === id);
      return item && !NEVER_DIRTY_TYPES.has(item.type);
    });
    const today = new Date().toISOString().split("T")[0];
    const newEntries: WearLog[] = [];
    for (const id of trackable) {
      const { error } = await supabase.from("wear_log").insert({ item_id: id, worn_date: today });
      if (!error) newEntries.push({ id: crypto.randomUUID(), item_id: id, worn_date: today });
    }
    if (newEntries.length) setWearLog(prev => [...prev, ...newEntries]);
    setOutfitApproved(true);
  }

  async function generateOutfit() {
    if (activities.length === 0) return;
    setGenerating(true);
    setTodayOutfit(null);
    setOutfitImage(null);
    setOutfitError(null);
    setOutfitJobId(null);
    setOutfitApproved(false);
    setOutfitItemIds([]);
    try {
      const res = await fetch("/api/stylist/outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities,
          cleanItemIds: cleanItems.map(i => i.id),
          weather,
          referencePhotoUrl: userPhotos[0]?.url ?? null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setOutfitError(data.error);
        setGenerating(false);
        return;
      }
      setOutfitJobId(data.jobId);
      const poll = setInterval(async () => {
        const { data: job } = await supabase
          .from("stylist_jobs")
          .select("status, outfit_description, outfit_image_url, error_message")
          .eq("id", data.jobId)
          .single();
        if (!job) return;
        if (job.status === "complete") {
          clearInterval(poll);
          setTodayOutfit(job.outfit_description);
          setOutfitImage(job.outfit_image_url);
          setOutfitJobId(null);
          setGenerating(false);
          const matched = parseOutfitItemIds(job.outfit_description ?? "", items);
          setOutfitItemIds(matched);
          if (localStorage.getItem("outfitAutoApprove") === "true") {
            await approveOutfit(matched);
          }
          const { data: history } = await supabase.from("outfit_history").select("*").order("created_at", { ascending: false }).limit(6);
          setOutfitHistory(history ?? []);
        } else if (job.status === "error") {
          clearInterval(poll);
          setOutfitError(job.error_message ?? "Extension pipeline failed.");
          setOutfitJobId(null);
          setGenerating(false);
        }
      }, 4000);
    } catch {
      setOutfitError("Failed to start outfit generation.");
      setGenerating(false);
    }
  }

  async function savePrompt(key: string) {
    const prompt = prompts.find(p => p.key === key);
    if (!prompt) return;
    setSavingPrompt(key);
    await supabase.from("prompt_templates")
      .update({ body: promptEdits[key], updated_at: new Date().toISOString() })
      .eq("key", key);
    setPrompts(prev => prev.map(p => p.key === key ? { ...p, body: promptEdits[key] } : p));
    setSavingPrompt(null);
  }

  function toggleActivity(a: string) {
    setActivities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function toggleOccasion(o: string) {
    setNewItem(prev => ({
      ...prev,
      occasions: prev.occasions.includes(o) ? prev.occasions.filter(x => x !== o) : [...prev.occasions, o],
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> stylist.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Personal Stylist</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Wardrobe catalog · worn-since-laundry tracking · AI daily outfit planner
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shirt className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Wardrobe</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">{loading ? "—" : items.length}</p>
            <p className="text-xs text-green-700 font-mono mt-1">items logged</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Clean</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">{loading ? "—" : totalClean}</p>
            <p className="text-xs text-green-700 font-mono mt-1">of {items.length} items</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Last Laundry</span>
            </div>
            <p className="text-xl font-black font-mono text-green-300 mt-1">{loading ? "—" : lastLaundryLabel}</p>
            <button
              onClick={() => setLaundryConfirm(true)}
              className="mt-2 text-xs font-mono text-green-700 hover:text-green-400 transition-colors underline underline-offset-2"
            >
              laundry done →
            </button>
          </div>
        </div>

        {/* Laundry confirm */}
        {laundryConfirm && (
          <div className="holo-card rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 mb-6 flex items-center justify-between">
            <p className="text-sm font-mono text-yellow-400">Reset all items to clean?</p>
            <div className="flex gap-3">
              <button
                onClick={doLaundry}
                className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all"
              >
                Yes, laundry done
              </button>
              <button onClick={() => setLaundryConfirm(false)} className="text-xs font-mono text-green-700 hover:text-green-500 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Daily Planner */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-7 h-7 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Daily Outfit Planner</span>
            {weather && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-mono">
                <CloudSun className="w-3.5 h-3.5" />
                {weather.temp}°F · {weather.condition}
              </span>
            )}
          </div>
          <div className="p-5">
            <p className="text-xs text-green-700 font-mono mb-2 uppercase tracking-wider">What are you doing today?</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {ACTIVITIES.map(a => (
                <Chip key={a} label={a} active={activities.includes(a)} onClick={() => toggleActivity(a)} />
              ))}
            </div>

            {totalClean === 0 && !loading && (
              <div className="text-xs text-red-400 font-mono mb-4 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
                No clean items — hit &quot;laundry done&quot; or mark items clean below.
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={generateOutfit}
                disabled={generating || activities.length === 0 || totalClean === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {generating ? (outfitJobId ? "Extension working..." : "Starting...") : "Generate Outfit"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoApproveOutfit;
                    setAutoApproveOutfit(next);
                    localStorage.setItem("outfitAutoApprove", String(next));
                  }}
                  className={`relative w-8 h-4 rounded-full border transition-all flex-shrink-0 ${autoApproveOutfit ? "border-green-500/60 bg-green-500/20" : "border-green-500/20 bg-black/40"}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${autoApproveOutfit ? "left-4 bg-green-400" : "left-0.5 bg-green-600"}`} />
                </button>
                <span className="text-xs font-mono text-green-700">Auto-approve</span>
              </div>
            </div>
            {activities.length === 0 && !generating && (
              <p className="text-xs text-green-800 font-mono mt-2">Pick at least one activity to generate.</p>
            )}
            {outfitError && (
              <p className="text-xs text-red-400 font-mono mt-2">{outfitError}</p>
            )}

            {outfitJobId && generating && (
              <p className="text-xs text-green-700 font-mono mt-3">
                <span className="text-red-500">&gt;</span> Extension is running — ChatGPT is generating your outfit + image...
              </p>
            )}

            {(outfitImage || todayOutfit) && (
              <div className="mt-5 pt-5 border-t border-green-500/20">
                <p className="text-xs text-green-600 font-mono uppercase tracking-wider mb-3">
                  <span className="text-red-500">&gt;</span> Today&apos;s Outfit
                </p>
                {outfitImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={outfitImage}
                    alt="outfit"
                    className="w-full max-w-sm rounded-xl border border-green-500/20 mb-4 object-cover"
                  />
                )}
                {todayOutfit && (
                  <ul className="space-y-1 mb-4">
                    {todayOutfit.split("\n").map((line, i) => {
                      const text = line.replace(/^[\s•\-*]+/, "").trim();
                      return text ? (
                        <li key={i} className="text-sm text-green-300 font-mono flex items-start gap-2">
                          <span className="text-red-500 flex-shrink-0">•</span>
                          {text}
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
                {outfitApproved ? (
                  <p className="text-xs text-green-500 font-mono font-bold">
                    ✓ Approved · wear logged
                  </p>
                ) : outfitItemIds.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => approveOutfit(outfitItemIds)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Approve &amp; Mark Worn
                    </button>
                    <span className="text-xs text-green-800 font-mono">
                      {outfitItemIds.filter(id => { const it = items.find(i => i.id === id); return it && !NEVER_DIRTY_TYPES.has(it.type); }).length} item(s) will log wear
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* My Photos */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-5 mb-6">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text">My Photos</p>
            <label className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all cursor-pointer">
              {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <p className="text-xs text-green-800 font-mono mb-4">
            {userPhotos.length > 0
              ? `${userPhotos.length} photo${userPhotos.length !== 1 ? "s" : ""} saved — first 3 are used when generating outfit images.`
              : "Upload photos of yourself so the AI can generate outfit images with your likeness."}
          </p>

          {uploadError && (
            <p className="text-xs text-red-400 font-mono mb-3 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">{uploadError}</p>
          )}

          {userPhotos.length === 0 && !uploadingPhoto && (
            <div className="border border-dashed border-green-500/20 rounded-xl py-8 flex flex-col items-center gap-2">
              <p className="text-xs text-green-800 font-mono">No photos yet.</p>
              <p className="text-xs text-green-900 font-mono">Use a clear full-body or face photo for best results.</p>
            </div>
          )}

          {userPhotos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {userPhotos.map((photo, i) => (
                <div key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`reference photo ${i + 1}`}
                    className={`w-full aspect-square object-cover rounded-xl border-2 cursor-pointer transition-all hover:opacity-90 ${
                      i < 3 ? "border-green-400" : "border-green-500/20"
                    }`}
                    onClick={() => setLightboxUrl(photo.url)}
                    onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).alt = "failed to load"; }}
                  />
                  {i < 3 && (
                    <span className="absolute top-1.5 left-1.5 text-xs bg-green-500 text-black font-mono font-bold px-1.5 py-0.5 rounded">
                      IN USE
                    </span>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      onClick={() => setLightboxUrl(photo.url)}
                      className="w-6 h-6 rounded-md bg-black/70 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-black/90 transition-all"
                      title="View full size"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id, photo.url)}
                      className="w-6 h-6 rounded-md bg-black/70 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-black/90 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Item Modal */}
        {editingItem && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setEditingItem(null)}
          >
            <div
              className="holo-card bg-black rounded-2xl border border-green-500/30 p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text">Edit Item</p>
                <button onClick={() => setEditingItem(null)} className="text-green-800 hover:text-green-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editingItem.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editingItem.image_url} alt={editingItem.name} className="w-full h-40 object-cover rounded-xl border border-green-500/20 mb-4" />
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Name *"
                  value={editingItem.name}
                  onChange={e => setEditingItem(p => p ? { ...p, name: e.target.value } : p)}
                />
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={editingItem.type}
                  onChange={e => setEditingItem(p => p ? { ...p, type: e.target.value } : p)}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Color"
                  value={editingItem.color ?? ""}
                  onChange={e => setEditingItem(p => p ? { ...p, color: e.target.value } : p)}
                />
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Brand"
                  value={editingItem.brand ?? ""}
                  onChange={e => setEditingItem(p => p ? { ...p, brand: e.target.value } : p)}
                />
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Size"
                  value={editingItem.size ?? ""}
                  onChange={e => setEditingItem(p => p ? { ...p, size: e.target.value } : p)}
                />
              </div>

              <p className="text-xs text-green-700 font-mono mb-2 uppercase tracking-wider">Occasions</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {OCCASIONS.map(o => (
                  <Chip key={o} label={o} active={editingItem.occasions.includes(o)} onClick={() => toggleEditOccasion(o)} />
                ))}
              </div>

              <input
                className="w-full bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60 mb-4"
                placeholder="Notes (optional)"
                value={editingItem.notes ?? ""}
                onChange={e => setEditingItem(p => p ? { ...p, notes: e.target.value } : p)}
              />

              <div className="flex gap-2">
                <button
                  onClick={updateItem}
                  disabled={editSaving || !editingItem.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => { deleteItem(editingItem.id); setEditingItem(null); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 font-mono font-bold text-sm hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt="full size"
                className="w-full rounded-2xl border border-green-500/30 object-contain max-h-[80vh]"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/80 border border-green-500/20 flex items-center justify-center text-green-400 hover:text-green-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Wardrobe */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-green-700 font-mono uppercase tracking-widest">
              <span className="text-red-500">&gt;</span> wardrobe ({items.length} items · {totalClean} clean)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
              <button
                onClick={() => setLaundryConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-green-500/20 text-green-600 hover:text-green-400 hover:border-green-500/40 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Laundry Done
              </button>
            </div>
          </div>

          {/* Add item form */}
          {showAdd && (
            <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text">Add Item</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 p-0.5 rounded-lg border border-green-500/20 bg-black/40">
                    <button
                      onClick={() => { setAddMode("import"); setResolvedImageUrl(null); setSplitItems(null); }}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-mono transition-all ${addMode === "import" ? "bg-green-500/20 text-green-300" : "text-green-700 hover:text-green-500"}`}
                    >
                      <Sparkles className="w-3 h-3" /> Via ChatGPT
                    </button>
                    <button
                      onClick={() => setAddMode("manual")}
                      className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${addMode === "manual" ? "bg-green-500/20 text-green-300" : "text-green-700 hover:text-green-500"}`}
                    >
                      Manual
                    </button>
                  </div>
                  <button onClick={resetAddForm} className="text-green-800 hover:text-green-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── ChatGPT import mode ── */}
              {addMode === "import" && (
                <div>
                  {/* Toggles */}
                  <div className="flex items-center gap-6 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoAnalyze;
                          setAutoAnalyze(next);
                          localStorage.setItem("wardrobeAutoAnalyze", String(next));
                        }}
                        className={`relative w-10 h-5 rounded-full border transition-all flex-shrink-0 ${autoAnalyze ? "border-green-500/60 bg-green-500/20" : "border-green-500/20 bg-black/40"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoAnalyze ? "left-5 bg-green-400" : "left-0.5 bg-green-600"}`} />
                      </button>
                      <span className="text-xs font-mono text-green-700">Auto-analyze</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoAdd;
                          setAutoAdd(next);
                          localStorage.setItem("wardrobeAutoAdd", String(next));
                        }}
                        className={`relative w-10 h-5 rounded-full border transition-all flex-shrink-0 ${autoAdd ? "border-green-500/60 bg-green-500/20" : "border-green-500/20 bg-black/40"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoAdd ? "left-5 bg-green-400" : "left-0.5 bg-green-600"}`} />
                      </button>
                      <span className="text-xs font-mono text-green-700">Auto-add</span>
                    </div>
                  </div>

                  {/* Step 1: get image */}
                  {!resolvedImageUrl && (
                    <>
                      <p className="text-xs text-green-700 font-mono mb-2">
                        Paste a product URL <span className="text-green-900">or</span> paste the image URL directly (right-click product image → Copy image address):
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                          placeholder="https://amazon.com/dp/...  or  https://m.media-amazon.com/images/..."
                          value={importUrl}
                          onChange={e => { setImportUrl(e.target.value); setImportError(null); }}
                          onKeyDown={e => e.key === "Enter" && resolveImage()}
                        />
                        <button
                          onClick={resolveImage}
                          disabled={scraping || !importUrl.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                          {scraping ? "Getting image..." : "Get Image"}
                        </button>
                      </div>
                      {importError && <p className="text-xs text-red-400 font-mono mb-2">{importError}</p>}
                    </>
                  )}

                  {/* Step 2: confirm image + analyze */}
                  {resolvedImageUrl && !splitting && !splitItems && (
                    <div className="flex items-start gap-4">
                      <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border border-green-500/20 bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolvedImageUrl}
                          alt="product"
                          className="w-full h-full object-cover object-top"
                          onError={e => { (e.target as HTMLImageElement).alt = "Image failed to load"; }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-green-400 font-mono font-bold mb-1">Image ready ✓</p>
                        <p className="text-xs text-green-800 font-mono mb-3 leading-relaxed">
                          ChatGPT will identify how many items are in the photo, analyze each one (type, color, brand), generate a clean catalog image for each, and add them all to your wardrobe.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => analyzeWithChatGPT()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Analyze &amp; Add to Wardrobe
                          </button>
                          <button
                            onClick={() => { setResolvedImageUrl(null); setImportUrl(""); }}
                            className="text-xs font-mono text-green-800 hover:text-green-500 transition-colors px-2"
                          >
                            Use different image
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: extension working */}
                  {splitting && (
                    <div className="flex items-center gap-3 py-4">
                      <Loader2 className="w-5 h-5 text-green-400 animate-spin flex-shrink-0" />
                      <div>
                        <p className="text-sm font-mono font-bold text-green-300">
                          {splitJobId ? "Extension working..." : "Starting..."}
                        </p>
                        {splitJobId && (
                          <p className="text-xs text-green-700 font-mono mt-0.5">
                            ChatGPT is analyzing the image, counting items, and generating individual catalog photos. This takes a few minutes.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {splitError && <p className="text-xs text-red-400 font-mono mt-2">{splitError}</p>}

                  {/* Step 4: review results */}
                  {splitItems && splitItems.length > 0 && (
                    <div>
                      <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text mb-1">
                        {splitItems.length} item{splitItems.length !== 1 ? "s" : ""} found
                      </p>
                      <p className="text-xs text-green-700 font-mono mb-3">Edit any names before saving.</p>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {splitItems.map((item, i) => (
                          <div key={i} className="rounded-lg border border-green-500/20 bg-black/40 overflow-hidden">
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" /> // eslint-disable-line @next/next/no-img-element
                              : <div className="w-full h-28 bg-green-500/5 flex items-center justify-center"><Shirt className="w-6 h-6 text-green-900" /></div>
                            }
                            <div className="p-2">
                              <input
                                className="w-full text-xs font-mono bg-black/40 border border-green-500/20 rounded px-2 py-1 text-green-300 focus:outline-none focus:border-green-400/40 mb-1"
                                value={item.name}
                                onChange={e => setSplitItems(prev => prev!.map((it, j) => j === i ? { ...it, name: e.target.value } : it))}
                              />
                              <p className="text-xs text-green-800 font-mono">{item.type}{item.color ? ` · ${item.color}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveAllSplitItems()}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {saving ? "Saving..." : `Save All ${splitItems.length} Item${splitItems.length !== 1 ? "s" : ""}`}
                        </button>
                        <button onClick={() => { setSplitItems(null); setResolvedImageUrl(null); setImportUrl(""); }} className="text-xs font-mono text-green-700 hover:text-green-500 px-2">
                          Start over
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Manual mode (fallback) ── */}
              {addMode === "manual" && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Name *"
                      value={newItem.name}
                      onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    />
                    <select
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                      value={newItem.type}
                      onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))}
                    >
                      {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60" placeholder="Color" value={newItem.color} onChange={e => setNewItem(p => ({ ...p, color: e.target.value }))} />
                    <input className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60" placeholder="Brand" value={newItem.brand} onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))} />
                    <input className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60" placeholder="Size" value={newItem.size} onChange={e => setNewItem(p => ({ ...p, size: e.target.value }))} />
                  </div>
                  <p className="text-xs text-green-700 font-mono mb-2 uppercase tracking-wider">Occasions</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {OCCASIONS.map(o => <Chip key={o} label={o} active={newItem.occasions.includes(o)} onClick={() => toggleOccasion(o)} />)}
                  </div>
                  <input className="w-full bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60 mb-4" placeholder="Notes (optional)" value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} />
                  {addError && <p className="text-xs text-red-400 font-mono mb-3">{addError}</p>}
                  <div className="flex gap-2">
                    <button onClick={addItem} disabled={saving || !newItem.name.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {saving ? "Saving..." : "Add to Wardrobe"}
                    </button>
                    <button onClick={resetAddForm} className="px-4 py-2 rounded-lg text-xs font-mono text-green-700 hover:text-green-500 transition-colors">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && !showAdd && (
            <div className="text-center py-16 border border-dashed border-green-500/20 rounded-xl">
              <Shirt className="w-8 h-8 text-green-800 mx-auto mb-3" />
              <p className="text-sm text-green-700 font-mono">Your wardrobe is empty.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-xs font-mono text-green-500 hover:text-green-300 transition-colors underline underline-offset-2"
              >
                Add your first item →
              </button>
            </div>
          )}

          {/* Items grid */}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isDirty={dirtyIds.has(item.id)}
                  onMarkWorn={markWorn}
                  onMarkClean={markClean}
                  onDelete={deleteItem}
                  onEdit={setEditingItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Prompt Templates */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <button
            onClick={() => setShowPrompts(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 border-b border-green-500/20 bg-green-500/5"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-green-600" />
              <span className="text-xs font-mono font-black uppercase tracking-widest text-green-500">ChatGPT Prompt Templates</span>
            </div>
            {showPrompts ? <ChevronUp className="w-4 h-4 text-green-700" /> : <ChevronDown className="w-4 h-4 text-green-700" />}
          </button>

          {showPrompts && (
            <div className="p-5 space-y-6">
              {prompts.length === 0 && (
                <p className="text-xs text-green-800 font-mono">No prompts found. Run <code className="text-green-600">supabase/prompt_templates.sql</code> in Supabase to seed defaults.</p>
              )}
              {prompts.map(prompt => {
                const vars: Record<string, string> = {
                  "wardrobe_analysis": "{{imageNote}}  {{productName}}  {{brandLine}}  {{focusNote}}",
                  "wardrobe_generation": "{{brand}}  {{color}}  {{item_type}}  {{styleNotes}}  {{referenceNote}}",
                  "outfit_selection": "{{itemsList}}  {{activities}}  {{weather}}",
                  "outfit_image": "{{subject}}  {{accessoryDetail}}",
                };
                return (
                  <div key={prompt.key}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono font-bold text-green-400 uppercase tracking-wider">{prompt.name}</p>
                      <button
                        onClick={() => savePrompt(prompt.key)}
                        disabled={savingPrompt === prompt.key || promptEdits[prompt.key] === prompt.body}
                        className="flex items-center gap-1 text-xs font-mono px-3 py-1 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingPrompt === prompt.key ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {savingPrompt === prompt.key ? "Saving..." : "Save"}
                      </button>
                    </div>
                    {vars[prompt.key] && (
                      <p className="text-xs text-green-900 font-mono mb-2">Variables: <span className="text-green-700">{vars[prompt.key]}</span></p>
                    )}
                    <textarea
                      className="w-full bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/40 resize-y"
                      rows={12}
                      value={promptEdits[prompt.key] ?? prompt.body}
                      onChange={e => setPromptEdits(prev => ({ ...prev, [prompt.key]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outfit History */}
        {outfitHistory.length > 0 && (
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 border-b border-green-500/20 bg-green-500/5"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-green-600" />
                <span className="text-xs font-mono font-black uppercase tracking-widest text-green-500">Outfit History</span>
              </div>
              {showHistory ? <ChevronUp className="w-4 h-4 text-green-700" /> : <ChevronDown className="w-4 h-4 text-green-700" />}
            </button>
            {showHistory && (
              <div className="divide-y divide-green-500/10">
                {outfitHistory.map(record => (
                  <div key={record.id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-bold text-green-500">
                        {new Date(record.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {record.activities?.length > 0 && (
                        <span className="text-xs text-green-700 font-mono">{record.activities.join(" · ")}</span>
                      )}
                      {record.weather_summary && (
                        <span className="ml-auto text-xs text-green-800 font-mono flex items-center gap-1">
                          <CloudSun className="w-3 h-3" /> {record.weather_summary}
                        </span>
                      )}
                    </div>
                    {record.ai_suggestion && (
                      <p className="text-xs text-green-700 font-mono whitespace-pre-wrap leading-relaxed">{record.ai_suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
