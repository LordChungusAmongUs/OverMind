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
  const tabId = await openTab("https://chatgpt.com/");
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
  const tabId = await openTab("https://chatgpt.com/");
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

  // Wait for image to appear — ChatGPT image gen usually takes 15-45s
  await sleep(10000);
  let attempts = 0;
  let imageUrl = null;
  while (attempts < 40 && !imageUrl) {
    imageUrl = await injectAndRun(tabId, () => {
      // Check all images in assistant messages
      const imgs = document.querySelectorAll('[data-message-author-role="assistant"] img');
      for (const img of imgs) {
        const src = img.src || img.getAttribute("src") || "";
        if (src && !src.startsWith("data:") && src.length > 50) {
          return src;
        }
      }
      return null;
    });
    if (!imageUrl) {
      await sleep(3000);
      attempts++;
    }
  }

  // Don't close the tab — leave it open so user can save the art manually
  // (don't call chrome.tabs.remove here)
  return imageUrl;
}

// ── SUNO AUTOMATION ──────────────────────────────────────────────
async function runSuno(lyrics, styleTags) {
  const tabId = await openTab("https://suno.com/create");
  await waitForTab(tabId);
  await sleep(6000);

  // Click "Advanced" tab/button
  const clickedAdvanced = await injectAndRun(tabId, () => {
    const all = Array.from(document.querySelectorAll("button, [role='tab'], [role='switch'], label, span"));
    const btn = all.find(el => /advanced/i.test(el.textContent.trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });

  await sleep(2500);

  // Fill lyrics — use execCommand like ChatGPT (works with React)
  await injectAndRun(tabId, (lyricsText) => {
    // Find the biggest visible textarea (lyrics field)
    const textareas = Array.from(document.querySelectorAll("textarea"))
      .filter(t => t.offsetParent !== null)
      .sort((a, b) => b.offsetHeight - a.offsetHeight);
    if (!textareas.length) return false;
    const ta = textareas[0];
    ta.focus();
    ta.select();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, lyricsText);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, [lyrics]);

  await sleep(1000);

  // Fill style tags — find visible input that isn't the lyrics textarea
  await injectAndRun(tabId, (style) => {
    const inputs = Array.from(document.querySelectorAll("input[type='text'], textarea"))
      .filter(el => el.offsetParent !== null);
    for (const input of inputs) {
      const ph = (input.placeholder || "").toLowerCase();
      const label = (input.getAttribute("aria-label") || "").toLowerCase();
      if (ph.includes("style") || ph.includes("genre") || ph.includes("musical") ||
          label.includes("style") || label.includes("genre")) {
        input.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, style);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    }
    return false;
  }, [styleTags]);

  await sleep(1000);

  // Click Create / Generate
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => /^(create|generate)$/i.test(b.textContent.trim())
    );
    if (btn) { btn.click(); return true; }
    return false;
  });

  // Wait for generation — Suno Pro is fast, usually 30-60s
  await sleep(10000);
  let attempts = 0;
  let audioUrl = null;

  while (attempts < 60 && !audioUrl) {
    audioUrl = await injectAndRun(tabId, () => {
      // Look for audio elements or download links that appear after generation
      const audioEl = document.querySelector("audio[src]");
      if (audioEl?.src) return audioEl.src;

      // Look for download button href
      const links = document.querySelectorAll("a[href*='.mp3'], a[href*='audio'], a[download]");
      if (links.length > 0) return links[0].href;

      return null;
    });

    if (!audioUrl) {
      await sleep(3000);
      attempts++;
    }
  }

  // Leave tab open so you can verify/download manually if needed
  return audioUrl;
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

    // Step 3: Generate audio in Suno
    await updateJob(id, { step: "audio" });
    const audioUrl = await runSuno(lyrics, style_tags);
    await updateJob(id, { audio_url: audioUrl, step: "metadata" });

    // Step 4: Generate metadata
    if (metadata_prompt) {
      await updateJob(id, { step: "metadata" });
      const metaResult = await runChatGPT(metadata_prompt);
      // Parse title and description from result
      const titleMatch = metaResult.match(/TITLE:\s*(.+)/i);
      const descMatch = metaResult.match(/DESCRIPTION:\s*([\s\S]+)/i);
      await updateJob(id, {
        title: titleMatch?.[1]?.trim() ?? "",
        description: descMatch?.[1]?.trim() ?? metaResult,
        step: "complete",
        status: "complete",
      });
    } else {
      await updateJob(id, { status: "complete", step: "complete" });
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
