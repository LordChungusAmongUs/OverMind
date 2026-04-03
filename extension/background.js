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
  const res = await fetch(`${db("pipeline_jobs")}?status=eq.pending&limit=1`, { headers });
  const data = await res.json();
  return data?.[0] ?? null;
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
function injectAndRun(tabId, func, args = []) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func, args },
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
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
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

  // Click Create
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => b.textContent.trim() === "Create"
    );
    if (btn) { btn.click(); return true; }
    return false;
  });

  // Wait for track cards to appear, then click play on each to trigger full generation
  await sleep(15000);

  // Click play on up to 2 generated track cards so Suno streams them (required to populate audio src)
  for (let playAttempt = 0; playAttempt < 10; playAttempt++) {
    const played = await injectAndRun(tabId, () => {
      // Suno play buttons: look for buttons with aria-label containing "Play" inside track cards
      const playBtns = Array.from(document.querySelectorAll('button[aria-label*="Play"], button[title*="Play"]'));
      if (playBtns.length === 0) return 0;
      playBtns.slice(0, 2).forEach(btn => btn.click());
      return playBtns.length;
    });
    if (played >= 2) break;
    await sleep(2000);
  }

  await sleep(3000); // let audio elements populate after play clicks

  let attempts = 0;
  let audioUrls = [];

  while (attempts < 25 && audioUrls.length < 2) {
    audioUrls = await injectAndRun(tabId, () => {
      const urls = new Set();
      // Grab all audio elements with src
      document.querySelectorAll("audio[src]").forEach(a => { if (a.src) urls.add(a.src); });
      // Grab MP3 download links
      document.querySelectorAll("a[href*='.mp3'], a[download]").forEach(a => { if (a.href) urls.add(a.href); });
      return Array.from(urls).slice(0, 2);
    });

    if (audioUrls.length < 2) {
      // Re-click play in case the first click didn't stick
      if (attempts % 5 === 0) {
        await injectAndRun(tabId, () => {
          const playBtns = Array.from(document.querySelectorAll('button[aria-label*="Play"], button[title*="Play"]'));
          playBtns.slice(0, 2).forEach(btn => btn.click());
        });
      }
      await sleep(3000);
      attempts++;
    }
  }

  // Close the Suno tab so the next runSuno call gets a fully fresh page load
  chrome.tabs.remove(tabId);

  // Upload both tracks to Supabase Storage for CORS-free access on dashboard
  const storageUrls = [];
  for (const url of audioUrls) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const path = `audio/${Date.now()}-${storageUrls.length}.mp3`;
      const storageUrl = await uploadToStorage(path, blob, "audio/mpeg");
      storageUrls.push(storageUrl || url);
    } catch {
      storageUrls.push(url);
    }
  }
  return JSON.stringify(storageUrls.length > 0 ? storageUrls : audioUrls);
}

// ── MAIN PIPELINE ────────────────────────────────────────────────
async function runPipeline(job) {
  const { id, lyrics_prompt, art_prompt, metadata_prompt, style_tags, lyrics: existingLyrics } = job;

  try {
    await updateJob(id, { status: "running", step: "lyrics" });

    // Step 1: Generate lyrics
    let lyrics = existingLyrics;
    if (!lyrics && lyrics_prompt) {
      const lyricsResult = await runChatGPT(lyrics_prompt);
      lyrics = lyricsResult;
      await updateJob(id, { lyrics: lyrics, step: "art" });
    }

    // Step 2: Generate art via ChatGPT image generation
    let artUrl = null;
    if (art_prompt) {
      await updateJob(id, { step: "art" });
      artUrl = await runChatGPTImage(art_prompt);
      await updateJob(id, { art_url: artUrl, step: "audio" });
    }

    // Step 3: Generate audio in Suno — run TWICE for 4 total tracks
    await updateJob(id, { step: "audio" });
    let run1 = [], run2 = [];
    try { run1 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run1 = []; }
    try { run2 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run2 = []; }
    const allAudioUrls = [...run1, ...run2];
    const audioUrl = JSON.stringify(allAudioUrls);
    await updateJob(id, { audio_url: audioUrl, step: "metadata" });

    // Step 4: Generate metadata
    if (metadata_prompt) {
      await updateJob(id, { step: "metadata" });
      const metaResult = await runChatGPT(metadata_prompt) || "";
      // Parse title and description from result
      const titleMatch = metaResult.match(/TITLE:\s*(.+)/i);
      const descMatch = metaResult.match(/DESCRIPTION:\s*([\s\S]+)/i);
      // Pause for user approval — dashboard handles video creation + upload
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

  // Check if already running a job
  const { running } = await chrome.storage.local.get("running");
  if (running) return;

  const job = await getJob();
  if (!job) return;

  await chrome.storage.local.set({ running: true, currentJob: job.id, step: job.step ?? "starting" });
  await runPipeline(job);
  await chrome.storage.local.set({ running: false, currentJob: null, step: null });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll", { periodInMinutes: 0.1 });
});
