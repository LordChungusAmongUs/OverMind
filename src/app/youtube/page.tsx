"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Youtube, Music, Wand2, ImageIcon, Video,
  FileText, Upload, RefreshCw, Copy, Check,
  ChevronRight, Calendar, BarChart2,
} from "lucide-react";

// ── PERSONAS ─────────────────────────────────────────────────
const PERSONAS = [
  { name: "ThirstyBoy",        weight: 2, instrumental: true,  vocals: null,             genres: ["jump up", "darkstep", "techstep", "dubstep", "drum n bass"],    moods: ["aggressive", "dark", "energetic", "rhythmic", "industrial", "paranoid", "epic"],           lyricsStyle: "",                                                          artStyle: "dark urban, neon glitch, aggressive bass culture aesthetic" },
  { name: "Stephani Luci",     weight: 1, instrumental: false, vocals: "female vocals",  genres: ["liquid", "drum n bass", "melodic dubstep"],                     moods: ["melodic", "emotional", "romantic", "deep", "cinematic", "atmospheric"],                   lyricsStyle: "soft, emotional, feminine, introspective, flowing",          artStyle: "ethereal, soft light, watercolor, feminine, dreamy atmosphere" },
  { name: "Hard On",           weight: 1, instrumental: false, vocals: "male vocals",    genres: ["hardstep", "hardstyle", "techno", "industrial"],                 moods: ["intense", "industrial", "epic", "tribal", "dark", "psychedelic"],                       lyricsStyle: "minimal, repetitive chants, high energy, aggressive",        artStyle: "industrial, hard geometric shapes, high contrast, rave aesthetic" },
  { name: "Wrapper",           weight: 1, instrumental: false, vocals: "male vocals",    genres: ["jump up", "dubstep", "drum n bass"],                            moods: ["hip hop", "funky", "rhythmic", "southern rap", "2000s"],                                lyricsStyle: "rap flow, bars, street-focused, rhythmic wordplay",           artStyle: "hip hop culture, urban landscape, bold colors" },
  { name: "Jerry Country Singer", weight: 1, instrumental: false, vocals: "male vocals", genres: ["dubstep", "drum n bass", "country fusion"],                    moods: ["suburban", "melodic", "emotional", "nostalgic", "funky"],                              lyricsStyle: "country storytelling, twangy phrasing, heartfelt, simple",   artStyle: "rural Americana, sunset fields, rustic textures, warm tones" },
  { name: "RaStevefarian",     weight: 1, instrumental: false, vocals: "male vocals",    genres: ["jungle", "ragga", "drum n bass"],                              moods: ["ragga", "caribbean", "rhythmic", "funky", "tribal", "psychedelic"],                     lyricsStyle: "reggae/MC toasting style, patois-influenced, chant-heavy",   artStyle: "Caribbean colors, tropical, Rastafarian imagery, jungle vibes" },
  { name: "Gore Lord",         weight: 1, instrumental: false, vocals: "male vocals",    genres: ["darkstep", "techstep", "dubstep"],                             moods: ["metal", "dark", "horror", "industrial", "aggressive", "sci-fi"],                        lyricsStyle: "horror imagery, dark poetry, ominous, death metal cadence",  artStyle: "horror, dark surrealism, skulls, demonic energy, black metal aesthetic" },
];

// Weighted random persona pick — ThirstyBoy appears 2x more often
function pickPersona() {
  const pool = PERSONAS.flatMap(p => Array(p.weight).fill(p));
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const REQUIRED_GENRES = ["drum n bass", "dubstep", "drumstep", "hardstep", "darkstep", "techstep", "jungle"];

function generateStyleTagForPersona(persona: typeof PERSONAS[0]): string {
  const genre = pickRandom(persona.genres, 1)[0];
  const moodCount = Math.floor(Math.random() * 3) + 2;
  const moods = pickRandom(persona.moods, moodCount);
  const parts = [genre, ...moods];
  // Always include at least one required genre word
  const hasRequired = parts.some(p => REQUIRED_GENRES.some(r => p.toLowerCase().includes(r)));
  if (!hasRequired) {
    parts.unshift(REQUIRED_GENRES[Math.floor(Math.random() * REQUIRED_GENRES.length)]);
  }
  if (persona.vocals) parts.push(persona.vocals);
  return parts.join(", ");
}

// ── STEP CONFIG ──────────────────────────────────────────────
const STEPS = [
  { key: "concept",   label: "Track Concept",   icon: Wand2,      desc: "Generate style tags and track theme" },
  { key: "lyrics",    label: "Lyrics",           icon: Music,       desc: "Generate lyrics in ChatGPT" },
  { key: "art",       label: "Cover Art",        icon: ImageIcon,   desc: "Generate artwork in ChatGPT" },
  { key: "audio",     label: "Audio (Suno)",     icon: Music,       desc: "Generate audio in Suno, download & upload here" },
  { key: "video",     label: "Create Video",     icon: Video,       desc: "Combine art + audio with chromatic aberration" },
  { key: "metadata",  label: "Title & Description", icon: FileText, desc: "Generate SEO-optimized metadata" },
  { key: "publish",   label: "Publish",          icon: Upload,      desc: "Upload to YouTube" },
];

type StepKey = "concept" | "lyrics" | "art" | "audio" | "video" | "metadata" | "publish";

interface ApprovalJob {
  jobId: string;
  audioUrls: string[];
  artUrl: string | null;
  title: string;
  description: string;
  lyrics: string;
  isInstrumental: boolean;
  approvedUrls: string[];
  skippedUrls: string[];
}

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "calendar" | "analytics">("pipeline");
  const [currentStep, setCurrentStep] = useState<StepKey>("concept");
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [styleTag, setStyleTag] = useState("");
  const [trackTheme, setTrackTheme] = useState("");
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [artPrompt, setArtPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artFile, setArtFile] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [automating, setAutomating] = useState(false);
  const [automationStep, setAutomationStep] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalJob[]>([]);
  const reportedErrors = useRef<Set<string>>(new Set());
  const [autoPublishing, setAutoPublishing] = useState(false);
  const [autoPublishStep, setAutoPublishStep] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const audioRef = useRef<HTMLInputElement>(null);
  const artRef = useRef<HTMLInputElement>(null);

  // ── POLL PENDING JOB COUNT (always-on, survives page reload) ──
  useEffect(() => {
    // On mount: auto-cancel any jobs stuck in pending/running for over 2 hours
    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Auto-cancelled: stale job" })
      .in("status", ["pending", "running"])
      .lt("updated_at", staleThreshold);

    const check = async () => {
      const { count } = await supabase.from("pipeline_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]);
      setPendingCount(count ?? 0);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const cancelAllPending = async () => {
    await supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Cancelled by user" })
      .in("status", ["pending", "running"]);
    setActiveJobIds([]);
    setAutomating(false);
    setAutomationStep(null);
    setPendingCount(0);
  };

  // ── POLL JOB STATUS ─────────────────────────────────────────
  useEffect(() => {
    if (activeJobIds.length === 0) return;
    const interval = setInterval(async () => {
      const { data: jobs } = await supabase
        .from("pipeline_jobs")
        .select("*")
        .in("id", activeJobIds);
      if (!jobs) return;

      // Update step display from running jobs
      const running = jobs.find(j => j.status === "running");
      if (running) setAutomationStep(running.step);

      // Add newly-approved jobs to queue
      const readyJobs = jobs.filter(j => j.step === "approval");
      if (readyJobs.length > 0) {
        setApprovalQueue(prev => {
          const existing = new Set(prev.map(a => a.jobId));
          const toAdd = readyJobs.filter(j => !existing.has(j.id)).map(j => ({
            jobId: j.id,
            audioUrls: (() => { try { return JSON.parse(j.audio_url ?? "[]"); } catch { return []; } })(),
            artUrl: j.art_url ?? null,
            title: j.title ?? "",
            description: j.description ?? "",
            lyrics: j.lyrics ?? "",
            isInstrumental: !j.lyrics,
            approvedUrls: [],
            skippedUrls: [],
          }));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      // Report errors once
      jobs.filter(j => j.status === "error").forEach(j => {
        if (!reportedErrors.current.has(j.id)) {
          reportedErrors.current.add(j.id);
          alert("Job error: " + j.error_message);
        }
      });

      // Remove finished/approval jobs from active tracking
      const doneIds = jobs.filter(j => j.step === "approval" || j.status === "error" || j.status === "complete").map(j => j.id);
      if (doneIds.length > 0) {
        setActiveJobIds(prev => {
          const next = prev.filter(id => !doneIds.includes(id));
          if (next.length === 0) { setAutomating(false); setAutomationStep(null); }
          return next;
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobIds]);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  // ── HELPERS ──────────────────────────────────────────────────
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const buildConcept = (theme: string) => {
    const persona = pickPersona();
    const tag = generateStyleTagForPersona(persona);
    const rhymeSchemes = ["AAAB AAAB", "AAAB CCCB", "ABAB", "ABCB", "ABBB"];
    const rhyme = rhymeSchemes[Math.floor(Math.random() * rhymeSchemes.length)];
    const verseBars = [8, 12, 16][Math.floor(Math.random() * 3)];
    const hookPatterns = [
      "8 completely unique lines, no repeats (A B C D E F G H)",
      "4 lines repeated twice in full (A B C D A B C D)",
      "2 lines repeated four times (A B A B A B A B)",
      "4 lines where lines 3–4 repeat twice after the initial delivery (A B C D C D C D)",
      "lines 1–2 repeat three times then close with 2 new lines (A B A B A B C D)",
    ];
    const hookPattern = hookPatterns[Math.floor(Math.random() * hookPatterns.length)];
    const extras: string[] = [];
    if (Math.random() < 0.3) extras.push("8-bar intro");
    if (Math.random() < 0.3) extras.push("8-bar bridge after the second verse");
    if (Math.random() < 0.3) extras.push("repeat chorus at the end");
    const structure = `Chorus (8 bars) → Verse (${verseBars} bars) → Chorus → Verse (${verseBars} bars) → Chorus` +
      (extras.length > 0 ? ` + ${extras.join(", ")}` : "");
    const lp = persona.instrumental ? "" :
      `You are writing lyrics for ${persona.name}, an electronic music artist. ` +
      `Style: ${persona.lyricsStyle}. ` +
      `Write lyrics for a ${tag} track${theme ? ` about "${theme}"` : ""}. ` +
      `Rhyme scheme: ${rhyme}. Song structure: ${structure}. ` +
      `Chorus/hook repetition pattern: ${hookPattern}. ` +
      `Label each section clearly (INTRO, CHORUS, VERSE, BRIDGE). ` +
      `Write out repeated lines explicitly — do not write "(repeat)" or "(x2)", write the actual lines. ` +
      `Keep lines punchy and rhythmically tight. ` +
      `Include a title at the top formatted as "TITLE: [track name]".`;
    const ap =
      `Create album cover art for ${persona.name}, an electronic music artist. ` +
      `Art style: ${persona.artStyle}. ` +
      `Genre: ${tag}${theme ? `. Theme: ${theme}` : ""}. ` +
      `High quality digital art.`;
    const mp =
      `I have a ${tag} track by ${persona.name} (DJ ThirstyBoy project). The lyrics are:\n\n${lp}\n\n` +
      `Generate:\n1. A YouTube title — just the track name, max 60 chars. No genre labels, no dashes, no descriptors after the name. Example format: "Shadow Protocol — ${persona.name}"\n` +
      `2. A 3-paragraph YouTube description referencing the style, mood, and artist. Include relevant hashtags at the end (#DnB #DrumAndBass #${persona.name.replace(/\s/g, "")} #DJThirstyBoy).\n` +
      `Format your response EXACTLY as:\nTITLE: [track name — ${persona.name}]\nDESCRIPTION:\n[description here]`;
    return { persona, tag, lyricsPrompt: lp, artPrompt: ap, metadataPrompt: mp };
  };

  const runAutomation = async () => {
    if (submitting || automating) return;
    setSubmitting(true);
    setAutomating(true);
    setAutomationStep("queued");

    // Cancel any leftover pending jobs from previous stuck runs
    await supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Cancelled — new batch started" })
      .eq("status", "pending");

    const newJobIds: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      const { persona, tag, lyricsPrompt: lp, artPrompt: ap, metadataPrompt: mp } = buildConcept(trackTheme.trim());
      const { data, error } = await supabase.from("pipeline_jobs").insert({
        status: "pending",
        style_tags: tag,
        track_theme: trackTheme.trim(),
        lyrics_prompt: lp,
        art_prompt: ap,
        metadata_prompt: mp,
      }).select().single();
      if (!error && data) newJobIds.push(data.id);
    }
    setSubmitting(false);
    if (newJobIds.length > 0) setActiveJobIds(prev => [...prev, ...newJobIds]);
    else { setAutomating(false); setAutomationStep(null); }
  };

  const handleSkipTrack = (jobId: string, audioUrl: string) => {
    setApprovalQueue(prev => prev.map(j => {
      if (j.jobId !== jobId) return j;
      const skippedUrls = [...j.skippedUrls, audioUrl];
      return { ...j, skippedUrls };
    }).filter(j => j.approvedUrls.length + j.skippedUrls.length < j.audioUrls.length || j.audioUrls.length === 0));
  };

  const handleDisapproveJob = async (jobId: string) => {
    await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Disapproved by user" }).eq("id", jobId);
    setApprovalQueue(prev => prev.filter(j => j.jobId !== jobId));
  };

  const handleApprove = async (job: ApprovalJob, audioUrl: string) => {
    // Vocal dedup: if vocal track and already approved one, block
    if (!job.isInstrumental && job.approvedUrls.length > 0) {
      alert("Already approved a track with this title — skip or disapprove the job.");
      return;
    }
    if (!audioUrl) { alert("No audio URL found. Cannot auto-publish."); return; }
    setAutoPublishing(true);

    // Determine title — append " (Alt)" for 2nd+ instrumental approval
    const trackTitle = (job.isInstrumental && job.approvedUrls.length >= 1)
      ? job.title + " (Alt)"
      : job.title;

    try {
      // Fetch audio
      setAutoPublishStep("Fetching audio...");
      let audioRes: Response;
      try {
        audioRes = await fetch(audioUrl);
      } catch (e) {
        throw new Error(`Audio fetch failed (${audioUrl.slice(0, 60)}...): ${e}`);
      }
      if (!audioRes.ok) throw new Error(`Audio HTTP ${audioRes.status} from ${audioUrl.slice(0, 60)}`);
      const audioBlob = await audioRes.blob();
      if (audioBlob.size < 10000) throw new Error(`Audio file too small (${audioBlob.size} bytes) — may be expired or invalid`);
      const audioFileObj = new File([audioBlob], "track.mp3", { type: "audio/mpeg" });
      setAudioFile(audioFileObj);

      // Fetch art — handle data: and https: URLs from job
      setAutoPublishStep("Fetching art...");
      let artFileObj: File | null = null;
      if (job.artUrl) {
        let artBlob: Blob;
        if (job.artUrl.startsWith("data:")) {
          const base64 = job.artUrl.split(",")[1];
          const binary = atob(base64);
          const arr = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
          artBlob = new Blob([arr], { type: "image/jpeg" });
        } else {
          let artRes: Response;
          try {
            artRes = await fetch(job.artUrl);
          } catch (e) {
            throw new Error(`Art fetch failed (${job.artUrl.slice(0, 60)}...): ${e}`);
          }
          artBlob = await artRes.blob();
        }
        artFileObj = new File([artBlob], "art.jpg", { type: "image/jpeg" });
        setArtPreview(URL.createObjectURL(artFileObj));
      }
      if (!artFileObj) {
        alert("No cover art available for this job.");
        setAutoPublishing(false);
        return;
      }

      // Create video with FFmpeg
      setAutoPublishStep("Loading FFmpeg WASM...");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }: { message: string }) => {
        const t = message.match(/time=(\d+:\d+:\d+)/);
        if (t) setAutoPublishStep(`Encoding video... ${t[1]}`);
      });
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      setAutoPublishStep("Writing files...");
      await ffmpeg.writeFile("art.jpg", await fetchFile(artFileObj));
      await ffmpeg.writeFile("audio.mp3", await fetchFile(audioFileObj));
      setAutoPublishStep("Encoding video... 0:00:00");
      await ffmpeg.exec([
        "-loop", "1", "-i", "art.jpg",
        "-i", "audio.mp3",
        "-c:v", "libx264", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags", "+faststart",
        "-shortest", "output.mp4",
      ]);
      setAutoPublishStep("Finalizing video...");
      const vidData = await ffmpeg.readFile("output.mp4");
      const vidBlob = new Blob([vidData as unknown as BlobPart], { type: "video/mp4" });
      if (vidBlob.size < 50000) throw new Error(`Encoded video is too small (${vidBlob.size} bytes) — FFmpeg may have failed`);
      const vidUrl = URL.createObjectURL(vidBlob);
      setVideoUrl(vidUrl);

      // Upload directly to YouTube from the browser (bypasses Vercel body size limit)
      const safeJson = async (res: Response, label: string) => {
        const text = await res.text();
        try { return JSON.parse(text); }
        catch { throw new Error(`${label} — HTTP ${res.status}: ${text.slice(0, 120)}`); }
      };

      setAutoPublishStep("Connecting to YouTube...");
      const tokenRes = await fetch("/api/youtube/token");
      const tokenData = await safeJson(tokenRes, "Token fetch");
      if (!tokenData.access_token) throw new Error(tokenData.error || "No YouTube token");

      setAutoPublishStep("Starting YouTube upload...");
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": String(vidBlob.size),
          },
          body: JSON.stringify({
            snippet: {
              title: trackTitle || "New Track",
              description: job.description || "",
              tags: ["drum and bass", "dnb", "djthirstyboy", "music"],
              categoryId: "10",
            },
            status: { privacyStatus: "public", madeForKids: false },
          }),
        }
      );
      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`YouTube session init failed — HTTP ${initRes.status}: ${errText.slice(0, 120)}`);
      }
      const uploadUrl = initRes.headers.get("Location");
      if (!uploadUrl) throw new Error("No upload URL from YouTube (Location header missing)");

      setAutoPublishStep(`Uploading to YouTube (${(vidBlob.size / 1024 / 1024).toFixed(0)} MB)...`);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes 0-${vidBlob.size - 1}/${vidBlob.size}`,
        },
        body: vidBlob,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`YouTube upload failed — HTTP ${uploadRes.status}: ${errText.slice(0, 200)}`);
      }
      const uploadData = await safeJson(uploadRes, "Upload response");
      const videoId = uploadData.id;
      if (!videoId) throw new Error(`No video ID in response: ${JSON.stringify(uploadData).slice(0, 120)}`);

      setPublishedUrl(`https://www.youtube.com/watch?v=${videoId}`);
      setCurrentStep("publish");

      // Mark this audioUrl as approved in the queue
      setApprovalQueue(prev => {
        const updated = prev.map(j => j.jobId === job.jobId
          ? { ...j, approvedUrls: [...j.approvedUrls, audioUrl] }
          : j
        );
        // If all tracks actioned for this job, mark complete and remove
        const thisJob = updated.find(j => j.jobId === job.jobId);
        if (thisJob && thisJob.approvedUrls.length + thisJob.skippedUrls.length >= thisJob.audioUrls.length && thisJob.audioUrls.length > 0) {
          supabase.from("pipeline_jobs").update({ status: "complete", step: "complete" }).eq("id", job.jobId);
          return updated.filter(j => j.jobId !== job.jobId);
        }
        return updated;
      });
    } catch (err: unknown) {
      alert("Auto-publish failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setAutoPublishing(false);
    setAutoPublishStep(null);
  };

  const generateConcept = () => {
    const { persona, tag, lyricsPrompt: lp, artPrompt: ap } = buildConcept(trackTheme.trim());
    setSelectedPersona(persona);
    setStyleTag(tag);
    setLyricsPrompt(lp);
    setArtPrompt(ap);
  };

  const handleArtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArtFile(file);
    setArtPreview(URL.createObjectURL(file));
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  };

  const createVideo = async () => {
    if (!audioFile || !artFile) return;
    setVideoProcessing(true);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }: { message: string }) => {
        const t = message.match(/time=(\d+:\d+:\d+)/);
        if (t) console.log(`FFmpeg encoding: ${t[1]}`);
      });
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      await ffmpeg.writeFile("art.jpg", await fetchFile(artFile));
      await ffmpeg.writeFile("audio.mp3", await fetchFile(audioFile));

      await ffmpeg.exec([
        "-loop", "1", "-i", "art.jpg", "-i", "audio.mp3",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-shortest", "output.mp4",
      ]);

      const data = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      alert("Video creation failed. Check console for details.");
    }
    setVideoProcessing(false);
  };

  const advance = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.key as StepKey);
  };

  // ── RENDER STEP CONTENT ──────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case "concept":
        return (
          <div className="space-y-4">
            {styleTag && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-xs text-muted-foreground">Persona:</span>
                <span className="text-sm font-semibold text-primary">{selectedPersona.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{selectedPersona.instrumental ? "Instrumental" : selectedPersona.vocals}</span>
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Track theme (optional)</label>
              <input
                value={trackTheme}
                onChange={e => setTrackTheme(e.target.value)}
                placeholder="e.g. lost in the city, space travel, midnight rain..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              onClick={generateConcept}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4" /> Generate Style
            </button>
            {styleTag && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-secondary border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Style tags</p>
                  <p className="text-sm font-medium text-primary">{styleTag}</p>
                </div>

                {/* Automation button */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <p className="text-sm font-semibold mb-1">Run Full Automation</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    The Overmind extension will handle ChatGPT + Suno automatically. Make sure the extension is installed and you are signed into ChatGPT and Suno.
                  </p>
                  {automating ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {activeJobIds.length} job{activeJobIds.length !== 1 ? "s" : ""} in queue —{" "}
                        {automationStep === "queued" ? "waiting for extension..." :
                         automationStep === "lyrics" ? "generating lyrics..." :
                         automationStep === "art" ? "generating cover art..." :
                         automationStep === "audio" ? "generating audio in Suno..." :
                         automationStep === "metadata" ? "writing metadata..." :
                         `running: ${automationStep}...`}
                      </div>
                      <button
                        onClick={async () => {
                          await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Cancelled by user" }).eq("status", "pending");
                          setActiveJobIds([]);
                          setAutomating(false);
                          setAutomationStep(null);
                        }}
                        className="text-xs text-red-400 border border-red-400/30 px-3 py-1 rounded-lg hover:bg-red-400/10"
                      >
                        Stop &amp; Cancel All Pending
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <label className="text-sm text-muted-foreground">Song ideas to generate:</label>
                        <input
                          type="number" min={1} max={20} value={batchCount}
                          onChange={e => setBatchCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                          className="w-16 px-2 py-1 text-sm rounded-lg bg-secondary border border-border text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <button
                        onClick={runAutomation}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                      >
                        {submitting
                          ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating jobs...</>
                          : <><Wand2 className="w-4 h-4" /> Run {batchCount} Idea{batchCount > 1 ? "s" : ""} Automatically</>}
                      </button>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">— or go step by step manually —</p>
                <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  Next: Lyrics manually <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        );

      case "lyrics":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary border border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Copy this prompt into ChatGPT</p>
                <button onClick={() => copy(lyricsPrompt, "lyrics-prompt")} className="text-xs text-primary flex items-center gap-1">
                  {copiedKey === "lyrics-prompt" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-foreground">{lyricsPrompt}</p>
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Paste lyrics here after generating</label>
              <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                rows={10}
                placeholder="Paste ChatGPT lyrics output here..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            {lyrics && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                Next: Cover Art <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "art":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary border border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Copy this prompt into ChatGPT (DALL-E)</p>
                <button onClick={() => copy(artPrompt, "art-prompt")} className="text-xs text-primary flex items-center gap-1">
                  {copiedKey === "art-prompt" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-foreground">{artPrompt}</p>
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Upload generated artwork</label>
              <input ref={artRef} type="file" accept="image/*" onChange={handleArtUpload} className="hidden" />
              <button onClick={() => artRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
                Choose Image
              </button>
              {artPreview && (
                <img src={artPreview} alt="Cover art preview" className="mt-3 w-48 h-48 object-cover rounded-lg border border-border" />
              )}
            </div>
            {artFile && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                Next: Audio <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary border border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Copy lyrics for Suno</p>
                <button onClick={() => copy(lyrics, "suno-lyrics")} className="text-xs text-primary flex items-center gap-1">
                  {copiedKey === "suno-lyrics" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Style tags: <span className="text-primary">{styleTag}</span></p>
            </div>
            <a href="https://suno.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
              Open Suno <ChevronRight className="w-4 h-4" />
            </a>
            <p className="text-sm text-muted-foreground">Generate your track in Suno, download the audio, then upload it here.</p>
            <div>
              <input ref={audioRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
              <button onClick={() => audioRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
                Upload Audio from Suno
              </button>
              {audioFile && <p className="mt-2 text-sm text-green-400">✓ {audioFile.name}</p>}
            </div>
            {audioFile && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                Next: Create Video <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`p-3 rounded-lg border ${artFile ? "border-green-500/30 bg-green-500/5" : "border-border bg-secondary"}`}>
                <p className="text-muted-foreground">Cover Art</p>
                <p className={artFile ? "text-green-400" : "text-muted-foreground"}>{artFile ? `✓ ${artFile.name}` : "Not uploaded"}</p>
              </div>
              <div className={`p-3 rounded-lg border ${audioFile ? "border-green-500/30 bg-green-500/5" : "border-border bg-secondary"}`}>
                <p className="text-muted-foreground">Audio</p>
                <p className={audioFile ? "text-green-400" : "text-muted-foreground"}>{audioFile ? `✓ ${audioFile.name}` : "Not uploaded"}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Effect: static image with chromatic aberration</p>
            <button
              onClick={createVideo}
              disabled={!audioFile || !artFile || videoProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {videoProcessing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</> : <><Video className="w-4 h-4" /> Create Video</>}
            </button>
            {videoProcessing && (
              <p className="text-sm text-muted-foreground">This may take 1–2 minutes depending on audio length...</p>
            )}
            {videoUrl && (
              <div className="space-y-3">
                <video src={videoUrl} controls className="w-full rounded-lg border border-border" style={{ maxHeight: 300 }} />
                <div className="flex gap-2">
                  <a href={videoUrl} download="track.mp4"
                    className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
                    Download MP4
                  </a>
                  <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline mt-2">
                    Next: Metadata <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case "metadata":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary border border-border">
              <p className="text-xs text-muted-foreground mb-1">Metadata is generated automatically by the pipeline. Fill in or edit title and description below.</p>
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Video Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Paste title from ChatGPT..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">{title.length}/60 chars</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Paste description from ChatGPT..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>
            {title && description && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                Next: Publish <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "publish": {
        const publishTrack = async () => {
          if (!videoUrl || !title) return;
          setPublishing(true);
          try {
            const videoBlob = await fetch(videoUrl).then(r => r.blob());
            const form = new FormData();
            form.append("video", videoBlob, "track.mp4");
            form.append("title", title);
            form.append("description", description);
            const res = await fetch("/api/youtube/upload", { method: "POST", body: form });
            const data = await res.json();
            if (data.url) setPublishedUrl(data.url);
            else alert("Upload failed: " + data.error);
          } catch (e) {
            alert("Upload failed. Check console.");
          }
          setPublishing(false);
        };

        const resetPipeline = () => {
          setCurrentStep("concept");
          setStyleTag(""); setTrackTheme(""); setLyrics("");
          setArtFile(null); setArtPreview(null); setAudioFile(null);
          setVideoUrl(null); setTitle(""); setDescription("");
          setPublishedUrl(null);
        };

        return (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              {[
                { label: "Style", value: styleTag },
                { label: "Title", value: title },
                { label: "Video", value: videoUrl ? "✓ Ready" : "Not created" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 p-3 rounded-lg bg-secondary border border-border">
                  <span className="text-muted-foreground w-16">{label}</span>
                  <span className={`text-sm ${value?.startsWith("✓") ? "text-green-400" : ""}`}>{value || "—"}</span>
                </div>
              ))}
            </div>

            {publishedUrl ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <p className="text-sm text-green-400 font-medium">✓ Published to YouTube!</p>
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 text-sm text-primary hover:underline block">{publishedUrl}</a>
                </div>
                <button onClick={resetPipeline}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  <RefreshCw className="w-4 h-4" /> Start Next Track
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <a href="/api/auth/youtube"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/40">
                  Connect YouTube Account <ChevronRight className="w-4 h-4" />
                </a>
                <button
                  onClick={publishTrack}
                  disabled={!videoUrl || !title || publishing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {publishing
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                    : <><Upload className="w-4 h-4" /> Publish to YouTube</>}
                </button>
                {publishing && <p className="text-sm text-muted-foreground">Uploading — this may take a minute...</p>}
                <button onClick={resetPipeline}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3.5 h-3.5" /> Start new track without publishing
                </button>
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 px-4 pt-16 pb-20 md:ml-56 md:p-8">
        <div className="mb-5 md:mb-6 flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Youtube className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">YouTube</h1>
            <p className="text-muted-foreground text-sm">@djthirstyboy · Drum & Bass</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 md:mb-6 bg-secondary rounded-lg p-1 overflow-x-auto">
          {[
            { key: "pipeline", label: "Track Pipeline", icon: Music },
            { key: "calendar", label: "Content Calendar", icon: Calendar },
            { key: "analytics", label: "Analytics", icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* PERSISTENT PIPELINE STATUS BAR */}
        {activeTab === "pipeline" && pendingCount > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 text-sm text-primary">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {pendingCount} job{pendingCount !== 1 ? "s" : ""} pending / running in extension
            </div>
            <button onClick={cancelAllPending} className="text-xs text-red-400 border border-red-400/30 px-3 py-1 rounded-lg hover:bg-red-400/10 flex-shrink-0">
              Cancel All
            </button>
          </div>
        )}

        {/* APPROVAL QUEUE */}
        {activeTab === "pipeline" && approvalQueue.length > 0 && (
          <div className="mb-5 space-y-4">
            <p className="text-sm font-semibold text-yellow-400">{approvalQueue.length} job{approvalQueue.length > 1 ? "s" : ""} awaiting approval</p>
            {approvalQueue.map(job => {
              const allActioned = job.approvedUrls.length + job.skippedUrls.length >= job.audioUrls.length && job.audioUrls.length > 0;
              return (
                <div key={job.jobId} className="p-5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{job.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.isInstrumental ? "Instrumental" : "Vocal"} · {job.audioUrls.length} tracks</p>
                    </div>
                    <button onClick={() => handleDisapproveJob(job.jobId)}
                      className="text-xs text-red-400 hover:text-red-300 flex-shrink-0">Dismiss Job</button>
                  </div>
                  {autoPublishing ? (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <RefreshCw className="w-4 h-4 animate-spin" /> {autoPublishStep}
                    </div>
                  ) : job.audioUrls.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No audio URLs captured.</p>
                  ) : (
                    <div className="space-y-2">
                      {job.audioUrls.map((url, i) => {
                        const approved = job.approvedUrls.includes(url);
                        const skipped = job.skippedUrls.includes(url);
                        const vocalLocked = !job.isInstrumental && job.approvedUrls.length > 0 && !approved && !skipped;
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                            <span className="text-sm text-muted-foreground w-16 flex-shrink-0">Track {i + 1}</span>
                            {approved ? (
                              <span className="text-xs text-green-400 flex-1">✓ Approved & uploading</span>
                            ) : skipped ? (
                              <span className="text-xs text-muted-foreground flex-1">Skipped</span>
                            ) : vocalLocked ? (
                              <>
                                <span className="text-xs text-yellow-400 flex-1">Title already used</span>
                                <button onClick={() => handleSkipTrack(job.jobId, url)}
                                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground">Skip</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleApprove(job, url)}
                                  className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">Approve</button>
                                <button onClick={() => handleSkipTrack(job.jobId, url)}
                                  className="px-4 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 text-sm font-semibold hover:bg-red-600/30">Skip</button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {allActioned && (
                    <p className="text-xs text-green-400">All tracks actioned for this job.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Step list */}
            <div className="md:col-span-1">
              <Card>
                <CardContent className="p-3">
                  {STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = step.key === currentStep;
                    const isDone = i < stepIndex;
                    return (
                      <button
                        key={step.key}
                        onClick={() => setCurrentStep(step.key as StepKey)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
                          isActive ? "bg-primary/10 text-primary" : isDone ? "text-muted-foreground" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isDone ? "bg-green-500/20 text-green-400" : isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                        }`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Step content */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => { const Icon = STEPS[stepIndex].icon; return <Icon className="w-4 h-4 text-primary" />; })()}
                    {STEPS[stepIndex].label}
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderStep()}</CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Content Calendar</p>
              <p className="text-sm text-muted-foreground mt-1">Track history will appear here as you publish videos. Target: 1 video/day.</p>
            </CardContent>
          </Card>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Channel Analytics</p>
              <p className="text-sm text-muted-foreground mt-1">Connect YouTube OAuth to see live stats for @djthirstyboy.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
