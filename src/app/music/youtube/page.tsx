"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import {
  Youtube, Music, Wand2, ImageIcon, Video,
  FileText, Upload, RefreshCw, Copy, Check,
  ChevronRight, ChevronLeft, Calendar, BarChart2, Clock, Plus, Trash2,
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
  { key: "lyrics",    label: "Lyrics",           icon: Music,       desc: "Generate lyrics in ChatGPT" },
  { key: "art",       label: "Cover Art",        icon: ImageIcon,   desc: "Generate artwork in ChatGPT" },
  { key: "audio",     label: "Audio (Suno)",     icon: Music,       desc: "Generate audio in Suno, download & upload here" },
  { key: "video",     label: "Create Video",     icon: Video,       desc: "Combine art + audio with chromatic aberration" },
  { key: "metadata",  label: "Title & Description", icon: FileText, desc: "Generate SEO-optimized metadata" },
  { key: "publish",   label: "Publish",          icon: Upload,      desc: "Upload to YouTube" },
];

type StepKey = "lyrics" | "art" | "audio" | "video" | "metadata" | "publish";

interface ApprovalJob {
  jobId: string;
  audioUrls: string[];
  artUrl: string | null;
  title: string;
  description: string;
  lyrics: string;
  styleTags: string;
  personaName: string;
  isInstrumental: boolean;
  artPrompt: string;
  metadataPrompt: string;
  approvedUrls: string[];   // sub-job created / single-audio upload started
  skippedUrls: string[];
  uploadedUrls: string[];   // successfully uploaded to YouTube
  errorUrls: Record<string, string>; // url → error message
}

// Per-track UI status (keyed by audio URL)
type TrackStatus = "processing" | "uploading" | "uploaded" | string; // string = error message

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "calendar" | "analytics">("pipeline");
  const [currentStep, setCurrentStep] = useState<StepKey>("lyrics");
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [styleTag, setStyleTag] = useState("");
  const [trackTheme, setTrackTheme] = useState("");
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [artPrompt, setArtPrompt] = useState("");
  const [metadataPrompt, setMetadataPrompt] = useState("");
  const [dbTemplates, setDbTemplates] = useState<Record<string, string>>({});
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
  const [autoApproveSteps, setAutoApproveSteps] = useState<{ lyrics: boolean; art: boolean; audio: boolean; metadata: boolean }>(() => {
    try {
      const saved = localStorage.getItem("autoApproveSteps");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { lyrics: false, art: false, audio: false, metadata: false };
  });
  const updateAutoApproveSteps = (fn: (prev: { lyrics: boolean; art: boolean; audio: boolean; metadata: boolean }) => { lyrics: boolean; art: boolean; audio: boolean; metadata: boolean }) => {
    setAutoApproveSteps(prev => {
      const next = fn(prev);
      try { localStorage.setItem("autoApproveSteps", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [autoNext, setAutoNext] = useState(() => { try { return JSON.parse(localStorage.getItem("autoNext") || "false"); } catch { return false; } });
  const [schedule, setSchedule] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("schedule") || "[]"); } catch { return []; } });
  const [scheduleEnabled, setScheduleEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem("scheduleEnabled") || "false"); } catch { return false; } });
  const [newScheduleTime, setNewScheduleTime] = useState("09:00");
  const autoNextRef = useRef(autoNext);
  const scheduleRef = useRef(schedule);
  const scheduleEnabledRef = useRef(scheduleEnabled);
  const lastScheduledRunRef = useRef<string | null>(null);
  const runAutomationRef = useRef<(() => Promise<void>) | null>(null);
  const runNightlyBatchRef = useRef<(() => Promise<void>) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [activeJobs, setActiveJobs] = useState<Record<string, { step: string; status: string }>>({});
  const [liveJob, setLiveJob] = useState<{ id: string; step: string; lyrics?: string; art_url?: string; audio_url?: string; title?: string; description?: string; error_message?: string; lyrics_prompt?: string; art_prompt?: string; metadata_prompt?: string; style_tags?: string; track_theme?: string } | null>(null);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalJob[]>([]);
  const reportedErrors = useRef<Set<string>>(new Set());
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [autoPublishStep, setAutoPublishStep] = useState<string | null>(null);
  // Manual upload queue — approvals drop in here, drain one at a time
  const [manualUploadQueue, setManualUploadQueue] = useState<Array<{ job: ApprovalJob; audioUrl: string }>>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [debugRunning, setDebugRunning] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<{ type: string; jobId: string; lyrics?: string; artUrl?: string; title?: string; description?: string } | null>(null);
  const debugJobIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const artRef = useRef<HTMLInputElement>(null);
  // Sub-job auto-upload queue (instrumental per-track sub-jobs)
  const subJobSeenRef = useRef<Set<string>>(new Set()); // dedup: sub-job IDs already queued
  const [trackStatuses, setTrackStatuses] = useState<Record<string, TrackStatus>>({});
  const [subJobQueue, setSubJobQueue] = useState<Array<{
    subJobId: string; parentJobId: string; audioUrl: string;
    artUrl: string | null; title: string; description: string;
  }>>([]);

  // ── POLL PENDING JOB COUNT (always-on, survives page reload) ──
  useEffect(() => {
    // On mount: restore any jobs sitting at approval step so they survive a page refresh.
    // Query by step only — not status — so they reappear even if status got changed.
    supabase.from("pipeline_jobs")
      .select("*")
      .eq("step", "approval")
      .not("status", "in", '("complete","error")')
      .then(({ data: pendingApprovals }) => {
        if (!pendingApprovals?.length) return;
        setActiveJobIds(prev => {
          const existing = new Set(prev);
          const newIds = pendingApprovals.map(j => j.id).filter(id => !existing.has(id));
          return newIds.length ? [...prev, ...newIds] : prev;
        });
        setApprovalQueue(prev => {
          const existing = new Set(prev.map(a => a.jobId));
          const toAdd = pendingApprovals
            .filter(j => !existing.has(j.id) && !(j.track_theme || "").startsWith("__subjob:"))
            .map(j => ({
              jobId: j.id,
              audioUrls: (() => { try { return JSON.parse(j.audio_url ?? "[]"); } catch { return []; } })(),
              artUrl: j.art_url ?? null,
              title: j.title ?? "",
              description: j.description ?? "",
              lyrics: j.lyrics ?? "",
              styleTags: j.style_tags ?? "",
              personaName: j.persona_name ?? "",
              isInstrumental: !(j.lyrics || "").replace(/^TITLE:\s*.+\r?\n?/im, "").replace(/^STYLE:\s*.+\r?\n?/im, "").trim(),
              artPrompt: j.art_prompt ?? "",
              metadataPrompt: j.metadata_prompt ?? "",
              approvedUrls: [],
              skippedUrls: [],
              uploadedUrls: [],
              errorUrls: {},
            }));
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
        setAutomating(true);
      });

    // On mount: auto-cancel jobs stuck mid-pipeline for over 2 hours.
    // Excludes approval-step jobs — those wait indefinitely for user action.
    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Auto-cancelled: stale job" })
      .in("status", ["pending", "running"])
      .neq("step", "approval")
      .lt("updated_at", staleThreshold);

    const check = async () => {
      const { count } = await supabase.from("pipeline_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]).not("step", "in", '("approval","complete")');
      setPendingCount(count ?? 0);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load per-artist prompt templates from Prompt Studio when persona changes
  // Templates are shown raw (with {{genre}} / {{theme}} visible) — variables are substituted at job creation time
  useEffect(() => {
    supabase
      .from("artist_prompt_configs")
      .select("prompt_type,template")
      .eq("persona_name", selectedPersona.name)
      .then(({ data }) => {
        if (!data?.length) { setDbTemplates({}); return; }
        const byType = Object.fromEntries(data.map((r: { prompt_type: string; template: string }) => [r.prompt_type, r.template]));
        setDbTemplates(byType);
        if (byType.lyrics)   setLyricsPrompt(byType.lyrics);
        if (byType.art)      setArtPrompt(byType.art);
        if (byType.metadata) setMetadataPrompt(byType.metadata);
      });
  }, [selectedPersona.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs in sync so callbacks always see latest values
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { scheduleEnabledRef.current = scheduleEnabled; }, [scheduleEnabled]);
  // No dependency array — runs after every render so the scheduler always has the latest runAutomation
  useEffect(() => { runAutomationRef.current = runAutomation; });

  // Scheduler — checks every 30s if it's time to run the nightly batch
  useEffect(() => {
    const interval = setInterval(() => {
      if (!scheduleEnabledRef.current || !scheduleRef.current.length) return;
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (scheduleRef.current.includes(t) && lastScheduledRunRef.current !== t) {
        lastScheduledRunRef.current = t;
        runNightlyBatchRef.current?.();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── SUB-JOB AUTO-UPLOAD QUEUE ─────────────────────────────────
  // Processes one sub-job upload at a time. publishingJobId acts as the lock:
  // the effect sets it before starting, clears it on completion → triggers the next.
  useEffect(() => {
    if (subJobQueue.length === 0 || publishingJobId !== null) return;
    const [next, ...rest] = subJobQueue;
    setSubJobQueue(rest);
    setPublishingJobId(next.parentJobId);
    autoUploadTrack(next);
  }, [subJobQueue, publishingJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MANUAL UPLOAD QUEUE ───────────────────────────────────────
  // Approvals enqueue here immediately so buttons stay unlocked.
  // Drains one at a time using the same publishingJobId lock.
  useEffect(() => {
    if (manualUploadQueue.length === 0 || publishingJobId !== null) return;
    const [next, ...rest] = manualUploadQueue;
    setManualUploadQueue(rest);
    executeUpload(next.job, next.audioUrl);
  }, [manualUploadQueue, publishingJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAllPending = async () => {
    await supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Cancelled by user" })
      .in("status", ["pending", "running"]);
    setActiveJobIds([]);
    setAutomating(false);
    setAutomationStep(null);
    setPendingCount(0);
  };

  // ── JUMP TO STEP ─────────────────────────────────────────────
  // Cancels the running job, then re-queues it starting from the requested step,
  // carrying over any already-generated data (lyrics, art_url, audio_url).
  const jumpToStep = async (jobId: string, targetStep: "lyrics" | "art" | "audio" | "metadata" | "approval") => {
    // Fetch current job data
    const { data: job } = await supabase.from("pipeline_jobs").select("*").eq("id", jobId).single();
    if (!job) return;

    // Cancel the stalled job
    await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Manually skipped to " + targetStep }).eq("id", jobId);
    setActiveJobIds(prev => prev.filter(id => id !== jobId));

    // Build new job carrying over completed-step data
    const carry: Record<string, string | null> = {
      status: "pending",
      style_tags: job.style_tags,
      track_theme: job.track_theme,
    };
    // Always carry lyrics & art prompts so the extension has them if needed later
    if (job.lyrics_prompt)   carry.lyrics_prompt   = job.lyrics_prompt;
    if (job.art_prompt)      carry.art_prompt       = job.art_prompt;
    if (job.metadata_prompt) carry.metadata_prompt  = job.metadata_prompt;

    // Pre-fill completed steps so the extension skips them
    if (targetStep === "art" || targetStep === "audio" || targetStep === "metadata" || targetStep === "approval") {
      carry.lyrics = job.lyrics ?? ""; // skip lyrics step
    }
    if (targetStep === "audio" || targetStep === "metadata" || targetStep === "approval") {
      carry.art_url = job.art_url ?? null; // skip art step (null = no art, extension skips)
      carry.art_prompt = null;             // clear prompt so extension won't regenerate
    }
    if (targetStep === "metadata" || targetStep === "approval") {
      carry.audio_url = job.audio_url ?? "[]"; // skip Suno
    }
    if (targetStep === "approval") {
      carry.title = job.title ?? "";
      carry.description = job.description ?? "";
      carry.metadata_prompt = null;
    }

    const { data: newJob } = await supabase.from("pipeline_jobs").insert(carry).select().single();
    if (newJob) {
      setActiveJobIds(prev => [...prev, newJob.id]);
      setAutomating(true);
    }
  };

  // ── RETRY LAST STEP ─────────────────────────────────────────
  // Re-runs the failed/rejected step from scratch, carrying over everything before it.
  const retryFromStep = async (job: NonNullable<typeof liveJob>) => {
    // Map review steps back to the step that runs them
    const stepToRun = job.step.replace("_review", "") as "lyrics" | "art" | "audio" | "metadata";
    const carry: Record<string, string | null> = {
      status: "pending",
      style_tags: job.style_tags ?? "",
      track_theme: job.track_theme ?? "",
      lyrics_prompt: job.lyrics_prompt ?? null,
      art_prompt: job.art_prompt ?? null,
      metadata_prompt: job.metadata_prompt ?? null,
    };
    // Carry over everything BEFORE the failed step
    if (stepToRun !== "lyrics") carry.lyrics = job.lyrics ?? "";
    if (stepToRun !== "art" && stepToRun !== "lyrics") {
      carry.art_url = job.art_url ?? null;
      carry.art_prompt = null;
    }
    if (stepToRun !== "audio" && stepToRun !== "art" && stepToRun !== "lyrics") {
      carry.audio_url = job.audio_url ?? "[]";
    }

    const { data: newJob } = await supabase.from("pipeline_jobs").insert(carry).select().single();
    if (newJob) {
      setActiveJobIds(prev => [...prev, newJob.id]);
      setAutomating(true);
      setLiveJob(null);
    }
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

      // Update per-job step/status tracking
      const jobMap: Record<string, { step: string; status: string }> = {};
      jobs.forEach(j => { jobMap[j.id] = { step: j.step, status: j.status }; });
      setActiveJobs(jobMap);

      // Keep the most recently updated job as the live preview (running, review, or errored)
      // Exclude approval-step jobs — those are handled by the approval queue card, not live preview
      const liveCandidate = [...jobs]
        .filter(j => j.step != null && j.step !== "approval")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;
      if (liveCandidate) setLiveJob({ id: liveCandidate.id, step: liveCandidate.step, lyrics: liveCandidate.lyrics, art_url: liveCandidate.art_url, audio_url: liveCandidate.audio_url, title: liveCandidate.title, description: liveCandidate.description, error_message: liveCandidate.error_message, lyrics_prompt: liveCandidate.lyrics_prompt, art_prompt: liveCandidate.art_prompt, metadata_prompt: liveCandidate.metadata_prompt, style_tags: liveCandidate.style_tags, track_theme: liveCandidate.track_theme });
      else setLiveJob(null);

      // Update step display from running jobs
      const running = jobs.find(j => j.status === "running");
      if (running) setAutomationStep(running.step);

      // Add newly-approved jobs to queue (or auto-upload if sub-job)
      const readyJobs = jobs.filter(j => j.step === "approval");
      if (readyJobs.length > 0) {
        // Route sub-jobs (tagged __subjob:<parentId>) to the auto-upload queue
        for (const j of readyJobs) {
          if ((j.track_theme || "").startsWith("__subjob:") && !subJobSeenRef.current.has(j.id)) {
            subJobSeenRef.current.add(j.id);
            const parentJobId = (j.track_theme as string).replace("__subjob:", "");
            const audioUrls: string[] = (() => { try { return JSON.parse(j.audio_url ?? "[]"); } catch { return []; } })();
            const audioUrl = audioUrls[0];
            if (audioUrl) {
              setSubJobQueue(prev => [...prev, {
                subJobId: j.id, parentJobId, audioUrl,
                artUrl: j.art_url ?? null,
                title: j.title ?? "",
                description: j.description ?? "",
              }]);
            }
          }
        }
        // Regular jobs (not sub-jobs) → approval queue
        setApprovalQueue(prev => {
          const existing = new Set(prev.map(a => a.jobId));
          const toAdd = readyJobs
            .filter(j => !existing.has(j.id) && !(j.track_theme || "").startsWith("__subjob:"))
            .map(j => ({
              jobId: j.id,
              audioUrls: (() => { try { return JSON.parse(j.audio_url ?? "[]"); } catch { return []; } })(),
              artUrl: j.art_url ?? null,
              title: j.title ?? "",
              description: j.description ?? "",
              lyrics: j.lyrics ?? "",
              styleTags: j.style_tags ?? "",
              personaName: j.persona_name ?? selectedPersona.name,
              isInstrumental: !(j.lyrics || "").replace(/^TITLE:\s*.+\r?\n?/im, "").replace(/^STYLE:\s*.+\r?\n?/im, "").trim(),
              artPrompt: j.art_prompt ?? "",
              metadataPrompt: j.metadata_prompt ?? "",
              approvedUrls: [],
              skippedUrls: [],
              uploadedUrls: [],
              errorUrls: {},
            }));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      // Mark errors as seen (live preview shows them with retry button)
      jobs.filter(j => j.status === "error").forEach(j => { reportedErrors.current.add(j.id); });

      // Remove finished jobs from active tracking (keep review steps alive so approve buttons show)
      const doneIds = jobs.filter(j => j.step === "approval" || j.status === "error" || j.status === "complete").map(j => j.id);
      if (doneIds.length > 0) {
        setActiveJobIds(prev => {
          const next = prev.filter(id => !doneIds.includes(id));
          if (next.length === 0) { setAutomating(false); setAutomationStep(null); setLiveJob(null); }
          return next;
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobIds]);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  // ── HELPERS ──────────────────────────────────────────────────
  const applyTemplate = (template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const buildConcept = (theme: string, persona: typeof PERSONAS[0] = pickPersona()) => {
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
    const lp = persona.instrumental
      ? `Create a track concept for ${persona.name}, an electronic music artist (instrumental, no vocals). ` +
        `Style: ${persona.artStyle}. Genre: ${tag}${theme ? `. Theme: "${theme}"` : ""}.\n\n` +
        `Output ONLY these two lines — nothing else:\n` +
        `TITLE: [a creative track name]\n` +
        `STYLE: ${tag}`
      : `You are writing lyrics for ${persona.name}, an electronic music artist. ` +
        `Style: ${persona.lyricsStyle}. ` +
        `Write lyrics for a ${tag} track${theme ? ` about "${theme}"` : ""}.\n\n` +
        `STRICT RULES — follow exactly, do not deviate:\n` +
        `1. RHYME SCHEME: ${rhyme}. Apply this pattern to EVERY verse and chorus section. Each letter = one line-end rhyme group. Every line labelled the same letter must rhyme with each other.\n` +
        `2. SONG STRUCTURE: ${structure}. Use exactly this order of sections, no more, no less.\n` +
        `3. CHORUS LENGTH: Every chorus is exactly 8 bars.\n` +
        `4. VERSE LENGTH: Every verse is exactly ${verseBars} bars.\n` +
        `5. CHORUS REPETITION PATTERN: ${hookPattern}. Write out every repeated line in full — never write "(repeat)", "(x2)", or any shorthand.\n` +
        `6. Label every section clearly on its own line: INTRO, CHORUS, VERSE 1, VERSE 2, BRIDGE, OUTRO.\n` +
        `7. Keep every line punchy and rhythmically tight for electronic music.\n` +
        `8. At the VERY TOP of your response (before any song sections), include these two header lines exactly:\n` +
        `   TITLE: [the track name you choose]\n` +
        `   STYLE: ${tag}`;
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

  // Nightly batch — queues one pipeline job per artist so all 7 run overnight
  const runNightlyBatch = async () => {
    for (const persona of PERSONAS) {
      const { tag, lyricsPrompt: lp, artPrompt: ap, metadataPrompt: mp } = buildConcept("", persona);
      try {
        await supabase.from("pipeline_jobs").insert({
          status: "pending",
          style_tags: tag,
          lyrics_prompt: lp,
          art_prompt: ap,
          metadata_prompt: mp,
          persona_name: persona.name,
          auto_approve: false,
        });
      } catch {}
    }
  };
  // Keep ref in sync so the scheduler interval always has the latest version
  useEffect(() => { runNightlyBatchRef.current = runNightlyBatch; }); // eslint-disable-line react-hooks/exhaustive-deps

  const runAutomation = async () => {
    if (submitting || automating) return;
    setSubmitting(true);
    setAutomating(true);
    setAutomationStep("queued");

    // Cancel any leftover pending/in-progress jobs from previous runs, then clear UI state
    await supabase.from("pipeline_jobs")
      .update({ status: "error", error_message: "Cancelled — new batch started" })
      .in("status", ["pending", "running"]);
    setApprovalQueue([]);
    setTrackStatuses({});
    setLiveJob(null);
    subJobSeenRef.current = new Set();

    const newJobIds: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      // If the user already generated a concept (styleTag is set), use those stored prompts.
      // Only generate fresh prompts if no concept has been built yet.
      let tag: string, lp: string, ap: string, mp: string;
      tag = generateStyleTagForPersona(selectedPersona);
      if (Object.keys(dbTemplates).length > 0) {
        const vars = { genre: tag, theme: trackTheme.trim() };
        lp = applyTemplate(dbTemplates.lyrics ?? "", vars);
        ap = applyTemplate(dbTemplates.art ?? "", vars);
        mp = applyTemplate(dbTemplates.metadata ?? "", vars);
        setStyleTag(tag);
      } else if (styleTag && lyricsPrompt && artPrompt && metadataPrompt) {
        tag = styleTag;
        lp = lyricsPrompt;
        ap = artPrompt;
        mp = metadataPrompt;
      } else {
        const built = buildConcept(trackTheme.trim(), selectedPersona);
        tag = built.tag;
        lp = built.lyricsPrompt;
        ap = built.artPrompt;
        mp = built.metadataPrompt;
      }
      const autoApproveStepsStr = Object.entries(autoApproveSteps)
        .filter(([, v]) => v).map(([k]) => k).join(",");
      const basePayload = {
        status: "pending",
        style_tags: tag,
        track_theme: trackTheme.trim(),
        lyrics_prompt: lp,
        art_prompt: ap,
        metadata_prompt: mp,
        persona_name: selectedPersona.name,
      };
      let insertResult = await supabase.from("pipeline_jobs").insert({
        ...basePayload,
        auto_approve: Object.values(autoApproveSteps).every(Boolean),
        auto_approve_steps: autoApproveStepsStr || null,
      }).select().single();
      if (insertResult.error) {
        // Retry without columns that may not exist in this schema
        insertResult = await supabase.from("pipeline_jobs").insert(basePayload).select().single();
      }
      const { data, error } = insertResult;
      if (error) { alert(`Failed to create job: ${error.message}`); break; }
      if (data) newJobIds.push(data.id);
    }
    setSubmitting(false);
    if (newJobIds.length > 0) setActiveJobIds(newJobIds);
    else { setAutomating(false); setAutomationStep(null); }
  };

  const runDebugStep = async (step: "lyrics" | "art" | "suno" | "metadata") => {
    if (debugRunning) return;
    setDebugRunning(step);
    setDebugResult(null);

    let tag: string, lp: string, ap: string, mp: string;
    tag = generateStyleTagForPersona(selectedPersona);
    if (Object.keys(dbTemplates).length > 0) {
      const vars = { genre: tag, theme: trackTheme.trim() };
      lp = applyTemplate(dbTemplates.lyrics ?? "", vars);
      ap = applyTemplate(dbTemplates.art ?? "", vars);
      mp = applyTemplate(dbTemplates.metadata ?? "", vars);
      setStyleTag(tag);
    } else if (styleTag && lyricsPrompt && artPrompt && metadataPrompt) {
      tag = styleTag;
      lp = lyricsPrompt;
      ap = artPrompt;
      mp = metadataPrompt;
    } else {
      const built = buildConcept(trackTheme.trim(), selectedPersona);
      tag = built.tag;
      lp = built.lyricsPrompt;
      ap = built.artPrompt;
      mp = built.metadataPrompt;
      setStyleTag(tag);
    }

    // Build a minimal job — pre-set audio_url="[]" to skip Suno for non-audio steps
    const jobData: Record<string, string> = {
      status: "pending",
      style_tags: tag,
      track_theme: `__debug:${step}__`,
    };
    if (step === "lyrics")   { jobData.lyrics_prompt = lp; jobData.audio_url = "[]"; }
    if (step === "art")      { jobData.art_prompt = ap;    jobData.audio_url = "[]"; }
    if (step === "suno")     { jobData.lyrics_prompt = lp; /* no audio_url — let Suno run */ }
    if (step === "metadata") { jobData.metadata_prompt = mp; jobData.lyrics = lp; jobData.audio_url = "[]"; }

    const { data, error } = await supabase.from("pipeline_jobs").insert(jobData).select().single();
    if (error || !data) { setDebugRunning(null); alert("Failed to create debug job: " + error?.message); return; }

    debugJobIdRef.current = data.id;
    setActiveJobIds(prev => [...prev, data.id]);

    // Poll until this specific job finishes (approval or error)
    const pollDebug = setInterval(async () => {
      const { data: job } = await supabase.from("pipeline_jobs").select("*").eq("id", data.id).single();
      if (!job) return;
      if (job.step === "approval" || job.status === "error" || job.status === "complete") {
        clearInterval(pollDebug);
        setDebugRunning(null);
        if (job.status === "error") { alert("Debug job failed: " + job.error_message); return; }
        if (step === "suno") return; // Suno results go to the normal approval queue
        setDebugResult({
          type: step,
          jobId: job.id,
          lyrics: job.lyrics ?? undefined,
          artUrl: job.art_url ?? undefined,
          title: job.title ?? undefined,
          description: job.description ?? undefined,
        });
      }
    }, 3000);
  };

  // ── SHARED UPLOAD HELPER ────────────────────────────────────────
  // Fetches audio + art, encodes video with FFmpeg, uploads to YouTube.
  // Returns the YouTube video URL on success; throws on failure.
  const uploadToYouTube = async (audioUrl: string, artUrl: string | null, title: string, description: string): Promise<string> => {
    setAutoPublishStep("Fetching audio...");
    let audioBlob: Blob;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30000);
      const audioRes = await fetch(audioUrl, { signal: ac.signal });
      clearTimeout(timer);
      if (!audioRes.ok) throw new Error(`HTTP ${audioRes.status}`);
      audioBlob = await audioRes.blob();
    } catch (e) {
      throw new Error(`Audio fetch failed — ${e instanceof Error ? e.message : e}. URL: ${audioUrl.slice(0, 80)}`);
    }
    if (audioBlob.size < 10000) throw new Error(`Audio file too small (${audioBlob.size} bytes) — URL may be expired`);

    setAutoPublishStep("Fetching art...");
    let artFileObj: File | null = null;
    if (artUrl) {
      let artBlob: Blob;
      if (artUrl.startsWith("data:")) {
        const base64 = artUrl.split(",")[1];
        const binary = atob(base64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        artBlob = new Blob([arr], { type: "image/jpeg" });
      } else {
        let artRes: Response;
        try { artRes = await fetch(artUrl); } catch (e) { throw new Error(`Art fetch failed: ${e}`); }
        artBlob = await artRes.blob();
      }
      artFileObj = new File([artBlob], "art.jpg", { type: "image/jpeg" });
    }
    if (!artFileObj) throw new Error("No cover art available for this job.");

    // Encode audio+art → video via MediaRecorder + HTMLAudioElement.captureStream().
    // Rules: (1) play() MUST be called before captureStream() — calling it before
    // returns empty audio tracks; (2) AudioContext won't work here because it starts
    // suspended when created outside a user gesture (deep in async chains).
    setAutoPublishStep("Encoding video...");
    const vidBlob = await (async () => {
      // Draw album art to offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width = 1280; canvas.height = 720;
      const ctx2d = canvas.getContext("2d")!;
      await new Promise<void>((res, rej) => {
        const img = new Image();
        const imgUrl = URL.createObjectURL(artFileObj);
        img.onload = () => {
          URL.revokeObjectURL(imgUrl);
          ctx2d.fillStyle = "#000";
          ctx2d.fillRect(0, 0, 1280, 720);
          const scale = Math.min(1280 / img.width, 720 / img.height);
          ctx2d.drawImage(img, (1280 - img.width * scale) / 2, (720 - img.height * scale) / 2, img.width * scale, img.height * scale);
          res();
        };
        img.onerror = () => rej(new Error("Art image failed to load for encoding"));
        img.src = imgUrl;
      });

      // Start audio FIRST — captureStream() only returns live audio tracks after play()
      const audioEl = document.createElement("audio");
      audioEl.muted = true; // allows autoplay without user gesture
      const audioObjUrl = URL.createObjectURL(audioBlob);
      audioEl.src = audioObjUrl;
      await audioEl.play();

      type AudioElWithCapture = HTMLAudioElement & { captureStream(): MediaStream };
      const audioStream = (audioEl as AudioElWithCapture).captureStream();
      const duration = isFinite(audioEl.duration) ? audioEl.duration : 300;

      const stream = new MediaStream([
        ...canvas.captureStream(1).getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 192_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      return new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          URL.revokeObjectURL(audioObjUrl);
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
        recorder.onerror = reject;

        let elapsed = 0;
        const encTimer = setInterval(() => {
          elapsed++;
          const rem = Math.max(0, duration - elapsed);
          setAutoPublishStep(`Encoding video... ${Math.floor(rem / 60)}:${String(Math.round(rem % 60)).padStart(2, "0")} left`);
        }, 1000);

        const stop = () => {
          clearInterval(encTimer);
          if (recorder.state !== "inactive") recorder.stop();
        };
        audioEl.onended = stop;
        setTimeout(stop, (duration + 5) * 1000); // failsafe if onended never fires

        recorder.start(1000);
      });
    })();
    if (vidBlob.size < 10000) throw new Error(`Encoded video too small (${vidBlob.size} bytes)`);

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
          "X-Upload-Content-Type": "video/webm",
          "X-Upload-Content-Length": String(vidBlob.size),
        },
        body: JSON.stringify({
          snippet: {
            title: title || "New Track",
            description: description || "",
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
        "Content-Type": "video/webm",
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
    return `https://www.youtube.com/watch?v=${videoId}`;
  };

  // Picks a random in-progress album for the persona and records the track in album_tracks.
  const assignTrackToRandomAlbum = async (personaName: string, trackTitle: string, ytUrl: string) => {
    const { data: openAlbums } = await supabase
      .from("albums")
      .select("id, max_tracks")
      .eq("persona_name", personaName)
      .eq("status", "in_progress");
    if (!openAlbums?.length) return;
    const album = openAlbums[Math.floor(Math.random() * openAlbums.length)] as { id: string; max_tracks?: number };
    const { count } = await supabase
      .from("album_tracks")
      .select("*", { count: "exact", head: true })
      .eq("album_id", album.id);
    const max = album.max_tracks ?? 10;
    if ((count ?? 0) >= max) return;
    await supabase.from("album_tracks").insert({
      album_id: album.id,
      track_number: (count ?? 0) + 1,
      title: trackTitle,
      youtube_url: ytUrl,
      status: "uploaded",
    });
  };

  // ── AUTO-UPLOAD FOR SUB-JOB TRACKS ──────────────────────────────
  // Called by the subJobQueue effect — publishingJobId is already set by the caller.
  const autoUploadTrack = async (item: {
    subJobId: string; parentJobId: string; audioUrl: string;
    artUrl: string | null; title: string; description: string;
  }) => {
    const { subJobId, parentJobId, audioUrl, artUrl, title, description } = item;
    setTrackStatuses(prev => ({ ...prev, [audioUrl]: "uploading" }));
    try {
      const ytUrl = await uploadToYouTube(audioUrl, artUrl, title, description);
      setTrackStatuses(prev => ({ ...prev, [audioUrl]: "uploaded" }));
      await supabase.from("pipeline_jobs").update({ status: "complete", step: "complete" }).eq("id", subJobId);

      // Register in track catalog
      const parentJob = approvalQueue.find(j => j.jobId === parentJobId);
      if (parentJob) {
        const videoId = ytUrl.split("v=")[1];
        const tagArr = parentJob.styleTags.split(",").map((t: string) => t.trim()).filter(Boolean);
        supabase.from("artist_track_names").upsert({
          persona_name: parentJob.personaName,
          track_name: title,
          youtube_video_id: videoId,
          youtube_url: ytUrl,
          tags: tagArr,
        }, { onConflict: "persona_name,track_name" });
        assignTrackToRandomAlbum(parentJob.personaName, title, ytUrl);
      }
      setApprovalQueue(prev => {
        const updated = prev.map(j => {
          if (j.jobId !== parentJobId) return j;
          return { ...j, uploadedUrls: [...j.uploadedUrls, audioUrl] };
        });
        // Mark parent job complete in DB if all tracks are done; fire auto-next
        const parentJob = updated.find(j => j.jobId === parentJobId);
        if (parentJob) {
          const done = parentJob.uploadedUrls.length + parentJob.skippedUrls.length + Object.keys(parentJob.errorUrls).length;
          if (done >= parentJob.audioUrls.length) {
            supabase.from("pipeline_jobs").update({ status: "complete", step: "complete" }).eq("id", parentJobId);
            if (autoNextRef.current) {
              setTimeout(() => { runAutomationRef.current?.(); }, 5000);
            }
          }
        }
        // Remove card only when all tracks resolved
        return updated.filter(j => {
          if (j.jobId !== parentJobId) return true;
          return j.uploadedUrls.length + j.skippedUrls.length + Object.keys(j.errorUrls).length < j.audioUrls.length;
        });
      });
      console.log(`Track uploaded: ${ytUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTrackStatuses(prev => ({ ...prev, [audioUrl]: msg }));
      setApprovalQueue(prev => prev.map(j => {
        if (j.jobId !== parentJobId) return j;
        return { ...j, errorUrls: { ...j.errorUrls, [audioUrl]: msg } };
      }));
    }
    setPublishingJobId(null);
    setAutoPublishStep(null);
  };

  const handleSkipTrack = (jobId: string, audioUrl: string) => {
    setApprovalQueue(prev => {
      const updated = prev.map(j => {
        if (j.jobId !== jobId) return j;
        return { ...j, skippedUrls: [...j.skippedUrls, audioUrl] };
      });
      return updated.filter(j => {
        if (j.jobId !== jobId) return true;
        return j.uploadedUrls.length + j.skippedUrls.length + Object.keys(j.errorUrls).length < j.audioUrls.length;
      });
    });
  };

  const handleDisapproveJob = async (jobId: string) => {
    await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Disapproved by user" }).eq("id", jobId);
    setApprovalQueue(prev => prev.filter(j => j.jobId !== jobId));
  };

  const handleApprove = async (job: ApprovalJob, audioUrl: string) => {
    // Prevent re-approving an already-actioned track
    if (trackStatuses[audioUrl] || job.skippedUrls.includes(audioUrl)) return;
    if (!audioUrl) { alert("No audio URL found. Cannot auto-publish."); return; }

    // ── ADDITIONAL TRACKS: build a fully fresh concept so every upload gets a unique title ──
    // First approval uses the already-generated art/title/description.
    // Every subsequent approval generates brand-new lyrics (→ new title), new art, new metadata
    // but keeps the already-approved audio from Suno.
    if (job.approvedUrls.length > 0) {
      setTrackStatuses(prev => ({ ...prev, [audioUrl]: "processing" }));
      setApprovalQueue(prev => prev.map(j =>
        j.jobId !== job.jobId ? j : { ...j, approvedUrls: [...j.approvedUrls, audioUrl] }
      ));
      const persona = PERSONAS.find(p => p.name === job.personaName) ?? selectedPersona;
      const fresh = buildConcept("", persona);
      const { data: newSubJob } = await supabase.from("pipeline_jobs").insert({
        status: "pending",
        track_theme: `__subjob:${job.jobId}`,
        lyrics_prompt: fresh.lyricsPrompt,
        art_prompt: fresh.artPrompt,
        metadata_prompt: fresh.metadataPrompt,
        audio_url: JSON.stringify([audioUrl]),
        style_tags: fresh.tag,
        persona_name: persona.name,
        auto_approve: true,
      }).select("id").single();
      // Track the sub-job ID so the polling loop can detect when it reaches "approval"
      if (newSubJob?.id) setActiveJobIds(prev => [...prev, newSubJob.id]);
      return;
    }

    // ── FIRST TRACK: enqueue the upload so the UI stays unlocked ────────────
    setTrackStatuses(prev => ({ ...prev, [audioUrl]: "queued" }));
    setApprovalQueue(prev => prev.map(j =>
      j.jobId !== job.jobId ? j : { ...j, approvedUrls: [...j.approvedUrls, audioUrl] }
    ));
    setManualUploadQueue(prev => [...prev, { job, audioUrl }]);
  };

  // Performs the actual YouTube upload for a manually-approved track.
  // Called by the manualUploadQueue drain effect — publishingJobId lock is managed here.
  const executeUpload = async (job: ApprovalJob, audioUrl: string) => {
    setPublishingJobId(job.jobId);
    setTrackStatuses(prev => ({ ...prev, [audioUrl]: "uploading" }));
    try {
      const ytUrl = await uploadToYouTube(audioUrl, job.artUrl, job.title, job.description);
      setTrackStatuses(prev => ({ ...prev, [audioUrl]: "uploaded" }));
      setPublishedUrl(ytUrl);
      setCurrentStep("publish");

      // Register in track catalog (dedup check + stats source)
      const videoId = ytUrl.split("v=")[1];
      const tagArr = job.styleTags.split(",").map((t: string) => t.trim()).filter(Boolean);
      supabase.from("artist_track_names").upsert({
        persona_name: job.personaName,
        track_name: job.title,
        youtube_video_id: videoId,
        youtube_url: ytUrl,
        tags: tagArr,
      }, { onConflict: "persona_name,track_name" });
      assignTrackToRandomAlbum(job.personaName, job.title, ytUrl);

      setApprovalQueue(prev => {
        // approvedUrls already set at enqueue time; here we only mark as uploaded
        const updated = prev.map(j => {
          if (j.jobId !== job.jobId) return j;
          return { ...j, uploadedUrls: [...j.uploadedUrls, audioUrl] };
        });
        const parentJob = updated.find(j => j.jobId === job.jobId);
        const allDone = parentJob
          ? parentJob.uploadedUrls.length + parentJob.skippedUrls.length + Object.keys(parentJob.errorUrls).length >= parentJob.audioUrls.length
          : true;
        if (allDone) {
          supabase.from("pipeline_jobs").update({ status: "complete", step: "complete" }).eq("id", job.jobId);
          // Fire auto-next only when ALL tracks are handled so sub-job approvals don't race with Suno
          if (autoNextRef.current) {
            setTimeout(() => {
              setPublishedUrl(null);
              setCurrentStep("lyrics");
              setStyleTag(""); setLyrics(""); setArtFile(null); setArtPreview(null);
              setAudioFile(null); setVideoUrl(null); setTitle(""); setDescription("");
              runAutomationRef.current?.();
            }, 5000);
          }
        }
        return updated.filter(j => {
          if (j.jobId !== job.jobId) return true;
          return j.uploadedUrls.length + j.skippedUrls.length + Object.keys(j.errorUrls).length < j.audioUrls.length;
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTrackStatuses(prev => ({ ...prev, [audioUrl]: msg }));
      setApprovalQueue(prev => prev.map(j =>
        j.jobId !== job.jobId ? j : { ...j, errorUrls: { ...j.errorUrls, [audioUrl]: msg } }
      ));
      alert("Upload failed: " + msg);
    }
    setPublishingJobId(null);
    setAutoPublishStep(null);
  };

  const generateConcept = () => {
    const { persona, tag, lyricsPrompt: lp, artPrompt: ap, metadataPrompt: mp } = buildConcept(trackTheme.trim(), selectedPersona);
    setSelectedPersona(persona);
    setStyleTag(tag);
    setLyricsPrompt(lp);
    setArtPrompt(ap);
    setMetadataPrompt(mp);
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
      case "lyrics":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-black/60 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-green-700 font-mono">Prompt sent to ChatGPT <span className="text-green-900">— edit in Prompt Studio</span></p>
                <button onClick={() => copy(lyricsPrompt, "lyrics-prompt")} className="text-xs text-green-400 font-mono flex items-center gap-1 hover:text-green-300">
                  {copiedKey === "lyrics-prompt" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <textarea
                className="w-full bg-transparent text-sm text-green-300 font-mono resize-y min-h-[80px] focus:outline-none"
                value={lyricsPrompt}
                onChange={e => setLyricsPrompt(e.target.value)}
              />
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div>
              <label className="text-xs text-green-700 font-mono uppercase tracking-widest mb-1 block">Paste lyrics here after generating</label>
              <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                rows={10}
                placeholder="Paste ChatGPT lyrics output here..."
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-black/60 border border-green-500/20 text-green-300 placeholder:text-green-800 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-500/30 resize-none"
              />
            </div>
            {lyrics && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-green-400 font-mono font-medium hover:text-green-300">
                Next: Cover Art <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "art":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-black/60 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-green-700 font-mono">Prompt sent to ChatGPT (DALL-E) <span className="text-green-900">— edit in Prompt Studio</span></p>
                <button onClick={() => copy(artPrompt, "art-prompt")} className="text-xs text-green-400 font-mono flex items-center gap-1 hover:text-green-300">
                  {copiedKey === "art-prompt" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <textarea
                className="w-full bg-transparent text-sm text-green-300 font-mono resize-y min-h-[60px] focus:outline-none"
                value={artPrompt}
                onChange={e => setArtPrompt(e.target.value)}
              />
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div>
              <label className="text-xs text-green-700 font-mono uppercase tracking-widest mb-2 block">Upload generated artwork</label>
              <input ref={artRef} type="file" accept="image/*" onChange={handleArtUpload} className="hidden" />
              <button onClick={() => artRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
                Choose Image
              </button>
              {artPreview && (
                <img src={artPreview} alt="Cover art preview" className="mt-3 w-48 h-48 object-cover rounded-lg border border-green-500/20" />
              )}
            </div>
            {artFile && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-green-400 font-mono font-medium hover:text-green-300">
                Next: Audio <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-black/60 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-green-700 font-mono">Copy lyrics for Suno</p>
                <button onClick={() => copy(lyrics, "suno-lyrics")} className="text-xs text-green-400 font-mono flex items-center gap-1 hover:text-green-300">
                  {copiedKey === "suno-lyrics" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-green-700 font-mono mt-1">Style tags: <span className="text-green-400">{styleTag}</span></p>
            </div>
            <a href="https://suno.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
              Open Suno <ChevronRight className="w-4 h-4" />
            </a>
            <p className="text-sm text-green-700 font-mono">Generate your track in Suno, download the audio, then upload it here.</p>
            <div>
              <input ref={audioRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
              <button onClick={() => audioRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
                Upload Audio from Suno
              </button>
              {audioFile && <p className="mt-2 text-sm text-green-400 font-mono">✓ {audioFile.name}</p>}
            </div>
            {audioFile && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-green-400 font-mono font-medium hover:text-green-300">
                Next: Create Video <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div className={`p-3 rounded-lg border ${artFile ? "border-green-500/30 bg-green-500/5" : "border-green-500/15 bg-black/40"}`}>
                <p className="text-green-700 text-xs uppercase tracking-widest mb-1">Cover Art</p>
                <p className={artFile ? "text-green-400" : "text-green-800"}>{artFile ? `✓ ${artFile.name}` : "Not uploaded"}</p>
              </div>
              <div className={`p-3 rounded-lg border ${audioFile ? "border-green-500/30 bg-green-500/5" : "border-green-500/15 bg-black/40"}`}>
                <p className="text-green-700 text-xs uppercase tracking-widest mb-1">Audio</p>
                <p className={audioFile ? "text-green-400" : "text-green-800"}>{audioFile ? `✓ ${audioFile.name}` : "Not uploaded"}</p>
              </div>
            </div>
            <p className="text-sm text-green-700 font-mono">Effect: static image with chromatic aberration</p>
            <button
              onClick={createVideo}
              disabled={!audioFile || !artFile || videoProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-mono font-medium hover:bg-green-500/30 disabled:opacity-50"
            >
              {videoProcessing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</> : <><Video className="w-4 h-4" /> Create Video</>}
            </button>
            {videoProcessing && (
              <p className="text-sm text-green-700 font-mono">This may take 1–2 minutes depending on audio length...</p>
            )}
            {videoUrl && (
              <div className="space-y-3">
                <video src={videoUrl} controls className="w-full rounded-lg border border-green-500/20" style={{ maxHeight: 300 }} />
                <div className="flex gap-2">
                  <a href={videoUrl} download="track.mp4"
                    className="px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
                    Download MP4
                  </a>
                  <button onClick={advance} className="flex items-center gap-2 text-sm text-green-400 font-mono font-medium hover:text-green-300 mt-2">
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
            <div className="p-3 rounded-lg bg-black/60 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-green-700 font-mono">Prompt sent to ChatGPT <span className="text-green-900">— edit in Prompt Studio</span></p>
              </div>
              <textarea
                className="w-full bg-transparent text-sm text-green-300 font-mono resize-y min-h-[60px] focus:outline-none"
                value={metadataPrompt}
                onChange={e => setMetadataPrompt(e.target.value)}
              />
            </div>
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
              Open ChatGPT <ChevronRight className="w-4 h-4" />
            </a>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-green-700 font-mono uppercase tracking-widest mb-1 block">Video Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Paste title from ChatGPT..."
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-black/60 border border-green-500/20 text-green-300 placeholder:text-green-800 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-500/30"
                />
                <p className="text-xs text-green-800 font-mono mt-1">{title.length}/60 chars</p>
              </div>
              <div>
                <label className="text-xs text-green-700 font-mono uppercase tracking-widest mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Paste description from ChatGPT..."
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-black/60 border border-green-500/20 text-green-300 placeholder:text-green-800 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-500/30 resize-none"
                />
              </div>
            </div>
            {title && description && (
              <button onClick={advance} className="flex items-center gap-2 text-sm text-green-400 font-mono font-medium hover:text-green-300">
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
          setCurrentStep("lyrics");
          setStyleTag(""); setTrackTheme(""); setLyrics("");
          setArtFile(null); setArtPreview(null); setAudioFile(null);
          setVideoUrl(null); setTitle(""); setDescription("");
          setPublishedUrl(null);
        };

        return (
          <div className="space-y-4">
            <div className="space-y-2 text-sm font-mono">
              {[
                { label: "Style", value: styleTag },
                { label: "Title", value: title },
                { label: "Video", value: videoUrl ? "✓ Ready" : "Not created" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 p-3 rounded-lg bg-black/60 border border-green-500/20">
                  <span className="text-green-700 w-16">{label}</span>
                  <span className={`text-sm ${value?.startsWith("✓") ? "text-green-400" : "text-green-600"}`}>{value || "—"}</span>
                </div>
              ))}
            </div>

            {publishedUrl ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <p className="text-sm text-green-400 font-mono font-medium">✓ Published to YouTube!</p>
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 text-sm text-green-500 font-mono hover:text-green-300 block">{publishedUrl}</a>
                </div>
                <button onClick={resetPipeline}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-mono font-medium hover:bg-green-500/30">
                  <RefreshCw className="w-4 h-4" /> Start Next Track
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <a href="/api/auth/youtube"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400">
                  Connect YouTube Account <ChevronRight className="w-4 h-4" />
                </a>
                <button
                  onClick={publishTrack}
                  disabled={!videoUrl || !title || publishing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-mono font-medium hover:bg-red-500/30 disabled:opacity-50"
                >
                  {publishing
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                    : <><Upload className="w-4 h-4" /> Publish to YouTube</>}
                </button>
                {publishing && <p className="text-sm text-green-700 font-mono">Uploading — this may take a minute...</p>}
                <button onClick={resetPipeline}
                  className="flex items-center gap-2 text-sm text-green-700 font-mono hover:text-green-400">
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
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-5xl">
        <div className="mb-2">
          <Link href="/music" className="flex items-center gap-1 text-xs text-green-700 font-mono hover:text-green-400 transition-colors">
            <ChevronLeft className="w-3 h-3" /> back to music
          </Link>
        </div>
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> music_pipeline.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">YouTube</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">@djthirstyboy · Drum &amp; Bass · 7 personas</p>
        </div>

        {/* Channel stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-red-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-8 h-8 flex-shrink-0">
                <span className="ping-slow absolute inset-0 rounded-full bg-red-500/20" />
                <div className="relative w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Youtube className="w-4 h-4 text-red-400" />
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-red-500 uppercase tracking-wider">Channel</span>
            </div>
            <p className="text-base font-black font-mono text-green-300">@djthirstyboy</p>
            <p className="text-xs text-green-700 font-mono mt-1">YouTube · Active</p>
          </div>

          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Personas</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">7</p>
            <p className="text-xs text-green-700 font-mono mt-1">AI artists loaded</p>
          </div>

          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Queue</span>
            </div>
            <p className={`text-3xl font-black font-mono ${approvalQueue.length > 0 ? "text-yellow-400 glow-text" : "text-green-300"}`}>
              {approvalQueue.length}
            </p>
            <p className="text-xs text-green-700 font-mono mt-1">
              {approvalQueue.length === 0 ? "nothing pending" : `awaiting approval`}
            </p>
          </div>

          <div className={`holo-card rounded-xl border p-4 transition-all ${automating ? "border-green-400/40 bg-green-400/5 glow-border" : "border-green-500/20 bg-black/40"}`}>
            <div className="flex items-center gap-2 mb-3">
              {automating ? (
                <>
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <span className="ping-slow absolute inset-0 rounded-full bg-green-400/20" />
                    <div className="relative w-8 h-8 rounded-full bg-green-500/10 border border-green-400/40 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-green-400 animate-spin" />
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-green-400 uppercase tracking-wider">Auto-Pilot</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-black/60 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4 text-green-700" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Auto-Pilot</span>
                </>
              )}
            </div>
            <p className={`text-xl font-black font-mono ${automating ? "text-green-300 glow-text" : "text-green-800"}`}>
              {automating ? "RUNNING" : "STANDBY"}
            </p>
            <p className="text-xs text-green-700 font-mono mt-1 truncate">
              {automating ? (automationStep ?? "processing…") : "ready to run"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 md:mb-6 bg-black/40 border border-green-500/20 rounded-lg p-1 overflow-x-auto">
          {[
            { key: "pipeline", label: "Track Pipeline", icon: Music },
            { key: "calendar", label: "Content Calendar", icon: Calendar },
            { key: "analytics", label: "Analytics", icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-mono font-medium transition-colors ${
                activeTab === key
                  ? "bg-green-500/10 text-green-300 border border-green-500/30 shadow-[0_0_8px_rgba(0,255,65,0.1)]"
                  : "text-green-700 hover:text-green-400"
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* SCHEDULER + AUTO-NEXT */}
        {activeTab === "pipeline" && (
          <div className="holo-card mb-6 rounded-xl border border-green-500/20 bg-black/60">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-green-500/20 bg-green-500/5">
              <Calendar className="w-4 h-4 text-green-600" />
              <span className="text-base font-mono font-black uppercase tracking-widest gradient-text">Nightly Batch Scheduler</span>
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => {
                    const next = !autoNext;
                    setAutoNext(next);
                    try { localStorage.setItem("autoNext", JSON.stringify(next)); } catch {}
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold border transition-all ${
                    autoNext
                      ? "border-green-400/60 bg-green-500/15 text-green-300"
                      : "border-green-500/20 bg-black/20 text-green-700 hover:border-green-500/40"
                  }`}
                >
                  {autoNext ? "✓ Auto-next" : "Auto-next: off"}
                </button>
                <button
                  onClick={() => {
                    const next = !scheduleEnabled;
                    setScheduleEnabled(next);
                    try { localStorage.setItem("scheduleEnabled", JSON.stringify(next)); } catch {}
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold border transition-all ${
                    scheduleEnabled
                      ? "border-green-400/60 bg-green-500/15 text-green-300 shadow-[0_0_8px_rgba(0,255,65,0.2)]"
                      : "border-green-500/20 bg-black/20 text-green-700 hover:border-green-500/40"
                  }`}
                >
                  {scheduleEnabled ? "● Scheduler ON" : "○ Scheduler OFF"}
                </button>
              </div>
            </div>
            <div className="p-5 flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-2">Nightly run time</p>
                <input
                  type="time"
                  value={newScheduleTime}
                  onChange={e => setNewScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-black/60 border border-green-500/20 text-green-300 focus:outline-none focus:border-green-400/50"
                />
              </div>
              <button
                onClick={() => {
                  if (!newScheduleTime) return;
                  setSchedule([newScheduleTime]);
                  try { localStorage.setItem("schedule", JSON.stringify([newScheduleTime])); } catch {}
                }}
                className="px-4 py-2 rounded-lg bg-black/60 border border-green-500/20 text-green-600 text-sm font-mono hover:border-green-400/40 hover:text-green-400 transition-all"
              >
                Set Time
              </button>
              <button
                onClick={runNightlyBatch}
                className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-400/30 text-green-400 text-sm font-mono hover:bg-green-500/20 transition-all"
              >
                Run Now
              </button>
              {schedule.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/15 text-xs text-green-600 font-mono">
                  <Clock className="w-3 h-3" />
                  {schedule[0]} nightly · {PERSONAS.length} artists
                  {scheduleEnabled && <span className="text-green-400 glow-text ml-1">active</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP CONTROLS — always visible in pipeline tab */}
        {activeTab === "pipeline" && (() => {
          const PIPELINE_STEPS = [
            { key: "lyrics",   label: "Lyrics" },
            { key: "art",      label: "Art" },
            { key: "audio",    label: "Suno" },
            { key: "metadata", label: "Metadata" },
            { key: "approval", label: "Approval" },
          ] as const;
          const runningJobId = activeJobIds.find(id => activeJobs[id]?.status === "running") ?? activeJobIds[0] ?? null;
          const runningStep = runningJobId ? activeJobs[runningJobId]?.step : null;
          const runningIdx = PIPELINE_STEPS.findIndex(s => s.key === runningStep);

          const handleStepClick = async (stepKey: typeof PIPELINE_STEPS[number]["key"]) => {
            if (runningJobId) {
              jumpToStep(runningJobId, stepKey);
            } else {
              runDebugStep(stepKey === "audio" ? "suno" : stepKey === "approval" ? "metadata" : stepKey as any);
            }
          };

          return (
            <div className="mb-4 p-3 rounded-xl border border-green-500/20 bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono font-semibold uppercase tracking-widest ${runningJobId ? "text-green-400 glow-text" : "text-green-700"}`}><span className="text-red-500">&gt;</span> Pipeline Steps</span>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {runningStep ? <span className="capitalize">{runningStep}…</span> : `${pendingCount} queued`}
                    </span>
                    <button onClick={cancelAllPending} className="text-xs text-red-400 border border-red-400/30 px-2 py-0.5 rounded font-mono hover:bg-red-400/10">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {PIPELINE_STEPS.map((s, i) => {
                  const isRunning = s.key === runningStep;
                  const isDone = runningIdx >= 0 && i < runningIdx;
                  const isJumpable = runningJobId && i > runningIdx;
                  const isIdle = !runningJobId;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleStepClick(s.key)}
                      disabled={!!debugRunning || (!isJumpable && !isIdle) || isRunning}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-colors
                        ${isRunning  ? "border-green-400/50 bg-green-400/10 text-green-300 cursor-default shadow-[0_0_8px_rgba(0,255,65,0.2)]" :
                          isDone     ? "border-green-500/30 bg-green-500/10 text-green-400 cursor-default opacity-60" :
                          isJumpable ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-300 hover:bg-yellow-500/10 cursor-pointer" :
                          isIdle     ? "border-green-500/20 bg-black/30 text-green-600 hover:border-green-400/40 hover:text-green-400 cursor-pointer" :
                                       "border-green-500/10 bg-black/20 text-green-800 opacity-40 cursor-not-allowed"}`}
                    >
                      {isRunning && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {isDone    && <span className="text-green-400">✓</span>}
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {!runningJobId && <p className="text-xs text-green-800 font-mono mt-2">Click any step to run it in isolation for testing.</p>}
              {runningJobId  && <p className="text-xs text-green-800 font-mono mt-2">Click a future step to skip ahead (carries over completed data).</p>}
            </div>
          );
        })()}

        {/* APPROVAL QUEUE — all jobs visible, one upload at a time */}
        {activeTab === "pipeline" && approvalQueue.length > 0 && (
          <div className="mb-5 space-y-4">
            <p className="text-sm font-mono font-semibold text-green-400 glow-text">
              <span className="text-red-500">&gt;</span> {approvalQueue.length} job{approvalQueue.length > 1 ? "s" : ""} awaiting approval
              {publishingJobId && <span className="text-green-700 font-normal"> — uploading…</span>}
            </p>
            {approvalQueue.map((job, jobIdx) => {
              const isBlocked = false;
              return (
                <div key={job.jobId} className="p-5 rounded-xl border border-green-400/30 bg-green-400/5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-green-700 font-mono mb-0.5">Job {jobIdx + 1} of {approvalQueue.length}</p>
                      <p className="text-sm font-semibold font-mono text-green-300 glow-text">{job.title || "Untitled"}</p>
                      <p className="text-xs text-green-700 font-mono mt-0.5">
                        {job.isInstrumental ? "Instrumental" : "Vocal"} · {job.audioUrls.length} track{job.audioUrls.length !== 1 ? "s" : ""} · approve or skip each track individually
                      </p>
                    </div>
                    <button onClick={() => handleDisapproveJob(job.jobId)}
                      className="text-xs text-red-400 hover:text-red-300 font-mono flex-shrink-0">Dismiss</button>
                  </div>

                  {/* Art + details */}
                  <div className="flex gap-4">
                    {job.artUrl
                      ? <img src={job.artUrl} alt="Cover art" className="w-28 h-28 object-cover rounded-lg border border-green-500/20 flex-shrink-0" />
                      : <div className="w-28 h-28 rounded-lg border border-green-500/20 bg-black/40 flex-shrink-0 flex items-center justify-center text-xs text-green-700 font-mono">No art</div>}
                    <div className="flex-1 space-y-2 min-w-0">
                      {job.styleTags && <p className="text-xs text-green-400 font-mono font-medium">{job.styleTags}</p>}
                      {job.description && <p className="text-xs text-green-700 font-mono line-clamp-4 whitespace-pre-wrap">{job.description}</p>}
                      {!job.isInstrumental && job.lyrics && (
                        <details className="text-xs">
                          <summary className="text-green-700 font-mono cursor-pointer hover:text-green-400">Show lyrics</summary>
                          <pre className="mt-1 text-green-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto p-2 rounded bg-black/40 border border-green-500/20">{job.lyrics}</pre>
                        </details>
                      )}
                    </div>
                  </div>

                  {/* Audio tracks */}
                  {job.audioUrls.length === 0 ? (
                    <p className="text-xs text-green-700 font-mono italic">No audio URLs captured.</p>
                  ) : (
                    <div className="space-y-2">
                      {job.audioUrls.map((url, i) => {
                        const status = trackStatuses[url];
                        const isSkipped = job.skippedUrls.includes(url);
                        const isUploading = publishingJobId === job.jobId && status === "uploading";
                        return (
                          <div key={url} className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-green-500/20">
                            <span className="text-xs text-green-700 w-14 flex-shrink-0 font-mono">Track {i + 1}</span>
                            <audio controls src={url} className="h-8 flex-1" style={{ maxWidth: 200 }} />
                            {status === "processing" ? (
                              <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-mono font-semibold flex items-center gap-1 flex-shrink-0">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Generating…
                              </span>
                            ) : status === "queued" ? (
                              <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-semibold flex-shrink-0">
                                Queued
                              </span>
                            ) : status === "uploading" ? (
                              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono font-semibold flex items-center gap-1 flex-shrink-0">
                                <RefreshCw className="w-3 h-3 animate-spin" /> {autoPublishStep ?? "Uploading…"}
                              </span>
                            ) : status === "uploaded" ? (
                              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono font-semibold flex-shrink-0 glow-text">✓ Uploaded</span>
                            ) : isSkipped ? (
                              <span className="px-3 py-1.5 rounded-lg text-green-800 font-mono text-xs font-semibold flex-shrink-0">Skipped</span>
                            ) : typeof status === "string" && status.length > 0 ? (
                              // Error state
                              <span className="px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-mono font-semibold flex-shrink-0 max-w-[160px] truncate" title={status}>
                                ✕ {status.slice(0, 40)}
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApprove(job, url)}
                                  disabled={isBlocked || isUploading}
                                  className="px-4 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-mono font-semibold hover:bg-green-500/30 hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleSkipTrack(job.jobId, url)}
                                  disabled={isBlocked || isUploading}
                                  className="px-3 py-1.5 rounded-lg bg-red-600/10 text-red-400 border border-red-500/30 text-sm font-mono font-semibold hover:bg-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                  Skip
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* LIVE JOB PREVIEW */}
        {activeTab === "pipeline" && liveJob && (() => {
          const REVIEW_NEXT: Record<string, string> = {
            lyrics_review: "art",
            art_review: "audio",
            audio_review: "metadata",
            metadata_review: "approval",
          };
          const step = liveJob.step ?? "";
          const reviewStep = REVIEW_NEXT[step] ? step : null;
          const isReview = !!reviewStep;
          const isError = liveJob.error_message && !step.endsWith("_review");

          const approveStep = async () => {
            if (!reviewStep) return;
            await supabase.from("pipeline_jobs").update({ step: REVIEW_NEXT[reviewStep] }).eq("id", liveJob.id);
          };
          const rejectStep = async () => {
            await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Rejected at " + liveJob.step }).eq("id", liveJob.id);
            setActiveJobIds(prev => prev.filter(id => id !== liveJob.id));
            setLiveJob(null);
          };

          let audioUrls: string[] = [];
          try { audioUrls = JSON.parse(liveJob.audio_url ?? "[]"); } catch {}

          return (
            <div className={`mb-5 p-4 rounded-xl border space-y-4 ${
              isError  ? "border-red-500/40 bg-red-500/5" :
              isReview ? "border-yellow-500/30 bg-yellow-500/5" :
                         "border-green-500/20 bg-black/40"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono font-semibold text-green-300">
                    {isError ? "Step Failed" : isReview ? "Approve to Continue" : "Live Preview"}
                    <span className={`ml-2 text-xs font-normal capitalize ${isError ? "text-red-400" : isReview ? "text-yellow-400" : "text-green-600"}`}>
                      — {step.replace("_review", " review") || "starting…"}
                    </span>
                  </p>
                  {isError && <p className="text-xs text-red-400 font-mono mt-0.5">{liveJob.error_message}</p>}
                </div>
                {!isReview && !isError && <button onClick={() => setLiveJob(null)} className="text-xs text-green-700 hover:text-green-400 font-mono">Dismiss</button>}
              </div>

              {/* Style tags row */}
              {liveJob.style_tags && (
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-widest">Style / Genre</p>
                  <p className="text-xs text-green-400 font-mono font-medium">{liveJob.style_tags}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lyrics */}
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-widest">Lyrics</p>
                  {liveJob.lyrics
                    ? <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto p-2 rounded-lg bg-black/60 border border-green-500/20">{liveJob.lyrics}</pre>
                    : <p className="text-xs text-green-800 font-mono italic">Not yet generated</p>}
                </div>

                {/* Cover Art */}
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-widest">Cover Art</p>
                  {liveJob.art_url
                    ? <img src={liveJob.art_url} alt="Cover art" className="w-40 h-40 object-cover rounded-lg border border-green-500/20" />
                    : <div className="w-40 h-40 rounded-lg border border-green-500/20 bg-black/60 flex items-center justify-center text-xs text-green-800 font-mono">Not yet generated</div>}
                </div>
              </div>

              {/* Audio tracks */}
              <div className="space-y-1">
                <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-widest">
                  Audio Tracks {audioUrls.length > 0 ? `(${audioUrls.length})` : ""}
                </p>
                {audioUrls.length > 0 ? (
                  <div className="space-y-2">
                    {audioUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-green-700 font-mono w-16 flex-shrink-0">Track {i + 1}</span>
                        <audio controls src={url} className="h-8 w-full" style={{ maxWidth: 320 }} />
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-green-800 font-mono italic">Not yet generated</p>}
              </div>

              {/* Title & Description */}
              {(liveJob.title || liveJob.description) && (
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-widest">Metadata</p>
                  {liveJob.title && <p className="text-sm font-mono font-medium text-green-300">{liveJob.title}</p>}
                  {liveJob.description && <p className="text-xs text-green-700 font-mono whitespace-pre-wrap line-clamp-3">{liveJob.description}</p>}
                </div>
              )}

              {/* Approve / Reject — shown when paused at a review step */}
              {isReview && (
                <div className="flex gap-3 pt-1 border-t border-green-500/20">
                  <button onClick={approveStep} className="flex-1 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-mono font-semibold hover:bg-green-500/30">
                    Approve — continue to {REVIEW_NEXT[reviewStep!]}
                  </button>
                  <button onClick={rejectStep} className="px-4 py-2 rounded-lg bg-red-600/10 text-red-400 border border-red-500/30 text-sm font-mono font-semibold hover:bg-red-600/20">
                    Reject
                  </button>
                </div>
              )}

              {/* Retry — shown when a step errored */}
              {isError && (
                <div className="flex gap-3 pt-1 border-t border-red-500/20">
                  <button onClick={() => retryFromStep(liveJob)} className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-sm font-mono font-semibold hover:bg-yellow-500/30">
                    Retry {step.replace("_review", "") || "step"}
                  </button>
                  <button onClick={() => setLiveJob(null)} className="px-4 py-2 rounded-lg bg-black/40 border border-green-500/20 text-green-600 text-sm font-mono font-semibold hover:border-green-500/40">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* LAUNCH CONTROL */}
        {activeTab === "pipeline" && (
          <div className="holo-card mb-6 rounded-xl border border-green-400/30 bg-black/60 glow-border">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-green-500/20 bg-green-500/5">
              <div className="relative w-8 h-8 flex-shrink-0">
                <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
                <div className="relative w-8 h-8 rounded-full bg-green-500/10 border border-green-400/40 flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <span className="text-base font-mono font-black uppercase tracking-widest gradient-text">Launch Control</span>
              <div className="ml-auto flex items-center gap-2">
                {automating ? (
                  <><span className="w-2 h-2 rounded-full bg-green-400 ping-slow" /><span className="text-xs text-green-400 font-mono glow-text">RUNNING</span></>
                ) : (
                  <span className="text-xs text-green-800 font-mono">STANDBY</span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Agent select grid */}
              <div>
                <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3"><span className="text-red-500">›</span> Select Agent</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PERSONAS.map(p => {
                    const isSelected = selectedPersona.name === p.name;
                    return (
                      <button
                        key={p.name}
                        onClick={() => { setSelectedPersona(p); setStyleTag(""); setLyricsPrompt(""); setArtPrompt(""); setMetadataPrompt(""); }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-green-400/60 bg-green-400/10 shadow-[0_0_20px_rgba(0,255,65,0.25),inset_0_0_20px_rgba(0,255,65,0.05)]"
                            : "border-green-500/20 bg-black/40 hover:border-green-400/30 hover:bg-green-500/5"
                        }`}
                      >
                        <p className={`text-sm font-mono font-bold mb-1 ${isSelected ? "text-green-300 glow-text" : "text-green-700"}`}>{p.name}</p>
                        <p className="text-xs text-green-800 font-mono truncate">{p.genres[0]}</p>
                        <p className="text-xs text-green-900 font-mono mt-1">{p.instrumental ? "instrumental" : "vocals"}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme + style row */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-2"><span className="text-red-500">›</span> Theme <span className="text-green-900">(optional)</span></p>
                  <input
                    value={trackTheme}
                    onChange={e => setTrackTheme(e.target.value)}
                    placeholder="e.g. lost in the city, space travel, midnight rain..."
                    className="w-full px-4 py-2.5 text-sm font-mono rounded-lg bg-black/60 border border-green-500/20 text-green-300 placeholder:text-green-900 focus:outline-none focus:border-green-400/50 focus:shadow-[0_0_12px_rgba(0,255,65,0.15)]"
                  />
                </div>
                <button
                  onClick={generateConcept}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black/60 border border-green-500/20 text-green-600 text-sm font-mono font-medium hover:border-green-400/40 hover:text-green-400 transition-all flex-shrink-0"
                >
                  <RefreshCw className="w-4 h-4" /> Roll Style
                </button>
              </div>

              {/* Style tag display */}
              {styleTag && (
                <div className="px-4 py-2 rounded-lg bg-green-400/5 border border-green-400/20 flex items-center gap-2">
                  <span className="text-xs text-green-700 font-mono flex-shrink-0">STYLE:</span>
                  <span className="text-xs text-green-400 font-mono font-semibold glow-text truncate">{styleTag}</span>
                </div>
              )}

              {/* Auto-approve row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-green-700 font-mono uppercase tracking-widest flex-shrink-0"><span className="text-red-500">›</span> Auto</span>
                {(["lyrics", "art", "audio", "metadata"] as const).map(step => (
                  <button
                    key={step}
                    onClick={() => updateAutoApproveSteps(prev => ({ ...prev, [step]: !prev[step] }))}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-medium border transition-all capitalize ${
                      autoApproveSteps[step]
                        ? "bg-green-600/20 border-green-500/40 text-green-400 shadow-[0_0_6px_rgba(0,255,65,0.2)]"
                        : "bg-black/40 border-green-500/15 text-green-800 hover:border-green-500/30 hover:text-green-700"
                    }`}
                  >
                    {autoApproveSteps[step] ? "✓ " : ""}{step}
                  </button>
                ))}
              </div>

              {/* BIG LAUNCH BUTTON */}
              {!automating ? (
                <button
                  onClick={runAutomation}
                  disabled={submitting}
                  className="w-full py-5 rounded-xl border-2 border-green-400/50 bg-green-500/10 text-green-300 font-mono font-black text-xl uppercase tracking-widest
                    transition-all disabled:opacity-40
                    shadow-[0_0_30px_rgba(0,255,65,0.15),inset_0_0_30px_rgba(0,255,65,0.05)]
                    hover:border-green-400/80 hover:bg-green-500/20 hover:text-green-200
                    hover:shadow-[0_0_50px_rgba(0,255,65,0.35),inset_0_0_40px_rgba(0,255,65,0.1)]
                    flex items-center justify-center gap-3"
                >
                  {submitting
                    ? <><RefreshCw className="w-6 h-6 animate-spin" /> Initializing...</>
                    : <><Wand2 className="w-6 h-6" /> Run Automatically</>}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="w-full py-4 rounded-xl border-2 border-green-400/40 bg-green-500/10 flex items-center justify-center gap-3">
                    <RefreshCw className="w-5 h-5 text-green-400 animate-spin" />
                    <span className="text-green-300 font-mono font-bold uppercase tracking-widest glow-text">
                      {automationStep === "queued" ? "Waiting for extension..." :
                       automationStep === "lyrics" ? "Generating lyrics..." :
                       automationStep === "art" ? "Generating cover art..." :
                       automationStep === "audio" ? "Generating audio in Suno..." :
                       automationStep === "metadata" ? "Writing metadata..." :
                       automationStep ? `Running: ${automationStep}...` : "Running..."}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-green-400 ping-slow" />
                  </div>
                  <button
                    onClick={cancelAllPending}
                    className="w-full py-2.5 rounded-xl border border-red-500/40 bg-red-500/5 text-red-400 font-mono font-bold text-sm uppercase tracking-widest
                      hover:bg-red-500/15 hover:border-red-500/60 transition-all
                      shadow-[0_0_12px_rgba(255,0,0,0.08)]"
                  >
                    ■ Stop Pipeline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Step list */}
            <div className="md:col-span-1">
              <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20">
                  <span className="text-xs font-mono font-bold text-green-700 uppercase tracking-widest"><span className="text-red-500">&gt;</span> Steps</span>
                  <span className="ml-auto text-xs font-mono text-green-700">{stepIndex + 1}/{STEPS.length}</span>
                </div>
                <div className="p-2">
                  {STEPS.map((step, i) => {
                    const isActive = step.key === currentStep;
                    const isDone = i < stepIndex;
                    return (
                      <button
                        key={step.key}
                        onClick={() => setCurrentStep(step.key as StepKey)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all mb-0.5 ${
                          isActive
                            ? "bg-green-500/10 border border-green-500/30 shadow-[0_0_10px_rgba(0,255,65,0.1)]"
                            : "hover:bg-green-500/5 border border-transparent"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 transition-all ${
                          isDone
                            ? "bg-green-500/20 border border-green-500/40 text-green-400 shadow-[0_0_6px_rgba(0,255,65,0.2)]"
                            : isActive
                            ? "bg-green-500/15 border border-green-400/50 text-green-300 shadow-[0_0_8px_rgba(0,255,65,0.25)]"
                            : "bg-black/60 border border-green-500/15 text-green-800"
                        }`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-mono font-medium ${isActive ? "text-green-300" : isDone ? "text-green-500" : "text-green-800"}`}>{step.label}</p>
                          <p className={`text-xs font-mono truncate ${isActive ? "text-green-700" : "text-green-900"}`}>{step.desc}</p>
                        </div>
                        {isActive && <span className="ml-auto text-red-500 text-xs flex-shrink-0">›</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step content */}
            <div className="md:col-span-2">
              <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 shadow-[0_0_20px_rgba(0,255,65,0.05)]">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
                  <div className="relative flex-shrink-0">
                    <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
                    <span className="relative w-7 h-7 rounded-full bg-green-500/15 border border-green-400/50 flex items-center justify-center text-xs font-mono font-bold text-green-300 shadow-[0_0_8px_rgba(0,255,65,0.25)]">
                      {stepIndex + 1}
                    </span>
                  </div>
                  {(() => { const Icon = STEPS[stepIndex].icon; return <Icon className="w-4 h-4 text-green-400" />; })()}
                  <span className="text-sm font-mono font-bold uppercase tracking-wider glow-text text-green-300">{STEPS[stepIndex].label}</span>
                  <span className="ml-auto text-xs text-green-800 font-mono hidden md:block">{STEPS[stepIndex].desc}</span>
                </div>
                <div className="p-5">{renderStep()}</div>
              </div>
            </div>
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
            <div className="p-12 text-center">
              <Calendar className="w-8 h-8 text-green-700 mx-auto mb-3" />
              <p className="font-mono font-semibold text-green-400">Content Calendar</p>
              <p className="text-sm text-green-700 font-mono mt-1">Track history will appear here as you publish videos. Target: 1 video/day.</p>
              <span className="mt-4 inline-block text-xs text-green-800 font-mono border border-green-500/20 px-3 py-1 rounded-full">[ COMING SOON ]</span>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
            <div className="p-12 text-center">
              <BarChart2 className="w-8 h-8 text-green-700 mx-auto mb-3" />
              <p className="font-mono font-semibold text-green-400">Channel Analytics</p>
              <p className="text-sm text-green-700 font-mono mt-1">Connect YouTube OAuth to see live stats for @djthirstyboy.</p>
              <span className="mt-4 inline-block text-xs text-green-800 font-mono border border-green-500/20 px-3 py-1 rounded-full">[ COMING SOON ]</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
