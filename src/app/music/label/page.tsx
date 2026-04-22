"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  Youtube, Music2, Disc3, MessageSquare, Wand2,
  Plus, X, Check, Loader2, Save, ChevronDown, ChevronUp,
  Mic2, Globe, Users, Heart, BookOpen, ListMusic, Share2, Radio,
  Pencil, Trash2, ExternalLink, RefreshCw, Eye, ThumbsUp, Tag,
  Layers, ArrowRight, Image as ImageIcon,
} from "lucide-react";

// ─── Styles ───────────────────────────────────────────────────────────────────

const KNOWN_STYLES: Record<string, { color: string; bg: string; emoji: string }> = {
  "ThirstyBoy":           { color: "text-red-400",    bg: "border-red-500/30 bg-red-500/5",       emoji: "🔥" },
  "Stephani Luci":        { color: "text-pink-400",   bg: "border-pink-500/30 bg-pink-500/5",     emoji: "🌸" },
  "Hard On":              { color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5", emoji: "⚡" },
  "Wrapper":              { color: "text-yellow-400", bg: "border-yellow-500/30 bg-yellow-500/5", emoji: "🎤" },
  "Jerry Country Singer": { color: "text-amber-400",  bg: "border-amber-500/30 bg-amber-500/5",   emoji: "🤠" },
  "RaStevefarian":        { color: "text-green-400",  bg: "border-green-500/30 bg-green-500/5",   emoji: "🌿" },
  "Gore Lord":            { color: "text-purple-400", bg: "border-purple-500/30 bg-purple-500/5", emoji: "💀" },
  "Dehydration Nation":   { color: "text-cyan-400",   bg: "border-cyan-500/30 bg-cyan-500/5",     emoji: "🏷️" },
};

const COLOR_OPTIONS = [
  { key: "red",    color: "text-red-400",    bg: "border-red-500/30 bg-red-500/5" },
  { key: "pink",   color: "text-pink-400",   bg: "border-pink-500/30 bg-pink-500/5" },
  { key: "orange", color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5" },
  { key: "yellow", color: "text-yellow-400", bg: "border-yellow-500/30 bg-yellow-500/5" },
  { key: "amber",  color: "text-amber-400",  bg: "border-amber-500/30 bg-amber-500/5" },
  { key: "lime",   color: "text-lime-400",   bg: "border-lime-500/30 bg-lime-500/5" },
  { key: "green",  color: "text-green-400",  bg: "border-green-500/30 bg-green-500/5" },
  { key: "teal",   color: "text-teal-400",   bg: "border-teal-500/30 bg-teal-500/5" },
  { key: "cyan",   color: "text-cyan-400",   bg: "border-cyan-500/30 bg-cyan-500/5" },
  { key: "blue",   color: "text-blue-400",   bg: "border-blue-500/30 bg-blue-500/5" },
  { key: "purple", color: "text-purple-400", bg: "border-purple-500/30 bg-purple-500/5" },
  { key: "rose",   color: "text-rose-400",   bg: "border-rose-500/30 bg-rose-500/5" },
];

function getPersonaStyle(name: string, colorKey?: string | null, emojiOverride?: string | null) {
  if (KNOWN_STYLES[name]) return { ...KNOWN_STYLES[name], emoji: emojiOverride ?? KNOWN_STYLES[name].emoji };
  const col = COLOR_OPTIONS.find(c => c.key === colorKey) ?? COLOR_OPTIONS[0];
  return { color: col.color, bg: col.bg, emoji: emojiOverride ?? "🎵" };
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

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

const PROMPT_VARS: Record<string, string> = {
  // Track
  lyrics:            "{{genre}}  {{theme}}",
  art:               "{{genre}}  {{theme}}",
  title:             "{{genre}}  {{theme}}",
  metadata:          "{{genre}}  {{theme}}",
  comment_reply:     "{{comment}}",
  // Album
  album_title:       "{{genre}}  {{theme}}  {{track_count}}",
  album_art:         "{{album_title}}  {{genre}}",
  track_art_overlay: "{{album_art_url}}  {{album_title}}  {{genre}}  {{theme}}",
  // Playlist
  playlist_name:     "{{vibe}}  {{playlist_type}}",
};

const PROMPT_TYPES = [
  // ── Track ──
  { key: "lyrics",            group: "track",   label: "Lyrics / Notes",   icon: Music2,       fallback: "" },
  { key: "art",               group: "track",   label: "Cover Art",         icon: Wand2,        fallback: "" },
  { key: "title",             group: "track",   label: "Track Title",       icon: BookOpen,     fallback: "" },
  { key: "metadata",          group: "track",   label: "YT Description",    icon: Globe,        fallback: "" },
  { key: "comment_reply",     group: "track",   label: "Comment Reply",     icon: MessageSquare, fallback: "" },
  // ── Album ──
  { key: "album_title",       group: "album",   label: "Album Title",       icon: Disc3,        fallback: "Generate a 2-4 word album title for a {{genre}} artist exploring {{theme}}. Return ONLY the title — no quotes, no explanation." },
  { key: "album_art",         group: "album",   label: "Album Art",         icon: ImageIcon,    fallback: "Generate professional square album cover art for '{{album_title}}' — a {{genre}} release. Dark, atmospheric, no text on the image." },
  { key: "track_art_overlay", group: "album",   label: "Track Art Style",   icon: Layers,       fallback: "Create artwork for a {{genre}} track from the album '{{album_title}}'. Theme: {{theme}}. Visually match the album's aesthetic and color palette. No text on image." },
  // ── Playlist ──
  { key: "playlist_name",     group: "playlist", label: "Playlist Name",    icon: ListMusic,    fallback: "Generate a creative 3-5 word YouTube playlist name. Vibe: {{vibe}}. Type: {{playlist_type}}. Return ONLY the name." },
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
  emoji: string | null;
  color_key: string | null;
  playlist_auto_sync: boolean;
  current_album_id: string | null;
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
  max_tracks: number;
  auto_generated: boolean;
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

interface ArtistPlaylist {
  id: string;
  persona_name: string;
  name: string;
  description: string | null;
  privacy: string;
  youtube_playlist_id: string | null;
  playlist_type: string;
  auto_tags: string[];
  top_n: number;
  created_at: string;
}

interface ArtistTrackName {
  id: string;
  persona_name: string;
  track_name: string;
  youtube_video_id: string | null;
  youtube_url: string | null;
  tags: string[];
  view_count: number;
  like_count: number;
  last_stats_synced_at: string | null;
  created_at: string;
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
  const [tab, setTab] = useState<"artists" | "prompts" | "albums" | "playlists" | "fans" | "platforms">("artists");

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
  const [generatingAlbum, setGeneratingAlbum] = useState<string | null>(null);
  const [albumTrackCounts, setAlbumTrackCounts] = useState<Record<string, number>>({});

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

  // New artist + YouTube connect
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [showNewArtist, setShowNewArtist] = useState(false);
  const [newArtistForm, setNewArtistForm] = useState({ name: "", emoji: "🎵", color_key: "purple", channel_name: "", youtube_channel_id: "", genre_description: "" });
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState<string | null>(null);
  const [scanningReply, setScanningReply] = useState<string | null>(null);
  const [editingArtist, setEditingArtist] = useState<string | null>(null);
  const [confirmDeleteArtist, setConfirmDeleteArtist] = useState<string | null>(null);
  const [deletingArtist, setDeletingArtist] = useState<string | null>(null);

  // Playlists
  const [artistPlaylists, setArtistPlaylists] = useState<ArtistPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistPersona, setPlaylistPersona] = useState("");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: "", description: "", privacy: "public", vibe: "" });
  const [savingNewPlaylist, setSavingNewPlaylist] = useState(false);
  const [generatingPlaylist, setGeneratingPlaylist] = useState(false);
  const [addingVideoTo, setAddingVideoTo] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [trackCatalog, setTrackCatalog] = useState<ArtistTrackName[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [syncingPlaylists, setSyncingPlaylists] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [playlistRuleDrafts, setPlaylistRuleDrafts] = useState<Record<string, { playlist_type: string; auto_tags: string; top_n: string }>>({});
  const [savingRules, setSavingRules] = useState<string | null>(null);
  const [editingTrackTags, setEditingTrackTags] = useState<string | null>(null);
  const [tagDraftInput, setTagDraftInput] = useState("");

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
      drafts[pt.key] = saved?.template ?? DEFAULT_PROMPTS[persona]?.[pt.key] ?? pt.fallback;
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

  const loadAlbumTrackCounts = useCallback(async () => {
    const { data } = await supabase.from("album_tracks").select("album_id");
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data) counts[row.album_id] = (counts[row.album_id] ?? 0) + 1;
    setAlbumTrackCounts(counts);
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

  const loadConnectedServices = useCallback(async () => {
    const { data } = await supabase.from("oauth_tokens").select("service").like("service", "youtube%");
    setConnectedServices((data ?? []).map((r: { service: string }) => r.service));
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => { loadAlbums(); loadAlbumTrackCounts(); }, [loadAlbums, loadAlbumTrackCounts]);
  useEffect(() => { loadFanJobs(); }, [loadFanJobs]);
  useEffect(() => { loadPrompts(promptPersona); }, [promptPersona, loadPrompts]);
  const loadPlaylists = useCallback(async (persona: string) => {
    setLoadingPlaylists(true);
    const { data } = await supabase.from("artist_playlists").select("*").eq("persona_name", persona).order("created_at", { ascending: false });
    setArtistPlaylists(data ?? []);
    setLoadingPlaylists(false);
  }, []);

  const loadTrackCatalog = useCallback(async (persona: string) => {
    setLoadingCatalog(true);
    const { data } = await supabase.from("artist_track_names").select("*").eq("persona_name", persona).order("created_at", { ascending: false });
    setTrackCatalog(data ?? []);
    setLoadingCatalog(false);
  }, []);

  useEffect(() => { loadPlatformAccounts(); }, [loadPlatformAccounts]);
  useEffect(() => { loadPlatformPostJobs(); }, [loadPlatformPostJobs]);
  useEffect(() => { loadConnectedServices(); }, [loadConnectedServices]);
  useEffect(() => { if (playlistPersona) loadPlaylists(playlistPersona); }, [playlistPersona, loadPlaylists]);
  useEffect(() => { if (playlistPersona) loadTrackCatalog(playlistPersona); }, [playlistPersona, loadTrackCatalog]);
  useEffect(() => { if (channels.length > 0 && !playlistPersona) setPlaylistPersona(channels[0].persona_name); }, [channels, playlistPersona]);

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

  async function createArtist() {
    if (!newArtistForm.name.trim()) return;
    setCreatingArtist(true);
    const { data } = await supabase.from("artist_channels").insert({
      persona_name: newArtistForm.name.trim(),
      channel_name: newArtistForm.channel_name || null,
      youtube_channel_id: newArtistForm.youtube_channel_id || null,
      emoji: newArtistForm.emoji,
      color_key: newArtistForm.color_key,
      is_master: false,
      upload_to_master: true,
      auto_interact: false,
      active: true,
    }).select().single();
    if (data) {
      setChannels(prev => [...prev, data]);
      // Seed default prompts (blank templates so Prompt Studio can fill them)
      const seeds = ["lyrics", "art", "title", "metadata", "comment_reply"].map(t => ({
        persona_name: newArtistForm.name.trim(),
        prompt_type: t,
        template: newArtistForm.genre_description
          ? `Write ${t} content for ${newArtistForm.name.trim()} — ${newArtistForm.genre_description}.`
          : "",
      }));
      await supabase.from("artist_prompt_configs").insert(seeds);
    }
    setNewArtistForm({ name: "", emoji: "🎵", color_key: "purple", channel_name: "", youtube_channel_id: "", genre_description: "" });
    setShowNewArtist(false);
    setCreatingArtist(false);
  }

  async function deleteArtist(personaName: string) {
    setDeletingArtist(personaName);
    await supabase.from("artist_prompt_configs").delete().eq("persona_name", personaName);
    await supabase.from("artist_channels").delete().eq("persona_name", personaName);
    setChannels(prev => prev.filter(c => c.persona_name !== personaName));
    setConfirmDeleteArtist(null);
    setDeletingArtist(null);
    setEditingArtist(null);
  }

  async function createGeneralPlaylist() {
    if (!newPlaylist.name.trim() || !playlistPersona) return;
    setSavingNewPlaylist(true);
    const { data: dbRow } = await supabase.from("artist_playlists").insert({
      persona_name: playlistPersona,
      name: newPlaylist.name.trim(),
      description: newPlaylist.description || null,
      privacy: newPlaylist.privacy,
    }).select().single();
    if (dbRow) {
      try {
        const res = await fetch("/api/youtube/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newPlaylist.name.trim(),
            description: newPlaylist.description,
            privacy: newPlaylist.privacy,
            persona_name: playlistPersona,
          }),
        });
        const json = await res.json();
        if (json.playlistId) {
          await supabase.from("artist_playlists").update({ youtube_playlist_id: json.playlistId }).eq("id", dbRow.id);
          dbRow.youtube_playlist_id = json.playlistId;
        }
      } catch {}
      setArtistPlaylists(prev => [{ ...dbRow }, ...prev]);
    }
    setNewPlaylist({ name: "", description: "", privacy: "public", vibe: "" });
    setShowNewPlaylist(false);
    setSavingNewPlaylist(false);
  }

  async function addVideoToPlaylist(playlist: ArtistPlaylist) {
    if (!videoUrlInput.trim() || !playlist.youtube_playlist_id) return;
    const videoId = extractVideoId(videoUrlInput);
    if (!videoId) return;
    setAddingVideoTo(playlist.id);
    await fetch("/api/youtube/playlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlist_id: playlist.youtube_playlist_id, video_id: videoId, persona_name: playlist.persona_name }),
    });
    setVideoUrlInput("");
    setAddingVideoTo(null);
  }

  async function deleteGeneralPlaylist(playlist: ArtistPlaylist) {
    await supabase.from("artist_playlists").delete().eq("id", playlist.id);
    setArtistPlaylists(prev => prev.filter(p => p.id !== playlist.id));
  }

  async function generatePlaylistName(playlistType: string) {
    if (!playlistPersona) return;
    setGeneratingPlaylist(true);
    try {
      const res = await fetch("/api/youtube/generate-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_name: playlistPersona,
          playlist_type: playlistType,
          tags: newPlaylist.vibe,
          vibe: newPlaylist.vibe,
        }),
      });
      const json = await res.json();
      if (json.name) setNewPlaylist(p => ({ ...p, name: json.name, description: json.description ?? p.description }));
    } catch {}
    setGeneratingPlaylist(false);
  }

  async function toggleAutoSync(personaName: string, enabled: boolean) {
    await supabase.from("artist_channels").update({ playlist_auto_sync: enabled }).eq("persona_name", personaName);
    setChannels(prev => prev.map(c => c.persona_name === personaName ? { ...c, playlist_auto_sync: enabled } : c));
  }

  async function syncPlaylists() {
    if (!playlistPersona) return;
    setSyncingPlaylists(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/youtube/playlist-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_name: playlistPersona }),
      });
      const json = await res.json();
      const r = json.results?.[playlistPersona];
      if (r?.error) setSyncResult(`Error: ${r.error}`);
      else setSyncResult(`✓ ${r?.statsUpdated ?? 0} stats updated · ${r?.added ?? 0} videos added to playlists`);
      loadTrackCatalog(playlistPersona);
    } catch (e) {
      setSyncResult(`Error: ${String(e)}`);
    }
    setSyncingPlaylists(false);
  }

  function getPlaylistRuleDraft(pl: ArtistPlaylist) {
    return playlistRuleDrafts[pl.id] ?? {
      playlist_type: pl.playlist_type ?? "general",
      auto_tags: (pl.auto_tags ?? []).join(", "),
      top_n: String(pl.top_n ?? 50),
    };
  }

  function setPlaylistRuleField(plId: string, pl: ArtistPlaylist, field: string, value: string) {
    setPlaylistRuleDrafts(prev => ({
      ...prev,
      [plId]: { ...getPlaylistRuleDraft(pl), ...prev[plId], [field]: value },
    }));
  }

  async function savePlaylistRules(pl: ArtistPlaylist) {
    const draft = playlistRuleDrafts[pl.id];
    if (!draft) return;
    setSavingRules(pl.id);
    const tagsArr = draft.auto_tags.split(",").map(t => t.trim()).filter(Boolean);
    await supabase.from("artist_playlists").update({
      playlist_type: draft.playlist_type,
      auto_tags: tagsArr,
      top_n: parseInt(draft.top_n) || 50,
    }).eq("id", pl.id);
    setArtistPlaylists(prev => prev.map(p => p.id === pl.id
      ? { ...p, playlist_type: draft.playlist_type, auto_tags: tagsArr, top_n: parseInt(draft.top_n) || 50 }
      : p));
    setPlaylistRuleDrafts(prev => { const n = { ...prev }; delete n[pl.id]; return n; });
    setSavingRules(null);
  }

  async function saveTrackTags(track: ArtistTrackName) {
    const tagsArr = tagDraftInput.split(",").map(t => t.trim()).filter(Boolean);
    await supabase.from("artist_track_names").update({ tags: tagsArr }).eq("id", track.id);
    setTrackCatalog(prev => prev.map(t => t.id === track.id ? { ...t, tags: tagsArr } : t));
    setEditingTrackTags(null);
    setTagDraftInput("");
  }

  async function createPlaylist(album: Album) {
    setCreatingPlaylist(album.id);
    try {
      const res = await fetch("/api/youtube/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: album.title,
          description: album.description ?? "",
          privacy: "public",
          persona_name: album.persona_name,
        }),
      });
      const json = await res.json();
      if (json.playlistId) {
        await supabase.from("albums").update({ youtube_playlist_id: json.playlistId }).eq("id", album.id);
        setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, youtube_playlist_id: json.playlistId } : a));
        // Add any tracks with YouTube URLs to the new playlist
        const tracks = albumTracks[album.id] ?? [];
        for (const t of tracks) {
          const vid = t.youtube_url ? extractVideoId(t.youtube_url) : null;
          if (vid) {
            await fetch("/api/youtube/playlist", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playlist_id: json.playlistId, video_id: vid, persona_name: album.persona_name }),
            });
          }
        }
      }
    } catch (e) {
      console.error("createPlaylist error", e);
    }
    setCreatingPlaylist(null);
  }

  async function scanAndReply(personaName: string) {
    setScanningReply(personaName);
    const { data } = await supabase.from("fan_interaction_jobs").insert({
      persona_name: personaName,
      video_id: null,
      status: "pending",
    }).select().single();
    if (data) setFanJobs(prev => [data, ...prev]);
    setScanningReply(null);
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

  async function generateNextAlbum(personaName: string) {
    setGeneratingAlbum(personaName);
    try {
      const res = await fetch("/api/youtube/generate-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_name: personaName }),
      });
      const json = await res.json();
      if (json.album) {
        setAlbums(prev => [json.album, ...prev]);
        setChannels(prev => prev.map(c => c.persona_name === personaName ? { ...c, current_album_id: json.album.id } : c));
      }
    } catch {}
    setGeneratingAlbum(null);
  }

  async function setAsCurrentAlbum(personaName: string, albumId: string | null) {
    await supabase.from("artist_channels").update({ current_album_id: albumId }).eq("persona_name", personaName);
    setChannels(prev => prev.map(c => c.persona_name === personaName ? { ...c, current_album_id: albumId } : c));
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

  const allArtists = channels.map(c => c.persona_name);

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
            { key: "albums",    label: "Albums",        icon: Disc3       },
            { key: "playlists", label: "Playlists",     icon: ListMusic   },
            { key: "fans",      label: "Fan Engagement", icon: Heart      },
            { key: "platforms", label: "Platforms",      icon: Share2     },
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
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-green-700 font-mono">
                Configure each artist&apos;s YouTube channel. Click &quot;Connect YouTube&quot; to authorize a separate Google account per artist.
              </p>
              <button
                onClick={() => setShowNewArtist(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all flex-shrink-0 ml-4"
              >
                <Plus className="w-3.5 h-3.5" /> New Artist
              </button>
            </div>

            {/* New artist form */}
            {showNewArtist && (
              <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 p-5 mb-2">
                <p className="text-xs font-mono font-black uppercase tracking-wider gradient-text mb-3">New Artist</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Artist / persona name *"
                    value={newArtistForm.name}
                    onChange={e => setNewArtistForm(p => ({ ...p, name: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-16 bg-black/60 border border-green-500/30 rounded-lg px-2 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60 text-center"
                      placeholder="🎵"
                      value={newArtistForm.emoji}
                      onChange={e => setNewArtistForm(p => ({ ...p, emoji: e.target.value }))}
                    />
                    <select
                      className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-2 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                      value={newArtistForm.color_key}
                      onChange={e => setNewArtistForm(p => ({ ...p, color_key: e.target.value }))}
                    >
                      {COLOR_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                    </select>
                  </div>
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Display / channel name"
                    value={newArtistForm.channel_name}
                    onChange={e => setNewArtistForm(p => ({ ...p, channel_name: e.target.value }))}
                  />
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="YouTube channel ID (UCxxxxxxxx)"
                    value={newArtistForm.youtube_channel_id}
                    onChange={e => setNewArtistForm(p => ({ ...p, youtube_channel_id: e.target.value }))}
                  />
                  <input
                    className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Genre / vibe description (used to seed prompts)"
                    value={newArtistForm.genre_description}
                    onChange={e => setNewArtistForm(p => ({ ...p, genre_description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createArtist}
                    disabled={creatingArtist || !newArtistForm.name.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
                  >
                    {creatingArtist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Artist
                  </button>
                  <button onClick={() => setShowNewArtist(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2">Cancel</button>
                </div>
              </div>
            )}

            {loadingChannels ? (
              <div className="flex items-center gap-2 text-green-700 font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : (
              channels.map(ch => {
                const style = getPersonaStyle(ch.persona_name, ch.color_key, ch.emoji);
                const isDirty = !!editChannel[ch.persona_name] && Object.keys(editChannel[ch.persona_name]).length > 0;
                const serviceKey = `youtube_${ch.persona_name}`;
                const isConnected = connectedServices.includes(serviceKey) || (ch.is_master && connectedServices.includes("youtube"));
                return (
                  <div key={ch.id} className={`rounded-xl border ${style.bg} p-4`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{style.emoji}</span>
                      <div>
                        <p className={`text-sm font-mono font-black ${style.color}`}>{ch.persona_name}</p>
                        {ch.is_master && <p className="text-xs text-green-800 font-mono">Master label channel — receives all tracks</p>}
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        {/* Edit / Delete controls */}
                        {editingArtist === ch.persona_name ? (
                          <button onClick={() => setEditingArtist(null)} className="text-green-700 hover:text-green-400 transition-colors" title="Done editing">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => setEditingArtist(ch.persona_name)} className="text-green-800 hover:text-green-500 transition-colors" title="Edit artist">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {confirmDeleteArtist === ch.persona_name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-red-400">Delete?</span>
                            <button
                              onClick={() => deleteArtist(ch.persona_name)}
                              disabled={deletingArtist === ch.persona_name}
                              className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded"
                            >
                              {deletingArtist === ch.persona_name ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                            </button>
                            <button onClick={() => setConfirmDeleteArtist(null)} className="text-xs font-mono text-green-800 hover:text-green-600">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteArtist(ch.persona_name)} className="text-green-900 hover:text-red-500 transition-colors" title="Delete artist">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* YouTube OAuth connect */}
                        {isConnected ? (
                          <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                            <Check className="w-3 h-3" /> YT connected
                          </span>
                        ) : (
                          <a
                            href={`/api/auth/youtube?persona=${encodeURIComponent(ch.is_master ? "" : ch.persona_name)}`}
                            className="flex items-center gap-1 text-xs font-mono text-red-400 hover:text-red-300 transition-colors border border-red-500/30 px-2 py-1 rounded-lg"
                          >
                            <Youtube className="w-3 h-3" /> Connect YouTube
                          </a>
                        )}
                        {!ch.is_master && (
                          <label className="flex items-center gap-1.5 text-xs font-mono text-green-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-green-400"
                              checked={Boolean(getChannelEdit(ch.persona_name, "upload_to_master", ch.upload_to_master ?? true))}
                              onChange={e => setChannelField(ch.persona_name, "upload_to_master", e.target.checked)}
                            />
                            post to DN
                          </label>
                        )}
                        <label className="flex items-center gap-1.5 text-xs font-mono text-green-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-400"
                            checked={Boolean(getChannelEdit(ch.persona_name, "auto_interact", ch.auto_interact ?? false))}
                            onChange={e => setChannelField(ch.persona_name, "auto_interact", e.target.checked)}
                          />
                          auto-interact
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                        placeholder="Display name"
                        value={String(getChannelEdit(ch.persona_name, "channel_name", ch.channel_name ?? ""))}
                        onChange={e => setChannelField(ch.persona_name, "channel_name", e.target.value)}
                      />
                      <input
                        className="bg-black/60 border border-green-500/20 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                        placeholder="YouTube channel ID (UCxxxxxxxx)"
                        value={String(getChannelEdit(ch.persona_name, "youtube_channel_id", ch.youtube_channel_id ?? ""))}
                        onChange={e => setChannelField(ch.persona_name, "youtube_channel_id", e.target.value)}
                      />
                    </div>

                    {/* Inline emoji / color edit */}
                    {editingArtist === ch.persona_name && (
                      <div className="flex gap-2 mt-2">
                        <input
                          className="w-14 bg-black/60 border border-green-500/20 rounded-lg px-2 py-1.5 text-sm text-green-300 font-mono text-center focus:outline-none focus:border-green-400/60"
                          placeholder="🎵"
                          value={String(getChannelEdit(ch.persona_name, "emoji", ch.emoji ?? ""))}
                          onChange={e => setChannelField(ch.persona_name, "emoji", e.target.value)}
                        />
                        <select
                          className="bg-black/60 border border-green-500/20 rounded-lg px-2 py-1.5 text-xs text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                          value={String(getChannelEdit(ch.persona_name, "color_key", ch.color_key ?? "green"))}
                          onChange={e => setChannelField(ch.persona_name, "color_key", e.target.value)}
                        >
                          {COLOR_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
                        </select>
                        <span className="text-xs font-mono text-green-800 self-center">emoji · color</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-green-500/10 flex-wrap">
                      {/* Scan & Reply comments */}
                      <button
                        onClick={() => scanAndReply(ch.persona_name)}
                        disabled={scanningReply === ch.persona_name}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40"
                      >
                        {scanningReply === ch.persona_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                        Scan & Reply Comments
                      </button>

                      {/* Edit prompts shortcut */}
                      <button
                        onClick={() => { setPromptPersona(ch.persona_name); setTab("prompts"); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/20 text-green-700 font-mono hover:text-green-400 transition-colors"
                      >
                        <Wand2 className="w-3 h-3" /> Edit Prompts
                      </button>

                      {/* Current album + progress bar */}
                      {(() => {
                        const currentAlbum = ch.current_album_id ? albums.find(a => a.id === ch.current_album_id) : null;
                        const trackCount = currentAlbum ? (albumTrackCounts[currentAlbum.id] ?? 0) : 0;
                        const maxTracks = currentAlbum?.max_tracks ?? 10;
                        const isFull = currentAlbum && trackCount >= maxTracks;

                        if (currentAlbum) {
                          return (
                            <div className="flex items-center gap-2">
                              <button onClick={() => setTab("albums")} className="flex items-center gap-1 text-xs font-mono text-green-500 hover:text-green-300 transition-colors font-bold">
                                <Disc3 className="w-3 h-3" /> {currentAlbum.title}
                              </button>
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1 rounded-full bg-green-900/60 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${isFull ? "bg-yellow-400" : "bg-green-500"}`} style={{ width: `${Math.min(100, (trackCount / maxTracks) * 100)}%` }} />
                                </div>
                                <span className="text-xs font-mono text-green-800">{trackCount}/{maxTracks}</span>
                              </div>
                              {isFull && (
                                <button
                                  onClick={() => generateNextAlbum(ch.persona_name)}
                                  disabled={generatingAlbum === ch.persona_name}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 font-mono font-bold hover:bg-yellow-500/20 transition-all disabled:opacity-40"
                                >
                                  {generatingAlbum === ch.persona_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                                  Next Album
                                </button>
                              )}
                            </div>
                          );
                        }

                        const artistAlbumCount = albums.filter(a => a.persona_name === ch.persona_name).length;
                        return (
                          <button
                            onClick={() => generateNextAlbum(ch.persona_name)}
                            disabled={generatingAlbum === ch.persona_name}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono font-bold hover:bg-purple-500/20 transition-all disabled:opacity-40"
                          >
                            {generatingAlbum === ch.persona_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Disc3 className="w-3 h-3" />}
                            {artistAlbumCount > 0 ? "Generate Album" : "Start First Album"}
                          </button>
                        );
                      })()}

                      {/* Last comment job status */}
                      {(() => {
                        const lastJob = fanJobs.find(j => j.persona_name === ch.persona_name);
                        return lastJob ? (
                          <span className={`text-xs font-mono ml-auto ${
                            lastJob.status === "complete" ? "text-green-600" :
                            lastJob.status === "running"  ? "text-yellow-500" :
                            lastJob.status === "error"    ? "text-red-500" : "text-green-800"
                          }`}>
                            last scan: {lastJob.status} · {lastJob.comments_replied} replies
                          </span>
                        ) : null;
                      })()}

                      {isDirty && (
                        <button
                          onClick={() => saveChannel(ch.persona_name)}
                          disabled={savingChannel === ch.persona_name}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40"
                        >
                          {savingChannel === ch.persona_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TAB: Prompt Studio ── */}
        {tab === "prompts" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <p className="text-xs text-green-700 font-mono">Artist:</p>
              <div className="flex gap-1 flex-wrap">
                {channels.map(ch => {
                  const style = getPersonaStyle(ch.persona_name, ch.color_key, ch.emoji);
                  return (
                    <button
                      key={ch.persona_name}
                      onClick={() => setPromptPersona(ch.persona_name)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all border ${
                        promptPersona === ch.persona_name
                          ? `${style.bg} ${style.color} border-current/50`
                          : "text-green-800 border-green-500/20 hover:text-green-600"
                      }`}
                    >
                      {style.emoji} {ch.persona_name}
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
                {(() => {
                  const GROUP_LABELS: Record<string, string> = {
                    track: "Track Generation",
                    album: "Album Generation",
                    playlist: "Playlist Generation",
                  };
                  let lastGroup = "";
                  return PROMPT_TYPES.flatMap(pt => {
                    const { key, label, icon: Icon, group, fallback } = pt;
                    const defaultVal = DEFAULT_PROMPTS[promptPersona]?.[key] ?? fallback;
                    const isDefault = (promptDrafts[key] ?? "") === defaultVal;
                    const header = group !== lastGroup ? (lastGroup = group, (
                      <p key={`g_${group}`} className="text-xs font-mono font-black uppercase tracking-widest text-green-700 pt-2 pb-1 border-b border-green-500/10">
                        {GROUP_LABELS[group] ?? group}
                      </p>
                    )) : null;
                    const card = (
                      <div key={key} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-green-400" />
                          <p className="text-xs font-mono font-black uppercase tracking-wider text-green-500">{label}</p>
                          <span className="text-xs font-mono text-yellow-400 ml-2">vars: {PROMPT_VARS[key]}</span>
                          {!isDefault && <span className="text-xs text-yellow-400 font-mono ml-auto">• modified</span>}
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
                    return header ? [header, card] : [card];
                  });
                })()}
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
                  const albumCh = channels.find(c => c.persona_name === album.persona_name);
                  const meta = getPersonaStyle(album.persona_name, albumCh?.color_key, albumCh?.emoji);
                  const tracks = albumTracks[album.id];
                  const isExpanded = expandedAlbum === album.id;
                  const uploadedCount = (tracks ?? []).filter(t => t.status === "uploaded").length;
                  const isCurrent = albumCh?.current_album_id === album.id;

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
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-mono font-black ${meta.color}`}>{album.title}</p>
                            {isCurrent && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-yellow-500/50 text-yellow-400 bg-yellow-500/10">current</span>
                            )}
                          </div>
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
                                disabled={creatingPlaylist === album.id}
                                onClick={() => createPlaylist(album)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40"
                              >
                                {creatingPlaylist === album.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListMusic className="w-3.5 h-3.5" />}
                                Create Playlist
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
                            {albumCh && (
                              <button
                                onClick={() => setAsCurrentAlbum(album.persona_name, isCurrent ? null : album.id)}
                                className={`text-xs font-mono transition-colors px-2 ${isCurrent ? "text-yellow-600 hover:text-yellow-400" : "text-green-800 hover:text-green-500"}`}
                              >
                                {isCurrent ? "Unset current" : "Set as current"}
                              </button>
                            )}
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

        {/* ── TAB: Playlists ── */}
        {tab === "playlists" && (
          <div>
            {/* Artist picker + Sync button */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <p className="text-xs text-green-700 font-mono">Artist:</p>
              <div className="flex gap-1 flex-wrap flex-1">
                {channels.map(ch => {
                  const s = getPersonaStyle(ch.persona_name, ch.color_key, ch.emoji);
                  return (
                    <button
                      key={ch.persona_name}
                      onClick={() => { setPlaylistPersona(ch.persona_name); setSyncResult(null); }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all border ${
                        playlistPersona === ch.persona_name
                          ? `${s.bg} ${s.color} border-current/50`
                          : "text-green-800 border-green-500/20 hover:text-green-600"
                      }`}
                    >
                      {s.emoji} {ch.persona_name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={syncPlaylists}
                  disabled={syncingPlaylists}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono font-bold hover:bg-cyan-500/20 transition-all disabled:opacity-40"
                >
                  {syncingPlaylists ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync Now
                </button>
                <button
                  onClick={() => setShowNewPlaylist(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> New Playlist
                </button>
              </div>
            </div>

            {/* Auto-sync toggle */}
            {(() => {
              const ch = channels.find(c => c.persona_name === playlistPersona);
              const autoSync = ch?.playlist_auto_sync ?? false;
              return ch ? (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border border-green-500/10 bg-black/30">
                  <div className="flex-1">
                    <p className="text-xs font-mono text-green-500 font-bold">Daily Auto-Sync</p>
                    <p className="text-xs font-mono text-green-800">Runs every day at 6 AM UTC — updates stats &amp; routes new tracks to playlists</p>
                  </div>
                  <button
                    onClick={() => toggleAutoSync(ch.persona_name, !autoSync)}
                    className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${autoSync ? "bg-green-500" : "bg-green-900"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoSync ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className={`text-xs font-mono font-bold w-5 ${autoSync ? "text-green-400" : "text-green-800"}`}>{autoSync ? "ON" : "OFF"}</span>
                </div>
              ) : null;
            })()}

            {syncResult && (
              <p className={`text-xs font-mono mb-4 ${syncResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>{syncResult}</p>
            )}

            {/* New playlist form */}
            {showNewPlaylist && (
              <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 p-5 mb-4">
                <p className="text-xs font-mono font-black uppercase tracking-wider gradient-text mb-3">New Playlist — {playlistPersona}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Vibe / type field drives AI generation */}
                  <input
                    className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Vibe / purpose (e.g. workout, dark club, emotional liquid, top hits…)"
                    value={newPlaylist.vibe}
                    onChange={e => setNewPlaylist(p => ({ ...p, vibe: e.target.value }))}
                  />
                  <div className="relative col-span-2 flex gap-2">
                    <input
                      className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Playlist name"
                      value={newPlaylist.name}
                      onChange={e => setNewPlaylist(p => ({ ...p, name: e.target.value }))}
                    />
                    <button
                      onClick={() => generatePlaylistName("general")}
                      disabled={generatingPlaylist}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono font-bold text-xs hover:bg-purple-500/20 transition-all disabled:opacity-40 flex-shrink-0"
                    >
                      {generatingPlaylist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Generate
                    </button>
                  </div>
                  <input
                    className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Description"
                    value={newPlaylist.description}
                    onChange={e => setNewPlaylist(p => ({ ...p, description: e.target.value }))}
                  />
                  <select
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                    value={newPlaylist.privacy}
                    onChange={e => setNewPlaylist(p => ({ ...p, privacy: e.target.value }))}
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createGeneralPlaylist}
                    disabled={savingNewPlaylist || !newPlaylist.name.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
                  >
                    {savingNewPlaylist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create
                  </button>
                  <button onClick={() => setShowNewPlaylist(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2">Cancel</button>
                </div>
              </div>
            )}

            {/* Playlist list with routing rules */}
            {loadingPlaylists ? (
              <div className="flex items-center gap-2 text-green-700 font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : artistPlaylists.length === 0 ? (
              <p className="text-xs text-green-800 font-mono mb-6">No playlists yet for {playlistPersona}. Create one above.</p>
            ) : (
              <div className="space-y-3 mb-8">
                {artistPlaylists.map(pl => {
                  const draft = getPlaylistRuleDraft(pl);
                  const isDirty = !!playlistRuleDrafts[pl.id];
                  return (
                    <div key={pl.id} className="rounded-xl border border-green-500/20 bg-black/40 p-4">
                      <div className="flex items-start gap-3">
                        <ListMusic className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-mono font-black text-green-300">{pl.name}</p>
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                              pl.privacy === "public"   ? "border-green-500/30 text-green-600" :
                              pl.privacy === "unlisted" ? "border-yellow-500/30 text-yellow-600" :
                                                          "border-red-500/30 text-red-600"
                            }`}>{pl.privacy}</span>
                            {(pl.playlist_type ?? "general") !== "general" && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-500">
                                {pl.playlist_type === "top_views" ? `top ${pl.top_n} views` :
                                 pl.playlist_type === "top_likes" ? `top ${pl.top_n} likes` :
                                 `tags: ${(pl.auto_tags ?? []).join(", ") || "none"}`}
                              </span>
                            )}
                            {pl.youtube_playlist_id && (
                              <a href={`https://www.youtube.com/playlist?list=${pl.youtube_playlist_id}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-mono text-red-400 hover:text-red-300 transition-colors ml-auto">
                                <ExternalLink className="w-3 h-3" /> YouTube
                              </a>
                            )}
                          </div>
                          {pl.description && <p className="text-xs text-green-800 font-mono mb-2 truncate">{pl.description}</p>}

                          {/* Routing rules */}
                          <div className="flex gap-2 flex-wrap items-center mt-2">
                            <select
                              className="bg-black/60 border border-green-500/20 rounded px-2 py-1 text-xs text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                              value={draft.playlist_type}
                              onChange={e => setPlaylistRuleField(pl.id, pl, "playlist_type", e.target.value)}
                            >
                              <option value="general">Manual only</option>
                              <option value="tag_match">Tag Match</option>
                              <option value="top_views">Top Views</option>
                              <option value="top_likes">Top Likes</option>
                            </select>
                            {draft.playlist_type === "tag_match" && (
                              <input
                                className="flex-1 min-w-32 bg-black/60 border border-green-500/20 rounded px-2 py-1 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                                placeholder="Tags: dnb, dark, workout, …"
                                value={draft.auto_tags}
                                onChange={e => setPlaylistRuleField(pl.id, pl, "auto_tags", e.target.value)}
                              />
                            )}
                            {(draft.playlist_type === "top_views" || draft.playlist_type === "top_likes") && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-mono text-green-700">top</span>
                                <input
                                  type="number"
                                  className="w-14 bg-black/60 border border-green-500/20 rounded px-2 py-1 text-xs text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                                  value={draft.top_n}
                                  onChange={e => setPlaylistRuleField(pl.id, pl, "top_n", e.target.value)}
                                />
                              </div>
                            )}
                            {isDirty && (
                              <button onClick={() => savePlaylistRules(pl)} disabled={savingRules === pl.id}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40">
                                {savingRules === pl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save Rules
                              </button>
                            )}
                          </div>

                          {/* Manual add video */}
                          {pl.youtube_playlist_id && (
                            <div className="flex gap-2 mt-3">
                              <input
                                className="flex-1 bg-black/60 border border-green-500/20 rounded-lg px-3 py-1.5 text-xs text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                                placeholder="Paste YouTube video URL to add manually…"
                                value={addingVideoTo === pl.id ? videoUrlInput : ""}
                                onFocus={() => setAddingVideoTo(pl.id)}
                                onChange={e => { setAddingVideoTo(pl.id); setVideoUrlInput(e.target.value); }}
                              />
                              <button onClick={() => addVideoToPlaylist(pl)} disabled={addingVideoTo !== pl.id || !videoUrlInput.trim()}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 font-mono font-bold hover:bg-green-500/20 transition-all disabled:opacity-40">
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteGeneralPlaylist(pl)} className="text-green-900 hover:text-red-500 transition-colors flex-shrink-0" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Track Catalog */}
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-green-700 mb-3">
                <span className="text-red-500">&gt;</span> Track Catalog — {playlistPersona} ({trackCatalog.length} tracks)
              </p>
              {loadingCatalog ? (
                <div className="flex items-center gap-2 text-green-700 font-mono text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
              ) : trackCatalog.length === 0 ? (
                <p className="text-xs text-green-900 font-mono italic">
                  No tracks registered yet. Tracks are automatically added to the catalog when uploaded via the pipeline.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-green-700 border-b border-green-500/10">
                        <th className="text-left pb-2 pr-3 font-semibold">Track Name</th>
                        <th className="text-left pb-2 pr-3 font-semibold">Tags</th>
                        <th className="text-center pb-2 pr-3 font-semibold"><Eye className="w-3 h-3 inline" /></th>
                        <th className="text-center pb-2 pr-3 font-semibold"><ThumbsUp className="w-3 h-3 inline" /></th>
                        <th className="text-left pb-2 font-semibold">Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-500/5">
                      {trackCatalog.map(track => (
                        <tr key={track.id} className="group">
                          <td className="py-2 pr-3 text-green-300 font-bold max-w-48 truncate">{track.track_name}</td>
                          <td className="py-2 pr-3">
                            {editingTrackTags === track.id ? (
                              <div className="flex gap-1">
                                <input
                                  autoFocus
                                  className="bg-black/60 border border-green-500/30 rounded px-2 py-0.5 text-green-300 placeholder-green-800 focus:outline-none focus:border-green-400/60 w-40"
                                  placeholder="dnb, dark, workout"
                                  value={tagDraftInput}
                                  onChange={e => setTagDraftInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") saveTrackTags(track); if (e.key === "Escape") { setEditingTrackTags(null); setTagDraftInput(""); } }}
                                />
                                <button onClick={() => saveTrackTags(track)} className="text-green-500 hover:text-green-300"><Check className="w-3 h-3" /></button>
                                <button onClick={() => { setEditingTrackTags(null); setTagDraftInput(""); }} className="text-green-800 hover:text-green-600"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingTrackTags(track.id); setTagDraftInput((track.tags ?? []).join(", ")); }}
                                className="flex items-center gap-1 text-green-800 hover:text-green-400 transition-colors group/tag"
                              >
                                {(track.tags ?? []).length > 0 ? (
                                  <span className="text-green-600">{track.tags.join(", ")}</span>
                                ) : (
                                  <span className="italic text-green-900 group-hover/tag:text-green-700">+ add tags</span>
                                )}
                                <Tag className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-center text-green-700">{track.view_count?.toLocaleString() ?? "—"}</td>
                          <td className="py-2 pr-3 text-center text-green-700">{track.like_count?.toLocaleString() ?? "—"}</td>
                          <td className="py-2">
                            {track.youtube_url ? (
                              <a href={track.youtube_url} target="_blank" rel="noreferrer" className="text-red-500 hover:text-red-400 transition-colors">
                                <Youtube className="w-3.5 h-3.5" />
                              </a>
                            ) : <span className="text-green-900">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                  {channels.map(ch => {
                    const style = getPersonaStyle(ch.persona_name, ch.color_key, ch.emoji);
                    return (
                    <tr key={ch.persona_name}>
                      <td className="py-3 pr-4">
                        <span className={`font-bold ${style.color}`}>{style.emoji} {ch.persona_name}</span>
                      </td>
                      {PLATFORMS.map(platform => {
                        const key = getPlatformKey(ch.persona_name, platform.key);
                        const isDirty = !!platformDrafts[key] && Object.keys(platformDrafts[key]).length > 0;
                        const isActive = Boolean(getPlatformField(ch.persona_name, platform.key, "active", false));
                        const handle = String(getPlatformField(ch.persona_name, platform.key, "handle", ""));
                        return (
                          <td key={platform.key} className="py-3 px-2">
                            <div className="flex flex-col items-center gap-1.5">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="accent-green-400"
                                  checked={isActive}
                                  onChange={e => setPlatformField(ch.persona_name, platform.key, "active", e.target.checked)}
                                />
                                <span className={isActive ? "text-green-400" : "text-green-800"}>on</span>
                              </label>
                              <input
                                className="w-24 bg-black/60 border border-green-500/20 rounded px-1.5 py-1 text-green-400 placeholder-green-900 focus:outline-none focus:border-green-400/60 text-center"
                                placeholder="@handle"
                                value={handle}
                                onChange={e => setPlatformField(ch.persona_name, platform.key, "handle", e.target.value)}
                              />
                              {isDirty && (
                                <button
                                  onClick={() => savePlatformAccount(ch.persona_name, platform.key)}
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
                    );
                  })}
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
