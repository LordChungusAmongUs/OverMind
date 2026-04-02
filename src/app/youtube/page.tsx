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

// ── STYLE DATA ───────────────────────────────────────────────
const DNB_SUBGENRES = [
  "darkstep", "dubstep", "techstep", "jump up",
  "liquid", "jungle", "hardstep", "drum n bass",
];

const MOODS = [
  "simple", "rhythmic", "melodic", "cinematic", "epic", "dark",
  "psychedelic", "funky", "tribal", "industrial", "ska", "jazz",
  "ragga", "90s", "2000s", "southern rap", "hip hop", "metal",
  "fantasy", "pop", "deep", "emotional", "romantic", "paranoid",
  "suburban", "caribbean", "sci-fi", "mystery",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateStyleTag(): string {
  const subgenre = pickRandom(DNB_SUBGENRES, 1)[0];
  const moodCount = Math.floor(Math.random() * 3) + 2; // 2–4
  const moods = pickRandom(MOODS, moodCount);
  return [subgenre, ...moods].join(", ");
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

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "calendar" | "analytics">("pipeline");
  const [currentStep, setCurrentStep] = useState<StepKey>("concept");
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [approvalJobId, setApprovalJobId] = useState<string | null>(null);
  const [approvalAudioUrl, setApprovalAudioUrl] = useState<string | null>(null);
  const [approvalArtUrl, setApprovalArtUrl] = useState<string | null>(null);
  const [autoPublishing, setAutoPublishing] = useState(false);
  const [autoPublishStep, setAutoPublishStep] = useState<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const artRef = useRef<HTMLInputElement>(null);

  // ── POLL JOB STATUS ─────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("pipeline_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (!data) return;
      setAutomationStep(data.step);
      if (data.step === "approval") {
        clearInterval(interval);
        setAutomating(false);
        setJobId(null);
        if (data.lyrics) setLyrics(data.lyrics);
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        setApprovalJobId(data.id);
        setApprovalAudioUrl(data.audio_url ?? null);
        setApprovalArtUrl(data.art_url ?? null);
        setPendingApproval(true);
      } else if (data.status === "error") {
        clearInterval(interval);
        setAutomating(false);
        setJobId(null);
        alert("Automation error: " + data.error_message);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  // ── HELPERS ──────────────────────────────────────────────────
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runAutomation = async () => {
    if (!styleTag) { alert("Generate a style first."); return; }
    setAutomating(true);
    setAutomationStep("queued");
    const { data, error } = await supabase.from("pipeline_jobs").insert({
      status: "pending",
      style_tags: styleTag,
      track_theme: trackTheme,
      lyrics_prompt: lyricsPrompt,
      art_prompt: artPrompt,
      metadata_prompt: generateMetadataPrompt(),
    }).select().single();
    if (error || !data) {
      alert("Failed to create job: " + (error?.message ?? "unknown"));
      setAutomating(false);
      return;
    }
    setJobId(data.id);
  };

  const handleDisapprove = async () => {
    if (approvalJobId) {
      await supabase.from("pipeline_jobs").update({ status: "error", error_message: "Disapproved by user" }).eq("id", approvalJobId);
    }
    setPendingApproval(false);
    setApprovalJobId(null);
    setApprovalAudioUrl(null);
    setApprovalArtUrl(null);
    setAutomationStep(null);
  };

  const handleApprove = async () => {
    if (!approvalAudioUrl) { alert("No audio URL found. Cannot auto-publish."); return; }
    setAutoPublishing(true);

    try {
      // Fetch audio
      setAutoPublishStep("Fetching audio...");
      const audioRes = await fetch(approvalAudioUrl);
      const audioBlob = await audioRes.blob();
      const audioFileObj = new File([audioBlob], "track.mp3", { type: "audio/mpeg" });
      setAudioFile(audioFileObj);

      // Fetch art if available
      let artFileObj = artFile;
      if (!artFileObj && approvalArtUrl) {
        try {
          const artRes = await fetch(approvalArtUrl);
          const artBlob = await artRes.blob();
          artFileObj = new File([artBlob], "art.jpg", { type: "image/jpeg" });
          setArtFile(artFileObj);
          setArtPreview(URL.createObjectURL(artFileObj));
        } catch { /* art URL may be inaccessible */ }
      }
      if (!artFileObj) {
        alert("No cover art available. Upload art manually on the Art step, then approve again.");
        setAutoPublishing(false);
        return;
      }

      // Create video with FFmpeg
      setAutoPublishStep("Creating video...");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      await ffmpeg.writeFile("art.jpg", await fetchFile(artFileObj));
      await ffmpeg.writeFile("audio.mp3", await fetchFile(audioFileObj));
      await ffmpeg.exec([
        "-loop", "1", "-i", "art.jpg", "-i", "audio.mp3",
        "-filter_complex",
        "[0:v]split=3[rv][gv][bv];" +
        "[rv]lutrgb=r=val:g=0:b=0,pad=iw+6:ih:3:0[r];" +
        "[gv]lutrgb=r=0:g=val:b=0,pad=iw+6:ih:3:0[g];" +
        "[bv]lutrgb=r=0:g=0:b=val,pad=iw+6:ih:0:0[b];" +
        "[r][g]blend=all_mode=screen[rg];" +
        "[rg][b]blend=all_mode=screen,crop=iw-6:ih:3:0[out]",
        "-map", "[out]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-pix_fmt", "yuv420p", "output.mp4",
      ]);
      const vidData = await ffmpeg.readFile("output.mp4");
      const vidBlob = new Blob([vidData as unknown as BlobPart], { type: "video/mp4" });
      const vidUrl = URL.createObjectURL(vidBlob);
      setVideoUrl(vidUrl);

      // Upload to YouTube
      setAutoPublishStep("Uploading to YouTube...");
      const form = new FormData();
      form.append("video", vidBlob, "track.mp4");
      form.append("title", title || "New Track");
      form.append("description", description || "");
      const res = await fetch("/api/youtube/upload", { method: "POST", body: form });
      const uploadData = await res.json();
      if (uploadData.url) {
        setPublishedUrl(uploadData.url);
        await supabase.from("pipeline_jobs").update({ status: "complete", step: "complete" }).eq("id", approvalJobId);
        setPendingApproval(false);
        setCurrentStep("publish");
      } else {
        throw new Error(uploadData.error || "Upload failed");
      }
    } catch (err: unknown) {
      alert("Auto-publish failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setAutoPublishing(false);
    setAutoPublishStep(null);
  };

  const generateConcept = () => {
    const tag = generateStyleTag();
    setStyleTag(tag);
    const theme = trackTheme.trim();
    setLyricsPrompt(
      `Write lyrics for a ${tag} track${theme ? ` about "${theme}"` : ""}. ` +
      `The lyrics should match the mood and energy of the style. Include a title at the top formatted as "TITLE: [track name]". ` +
      `Keep it 2 verses and a chorus.`
    );
    setArtPrompt(
      `Create album cover art for a ${tag} music track${theme ? ` themed around "${theme}"` : ""}. ` +
      `Dark, atmospheric, high quality, digital art style. No text on the image.`
    );
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
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      await ffmpeg.writeFile("art.jpg", await fetchFile(artFile));
      await ffmpeg.writeFile("audio.mp3", await fetchFile(audioFile));

      // Static image + chromatic aberration + audio
      await ffmpeg.exec([
        "-loop", "1",
        "-i", "art.jpg",
        "-i", "audio.mp3",
        "-filter_complex",
        // Chromatic aberration: split RGB channels, offset R right, B left, blend
        "[0:v]split=3[rv][gv][bv];" +
        "[rv]lutrgb=r=val:g=0:b=0,pad=iw+6:ih:3:0[r];" +
        "[gv]lutrgb=r=0:g=val:b=0,pad=iw+6:ih:3:0[g];" +
        "[bv]lutrgb=r=0:g=0:b=val,pad=iw+6:ih:0:0[b];" +
        "[r][g]blend=all_mode=screen[rg];" +
        "[rg][b]blend=all_mode=screen,crop=iw-6:ih:3:0[out]",
        "-map", "[out]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-pix_fmt", "yuv420p",
        "output.mp4",
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

  const generateMetadataPrompt = () => {
    return (
      `I have a ${styleTag} music track. The lyrics are:\n\n${lyrics}\n\n` +
      `Generate:\n1. An engaging YouTube title (max 60 chars, no clickbait)\n` +
      `2. A 3-paragraph YouTube description with relevant hashtags at the end.\n` +
      `Format as:\nTITLE: [title here]\nDESCRIPTION:\n[description here]`
    );
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

                {/* Approval card */}
                {pendingApproval && (
                  <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                    <p className="text-sm font-semibold text-yellow-400">Track Ready for Approval</p>
                    <p className="text-xs text-muted-foreground">Listen to the generated track. Approve to auto-create video and upload to YouTube, or disapprove to discard.</p>
                    {approvalAudioUrl && (
                      <audio controls src={approvalAudioUrl} className="w-full h-10" />
                    )}
                    {!approvalAudioUrl && (
                      <p className="text-xs text-muted-foreground italic">Audio URL not captured — download from Suno tab manually.</p>
                    )}
                    {autoPublishing ? (
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {autoPublishStep}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={handleApprove}
                          className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                          Approve & Publish
                        </button>
                        <button onClick={handleDisapprove}
                          className="flex-1 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 text-sm font-semibold hover:bg-red-600/30">
                          Disapprove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Automation button */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <p className="text-sm font-semibold mb-1">Run Full Automation</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    The Overmind extension will handle ChatGPT + Suno automatically. Make sure the extension is installed and you are signed into ChatGPT and Suno.
                  </p>
                  {automating ? (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {automationStep === "queued" ? "Queued — extension picking up job..." :
                       automationStep === "lyrics" ? "Generating lyrics in ChatGPT..." :
                       automationStep === "art" ? "Generating cover art in DALL-E..." :
                       automationStep === "audio" ? "Generating audio in Suno..." :
                       automationStep === "metadata" ? "Writing title & description..." :
                       `Running: ${automationStep}...`}
                    </div>
                  ) : (
                    <button
                      onClick={runAutomation}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                    >
                      <Wand2 className="w-4 h-4" /> Run Full Pipeline Automatically
                    </button>
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
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Copy this prompt into ChatGPT</p>
                <button onClick={() => copy(generateMetadataPrompt(), "meta-prompt")} className="text-xs text-primary flex items-center gap-1">
                  {copiedKey === "meta-prompt" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{generateMetadataPrompt()}</p>
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
