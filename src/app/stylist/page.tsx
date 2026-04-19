"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  Shirt, RefreshCw, Calendar, Plus, X, Sparkles,
  Loader2, CloudSun, History, Zap, ChevronDown, ChevronUp, Link, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

function ItemCard({ item, isDirty, onMarkWorn, onMarkClean, onDelete }: {
  item: WardrobeItem;
  isDirty: boolean;
  onMarkWorn: (id: string) => void;
  onMarkClean: (id: string) => void;
  onDelete: (id: string) => void;
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
          <button
            onClick={() => onDelete(item.id)}
            className="text-green-900 hover:text-red-500 transition-colors ml-2 flex-shrink-0 mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
  const [addMode, setAddMode] = useState<"url" | "manual">("url");
  const [importUrl, setImportUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ ...BLANK_ITEM });
  const [saving, setSaving] = useState(false);

  const [activities, setActivities] = useState<string[]>([]);
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

    setItems(itemsData ?? []);
    setWearLog(wears ?? []);
    setOutfitHistory(historyData ?? []);
    setUserPhotos(photosData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

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

  const dirtyIds = new Set(wearLog.map(w => w.item_id));
  const cleanItems = items.filter(i => !dirtyIds.has(i.id));
  const totalClean = cleanItems.length;
  const lastLaundryLabel = lastLaundry
    ? new Date(lastLaundry).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Never";

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function importFromUrl() {
    if (!importUrl.trim()) return;
    setScraping(true);
    setScrapeError(null);
    let cleanUrl = importUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
    const res = await fetch("/api/stylist/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl }),
    });
    const data = await res.json();
    if (data.error) {
      setScrapeError(data.error);
    } else {
      setNewItem({
        name: data.name ?? "",
        type: ITEM_TYPES.includes(data.type) ? data.type : "Top",
        color: data.color ?? "",
        brand: data.brand ?? "",
        size: data.size ?? "",
        occasions: Array.isArray(data.occasions) ? data.occasions : [],
        notes: data.notes ?? "",
        image_url: data.image_url ?? "",
      });
      setAddMode("manual");
    }
    setScraping(false);
  }

  async function markWorn(itemId: string) {
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
    setAddMode("url");
    setShowAdd(false);
    setSaving(false);
  }

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `user-photos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pipeline-assets").upload(path, file, { upsert: true });
    if (!error) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pipeline-assets/${path}`;
      const { data } = await supabase.from("user_photos").insert({ url }).select().single();
      if (data) setUserPhotos(prev => [data, ...prev]);
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
    setAddMode("url");
    setScrapeError(null);
  }

  async function deleteItem(id: string) {
    await supabase.from("wardrobe_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    setWearLog(prev => prev.filter(w => w.item_id !== id));
  }

  async function generateOutfit() {
    if (activities.length === 0) return;
    setGenerating(true);
    setTodayOutfit(null);
    setOutfitImage(null);
    setOutfitError(null);
    setOutfitJobId(null);
    try {
      const res = await fetch("/api/stylist/outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities,
          cleanItems: cleanItems.map(i => ({ id: i.id, name: i.name, type: i.type, color: i.color, brand: i.brand, occasions: i.occasions, image_url: i.image_url })),
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
      // Poll for job completion
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

            <button
              onClick={generateOutfit}
              disabled={generating || activities.length === 0 || totalClean === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {generating ? (outfitJobId ? "Extension working..." : "Starting...") : "Generate Outfit"}
            </button>
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

            {todayOutfit && (
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
                <div className="text-sm text-green-300 font-mono whitespace-pre-wrap leading-relaxed">{todayOutfit}</div>
              </div>
            )}
          </div>
        </div>

        {/* My Photos */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text">My Photos</p>
              <p className="text-xs text-green-800 font-mono mt-0.5">Upload photos of yourself — the extension will use your face when generating outfit images.</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all cursor-pointer">
              {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {uploadingPhoto ? "Uploading..." : "Add Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
              />
            </label>
          </div>

          {userPhotos.length === 0 && (
            <p className="text-xs text-green-800 font-mono">No photos yet. Add a clear photo of your face and full body for best results.</p>
          )}

          {userPhotos.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {userPhotos.map((photo, i) => (
                <div key={photo.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt="reference"
                    className={`w-20 h-20 object-cover rounded-xl border-2 transition-all ${i < 3 ? "border-green-400" : "border-green-500/20"}`}
                  />
                  {i < 3 && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-green-500 text-black font-mono font-bold px-1 rounded">IN USE</span>
                  )}
                  <button
                    onClick={() => deletePhoto(photo.id, photo.url)}
                    className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                <p className="text-xs font-mono font-black uppercase tracking-widest gradient-text">Add New Item</p>
                <div className="flex gap-1 p-0.5 rounded-lg border border-green-500/20 bg-black/40">
                  <button
                    onClick={() => setAddMode("url")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                      addMode === "url" ? "bg-green-500/20 text-green-300" : "text-green-700 hover:text-green-500"
                    }`}
                  >
                    <Link className="w-3 h-3" /> URL Import
                  </button>
                  <button
                    onClick={() => setAddMode("manual")}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                      addMode === "manual" ? "bg-green-500/20 text-green-300" : "text-green-700 hover:text-green-500"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {/* URL import mode */}
              {addMode === "url" && (
                <div>
                  <p className="text-xs text-green-700 font-mono mb-2">Paste an Amazon, ASOS, Nike, or any product URL:</p>
                  <div className="flex gap-2 mb-2">
                    <input
                      className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="https://amazon.com/dp/..."
                      value={importUrl}
                      onChange={e => { setImportUrl(e.target.value); setScrapeError(null); }}
                      onKeyDown={e => e.key === "Enter" && importFromUrl()}
                    />
                    <button
                      onClick={importFromUrl}
                      disabled={scraping || !importUrl.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {scraping ? "Fetching..." : "Auto-fill"}
                    </button>
                  </div>
                  {scrapeError && (
                    <p className="text-xs text-red-400 font-mono mb-2">{scrapeError}</p>
                  )}
                  <button
                    onClick={() => setAddMode("manual")}
                    className="text-xs text-green-800 font-mono hover:text-green-600 transition-colors underline underline-offset-2"
                  >
                    or enter manually →
                  </button>
                </div>
              )}

              {/* Manual / review mode */}
              {addMode === "manual" && (
                <>
                  {/* Image preview */}
                  {newItem.image_url && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-green-500/20 bg-black/40 relative w-32 h-32">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={newItem.image_url}
                        alt="preview"
                        className="w-full h-full object-cover object-top"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                    </div>
                  )}

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
                    <input
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Color"
                      value={newItem.color}
                      onChange={e => setNewItem(p => ({ ...p, color: e.target.value }))}
                    />
                    <input
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Brand"
                      value={newItem.brand}
                      onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))}
                    />
                    <input
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Size"
                      value={newItem.size}
                      onChange={e => setNewItem(p => ({ ...p, size: e.target.value }))}
                    />
                  </div>

                  <p className="text-xs text-green-700 font-mono mb-2 uppercase tracking-wider">Occasions</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {OCCASIONS.map(o => (
                      <Chip key={o} label={o} active={newItem.occasions.includes(o)} onClick={() => toggleOccasion(o)} />
                    ))}
                  </div>

                  <input
                    className="w-full bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60 mb-4"
                    placeholder="Notes (optional)"
                    value={newItem.notes}
                    onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))}
                  />

                  {addError && (
                    <p className="text-xs text-red-400 font-mono mb-3">{addError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={addItem}
                      disabled={saving || !newItem.name.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {saving ? "Saving..." : "Add to Wardrobe"}
                    </button>
                    <button onClick={resetAddForm} className="px-4 py-2 rounded-lg text-xs font-mono text-green-700 hover:text-green-500 transition-colors">
                      Cancel
                    </button>
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
                />
              ))}
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
