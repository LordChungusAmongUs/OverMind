"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  Youtube, Music2, Disc3, MessageSquare, Wand2,
  Plus, X, Check, Loader2, Save, ChevronDown, ChevronUp,
  Mic2, Globe, Users, Heart, BookOpen, ListMusic, Share2, Radio,
} from "lucide-react";

// ─── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS = [
  { name: "ThirstyBoy",          color: "text-red-400",    bg: "border-red-500/30 bg-red-500/5",       emoji: "🔥" },
  { name: "Stephani Luci",       color: "text-pink-400",   bg: "border-pink-500/30 bg-pink-500/5",     emoji: "🌸" },
  { name: "Hard On",             color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5", emoji: "⚡" },
  { name: "Wrapper",             color: "text-yellow-400", bg: "border-yellow-500/30 bg-yellow-500/5", emoji: "🎤" },
  { name: "Jerry Country Singer",color: "text-amber-400",  bg: "border-amber-500/30 bg-amber-500/5",   emoji: "🤠" },
  { name: "RaStevefarian",       color: "text-green-400",  bg: "border-green-500/30 bg-green-500/5",   emoji: "🌿" },
  { name: "Gore Lord",           color: "text-purple-400", bg: "border-purple-500/30 bg-purple-500/5", emoji: "💀" },
];

const MASTER_CHANNEL = { name: "Dehydration Nation", color: "text-cyan-400", bg: "border-cyan-500/30 bg-cyan-500/5", emoji: "🏷️" };

const PLATFORMS = [
  { key: "soundcloud", label: "SoundCloud", icon: Radio,     color: "text-orange-400" },
  { key: "tiktok",     label: "TikTok",     icon: Music2,    color: "text-pink-400"   },
  { key: "instagram",  label: "Instagram",  icon: Share2,    color: "text-purple-400" },
  { key: "facebook",   label: "Facebook",   icon: Globe,     color: "text-blue-400"   },
  { key: "twitter",    label: "X / Twitter",icon: MessageSquare, color: "text-sky-400" },
];

const DEFAULT_PROMPTS: Record<string, Record<string, string>> = {
  "ThirstyBoy": {
    lyrics: "Write instrumental track notes for ThirstyBoy — this is a DJ persona so no lyrics, just describe the vibe, BPM feel, and drop structure in a few lines. Dark, aggressive, bass-heavy drum n bass / dubstep.",
    art: "Dark urban neon glitch artwork for a drum n bass track by ThirstyBoy. Aggressive bass culture aesthetic, neon green and black, glitch effects, no text.",
    title: "Generate a short aggressive DJ track title (3-5 words) that fits dark drum n bass / dubstep. No artist name. Return just the title.",
    metadata: "Write a YouTube description for a ThirstyBoy drum n bass / dubstep instrumental track. 3-4 sentences. Mention the dark aggressive energy, BPM range, and genre tags. End with: #drumandbass #dubstep #ThirstyBoy",
    comment_reply: "Reply to this YouTube comment on a ThirstyBoy track as ThirstyBoy — keep it short, hype, minimal words. Use emojis sparingly. Comment: {comment}",
  },
  "Stephani Luci": {
    lyrics: "Write dreamy, emotional female vocal lyrics for a liquid drum n bass track by Stephani Luci. Soft, introspective, flowing. 2 verses + chorus. Include TITLE: and STYLE: lines at the top.",
    art: "Ethereal soft-light watercolor artwork for a melodic drum n bass track. Feminine, dreamy atmosphere, pastel colors, flowing shapes. No text.",
    title: "Generate a soft, emotional track title (3-5 words) for Stephani Luci's melodic drum n bass music. Return just the title.",
    metadata: "Write a YouTube description for a Stephani Luci liquid drum n bass track. Emotional, atmospheric, female vocals. 3-4 sentences. End with: #liquidDnB #drumandbass #StephaniLuci",
    comment_reply: "Reply to this YouTube comment on a Stephani Luci track as Stephani — warm, appreciative, gentle tone. Short reply. Comment: {comment}",
  },
  "Hard On": {
    lyrics: "Write intense, minimal male vocal lyrics for a hardstep / industrial drum n bass track by Hard On. Chant-like, high energy, aggressive. 2 verses + chorus. Include TITLE: and STYLE: lines at the top.",
    art: "Industrial hard geometric shapes, high contrast black and white, rave aesthetic. Harsh lighting, mechanical textures. No text.",
    title: "Generate a hard, punchy track title (2-4 words) for Hard On's industrial hardstep music. Return just the title.",
    metadata: "Write a YouTube description for a Hard On hardstep / industrial track. Intense, tribal, dark energy. 3-4 sentences. End with: #hardstep #hardDnB #HardOn",
    comment_reply: "Reply to this YouTube comment on a Hard On track as Hard On — minimal, intense, 1-2 sentences max. Comment: {comment}",
  },
  "Wrapper": {
    lyrics: "Write hip hop rap bars for a jump up drum n bass track by Wrapper. Street-focused, rhythmic wordplay, 2000s southern rap influenced. 2 verses + hook. Include TITLE: and STYLE: lines at the top.",
    art: "Hip hop culture urban landscape artwork. Bold colors, graffiti elements, jump up drum n bass aesthetic. No text.",
    title: "Generate a hip hop flavored track title (3-5 words) for Wrapper's jump up drum n bass music. Return just the title.",
    metadata: "Write a YouTube description for a Wrapper jump up drum n bass track with rap vocals. Street energy, hip hop flavored. 3-4 sentences. End with: #jumpup #drumandbass #Wrapper",
    comment_reply: "Reply to this YouTube comment on a Wrapper track as Wrapper — casual, hip hop energy, keep it real. Short. Comment: {comment}",
  },
  "Jerry Country Singer": {
    lyrics: "Write heartfelt country storytelling lyrics for a country-dubstep fusion track by Jerry Country Singer. Twangy, nostalgic, suburban. 2 verses + chorus. Include TITLE: and STYLE: lines at the top.",
    art: "Rural Americana sunset fields, rustic textures, warm tones. Country meets electronic aesthetic. No text.",
    title: "Generate a heartfelt country-style track title (3-5 words) for Jerry Country Singer's country dubstep fusion. Return just the title.",
    metadata: "Write a YouTube description for a Jerry Country Singer country-dubstep fusion track. Nostalgic, melodic, unique blend of genres. 3-4 sentences. End with: #countrydubstep #drumandbass #JerryCountrySinger",
    comment_reply: "Reply to this YouTube comment on a Jerry Country Singer track as Jerry — friendly, down-to-earth, country charm. Short. Comment: {comment}",
  },
  "RaStevefarian": {
    lyrics: "Write reggae MC toasting style lyrics for a jungle / ragga drum n bass track by RaStevefarian. Patois-influenced, chant-heavy, Caribbean vibes. 2 verses + chorus. Include TITLE: and STYLE: lines at the top.",
    art: "Caribbean colors, tropical vibes, Rastafarian imagery, jungle aesthetic. Vibrant, natural, warm. No text.",
    title: "Generate a reggae-influenced track title (3-5 words) for RaStevefarian's ragga jungle music. Return just the title.",
    metadata: "Write a YouTube description for a RaStevefarian ragga jungle drum n bass track. Caribbean, tribal, rhythmic energy. 3-4 sentences. End with: #ragga #jungle #drumandbass #RaStevefarian",
    comment_reply: "Reply to this YouTube comment on a RaStevefarian track as RaStevefarian — positive vibes, reggae energy, irie tone. Short. Comment: {comment}",
  },
  "Gore Lord": {
    lyrics: "Write dark horror poetry lyrics for a darkstep / death metal drum n bass track by Gore Lord. Ominous, disturbing imagery, heavy atmosphere. 2 verses + chorus. Include TITLE: and STYLE: lines at the top.",
    art: "Horror dark surrealism, skulls, demonic energy, black metal aesthetic. Black and deep red, unsettling. No text.",
    title: "Generate a dark horror track title (2-4 words) for Gore Lord's darkstep music. Return just the title.",
    metadata: "Write a YouTube description for a Gore Lord darkstep horror drum n bass track. Dark, ominous, industrial. 3-4 sentences. End with: #darkstep #darkDnB #GoreLord",
    comment_reply: "Reply to this YouTube comment on a Gore Lord track as Gore Lord — dark, ominous, minimal words. Comment: {comment}",
  },
  "Dehydration Nation": {
    lyrics: "",
    art: "Record label promotional artwork for Dehydration Nation — a bass music label featuring drum n bass, dubstep, darkstep, ragga jungle. Bold label aesthetic, modern, dark.",
    title: "Generate a compilation or label release title for Dehydration Nation records. Return just the title.",
    metadata: "Write a YouTube description for a Dehydration Nation release featuring multiple artists. Mention the label, bass music genres, and artist roster. End with: #DehydrationNation #drumandbass #dubstep",
    comment_reply: "Reply to this YouTube comment on the Dehydration Nation channel as the label — professional, welcoming, supportive of the music. Comment: {comment}",
  },
};

const PROMPT_TYPES = [
  { key: "lyrics",        label: "Lyrics / Notes",  icon: Music2 },
  { key: "art",           label: "Cover Art",        icon: Wand2 },
  { key: "title",         label: "Track Title",      icon: BookOpen },
  { key: "metadata",      label: "YT Description",   icon: Globe },
  { key: "comment_reply", label: "Comment Reply",    icon: MessageSquare },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistChannel {
  id: string;
  persona_name: string;
  channel_name: string | null;
  youtube_channel_id: string | null;
  is_master: boolean;
  upload_to_master: boolean;
  auto_interact: boolean;
  active: boolean;
}

interface PromptConfig {
  id: string;
  persona_name: string;
  prompt_type: string;
  template: string;
}

interface Album {
  id: string;
  title: string;
  persona_name: string;
  art_url: string | null;
  description: string | null;
  status: string;
  youtube_playlist_id: string | null;
  created_at: string;
}

interface AlbumTrack {
  id: string;
  album_id: string;
  track_number: number;
  title: string | null;
  youtube_url: string | null;
  status: string;
}

interface FanJob {
  id: string;
  persona_name: string;
  video_id: string | null;
  status: string;
  comments_replied: number;
  likes_given: number;
  created_at: string;
}

interface PlatformAccount {
  id: string;
  persona_name: string;
  platform: string;
  handle: string | null;
  profile_url: string | null;
  active: boolean;
}

interface PlatformPostJob {
  id: string;
  persona_name: string;
  platform: string;
  title: string | null;
  status: string;
  post_url: string | null;
  error_message: string | null;
  created_at: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabelPage() {
  const [tab, setTab] = useState<"artists" | "prompts" | "albums" | "fans" | "platforms">("artists");

  // Artists
  const [channels, setChannels] = useState<ArtistChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [editChannel, setEditChannel] = useState<Record<string, Partial<ArtistChannel>>>({});

  // Prompts
  const [promptPersona, setPromptPersona] = useState("ThirstyBoy");
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});

  // Albums
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumTracks, setAlbumTracks] = useState<Record<string, AlbumTrack[]>>({});
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ title: "", persona_name: "ThirstyBoy", description: "", art_url: "" });
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [addingTrack, setAddingTrack] = useState<string | null>(null);
  const [newTrack, setNewTrack] = useState({ title: "", youtube_url: "" });

  // Fan
  const [fanJobs, setFanJobs] = useState<FanJob[]>([]);
  const [loadingFan, setLoadingFan] = useState(true);
  const [launchingFan, setLaunchingFan] = useState(false);
  const [fanForm, setFanForm] = useState({ persona_name: "ThirstyBoy", video_id: "" });

  // Platforms
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [platformDrafts, setPlatformDrafts] = useState<Record<string, Partial<PlatformAccount>>>({});
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [platformPostJobs, setPlatformPostJobs] = useState<PlatformPostJob[]>([]);
  const [postJobForm, setPostJobForm] = useState({ persona_name: "ThirstyBoy", platform: "soundcloud", title: "", audio_url: "", video_url: "", description: "", tags: "" });
  const [launchingPost, setLaunchingPost] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    const { data } = await supabase.from("artist_channels").select("*").order("created_at");
    setChannels(data ?? []);
    setLoadingChannels(false);
  }, []);

  const loadPrompts = useCallback(async (persona: string) => {
    setLoadingPrompts(true);
    const { data } = await supabase.from("artist_prompt_configs").select("*").eq("persona_name", persona);
    setPrompts(data ?? []);
    const drafts: Record<string, string> = {};
    PROMPT_TYPES.forEach(pt => {
      const saved = data?.find(p => p.prompt_type === pt.key);
      drafts[pt.key] = saved?.template ?? DEFAULT_PROMPTS[persona]?.[pt.key] ?? "";
    });
    setPromptDrafts(drafts);
    setLoadingPrompts(false);
  }, []);

  const loadAlbums = useCallback(async () => {
    setLoadingAlbums(true);
    const { data } = await supabase.from("albums").select("*").order("created_at", { ascending: false });
    setAlbums(data ?? []);
    setLoadingAlbums(false);
  }, []);

  const loadAlbumTracks = useCallback(async (albumId: string) => {
    const { data } = await supabase.from("album_tracks").select("*").eq("album_id", albumId).order("track_number");
    setAlbumTracks(prev => ({ ...prev, [albumId]: data ?? [] }));
  }, []);

  const loadFanJobs = useCallback(async () => {
    setLoadingFan(true);
    const { data } = await supabase.from("fan_interaction_jobs").select("*").order("created_at", { ascending: false }).limit(20);
    setFanJobs(data ?? []);
    setLoadingFan(false);
  }, []);

  const loadPlatformAccounts = useCallback(async () => {
    const { data } = await supabase.from("artist_platform_accounts").select("*");
    setPlatformAccounts(data ?? []);
  }, []);

  const loadPlatformPostJobs = useCallback(async () => {
    const { data } = await supabase.from("platform_post_jobs").select("*").order("created_at", { ascending: false }).limit(30);
    setPlatformPostJobs(data ?? []);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => { loadAlbums(); }, [loadAlbums]);
  useEffect(() => { loadFanJobs(); }, [loadFanJobs]);
  useEffect(() => { loadPrompts(promptPersona); }, [promptPersona, loadPrompts]);
  useEffect(() => { loadPlatformAccounts(); }, [loadPlatformAccounts]);
  useEffect(() => { loadPlatformPostJobs(); }, [loadPlatformPostJobs]);

  // ── Channel actions ───────────────────────────────────────────────────────

  function getChannelEdit(name: string, field: keyof ArtistChannel, fallback: unknown) {
    const ch = channels.find(c => c.persona_name === name);
    const draft = editChannel[name];
    if (draft && field in draft) return draft[field];
    return ch?.[field] ?? fallback;
  }

  function setChannelField(name: string, field: keyof ArtistChannel, value: unknown) {
    setEditChannel(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  }

  async function saveChannel(personaName: string) {
    setSavingChannel(personaName);
    const draft = editChannel[personaName] ?? {};
    const existing = channels.find(c => c.persona_name === personaName);
    if (existing) {
      const { data } = await supabase.from("artist_channels").update(draft).eq("id", existing.id).select().single();
      if (data) setChannels(prev => prev.map(c => c.id === data.id ? data : c));
    } else {
      const isMaster = personaName === "Dehydration Nation";
      const { data } = await supabase.from("artist_channels").insert({
        persona_name: personaName,
        is_master: isMaster,
        ...draft,
      }).select().single();
      if (data) setChannels(prev => [...prev, data]);
    }
    setEditChannel(prev => { const n = { ...prev }; delete n[personaName]; return n; });
    setSavingChannel(null);
  }

  // ── Prompt actions ────────────────────────────────────────────────────────

  async function savePrompt(promptType: string) {
    setSavingPrompt(promptType);
    const template = promptDrafts[promptType] ?? "";
    const existing = prompts.find(p => p.prompt_type === promptType);
    if (existing) {
      await supabase.from("artist_prompt_configs").update({ template, updated_at: new Date().toISOString() }).eq("id", existing.id);
      setPrompts(prev => prev.map(p => p.id === existing.id ? { ...p, template } : p));
    } else {
      const { data } = await supabase.from("artist_prompt_configs").insert({
        persona_name: promptPersona, prompt_type: promptType, template,
      }).select().single();
      if (data) setPrompts(prev => [...prev, data]);
    }
    setSavingPrompt(null);
  }

  function resetPrompt(promptType: string) {
    setPromptDrafts(prev => ({ ...prev, [promptType]: DEFAULT_PROMPTS[promptPersona]?.[promptType] ?? "" }));
  }

  // ── Album actions ─────────────────────────────────────────────────────────

  async function createAlbum() {
    if (!newAlbum.title.trim()) return;
    setSavingAlbum(true);
    const { data } = await supabase.from("albums").insert({
      title: newAlbum.title.trim(),
      persona_name: newAlbum.persona_name,
      description: newAlbum.description || null,
      art_url: newAlbum.art_url || null,
    }).select().single();
    if (data) setAlbums(prev => [data, ...prev]);
    setNewAlbum({ title: "", persona_name: "ThirstyBoy", description: "", art_url: "" });
    setShowAlbumForm(false);
    setSavingAlbum(false);
  }

  async function deleteAlbum(id: string) {
    await supabase.from("albums").delete().eq("id", id);
    setAlbums(prev => prev.filter(a => a.id !== id));
  }

  async function addTrack(albumId: string) {
    const tracks = albumTracks[albumId] ?? [];
    const trackNumber = tracks.length + 1;
    const { data } = await supabase.from("album_tracks").insert({
      album_id: albumId,
      track_number: trackNumber,
      title: newTrack.title || null,
      youtube_url: newTrack.youtube_url || null,
      status: newTrack.youtube_url ? "uploaded" : "pending",
    }).select().single();
    if (data) {
      setAlbumTracks(prev => ({ ...prev, [albumId]: [...(prev[albumId] ?? []), data] }));
    }
    setNewTrack({ title: "", youtube_url: "" });
    setAddingTrack(null);
  }

  async function updateTrackStatus(track: AlbumTrack, field: "youtube_url" | "status", value: string) {
    await supabase.from("album_tracks").update({ [field]: value }).eq("id", track.id);
    setAlbumTracks(prev => ({
      ...prev,
      [track.album_id]: (prev[track.album_id] ?? []).map(t => t.id === track.id ? { ...t, [field]: value } : t),
    }));
  }

  async function deleteTrack(track: AlbumTrack) {
    await supabase.from("album_tracks").delete().eq("id", track.id);
    setAlbumTracks(prev => ({
      ...prev,
      [track.album_id]: (prev[track.album_id] ?? []).filter(t => t.id !== track.id),
    }));
  }

  // ── Fan actions ───────────────────────────────────────────────────────────

  async function launchFanJob() {
    setLaunchingFan(true);
    const { data } = await supabase.from("fan_interaction_jobs").insert({
      persona_name: fanForm.persona_name,
      video_id: fanForm.video_id || null,
      status: "pending",
    }).select().single();
    if (data) setFanJobs(prev => [data, ...prev]);
    setFanForm(f => ({ ...f, video_id: "" }));
    setLaunchingFan(false);
  }

  async function cancelFanJob(id: string) {
    await supabase.from("fan_interaction_jobs").update({ status: "error", error_message: "Cancelled" }).eq("id", id);
    setFanJobs(prev => prev.map(j => j.id === id ? { ...j, status: "error" } : j));
  }

  // ── Platform account actions ──────────────────────────────────────────────

  function getPlatformKey(personaName: string, platform: string) {
    return `${personaName}__${platform}`;
  }

  function getPlatformField(personaName: string, platform: string, field: keyof PlatformAccount, fallback: unknown) {
    const key = getPlatformKey(personaName, platform);
    const draft = platformDrafts[key];
    if (draft && field in draft) return draft[field];
    const saved = platformAccounts.find(a => a.persona_name === personaName && a.platform === platform);
    return saved?.[field] ?? fallback;
  }

  function setPlatformField(personaName: string, platform: string, field: keyof PlatformAccount, value: unknown) {
    const key = getPlatformKey(personaName, platform);
    setPlatformDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function savePlatformAccount(personaName: string, platform: string) {
    const key = getPlatformKey(personaName, platform);
    const draft = platformDrafts[key] ?? {};
    setSavingPlatform(key);
    const existing = platformAccounts.find(a => a.persona_name === personaName && a.platform === platform);
    if (existing) {
      const { data } = await supabase.from("artist_platform_accounts").update(draft).eq("id", existing.id).select().single();
      if (data) setPlatformAccounts(prev => prev.map(a => a.id === data.id ? data : a));
    } else {
      const { data } = await supabase.from("artist_platform_accounts").insert({
        persona_name: personaName, platform, ...draft,
      }).select().single();
      if (data) setPlatformAccounts(prev => [...prev, data]);
    }
    setPlatformDrafts(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSavingPlatform(null);
  }

  async function launchPlatformPost() {
    if (!postJobForm.audio_url && !postJobForm.video_url) return;
    setLaunchingPost(true);
    const { data } = await supabase.from("platform_post_jobs").insert({
      persona_name: postJobForm.persona_name,
      platform: postJobForm.platform,
      audio_url: postJobForm.audio_url || null,
      video_url: postJobForm.video_url || null,
      title: postJobForm.title || null,
      description: postJobForm.description || null,
      tags: postJobForm.tags || null,
    }).select().single();
    if (data) setPlatformPostJobs(prev => [data, ...prev]);
    setPostJobForm(f => ({ ...f, audio_url: "", video_url: "", title: "", description: "", tags: "" }));
    setLaunchingPost(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allArtists = [...PERSONAS.map(p => p.name), MASTER_CHANNEL.name];

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> label.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Dehydration Nation</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Artist channels · prompt studio · album manager · fan engagement
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl border border-green-500/20 bg-black/40 mb-6 w-fit">
          {[
            { key: "artists", label: "Artists",       icon: Mic2 },
            { key: "prompts", label: "Prompt Studio", icon: Wand2 },
            { key: "albums",  label: "Albums",        icon: Disc3 },
            { key: "fans",      label: "Fan Engagement", icon: Heart  },
          { key: "platforms", label: "Platforms",      icon: Share2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-mono font-bold transition-all ${
                tab === key
                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                  : "text-green-700 hover:text-green-500"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ── TAB: Artists ── */}
        {tab === "artists" && (
          <div className="space-y-3">
            <p className="text-xs text-green-700 font-mono mb-4">
              Configure each artist&apos;s YouTube channel ID. Tracks uploaded via the pipeline will post to that channel (and optionally to Dehydration Nation too).
            </p>

            {/* Master channel first */}
            {[MASTER_CHANNEL, ...PERSONAS].map(persona => {
              const isMaster = persona.name === "Dehydration Nation";
              const ch = channels.find(c => c.persona_name === persona.name);
              const isDirty = !!editChannel[persona.name] && Object.keys(editChannel[persona.name]).length > 0;
              return (
                <div key={persona.name} className={`rounded-xl border ${persona.bg} p-4`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{persona.emoji}</span>
                    <div>
                      <p className={`text-sm font-mono font-black ${persona.color}`}>{persona.name}</p>
                      {isMaster && <p className="text-xs text-green-800 font-mono">Master label channel — receives all tracks</p>}
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {!isMaster && (
                        <label className="flex items-center gap-1.5 text-xs font-mono text-green-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-400"
                            checked={Boolean(getChannelEdit(persona.name, "upload_to_master", ch?.upload_to_master ?? true))}
                            onChange={e => setChannelField(persona.name, "upload_to_master", e.target.checked)}
                          />
                          post to DN
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-xs font-mono text-green-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-green-400"
                          checked={Boolean(getChannelEdit(persona.name, "auto_interact", ch?.auto_interact ?? false))}
                          onChange={e => setChannelField(persona.name, "auto_interact", e.target.checked)}
                        />
                        auto-interact
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Display name"
                      value={String(getChannelEdit(persona.name, "channel_name", ch?.channel_name ?? ""))}
                      onChange={e => setChannelField(persona.name, "channel_name", e.target.value)}
                    />
                    <input
                      className="bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="YouTube channel ID (UCxxxxxxxx)"
                      value={String(getChannelEdit(persona.name, "youtube_channel_id", ch?.youtube_channel_id ?? ""))}
                      onChange={e => setChannelField(persona.name, "youtube_channel_id", e.target.value)}
                    />
                  </div>
                  {isDirty && (
                    <button
                      onClick={() => saveChannel(persona.name)}
                      disabled={savingChannel === persona.name}
                      className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40"
                    >
                      {savingChannel === persona.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: Prompt Studio ── */}
        {tab === "prompts" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <p className="text-xs text-green-700 font-mono">Artist:</p>
              <div className="flex gap-1 flex-wrap">
                {[...PERSONAS.map(p => p.name), "Dehydration Nation"].map(name => {
                  const meta = name === "Dehydration Nation" ? MASTER_CHANNEL : PERSONAS.find(p => p.name === name)!;
                  return (
                    <button
                      key={name}
                      onClick={() => setPromptPersona(name)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all border ${
                        promptPersona === name
                          ? `${meta.bg} ${meta.color} border-current/50`
                          : "text-green-800 border-green-500/20 hover:text-green-600"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingPrompts ? (
              <div className="flex items-center gap-2 text-green-700 font-mono text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading prompts...
              </div>
            ) : (
              <div className="space-y-4">
                {PROMPT_TYPES.map(({ key, label, icon: Icon }) => {
                  const isDefault = (promptDrafts[key] ?? "") === (DEFAULT_PROMPTS[promptPersona]?.[key] ?? "");
                  return (
                    <div key={key} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-green-400" />
                        <p className="text-xs font-mono font-black uppercase tracking-wider text-green-500">{label}</p>
                        {!isDefault && <span className="text-xs text-yellow-400 font-mono ml-auto">• modified</span>}
                        {key === "comment_reply" && (
                          <span className="text-xs text-green-800 font-mono ml-auto">use {`{comment}`} as placeholder</span>
                        )}
                      </div>
                      <textarea
                        className="w-full bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60 resize-y min-h-[80px]"
                        value={promptDrafts[key] ?? ""}
                        onChange={e => setPromptDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => savePrompt(key)}
                          disabled={savingPrompt === key}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40"
                        >
                          {savingPrompt === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => resetPrompt(key)}
                            className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Albums ── */}
        {tab === "albums" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-green-700 font-mono">Create albums, add tracks as they upload, reuse artwork across the whole release.</p>
              <button
                onClick={() => setShowAlbumForm(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> New Album
              </button>
            </div>

            {showAlbumForm && (
              <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 p-5 mb-4">
                <p className="text-xs font-mono font-black uppercase tracking-wider gradient-text mb-3">New Album</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Album title *"
                    value={newAlbum.title}
                    onChange={e => setNewAlbum(p => ({ ...p, title: e.target.value }))}
                  />
                  <select
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                    value={newAlbum.persona_name}
                    onChange={e => setNewAlbum(p => ({ ...p, persona_name: e.target.value }))}
                  >
                    {allArtists.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input
                    className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Album art URL (reused for all tracks)"
                    value={newAlbum.art_url}
                    onChange={e => setNewAlbum(p => ({ ...p, art_url: e.target.value }))}
                  />
                  <input
                    className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Description (optional)"
                    value={newAlbum.description}
                    onChange={e => setNewAlbum(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createAlbum}
                    disabled={savingAlbum || !newAlbum.title.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
                  >
                    {savingAlbum ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Album
                  </button>
                  <button onClick={() => setShowAlbumForm(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2">Cancel</button>
                </div>
              </div>
            )}

            {loadingAlbums ? (
              <div className="flex items-center gap-2 text-green-700 font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : albums.length === 0 ? (
              <p className="text-xs text-green-800 font-mono">No albums yet. Create your first one above.</p>
            ) : (
              <div className="space-y-3">
                {albums.map(album => {
                  const meta = album.persona_name === "Dehydration Nation" ? MASTER_CHANNEL : PERSONAS.find(p => p.name === album.persona_name) ?? PERSONAS[0];
                  const tracks = albumTracks[album.id];
                  const isExpanded = expandedAlbum === album.id;
                  const uploadedCount = (tracks ?? []).filter(t => t.status === "uploaded").length;

                  return (
                    <div key={album.id} className={`rounded-xl border ${meta.bg} bg-black/40`}>
                      <button
                        onClick={() => {
                          if (!isExpanded && !tracks) loadAlbumTracks(album.id);
                          setExpandedAlbum(isExpanded ? null : album.id);
                        }}
                        className="w-full flex items-center gap-3 p-4"
                      >
                        {album.art_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={album.art_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                            <Disc3 className={`w-5 h-5 ${meta.color}`} />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-mono font-black ${meta.color}`}>{album.title}</p>
                          <p className="text-xs text-green-800 font-mono">{album.persona_name} · {uploadedCount}/{tracks?.length ?? "?"} uploaded</p>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                          album.status === "released" ? "border-green-400/40 text-green-400" : "border-yellow-500/30 text-yellow-400"
                        }`}>{album.status}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-green-700" /> : <ChevronDown className="w-4 h-4 text-green-700" />}
                        <button
                          onClick={e => { e.stopPropagation(); deleteAlbum(album.id); }}
                          className="text-green-900 hover:text-red-500 transition-colors ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-green-500/10 p-4">
                          {album.art_url && (
                            <p className="text-xs text-green-700 font-mono mb-3">
                              🖼️ Shared artwork: <a href={album.art_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-green-400">{album.art_url.slice(0, 60)}...</a>
                            </p>
                          )}

                          {/* Track list */}
                          <div className="space-y-2 mb-3">
                            {(tracks ?? []).map(track => (
                              <div key={track.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-green-500/10">
                                <span className="text-xs text-green-800 font-mono w-4 text-right flex-shrink-0">{track.track_number}.</span>
                                <p className="text-xs font-mono text-green-400 flex-1 truncate">{track.title ?? "Untitled"}</p>
                                {track.youtube_url ? (
                                  <a href={track.youtube_url} target="_blank" rel="noreferrer" className="text-xs text-red-400 font-mono hover:underline flex items-center gap-1 flex-shrink-0">
                                    <Youtube className="w-3 h-3" /> live
                                  </a>
                                ) : (
                                  <input
                                    className="text-xs bg-black/60 border border-green-500/20 rounded px-2 py-1 text-green-700 font-mono w-48 focus:outline-none focus:border-green-400/60"
                                    placeholder="Paste YouTube URL..."
                                    onBlur={e => { if (e.target.value) updateTrackStatus(track, "youtube_url", e.target.value); }}
                                  />
                                )}
                                <button onClick={() => deleteTrack(track)} className="text-green-900 hover:text-red-500 transition-colors flex-shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add track */}
                          {addingTrack === album.id ? (
                            <div className="flex gap-2 items-center">
                              <input
                                className="flex-1 bg-black/60 border border-green-500/20 rounded-lg px-3 py-1.5 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                                placeholder="Track title"
                                value={newTrack.title}
                                onChange={e => setNewTrack(p => ({ ...p, title: e.target.value }))}
                              />
                              <input
                                className="flex-1 bg-black/60 border border-green-500/20 rounded-lg px-3 py-1.5 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                                placeholder="YouTube URL (optional)"
                                value={newTrack.youtube_url}
                                onChange={e => setNewTrack(p => ({ ...p, youtube_url: e.target.value }))}
                              />
                              <button onClick={() => addTrack(album.id)} className="text-xs px-2 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all">
                                <Check className="w-3 h-3" />
                              </button>
                              <button onClick={() => setAddingTrack(null)} className="text-green-800 hover:text-green-600 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingTrack(album.id); setNewTrack({ title: "", youtube_url: "" }); }}
                              className="flex items-center gap-1 text-xs font-mono text-green-700 hover:text-green-400 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add track
                            </button>
                          )}

                          {/* Album controls */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-green-500/10">
                            {album.youtube_playlist_id ? (
                              <a
                                href={`https://www.youtube.com/playlist?list=${album.youtube_playlist_id}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 font-mono font-bold hover:bg-red-500/10 transition-all"
                              >
                                <ListMusic className="w-3.5 h-3.5" /> View Playlist
                              </a>
                            ) : (
                              <button
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all"
                                onClick={async () => {
                                  const pid = prompt("Paste the YouTube playlist ID (from the URL after ?list=):");
                                  if (!pid) return;
                                  await supabase.from("albums").update({ youtube_playlist_id: pid }).eq("id", album.id);
                                  setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, youtube_playlist_id: pid } : a));
                                }}
                              >
                                <ListMusic className="w-3.5 h-3.5" /> Link Playlist
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                const newStatus = album.status === "released" ? "in_progress" : "released";
                                await supabase.from("albums").update({ status: newStatus }).eq("id", album.id);
                                setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, status: newStatus } : a));
                              }}
                              className="text-xs font-mono text-green-700 hover:text-green-400 transition-colors px-2"
                            >
                              Mark as {album.status === "released" ? "in progress" : "released"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Fan Engagement ── */}
        {tab === "fans" && (
          <div>
            <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-green-400" />
                <p className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Launch Fan Interaction Job</p>
              </div>
              <p className="text-xs text-green-700 font-mono mb-4">
                The browser extension will open YouTube, find recent comments on the artist&apos;s videos, generate replies using their persona&apos;s comment prompt, and post them. Leave video ID blank to scan all recent videos.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={fanForm.persona_name}
                  onChange={e => setFanForm(p => ({ ...p, persona_name: e.target.value }))}
                >
                  {allArtists.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Video ID (optional — blank = all recent)"
                  value={fanForm.video_id}
                  onChange={e => setFanForm(p => ({ ...p, video_id: e.target.value }))}
                />
              </div>
              <button
                onClick={launchFanJob}
                disabled={launchingFan}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
              >
                {launchingFan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                {launchingFan ? "Launching..." : "Launch Interaction Job"}
              </button>
            </div>

            {/* Job history */}
            <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
              <span className="text-red-500">&gt;</span> Recent jobs
            </p>
            {loadingFan ? (
              <div className="flex items-center gap-2 text-green-700 font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : fanJobs.length === 0 ? (
              <p className="text-xs text-green-800 font-mono">No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {fanJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl border border-green-500/15 bg-black/30 font-mono text-xs">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      job.status === "complete" ? "bg-green-400" :
                      job.status === "running" ? "bg-yellow-400 animate-pulse" :
                      job.status === "error" ? "bg-red-400" : "bg-green-800"
                    }`} />
                    <span className="text-green-500 font-bold">{job.persona_name}</span>
                    {job.video_id && <span className="text-green-800">{job.video_id}</span>}
                    <span className="text-green-700">{job.comments_replied} replies · {job.likes_given} likes</span>
                    <span className="ml-auto text-green-900">{new Date(job.created_at).toLocaleDateString()}</span>
                    {job.status === "pending" && (
                      <button onClick={() => cancelFanJob(job.id)} className="text-green-900 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Platforms ── */}
        {tab === "platforms" && (
          <div>
            <p className="text-xs text-green-700 font-mono mb-5">
              Toggle each platform per artist. The extension will automatically post to enabled platforms after each track uploads to YouTube.
            </p>

            {/* Platform accounts grid */}
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr>
                    <th className="text-left text-green-700 pb-3 pr-4 font-semibold uppercase tracking-wider">Artist</th>
                    {PLATFORMS.map(p => (
                      <th key={p.key} className={`text-center pb-3 px-2 font-semibold uppercase tracking-wider ${p.color}`}>
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-500/10">
                  {[MASTER_CHANNEL, ...PERSONAS].map(persona => (
                    <tr key={persona.name}>
                      <td className="py-3 pr-4">
                        <span className={`font-bold ${persona.color}`}>{persona.emoji} {persona.name}</span>
                      </td>
                      {PLATFORMS.map(platform => {
                        const key = getPlatformKey(persona.name, platform.key);
                        const isDirty = !!platformDrafts[key] && Object.keys(platformDrafts[key]).length > 0;
                        const isActive = Boolean(getPlatformField(persona.name, platform.key, "active", false));
                        const handle = String(getPlatformField(persona.name, platform.key, "handle", ""));
                        return (
                          <td key={platform.key} className="py-3 px-2">
                            <div className="flex flex-col items-center gap-1.5">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="accent-green-400"
                                  checked={isActive}
                                  onChange={e => setPlatformField(persona.name, platform.key, "active", e.target.checked)}
                                />
                                <span className={isActive ? "text-green-400" : "text-green-800"}>on</span>
                              </label>
                              <input
                                className="w-24 bg-black/60 border border-green-500/20 rounded px-1.5 py-1 text-green-400 placeholder-green-900 focus:outline-none focus:border-green-400/60 text-center"
                                placeholder="@handle"
                                value={handle}
                                onChange={e => setPlatformField(persona.name, platform.key, "handle", e.target.value)}
                              />
                              {isDirty && (
                                <button
                                  onClick={() => savePlatformAccount(persona.name, platform.key)}
                                  disabled={savingPlatform === key}
                                  className="text-green-600 hover:text-green-300 transition-colors"
                                >
                                  {savingPlatform === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Manual post launcher */}
            <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="w-4 h-4 text-green-400" />
                <p className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Manual Post Job</p>
              </div>
              <p className="text-xs text-green-700 font-mono mb-4">
                Paste a track&apos;s audio or video URL to queue a post to any platform. The extension will pick it up and post automatically.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={postJobForm.persona_name}
                  onChange={e => setPostJobForm(p => ({ ...p, persona_name: e.target.value }))}
                >
                  {allArtists.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={postJobForm.platform}
                  onChange={e => setPostJobForm(p => ({ ...p, platform: e.target.value }))}
                >
                  {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Audio URL (.mp3)"
                  value={postJobForm.audio_url}
                  onChange={e => setPostJobForm(p => ({ ...p, audio_url: e.target.value }))}
                />
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Video URL (.mp4) — for TikTok/IG/FB/X"
                  value={postJobForm.video_url}
                  onChange={e => setPostJobForm(p => ({ ...p, video_url: e.target.value }))}
                />
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Track title"
                  value={postJobForm.title}
                  onChange={e => setPostJobForm(p => ({ ...p, title: e.target.value }))}
                />
                <input
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Tags (e.g. #drumandbass #dubstep)"
                  value={postJobForm.tags}
                  onChange={e => setPostJobForm(p => ({ ...p, tags: e.target.value }))}
                />
                <input
                  className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Description / caption"
                  value={postJobForm.description}
                  onChange={e => setPostJobForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <button
                onClick={launchPlatformPost}
                disabled={launchingPost || (!postJobForm.audio_url && !postJobForm.video_url)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
              >
                {launchingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {launchingPost ? "Queuing..." : "Queue Post"}
              </button>
            </div>

            {/* Post job history */}
            <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
              <span className="text-red-500">&gt;</span> Post history
            </p>
            {platformPostJobs.length === 0 ? (
              <p className="text-xs text-green-800 font-mono">No posts yet.</p>
            ) : (
              <div className="space-y-2">
                {platformPostJobs.map(job => {
                  const plt = PLATFORMS.find(p => p.key === job.platform);
                  const Icon = plt?.icon ?? Share2;
                  return (
                    <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl border border-green-500/15 bg-black/30 font-mono text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        job.status === "complete" ? "bg-green-400" :
                        job.status === "running"  ? "bg-yellow-400 animate-pulse" :
                        job.status === "error"    ? "bg-red-400" : "bg-green-800"
                      }`} />
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${plt?.color ?? "text-green-600"}`} />
                      <span className="text-green-500 font-bold">{job.persona_name}</span>
                      <span className="text-green-700">{plt?.label}</span>
                      {job.title && <span className="text-green-800 truncate flex-1">{job.title}</span>}
                      {job.post_url && (
                        <a href={job.post_url} target="_blank" rel="noreferrer" className="text-green-500 hover:underline flex-shrink-0">view</a>
                      )}
                      {job.error_message && <span className="text-red-400 truncate flex-1">{job.error_message}</span>}
                      <span className="ml-auto text-green-900 flex-shrink-0">{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
