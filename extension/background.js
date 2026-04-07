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
    // Try PUT with upsert first (more permissive), fall back to POST
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/pipeline-assets/${path}`, {
      method: "PUT",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!res.ok) {
      // Log the error for debugging
      const errText = await res.text().catch(() => "");
      await chrome.storage.local.set({ __uploadErr: `PUT ${res.status}: ${errText.slice(0, 200)}` });
      // Retry with POST
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/pipeline-assets/${path}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": contentType,
        },
        body: blob,
      });
    }
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

  await new Promise(resolve => chrome.tabs.remove(tabId, () => resolve()));
  return text;
}

// ── CHATGPT IMAGE GENERATION ─────────────────────────────────────
async function runChatGPTImage(prompt) {
  // Always open a FRESH tab — reusing an existing tab risks capturing old images
  const tabId = await openTab("https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(4000);

  // ── Helper: collect image srcs from INSIDE assistant messages only ──
  const getAssistantImages = () => injectAndRun(tabId, () => {
    const srcs = [];
    document.querySelectorAll('[data-message-author-role="assistant"] img').forEach(img => {
      const src = img.currentSrc || img.src || "";
      if (!src || src.startsWith("data:") || src.endsWith(".svg")) return;
      srcs.push(src);
    });
    return srcs;
  }).catch(() => []);

  // Snapshot any images already on the page before we send our prompt
  const baseline = new Set(await getAssistantImages());

  // ── Step 1: Type and send the art prompt ──
  await injectAndRun(tabId, (p) => {
    const input = document.querySelector("#prompt-textarea") || document.querySelector('[contenteditable="true"]');
    if (!input) return;
    input.focus();
    document.execCommand("insertText", false, p);
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, [prompt]);
  await sleep(1000);
  await injectAndRun(tabId, () => {
    const btn = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label*="Send"]');
    if (btn) btn.click();
  });

  // ── Step 2: Wait for the stop button to appear (generation started) ──
  for (let i = 0; i < 30; i++) {
    const appeared = await injectAndRun(tabId, () =>
      !!document.querySelector('[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label*="Stop"]') ||
      !!document.querySelector('button[aria-label*="stop"]')
    ).catch(() => false);
    if (appeared) break;
    await sleep(2000);
  }

  // ── Step 3: Wait for stop button to disappear (generation finished) ──
  for (let i = 0; i < 90; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]') &&
      !document.querySelector('button[aria-label*="stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(3000);
  }

  // ── Step 4: Poll for a NEW image inside the last assistant message ──
  // Poll up to ~3 min for the image to appear. We specifically look for images
  // INSIDE the last assistant message that weren't there before we sent the prompt.
  let imgSrc = "";
  for (let i = 0; i < 60 && !imgSrc; i++) {
    const current = await getAssistantImages();
    const newImgs = current.filter(src => !baseline.has(src));
    if (newImgs.length > 0) {
      imgSrc = newImgs[newImgs.length - 1]; // last new image = the generated art
    }
    if (!imgSrc) await sleep(3000);
  }

  // Fallback: if no image found in assistant messages, scan page for any large image
  if (!imgSrc) {
    imgSrc = await injectAndRun(tabId, () => {
      let best = "";
      document.querySelectorAll("img").forEach(img => {
        const src = img.currentSrc || img.src || "";
        if (!src || src.startsWith("data:") || src.endsWith(".svg")) return;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w > 200 && h > 200) best = src; // keep last large image found
      });
      return best;
    }).catch(() => "") || "";
  }

  const artLog = { imgSrc: imgSrc?.slice(0, 120), fetch: null };
  await chrome.storage.local.set({ __artLog: artLog });

  if (imgSrc) {
    // Fetch from within the tab so same-origin/CDN URLs work
    const b64 = await injectAndRun(tabId, (src) => new Promise(async resolve => {
      try {
        const r = await fetch(src, { credentials: "include" });
        if (!r.ok) { resolve(`err:${r.status}`); return; }
        const blob = await r.blob();
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      } catch (e) { resolve(`exc:${e.message}`); }
    }), [imgSrc]).catch(() => null);

    artLog.fetch = typeof b64 === "string" ? (b64.startsWith("data:") ? `ok len=${b64.length}` : b64) : "null";
    await chrome.storage.local.set({ __artLog: artLog });

    if (typeof b64 === "string" && b64.startsWith("data:image")) {
      await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
      return b64;
    }
  }

  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
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

  // Click "Custom Mode" / "Advanced" toggle and wait until the lyrics field appears
  // Suno renamed "Advanced" to "Custom Mode" — handle both
  let lyricsFieldVisible = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    await injectAndRun(tabId, () => {
      const LABELS = ["Custom Mode", "Custom", "Advanced"];
      const all = Array.from(document.querySelectorAll("button, [role='tab'], [role='switch'], label, span"));
      const btn = all.find(el => LABELS.includes(el.textContent.trim()));
      if (btn) btn.click();
    });
    await sleep(1500);
    lyricsFieldVisible = await injectAndRun(tabId, () => {
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => (t.placeholder || "").toLowerCase().includes("leave blank for instrumental") ||
             (t.placeholder || "").toLowerCase().includes("lyrics") ||
             (t.placeholder || "").toLowerCase().includes("enter lyrics")
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
      const LYRICS_PH = ["leave blank for instrumental", "lyrics", "enter lyrics", "write lyrics"];
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => LYRICS_PH.some(ph => (t.placeholder || "").toLowerCase().includes(ph))
      );
      if (!ta) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else {
    // Fill lyrics
    await injectAndRun(tabId, (lyricsText) => {
      const LYRICS_PH = ["leave blank for instrumental", "lyrics", "enter lyrics", "write lyrics"];
      const ta = Array.from(document.querySelectorAll("textarea")).find(
        t => LYRICS_PH.some(ph => (t.placeholder || "").toLowerCase().includes(ph))
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

  // ── Fill style + title fields ────────────────────────────────────
  const titleFromLyrics = (lyrics || "").match(/^TITLE:\s*(.+)/im)?.[1]?.trim() ?? "";

  // Poll up to 10s for the style field to be present in the DOM before filling
  let styleFilled = false, titleFilled = false;
  for (let attempt = 0; attempt < 5 && !styleFilled; attempt++) {
    styleFilled = await injectAndRun(tabId, (style) => {
      const LYRICS_PH = ["leave blank for instrumental", "lyrics", "enter lyrics", "write lyrics", "optional"];
      const STYLE_PH  = ["style of music", "enter style", "style tags", "genre", "style", "music style"];

      const visible = Array.from(document.querySelectorAll("input, textarea"))
        .filter(el => el.offsetParent !== null && !el.disabled && el.offsetWidth > 0);

      // 1. Placeholder match
      let el = visible.find(el => STYLE_PH.some(sp => (el.placeholder || "").toLowerCase().includes(sp)));

      // 2. aria-label match
      if (!el) el = visible.find(el => STYLE_PH.some(sp => (el.getAttribute("aria-label") || "").toLowerCase().includes(sp)));

      // 3. Nearest label text match
      if (!el) el = visible.find(el => {
        const label = el.labels?.[0]?.textContent || el.closest("label")?.textContent || "";
        return STYLE_PH.some(sp => label.toLowerCase().includes(sp));
      });

      // 4. Short textarea that isn't lyrics (lyrics textarea is usually tall > 100px)
      if (!el) {
        el = visible.find(el =>
          el.tagName === "TEXTAREA" &&
          el.offsetHeight < 100 &&
          !LYRICS_PH.some(lp => (el.placeholder || "").toLowerCase().includes(lp))
        );
      }

      // 5. Any visible input with no conflicting placeholder (last resort)
      if (!el) {
        el = visible.find(el =>
          el.tagName === "INPUT" && el.type !== "search" &&
          !LYRICS_PH.some(lp => (el.placeholder || "").toLowerCase().includes(lp)) &&
          !(el.placeholder || "").toLowerCase().includes("search") &&
          !(el.placeholder || "").toLowerCase().includes("title") &&
          !(el.placeholder || "").toLowerCase().includes("name")
        );
      }

      if (!el) return false;
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, style);
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, [styleTags]).catch(() => false);

    if (!styleFilled) await sleep(2000);
  }

  await sleep(1000);

  // Fill Suno's title/song-name field
  if (titleFromLyrics) {
    for (let attempt = 0; attempt < 5 && !titleFilled; attempt++) {
      titleFilled = await injectAndRun(tabId, (titleText) => {
        const LYRICS_PH = ["leave blank for instrumental", "lyrics", "enter lyrics", "write lyrics", "optional"];
        const STYLE_PH  = ["style of music", "enter style", "style tags", "genre", "style", "music style"];
        const TITLE_PH  = ["song name", "title", "track name", "track title", "name"];

        const visible = Array.from(document.querySelectorAll("input, textarea"))
          .filter(el => el.offsetParent !== null && !el.disabled && el.offsetWidth > 0);

        // 1. Placeholder/aria-label title match (exclude style and lyrics fields)
        let el = visible.find(el => {
          const ph  = (el.placeholder || "").toLowerCase();
          const al  = (el.getAttribute("aria-label") || "").toLowerCase();
          const isTitle = TITLE_PH.some(tp => ph.includes(tp) || al.includes(tp));
          const isStyle = STYLE_PH.some(sp => ph.includes(sp) || al.includes(sp));
          const isLyrics = LYRICS_PH.some(lp => ph.includes(lp));
          return isTitle && !isStyle && !isLyrics;
        });

        // 2. Any single-line input not already matched as style/lyrics
        if (!el) {
          el = visible.find(el => {
            if (el.tagName !== "INPUT") return false;
            const ph = (el.placeholder || "").toLowerCase();
            return !LYRICS_PH.some(lp => ph.includes(lp)) &&
                   !STYLE_PH.some(sp => ph.includes(sp)) &&
                   el.type !== "search";
          });
        }

        if (!el) return false;
        const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, titleText);
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, [titleFromLyrics]).catch(() => false);

      if (!titleFilled) await sleep(2000);
    }
  }

  // Debug log — visible in chrome.storage via the extension popup console
  const allPH = await injectAndRun(tabId, () =>
    Array.from(document.querySelectorAll("input, textarea"))
      .filter(el => el.offsetParent !== null)
      .map(el => `${el.tagName}[ph="${el.placeholder}"][al="${el.getAttribute("aria-label") || ""}"]`)
  ).catch(() => []);
  await chrome.storage.local.set({ __sunoFill: { styleFilled, titleFilled, titleFromLyrics, styleTags, allPH } });

  // Inject audio URL collector into MAIN world BEFORE clicking Create.
  // Primary strategy: intercept Suno's own API polling responses — they contain
  // audio_url/stream_audio_url fields in JSON once tracks finish generating.
  // This is more reliable than intercepting audio element loads because we get
  // URLs directly from Suno's data, regardless of how the player loads them.
  await injectAndRun(tabId, () => {
    window.__sunoAudio = [];
    window.__sunoBlobUrls = [];

    const cdnPattern = /https:\/\/(cdn\d*|audiopipe)\.suno\.ai\/[a-f0-9\-]{20,}/;

    // Intercept createObjectURL — catches audio blobs created by Suno's download flow
    try {
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(obj) {
        const url = origCreate(obj);
        if (obj instanceof Blob && obj.size > 100000) window.__sunoBlobUrls.push(url);
        return url;
      };
    } catch (e) {}

    // API + WebSocket response scanner — extracts audio_url from generation status payloads.
    // Suno may push updates over WebSocket instead of HTTP polling.
    const scanForAudioUrls = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(scanForAudioUrls); return; }
      ["audio_url", "stream_audio_url", "download_url"].forEach(key => {
        const val = obj[key];
        if (typeof val === "string" && val.length > 10 && cdnPattern.test(val)) {
          if (!window.__sunoAudio.includes(val)) window.__sunoAudio.push(val);
        }
      });
      Object.values(obj).forEach(v => { if (v && typeof v === "object") scanForAudioUrls(v); });
    };

    // Patch fetch — intercept requests AND responses
    try {
      const origFetch = window.fetch;
      window.fetch = function(resource, ...args) {
        const url = typeof resource === "string" ? resource : (resource && resource.url) || "";
        if (url && cdnPattern.test(url) && !window.__sunoAudio.includes(url)) window.__sunoAudio.push(url);
        const result = origFetch.apply(this, [resource, ...args]);
        if (url && url.includes("suno")) {
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
        if (url && url.includes("suno")) {
          xhr.addEventListener("load", () => { try { scanForAudioUrls(JSON.parse(xhr.responseText)); } catch (e) {} });
        }
        return origSend.apply(this, args);
      };
    } catch (e) {}

    // Patch WebSocket — Suno may stream generation status (including audio_url) via WS
    try {
      const OrigWS = window.WebSocket;
      window.WebSocket = function(url, ...args) {
        const ws = new OrigWS(url, ...args);
        ws.addEventListener("message", (evt) => {
          try { scanForAudioUrls(JSON.parse(evt.data)); } catch (e) {}
        });
        return ws;
      };
      Object.setPrototypeOf(window.WebSocket, OrigWS);
      window.WebSocket.prototype = OrigWS.prototype;
    } catch (e) {}
  }, [], "MAIN").catch(() => {});

  // Click Create
  const createClicked = await injectAndRun(tabId, () => {
    const LABELS = ["Create", "Generate"];
    const btn = Array.from(document.querySelectorAll("button")).find(
      b => LABELS.includes(b.textContent.trim())
    );
    if (btn) { btn.click(); return true; }
    return false;
  }).catch(() => false);
  await chrome.storage.local.set({ __sunoStep: `create_clicked=${createClicked}` });

  // Reset audio arrays NOW (after Create click) so ambient URLs captured before
  // generation (from Suno's feed/existing songs) are discarded.
  await injectAndRun(tabId, () => {
    window.__sunoAudio = [];
    window.__sunoBlobUrls = [];
  }, [], "MAIN").catch(() => {});

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

  let attempts = 0;
  let audioUrls = [];

  // Phase 1: wait for 2 blob URLs (up to ~3 min). If blobs aren't firing,
  // CDN URLs from the API interceptor cover us in Phase 2.
  while (attempts < 60 && audioUrls.length < 2) {
    const blobs = await injectAndRun(tabId, () => window.__sunoBlobUrls ? [...window.__sunoBlobUrls] : [], [], "MAIN").catch(() => []);
    if ((blobs || []).length > audioUrls.length) audioUrls = (blobs || []).slice(0, 2);
    if (audioUrls.length >= 2) break;

    if (attempts % 10 === 0) await clickPlay();
    await sleep(3000);
    attempts++;
  }

  // Phase 2: fall back to CDN URLs only if we couldn't get 2 blob URLs
  if (audioUrls.length < 2) {
    const intercepted = await injectAndRun(tabId, () => window.__sunoAudio ? [...window.__sunoAudio] : [], [], "MAIN").catch(() => []);
    const domUrls = await injectAndRun(tabId, () => {
      const urls = new Set();
      document.querySelectorAll("audio").forEach(a => {
        const s = a.src || a.currentSrc;
        if (s && !s.startsWith("blob:") && !s.startsWith("data:")) urls.add(s);
      });
      document.querySelectorAll("a[href*='.mp3']").forEach(a => { if (a.href) urls.add(a.href); });
      return Array.from(urls);
    }).catch(() => []);
    const needed = 2 - audioUrls.length;
    const cdnCandidates = [...new Set([...(intercepted || []), ...(domUrls || [])])].filter(u => !audioUrls.includes(u));
    audioUrls = [...audioUrls, ...cdnCandidates.slice(0, needed)];
  }

  // Extract the Clerk session token from the page — Suno uses it as Bearer auth for CDN requests
  const clerkToken = await injectAndRun(tabId, async () => {
    try {
      if (window.Clerk?.session) return await window.Clerk.session.getToken();
    } catch {}
    // Fallback: read __session cookie directly
    const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [], "MAIN").catch(() => null);

  // Get Suno cookies from the browser cookie store (for background-script fallback)
  const sunoCookies = await new Promise(r => chrome.cookies.getAll({ domain: "suno.com" }, r)).catch(() => []);
  const cookieHeader = (sunoCookies || []).map(c => `${c.name}=${c.value}`).join("; ");

  const storageUrls = [];
  for (let i = 0; i < audioUrls.length; i++) {
    const url = audioUrls[i];
    const storagePath = `audio/${Date.now()}-${i}.mp3`;

    // Try from within the Suno tab (MAIN world) — blob URLs work natively here,
    // CDN URLs get the Clerk Bearer token which is what Suno's player uses
    const stored = await injectAndRun(tabId, async (src, sbUrl, sbKey, path, token) => {
      try {
        const fetchOpts = src.startsWith("blob:") ? {} : {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        };
        const res = await fetch(src, fetchOpts);
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!src.startsWith("blob:") && ct.includes("text/html")) return null;
        const blob = await res.blob();
        if (blob.size < 50000) return null;
        const up = await fetch(`${sbUrl}/storage/v1/object/pipeline-assets/${path}`, {
          method: "POST",
          headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "audio/mpeg" },
          body: blob,
        });
        if (!up.ok) return null;
        return `${sbUrl}/storage/v1/object/public/pipeline-assets/${path}`;
      } catch { return null; }
    }, [url, SUPABASE_URL, SUPABASE_KEY, storagePath, clerkToken], "MAIN").catch(() => null);

    if (stored) { storageUrls.push(stored); continue; }

    // Fallback: fetch from background script using stored Suno cookies + Clerk token
    try {
      const hdrs = {};
      if (cookieHeader) hdrs["Cookie"] = cookieHeader;
      if (clerkToken) hdrs["Authorization"] = `Bearer ${clerkToken}`;
      const res = await fetch(url, { headers: hdrs });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size >= 50000) {
          const su = await uploadToStorage(storagePath, blob, "audio/mpeg");
          if (su) { storageUrls.push(su); continue; }
        }
      }
    } catch {}

    // Last resort: store the raw URL. If it fails at approve time we'll know
    // the CDN requires auth we can't replicate — but at least approval cards appear.
    if (url && !url.startsWith("blob:")) storageUrls.push(url);
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

// ── WAIT FOR STEP APPROVAL ───────────────────────────────────────
// Sets the job step to `reviewStep` and polls until the dashboard
// changes it (user clicked Approve) or the job is cancelled.
async function waitForApproval(id, reviewStep) {
  while (true) {
    await sleep(3000);
    try {
      const res = await fetch(`${db("pipeline_jobs")}?id=eq.${id}&select=step,status`, { headers });
      const rows = await res.json();
      const job = rows?.[0];
      if (!job || job.status === "error") return; // cancelled
      if (job.step !== reviewStep) return;         // approved — step was advanced
    } catch { return; }
  }
}

// ── MAIN PIPELINE ────────────────────────────────────────────────
async function runPipeline(job) {
  const { id, lyrics_prompt, art_prompt, metadata_prompt, lyrics: existingLyrics } = job;
  // style_tags may be updated after step 1 if ChatGPT returns a STYLE: line
  let style_tags = job.style_tags;
  // Debug jobs (created by the step-test buttons) skip approval gates and run straight through
  const isDebug = (job.track_theme || "").startsWith("__debug:");

  try {
    await updateJob(id, { status: "running", step: "lyrics" });

    // Step 1: Generate lyrics → capture TITLE + STYLE + lyrics → pause for review
    let lyrics = existingLyrics;
    if (!lyrics && lyrics_prompt) {
      if (await isCancelled(id)) return;
      const lyricsResult = await runChatGPT(lyrics_prompt);
      lyrics = lyricsResult;
      // Extract style tags from ChatGPT's STYLE: header line — use for Suno
      const styleFromLyrics = lyricsResult.match(/^STYLE:\s*(.+)/im)?.[1]?.trim();
      if (styleFromLyrics) style_tags = styleFromLyrics;
      const step1Update = { lyrics, step: isDebug ? "art" : "lyrics_review" };
      if (styleFromLyrics) step1Update.style_tags = styleFromLyrics;
      await updateJob(id, step1Update);
      if (!isDebug) {
        await waitForApproval(id, "lyrics_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 2: Generate art → pause for review (skipped for debug jobs)
    let artUrl = null;
    if (art_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "art" });
      artUrl = await runChatGPTImage(art_prompt);
      await updateJob(id, { art_url: artUrl, step: isDebug ? "audio" : "art_review" });
      if (!isDebug) {
        await waitForApproval(id, "art_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 3: Generate audio in Suno → pause for review
    // Skip if audio_url already set (debug/pre-filled jobs)
    const prefilledAudio = job.audio_url;
    let audioUrl;
    if (prefilledAudio) {
      audioUrl = prefilledAudio;
      await updateJob(id, { step: isDebug ? "metadata" : "audio_review" });
      if (!isDebug) {
        await waitForApproval(id, "audio_review");
        if (await isCancelled(id)) return;
      }
    } else {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "audio" });
      let run1 = [], run2 = [];
      try { run1 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run1 = []; }
      if (run1.length > 0) await updateJob(id, { audio_url: JSON.stringify(run1) });
      if (await isCancelled(id)) return;
      try { run2 = JSON.parse(await runSuno(lyrics, style_tags) || "[]"); } catch { run2 = []; }
      const allAudioUrls = [...run1, ...run2];
      await chrome.storage.local.set({ __audioDebug: { run1, run2, allAudioUrls } });
      audioUrl = JSON.stringify(allAudioUrls);
      await updateJob(id, { audio_url: audioUrl, step: isDebug ? "metadata" : "audio_review" });
      if (!isDebug) {
        await waitForApproval(id, "audio_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 4: Generate metadata → pause for review (skipped for debug jobs)
    if (metadata_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "metadata" });
      const metaResult = await runChatGPT(metadata_prompt) || "";
      const titleMatch = metaResult.match(/TITLE:\s*(.+)/i);
      const descMatch = metaResult.match(/DESCRIPTION:\s*([\s\S]+)/i);
      await updateJob(id, {
        title: titleMatch?.[1]?.trim() ?? "",
        description: descMatch?.[1]?.trim() ?? metaResult,
        step: isDebug ? "approval" : "metadata_review",
      });
      if (!isDebug) {
        await waitForApproval(id, "metadata_review");
        if (await isCancelled(id)) return;
      }
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
      const res = await fetch(`${db("pipeline_jobs")}?id=eq.${currentJob}&select=status,step`, { headers });
      const rows = await res.json().catch(() => []);
      const jobRow = rows?.[0];
      const cancelled = jobRow?.status === "error" || jobRow?.status === "complete";
      // Jobs paused at a review step can wait up to 8 hours; all others time out at 45 min
      const isReview = (jobRow?.step || "").endsWith("_review");
      const timeout = isReview ? 8 * 60 * 60 * 1000 : 45 * 60 * 1000;
      const timedOut = Date.now() - runningStarted > timeout;
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

  let job = null;
  try {
    job = await getJob();
  } catch (e) {
    // Network error reaching Supabase — release lock and retry on next alarm
    await chrome.storage.local.set({ running: false, runningStarted: null });
    return;
  }

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
