// ── OVERMIND PIPELINE — Background Service Worker ───────────────
const SUPABASE_URL = "https://yrvxxnhwkmukhtwpcusw.supabase.co";
const SUPABASE_KEY = "sb_publishable_5jLWH-dgpHDjr5rvmGmp_w_y3BhkinO";

const db = (table) => `${SUPABASE_URL}/rest/v1/${table}`;
const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

// ── SUPABASE HELPERS ─────────────────────────────────────────────
async function getJob() {
  // Fetch the oldest pending job
  const res = await fetch(`${db("pipeline_jobs")}?status=eq.pending&limit=1`, { headers });
  const rows = await res.json();
  const job = rows?.[0];
  if (!job) return null;

  // Atomically claim it: PATCH only matches if status is STILL pending.
  // If two alarm handlers race, Postgres serializes them — the second gets 0 rows back.
  const claimRes = await fetch(`${db("pipeline_jobs")}?id=eq.${job.id}&status=eq.pending`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }),
  });
  const claimed = await claimRes.json();
  if (!claimed?.length) return null; // lost the race — another instance already claimed it

  return claimed[0];
}

async function updateJob(id, fields) {
  await fetch(`${db("pipeline_jobs")}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

// ── SUPABASE STORAGE UPLOAD ──────────────────────────────────────
async function uploadToStorage(path, blob, contentType) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/pipeline-assets/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType,
      },
      body: blob,
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/pipeline-assets/${path}`;
  } catch {
    return null;
  }
}

// ── INJECT & RUN SCRIPT IN TAB ───────────────────────────────────
// world: "ISOLATED" (default) or "MAIN" (shares page JS context, window vars persist between calls)
function injectAndRun(tabId, func, args = [], world = "ISOLATED") {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func, args, world },
      (results) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(results?.[0]?.result);
      }
    );
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Reuse an existing tab matching the URL pattern, or open a new one
async function getOrOpenTab(urlPattern, navigateTo) {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const existing = tabs.find(t => t.url && t.url.includes(urlPattern));
      if (existing) {
        chrome.tabs.update(existing.id, { url: navigateTo, active: true }, () => resolve(existing.id));
      } else {
        chrome.tabs.create({ url: navigateTo, active: true }, (tab) => resolve(tab.id));
      }
    });
  });
}

async function openTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: true }, (tab) => resolve(tab.id));
  });
}

async function waitForTab(tabId) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timeout); resolve(); };
    // 30s max — prevents hanging if "complete" event already fired before listener was added
    const timeout = setTimeout(done, 30000);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) { done(); return; }
      if (tab.status === "complete") { done(); return; }
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          done();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

// ── CHATGPT AUTOMATION ───────────────────────────────────────────
async function runChatGPT(prompt) {
  const tabId = await getOrOpenTab("chatgpt.com", "https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(3000);

  // Type prompt into ChatGPT
  await injectAndRun(tabId, (prompt) => {
    const tryType = () => {
      const input = document.querySelector("#prompt-textarea") ||
        document.querySelector('[contenteditable="true"][data-id]') ||
        document.querySelector('[placeholder*="Message"]');
      if (!input) return false;
      input.focus();
      document.execCommand("insertText", false, prompt);
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return true;
    };
    return tryType();
  }, [prompt]);

  await sleep(1000);

  // Click send
  await injectAndRun(tabId, () => {
    const btn = document.querySelector('[data-testid="send-button"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('button[aria-label*="send"]');
    if (btn) btn.click();
  });

  // Wait for response to complete (stop button disappears)
  await sleep(5000);
  let attempts = 0;
  while (attempts < 60) {
    const done = await injectAndRun(tabId, () => {
      const stopBtn = document.querySelector('[data-testid="stop-button"]') ||
        document.querySelector('button[aria-label*="Stop"]');
      return !stopBtn;
    });
    if (done) break;
    await sleep(2000);
    attempts++;
  }

  await sleep(1500);

  // Extract response text
  const text = await injectAndRun(tabId, () => {
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const last = messages[messages.length - 1];
    return last?.innerText ?? "";
  });

  chrome.tabs.remove(tabId);
  return text;
}

// ── CHATGPT IMAGE GENERATION ─────────────────────────────────────
async function runChatGPTImage(prompt) {
  const tabId = await getOrOpenTab("chatgpt.com", "https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(3000);

  await injectAndRun(tabId, (prompt) => {
    const input = document.querySelector("#prompt-textarea") ||
      document.querySelector('[contenteditable="true"][data-id]');
    if (!input) return;
    input.focus();
    document.execCommand("insertText", false, prompt);
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, [prompt]);

  await sleep(1000);

  await injectAndRun(tabId, () => {
    const btn = document.querySelector('[data-testid="send-button"]') ||
      document.querySelector('button[aria-label*="Send"]');
    if (btn) btn.click();
  });

  // Snapshot existing large images BEFORE the prompt is sent so we only pick up the NEW one
  const existingImgSrcs = await injectAndRun(tabId, () => {
    return [...document.querySelectorAll("img")]
      .map(img => img.currentSrc || img.src || "")
      .filter(src => src && !src.startsWith("data:") && src.length > 20);
  });

  // Wait for a NEW image to appear — ChatGPT image gen usually takes 15-45s
  await sleep(10000);
  let attempts = 0;
  let imgSrc = null;
  while (attempts < 40 && !imgSrc) {
    imgSrc = await injectAndRun(tabId, (knownSrcs) => {
      const allImgs = [...document.querySelectorAll("img")];
      for (const img of allImgs) {
        const src = img.currentSrc || img.src || "";
        if (!src || src.length < 20) continue;
        if (src.startsWith("data:")) continue;
        if (knownSrcs.includes(src)) continue; // skip pre-existing images
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w > 200 && h > 200) return src;
      }
      return null;
    }, [existingImgSrcs]);
    if (!imgSrc) {
      await sleep(3000);
      attempts++;
    }
  }

  if (!imgSrc) return null;

  // URL is chatgpt.com/backend-api/... — same-origin from the tab, fetch it there
  const artBase64 = await injectAndRun(tabId, (src) => {
    return new Promise(async (resolve) => {
      try {
        const r = await fetch(src, { credentials: "include" });
        if (!r.ok) { resolve(null); return; }
        const blob = await r.blob();
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      } catch {
        resolve(null);
      }
    });
  }, [imgSrc]);

  if (artBase64 && artBase64.startsWith("data:")) {
    try {
      const base64 = artBase64.split(",")[1];
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/jpeg" });
      const path = `art/${Date.now()}.jpg`;
      const storageUrl = await uploadToStorage(path, blob, "image/jpeg");
      if (storageUrl) return storageUrl;
    } catch { /* fall through */ }
    // Storage upload failed — store base64 directly in the job record
    return artBase64;
  }

  return null;
}

// ── SUNO AUTOMATION ──────────────────────────────────────────────
async function runSuno(lyrics, styleTags) {
  const tabId = await getOrOpenTab("suno.com", "https://suno.com/create");
  await waitForTab(tabId);
  await sleep(4000);

  // Dismiss cookie consent if present
  await injectAndRun(tabId, () => {
    const btns = Array.from(document.querySelectorAll("button"));
    const allow = btns.find(b => b.textContent.trim() === "Allow All" || b.textContent.trim() === "Reject All");
    if (allow) allow.click();
  });

  await sleep(2000);

  // Click "Advanced" and wait until the lyrics field appears
  let lyricsFieldVisible = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    await injectAndRun(tabId, () => {
      const all = Array.from(document.querySelectorAll("button, [role='tab'], label, span"));
      const btn = all.find(el => el.textContent.trim() === "Advanced");
      if (btn) btn.click();
    });
    await sleep(1500);
    lyricsFieldVisible = await injectAndRun(tabId, () => {
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => (t.placeholder || "").toLowerCase().includes("leave blank for instrumental")
      );
      return !!ta;
    });
    if (lyricsFieldVisible) break;
  }

  await sleep(1000);

  if (!lyrics) {
    // Instrumental — retry clicking until the button shows as active
    let instrumentalActive = false;
    for (let attempt = 0; attempt < 8 && !instrumentalActive; attempt++) {
      instrumentalActive = await injectAndRun(tabId, () => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          b => b.textContent.trim() === "Instrumental"
        );
        if (!btn) return false;
        // Already active if aria-pressed="true" or has an active/selected class
        const alreadyOn = btn.getAttribute("aria-pressed") === "true" ||
          btn.classList.contains("active") || btn.classList.contains("selected") ||
          btn.dataset.state === "on";
        if (alreadyOn) return true;
        btn.click();
        return false;
      });
      if (!instrumentalActive) await sleep(1000);
    }
    // Also clear the lyrics textarea just in case
    await injectAndRun(tabId, () => {
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => (t.placeholder || "").toLowerCase().includes("leave blank for instrumental")
      );
      if (!ta) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else {
    // Fill lyrics — exact placeholder match
    await injectAndRun(tabId, (lyricsText) => {
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => (t.placeholder || "").toLowerCase().includes("leave blank for instrumental")
      );
      if (!ta) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, lyricsText);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, [lyrics]);
  }

  await sleep(1000);

  // Fill style — exclude lyrics, title (tallest), and "describe the sound" fields
  await injectAndRun(tabId, (style) => {
    const all = Array.from(document.querySelectorAll("textarea"))
      .filter(t => t.offsetHeight > 0 && t.offsetParent !== null);
    const input = all.find(t => {
      const ph = (t.placeholder || "").toLowerCase();
      return !ph.includes("leave blank for instrumental") &&
             !ph.includes("describe the sound") &&
             t.offsetHeight < 108; // exclude title field (tallest)
    });
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, style);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, [styleTags]);

  await sleep(2000);

  // Fill Suno's Song Name field using the title extracted from the lyrics
  const titleFromLyrics = (lyrics || "").match(/^TITLE:\s*(.+)/im)?.[1]?.trim() ?? "";
  if (titleFromLyrics) {
    await injectAndRun(tabId, (titleText) => {
      // Song Name is a text input in Suno's Advanced form
      const el = Array.from(document.querySelectorAll("input, textarea")).find(el => {
        const ph = (el.placeholder || "").toLowerCase();
        return ph.includes("name") || ph.includes("title");
      });
      if (!el) return false;
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, titleText);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, [titleFromLyrics]);
    await sleep(500);
  }

  // Inject audio URL collector into MAIN world BEFORE clicking Create.
  // Primary strategy: intercept Suno's own API polling responses — they contain
  // audio_url/stream_audio_url fields in JSON once tracks finish generating.
  // This is more reliable than intercepting audio element loads because we get
  // URLs directly from Suno's data, regardless of how the player loads them.
  await injectAndRun(tabId, () => {
    window.__sunoAudio = [];
    // __sunoBlobUrls captures large blobs created by Suno's download button —
    // these are the actual authenticated audio bytes, no CDN auth needed.
    window.__sunoBlobUrls = [];

    // Intercept URL.createObjectURL — fires when Suno creates a blob URL for download/playback
    try {
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(obj) {
        const url = origCreate(obj);
        // Only keep large blobs — real tracks are 3–10 MB, previews/images are smaller
        if (obj instanceof Blob && obj.size > 100000) {
          window.__sunoBlobUrls.push(url);
        }
        return url;
      };
    } catch (e) {}

    const cdnPattern = /https:\/\/(cdn\d*|audiopipe)\.suno\.ai\/[a-f0-9\-]{20,}/;

    // API response scanner — extracts audio_url from Suno's generation status JSON
    const scanForAudioUrls = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(scanForAudioUrls); return; }
      ["audio_url", "stream_audio_url"].forEach(key => {
        const val = obj[key];
        if (typeof val === "string" && val.length > 10 && cdnPattern.test(val)) {
          if (!window.__sunoAudio.includes(val)) window.__sunoAudio.push(val);
        }
      });
      Object.values(obj).forEach(v => { if (v && typeof v === "object") scanForAudioUrls(v); });
    };

    // Patch fetch
    try {
      const origFetch = window.fetch;
      window.fetch = function(resource, ...args) {
        const url = typeof resource === "string" ? resource : (resource && resource.url) || "";
        if (url && cdnPattern.test(url) && !window.__sunoAudio.includes(url)) window.__sunoAudio.push(url);
        const result = origFetch.apply(this, [resource, ...args]);
        if (url && url.includes("suno.ai")) {
          result.then(res => { try { res.clone().json().then(scanForAudioUrls).catch(() => {}); } catch (e) {} }).catch(() => {});
        }
        return result;
      };
    } catch (e) {}

    // Patch XHR
    try {
      const origOpen = window.XMLHttpRequest.prototype.open;
      const origSend = window.XMLHttpRequest.prototype.send;
      window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__sunoUrl = url; return origOpen.apply(this, [method, url, ...rest]);
      };
      window.XMLHttpRequest.prototype.send = function(...args) {
        const xhr = this; const url = xhr.__sunoUrl || "";
        if (url && cdnPattern.test(url) && !window.__sunoAudio.includes(url)) window.__sunoAudio.push(url);
        if (url && url.includes("suno.ai")) {
          xhr.addEventListener("load", () => { try { scanForAudioUrls(JSON.parse(xhr.responseText)); } catch (e) {} });
        }
        return origSend.apply(this, args);
      };
    } catch (e) {}
  }, [], "MAIN").catch(() => {});

  // Click Create
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent.trim() === "Create"
    );
    if (btn) { btn.click(); return true; }
    return false;
  });

  // Wait for track generation to start
  await sleep(15000);

  // Safe play-button selector: aria-label only — avoids broad class/testid matches
  // that could accidentally click the Create button after generation completes.
  const clickPlay = () => injectAndRun(tabId, () => {
    const btns = Array.from(document.querySelectorAll('button[aria-label="Play"], button[aria-label="play"]'));
    btns.slice(0, 2).forEach(b => b.click());
    return btns.length;
  }).catch(() => 0);

  // Try clicking play a few times (not 40 — that was re-clicking Create)
  for (let i = 0; i < 5; i++) {
    const n = await clickPlay();
    if (n >= 2) break;
    await sleep(3000);
  }

  await sleep(3000);

  // Trigger Suno's native download for each generated track.
  // Suno's download pipeline creates an authenticated blob via createObjectURL,
  // which our interceptor captures — giving us the real audio bytes without CDN auth issues.
  const triggerDownloads = async () => {
    // Step 1: open the "..." more-options menu for each track card
    await injectAndRun(tabId, () => {
      const btns = Array.from(document.querySelectorAll("button")).filter(b => {
        const label = (b.getAttribute("aria-label") || "").toLowerCase();
        const text = (b.textContent || "").trim();
        return label.includes("more") || label.includes("option") || text === "..." || text === "⋯";
      });
      btns.slice(0, 4).forEach(b => b.click());
    }, [], "MAIN").catch(() => {});
    await sleep(700);
    // Step 2: click "Download" in the opened menus
    await injectAndRun(tabId, () => {
      Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, a, li')).forEach(el => {
        const text = (el.textContent || "").trim().toLowerCase();
        if (text === "download" || text === "download audio") el.click();
      });
    }, [], "MAIN").catch(() => {});
    await sleep(2000);
  };

  let attempts = 0;
  let audioUrls = [];

  while (attempts < 60 && audioUrls.length < 2) {
    // Check blob URLs first — these come from Suno's download button (fully authenticated)
    const blobUrls = await injectAndRun(tabId, () => window.__sunoBlobUrls ? [...window.__sunoBlobUrls] : [], [], "MAIN").catch(() => []);

    // Also check CDN URLs from the API response interceptor
    const intercepted = await injectAndRun(tabId, () => window.__sunoAudio ? [...window.__sunoAudio] : [], [], "MAIN").catch(() => []);

    // DOM scan fallback
    const domUrls = await injectAndRun(tabId, () => {
      const urls = new Set();
      document.querySelectorAll("audio").forEach(a => {
        const s = a.src || a.currentSrc;
        if (s && !s.startsWith("blob:") && !s.startsWith("data:")) urls.add(s);
      });
      document.querySelectorAll("a[href*='.mp3'], a[download]").forEach(a => { if (a.href) urls.add(a.href); });
      return Array.from(urls);
    }).catch(() => []);

    // Prefer blob URLs (real audio) over CDN URLs (may need auth)
    const combined = [...new Set([...(blobUrls || []), ...(intercepted || []), ...(domUrls || [])])];
    if (combined.length > audioUrls.length) audioUrls = combined;
    if (audioUrls.length >= 2) break;

    // Every 15 attempts, retry play + download triggers
    if (attempts % 15 === 0) {
      await clickPlay();
      await triggerDownloads();
    } else if (attempts % 10 === 0) {
      await clickPlay();
    }

    await sleep(3000);
    attempts++;
  }

  // Try download trigger once more if we still don't have enough URLs
  if (audioUrls.length < 2) await triggerDownloads();

  // Upload audio to Supabase Storage from within the Suno tab (MAIN world).
  // Blob URLs (from download intercept) are fetched directly — no CDN auth needed.
  // CDN URLs fall back to a credentials fetch — may fail if Suno uses token-based auth.
  const storageUrls = [];
  for (let i = 0; i < audioUrls.length; i++) {
    const url = audioUrls[i];
    const storagePath = `audio/${Date.now()}-${i}.mp3`;

    const stored = await injectAndRun(tabId, async (src, sbUrl, sbKey, path) => {
      try {
        // blob: URLs are local to the page — fetch works without any auth
        const res = await fetch(src, src.startsWith("blob:") ? {} : { credentials: "include" });
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!src.startsWith("blob:") && ct.includes("text/html")) return null; // auth redirect
        const blob = await res.blob();
        if (blob.size < 50000) return null; // real tracks are at least a few hundred KB
        const up = await fetch(`${sbUrl}/storage/v1/object/pipeline-assets/${path}`, {
          method: "POST",
          headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "audio/mpeg" },
          body: blob,
        });
        if (!up.ok) return null;
        return `${sbUrl}/storage/v1/object/public/pipeline-assets/${path}`;
      } catch { return null; }
    }, [url, SUPABASE_URL, SUPABASE_KEY, storagePath], "MAIN").catch(() => null);

    if (stored) { storageUrls.push(stored); continue; }

    // Background fallback (public CDN URLs only)
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size >= 50000) {
          const su = await uploadToStorage(storagePath, blob, "audio/mpeg");
          if (su) { storageUrls.push(su); continue; }
        }
      }
    } catch {}

    // Don't store raw Suno URLs — they require auth and always fail at approve time
  }

  // Close the tab AFTER uploading so the next runSuno call gets a fresh page.
  await new Promise(resolve => chrome.tabs.remove(tabId, () => resolve()));

  return JSON.stringify(storageUrls);
}

// ── CANCELLATION CHECK ───────────────────────────────────────────
async function isCancelled(id) {
  try {
    const res = await fetch(`${db("pipeline_jobs")}?id=eq.${id}&select=status`, { headers });
    const rows = await res.json();
    return rows?.[0]?.status === "error";
  } catch { return false; }
}

// ── MAIN PIPELINE ────────────────────────────────────────────────
async function runPipeline(job) {
  const { id, lyrics_prompt, art_prompt, metadata_prompt, style_tags, lyrics: existingLyrics } = job;

  try {
    await updateJob(id, { status: "running", step: "lyrics" });

    // Step 1: Generate lyrics
    let lyrics = existingLyrics;
    if (!lyrics && lyrics_prompt) {
      if (await isCancelled(id)) return;
      const lyricsResult = await runChatGPT(lyrics_prompt);
      lyrics = lyricsResult;
      await updateJob(id, { lyrics: lyrics, step: "art" });
    }

    // Step 2: Generate art via ChatGPT image generation
    let artUrl = null;
    if (art_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "art" });
      artUrl = await runChatGPTImage(art_prompt);
      await updateJob(id, { art_url: artUrl, step: "audio" });
    }

    // Step 3: Generate audio in Suno — run TWICE for 4 total tracks
    if (await isCancelled(id)) return;
    await updateJob(id, { step: "audio" });
    let run1 = [], run2 = [];
    try { run1 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run1 = []; }
    // Save run1 immediately so we never lose those tracks if run2 fails
    if (run1.length > 0) await updateJob(id, { audio_url: JSON.stringify(run1) });
    if (await isCancelled(id)) return;
    try { run2 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run2 = []; }
    const allAudioUrls = [...run1, ...run2];
    const audioUrl = JSON.stringify(allAudioUrls);
    await updateJob(id, { audio_url: audioUrl, step: "metadata" });

    // Step 4: Generate metadata
    if (metadata_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "metadata" });
      const metaResult = await runChatGPT(metadata_prompt) || "";
      const titleMatch = metaResult.match(/TITLE:\s*(.+)/i);
      const descMatch = metaResult.match(/DESCRIPTION:\s*([\s\S]+)/i);
      await updateJob(id, {
        title: titleMatch?.[1]?.trim() ?? "",
        description: descMatch?.[1]?.trim() ?? metaResult,
        step: "approval",
      });
    } else {
      await updateJob(id, { step: "approval" });
    }

  } catch (err) {
    await updateJob(id, { status: "error", error_message: err.message });
  }
}

// ── ALARM POLLING ─────────────────────────────────────────────────
chrome.alarms.create("poll", { periodInMinutes: 0.1 }); // every 6 seconds

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "poll") return;

  // Watchdog: clear stuck running flag
  const { running, currentJob, runningStarted } = await chrome.storage.local.get(["running", "currentJob", "runningStarted"]);
  if (running) {
    if (!currentJob || !runningStarted) {
      // No job attached yet — if it's been more than 30s, something went wrong, clear it
      if (Date.now() - (runningStarted || 0) > 30000) {
        await chrome.storage.local.set({ running: false, currentJob: null, step: null, runningStarted: null });
      } else {
        return; // still claiming the lock, leave it alone
      }
    } else {
      const timedOut = Date.now() - runningStarted > 45 * 60 * 1000;
      let cancelled = false;
      if (!timedOut) {
        const res = await fetch(`${db("pipeline_jobs")}?id=eq.${currentJob}&select=status`, { headers });
        const rows = await res.json().catch(() => []);
        cancelled = rows?.[0]?.status === "error" || rows?.[0]?.status === "complete";
      }
      if (timedOut || cancelled) {
        await chrome.storage.local.set({ running: false, currentJob: null, step: null, runningStarted: null });
      } else {
        return;
      }
    }
  }

  // Claim the running lock BEFORE any async work to prevent race conditions.
  // Without this, two alarm firings in quick succession can both read running=false
  // and both start a pipeline on the same job, causing duplicate Suno runs.
  await chrome.storage.local.set({ running: true, currentJob: null, step: null, runningStarted: Date.now() });

  const job = await getJob();
  if (!job) {
    // Nothing to do — release the lock
    await chrome.storage.local.set({ running: false, runningStarted: null });
    return;
  }

  await chrome.storage.local.set({ currentJob: job.id, step: job.step ?? "starting" });
  await runPipeline(job);
  await chrome.storage.local.set({ running: false, currentJob: null, step: null });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll", { periodInMinutes: 0.1 });
});
