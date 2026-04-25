// ── OVERMIND PIPELINE — Background Service Worker ───────────────
const SUPABASE_URL = "https://yrvxxnhwkmukhtwpcusw.supabase.co";
const SUPABASE_KEY = "sb_publishable_5jLWH-dgpHDjr5rvmGmp_w_y3BhkinO";

let stylistRunning = false; // in-memory lock — auto-resets if service worker is restarted

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
  const tabId = await openTab("https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(4000);

  // ── Send the art prompt ──
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

  // ── Wait for stop button to appear then disappear ──
  for (let i = 0; i < 30; i++) {
    const appeared = await injectAndRun(tabId, () =>
      !!document.querySelector('[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label*="Stop"]') ||
      !!document.querySelector('button[aria-label*="stop"]')
    ).catch(() => false);
    if (appeared) break;
    await sleep(2000);
  }
  for (let i = 0; i < 90; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]') &&
      !document.querySelector('button[aria-label*="stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(3000);
  }

  // ── Wait 75 seconds for the final image to fully render ──
  // No MutationObserver — we scan the conversation directly so we only
  // ever pick up images from ChatGPT's reply, not UI chrome / suggestions.
  await sleep(75000);

  // ── Direct scan: walk imgs inside <main> in reverse, take the last large one ──
  // On a fresh tab with a single conversation, the only large image in <main>
  // is the DALL-E art ChatGPT just generated. Sidebars and suggestions live
  // outside <main> so they're invisible to this query.
  let imgSrc = "";
  for (let i = 0; i < 20 && !imgSrc; i++) {
    // Scroll to bottom so lazy-loaded image is in view
    await injectAndRun(tabId, () => {
      (document.querySelector("main") || document.body).scrollTo(0, 999999);
    }).catch(() => {});
    await sleep(2000);

    imgSrc = await injectAndRun(tabId, () => {
      const main = document.querySelector("main");
      if (!main) return "";
      const imgs = Array.from(main.querySelectorAll("img")).reverse();
      for (const img of imgs) {
        const src = img.currentSrc || img.src || "";
        if (!src || src.startsWith("data:") || src.endsWith(".svg")) continue;
        const r = img.getBoundingClientRect();
        if (r.width > 150 && r.height > 150) return src;
      }
      return "";
    }).catch(() => "");

    if (!imgSrc) await sleep(3000);
  }

  const artLog = { imgSrc: imgSrc?.slice(0, 200), isCDN: !!(imgSrc?.includes("oaiusercontent") || imgSrc?.includes("blob.core")), fetch: null };
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

// ── CHATGPT IMAGE EDIT (album art → track art) ───────────────────
// Opens a ChatGPT tab, uploads the album cover, and asks it to add the track title.
// Returns a base64 data URL of the edited image, or null on failure.
async function runChatGPTImageEdit(baseImageUrl, trackTitle, artistName, hasTitledArt = false) {
  const imageB64 = await urlToBase64(baseImageUrl);
  if (!imageB64) return null;

  const tabId = await openTab("https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(4000);

  await attachFilesToTab(tabId, [imageB64]);
  // Wait longer after attaching — ChatGPT processes the upload before enabling the send button
  await sleep(5000);

  const label = artistName ? `${artistName} - ${trackTitle}` : trackTitle;
  const prompt = hasTitledArt
    ? `This image already has a song title on it. Replace only the existing song title text with "${label}". Keep the font, style, placement, colors, and all artwork completely identical — change nothing except the title text itself.`
    : `This is an album cover. Edit it to add the text "${label}" in a stylized font that matches the artwork's aesthetic. Place the text along either the top or the bottom of the image so it does not cover the main artwork. Keep the rest of the composition completely unchanged.`;

  // Type the prompt into the textarea
  await injectAndRun(tabId, (p) => {
    const input = document.querySelector("#prompt-textarea") || document.querySelector('[contenteditable="true"]');
    if (!input) return;
    input.focus();
    document.execCommand("insertText", false, p);
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, [prompt]);
  await sleep(1500);

  // Retry clicking send until it works (button may be disabled while image is still processing)
  for (let i = 0; i < 10; i++) {
    const sent = await injectAndRun(tabId, () => {
      const btn = document.querySelector('[data-testid="send-button"]') ||
                  document.querySelector('button[aria-label*="Send"]');
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    }).catch(() => false);
    if (sent) break;
    await sleep(2000);
  }

  for (let i = 0; i < 30; i++) {
    const appeared = await injectAndRun(tabId, () =>
      !!document.querySelector('[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label*="Stop"]') ||
      !!document.querySelector('button[aria-label*="stop"]')
    ).catch(() => false);
    if (appeared) break;
    await sleep(2000);
  }
  for (let i = 0; i < 90; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]') &&
      !document.querySelector('button[aria-label*="stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(3000);
  }

  await sleep(75000);

  let imgSrc = "";
  for (let i = 0; i < 20 && !imgSrc; i++) {
    await injectAndRun(tabId, () => {
      (document.querySelector("main") || document.body).scrollTo(0, 999999);
    }).catch(() => {});
    await sleep(2000);

    imgSrc = await injectAndRun(tabId, () => {
      const main = document.querySelector("main");
      if (!main) return "";
      const imgs = Array.from(main.querySelectorAll("img")).reverse();
      for (const img of imgs) {
        const src = img.currentSrc || img.src || "";
        if (!src || src.startsWith("data:") || src.endsWith(".svg")) continue;
        const r = img.getBoundingClientRect();
        if (r.width > 150 && r.height > 150) return src;
      }
      return "";
    }).catch(() => "");

    if (!imgSrc) await sleep(3000);
  }

  if (imgSrc) {
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

  // Strip TITLE:/STYLE: header lines that ChatGPT adds — they belong in separate fields,
  // not in Suno's lyrics box. After stripping, empty = instrumental track.
  const lyricsForSuno = (lyrics || "")
    .replace(/^TITLE:\s*.+\r?\n?/im, "")
    .replace(/^STYLE:\s*.+\r?\n?/im, "")
    .trim();

  if (!lyricsForSuno) {
    // Instrumental — click Instrumental button and clear the lyrics field
    let instrumentalActive = false;
    for (let attempt = 0; attempt < 8 && !instrumentalActive; attempt++) {
      instrumentalActive = await injectAndRun(tabId, () => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          b => b.textContent.trim() === "Instrumental"
        );
        if (!btn) return false;
        const alreadyOn = btn.getAttribute("aria-pressed") === "true" ||
          btn.classList.contains("active") || btn.classList.contains("selected") ||
          btn.dataset.state === "on";
        if (alreadyOn) return true;
        btn.click();
        return false;
      });
      if (!instrumentalActive) await sleep(1000);
    }
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
    // Fill lyrics (headers already stripped)
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
    }, [lyricsForSuno]);
  }

  await sleep(1000);

  // titleFromLyrics is extracted here so it's available when we fill just before Create
  const titleFromLyrics = (lyrics || "").match(/^TITLE:\s*(.+)/im)?.[1]?.trim() ?? "";

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

  // ── Fill style + title RIGHT before clicking Create ──────────────
  // Doing this here (not earlier) prevents Suno's React from resetting
  // the fields during the interceptor injection above.
  const SUNO_LYRICS_PH = ["leave blank for instrumental", "lyrics", "enter lyrics", "write lyrics"];
  const SUNO_STYLE_PH  = ["style of music", "enter style", "style tags", "genre", "style", "music style"];
  const SUNO_TITLE_PH  = ["song name", "title", "track name", "track title", "name"];

  const sunoFillField = async (tabId, value, lyrPH, stylPH, titPH, mode) => {
    const result = await injectAndRun(tabId, (val, lyrPH, stylPH, titPH, mode) => {
      const fields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
        .filter(el => {
          if (el.disabled || el.readOnly) return false;
          const r = el.getBoundingClientRect();
          return r.width > 50 && r.height > 10;
        });
      const lbl = el =>
        ((el.placeholder || "") + " " + (el.getAttribute("aria-label") || "") + " " +
         (el.getAttribute("aria-placeholder") || "") + " " + (el.getAttribute("data-placeholder") || "")
        ).toLowerCase();

      const lyricsField = fields.find(el => lyrPH.some(ph => lbl(el).includes(ph)));
      const nonLyrics   = fields.filter(el => el !== lyricsField);

      let el = null;
      if (mode === "style") {
        // Exclude "Exclude styles" / "negative" fields — their label contains "style" but they're for exclusions
        const notExclude = el => !lbl(el).includes("exclude") && !lbl(el).includes("negative");
        el = nonLyrics.find(el => notExclude(el) && stylPH.some(s => lbl(el).includes(s)))
          ?? nonLyrics.find(el => notExclude(el) && el.tagName === "TEXTAREA")
          ?? nonLyrics.find(el => notExclude(el) && el.getAttribute("contenteditable") === "true")
          ?? nonLyrics.find(el => notExclude(el) && el.tagName === "INPUT" && el.type !== "search" && !lbl(el).includes("title") && !lbl(el).includes("name") && !lbl(el).includes("search"));
      } else {
        el = fields.find(el => {
          const l = lbl(el);
          return titPH.some(t => l.includes(t)) && !stylPH.some(s => l.includes(s)) && !lyrPH.some(lp => l.includes(lp));
        }) ?? fields.find(el => el.tagName === "INPUT" && el.type !== "search" && !lyrPH.some(lp => lbl(el).includes(lp)) && !stylPH.some(s => lbl(el).includes(s)) && !lbl(el).includes("search"));
      }

      if (!el) return `no_field mode=${mode} lyricsFound=${!!lyricsField} total=${fields.length} labels=${fields.map(lbl).join("|")}`;

      const elDesc = `${el.tagName}[ph="${(el.placeholder||"").slice(0,40)}"][al="${(el.getAttribute("aria-label")||"").slice(0,40)}"][id="${el.id||""}"]`;

      el.focus(); el.click();
      if (el.isContentEditable) {
        el.textContent = "";
        document.execCommand("insertText", false, val);
      } else {
        // Use the PAGE's native prototype setter (MAIN world) so React's fiber sees the change
        const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // Do NOT call el.blur() — Suno's onBlur handler resets the field
      const final = el.isContentEditable ? el.textContent : el.value;
      return final === val ? `ok:${elDesc}` : `wrong_val got="${final.slice(0,40)}" el=${elDesc}`;
    }, [value, lyrPH, stylPH, titPH, mode], "MAIN").catch(e => `exc:${e}`);
    return result;
  };

  let styleFilled = "not_attempted", titleFilled = "not_attempted";
  if (styleTags) {
    for (let i = 0; i < 5; i++) {
      styleFilled = await sunoFillField(tabId, styleTags, SUNO_LYRICS_PH, SUNO_STYLE_PH, SUNO_TITLE_PH, "style");
      if (styleFilled === "ok") break;
      await sleep(1000);
    }
  }
  if (titleFromLyrics) {
    for (let i = 0; i < 5; i++) {
      titleFilled = await sunoFillField(tabId, titleFromLyrics, SUNO_LYRICS_PH, SUNO_STYLE_PH, SUNO_TITLE_PH, "title");
      if (titleFilled === "ok") break;
      await sleep(1000);
    }
  }
  // Verify the style value is still present right before clicking Create.
  // If React reset it, try one more fill.
  let stylePreCreate = "skipped";
  if (styleTags) {
    stylePreCreate = await injectAndRun(tabId, (val, lyrPH, stylPH) => {
      const fields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
        .filter(el => { if (el.disabled || el.readOnly) return false; const r = el.getBoundingClientRect(); return r.width > 50 && r.height > 10; });
      const lbl = el => ((el.placeholder || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      const lyricsField = fields.find(el => lyrPH.some(ph => lbl(el).includes(ph)));
      const nonLyrics = fields.filter(el => el !== lyricsField);
      const notExclude = el => !lbl(el).includes("exclude") && !lbl(el).includes("negative");
      const el = nonLyrics.find(el => notExclude(el) && stylPH.some(s => lbl(el).includes(s)))
        ?? nonLyrics.find(el => notExclude(el) && el.tagName === "TEXTAREA")
        ?? nonLyrics.find(el => notExclude(el) && el.getAttribute("contenteditable") === "true");
      if (!el) return "field_gone";
      const cur = el.isContentEditable ? el.textContent : el.value;
      if (cur === val) return `still_ok`;
      // Re-fill
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      const after = el.value;
      return `refilled was="${cur.slice(0,30)}" now="${after.slice(0,30)}"`;
    }, [styleTags, SUNO_LYRICS_PH, SUNO_STYLE_PH], "MAIN").catch(e => `exc:${e}`);
  }

  await chrome.storage.local.set({ __sunoFill: { styleFilled, titleFilled, styleTags, titleFromLyrics, stylePreCreate } });

  // Click Create immediately after filling — minimizes window for React to reset fields
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
  while (attempts < 50 && audioUrls.length < 2) {
    const blobs = await injectAndRun(tabId, () => window.__sunoBlobUrls ? [...window.__sunoBlobUrls] : [], [], "MAIN").catch(() => []);
    if ((blobs || []).length > audioUrls.length) audioUrls = (blobs || []).slice(0, 2);
    if (audioUrls.length >= 2) break;

    // Click play every 5 attempts (~15s) to trigger blob URL creation for both tracks
    if (attempts % 5 === 0) await clickPlay();
    await sleep(3000);
    attempts++;
  }

  // Phase 2: supplement with CDN URLs from the API interceptor only.
  // Only use window.__sunoAudio (reset post-Create click) — never DOM audio elements,
  // which include old/historical Suno tracks from the feed and cause duplicate URLs.
  {
    const intercepted = await injectAndRun(tabId, () => window.__sunoAudio ? [...window.__sunoAudio] : [], [], "MAIN").catch(() => []);
    const cdnCandidates = [...new Set(intercepted || [])].filter(u => !audioUrls.includes(u));
    // Fill remaining slots up to 2 total
    const needed = Math.max(0, 2 - audioUrls.length);
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
  const runTs = Date.now();
  for (let i = 0; i < audioUrls.length; i++) {
    const url = audioUrls[i];
    const storagePath = `audio/${runTs}-${i}.mp3`;

    // Try from within the Suno tab (MAIN world) — blob URLs work natively here,
    // CDN URLs get the Clerk Bearer token which is what Suno's player uses.
    // Use PUT with x-upsert so re-runs never fail due to existing file conflict.
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
        // Try PUT (upsert) first, fall back to POST
        let up = await fetch(`${sbUrl}/storage/v1/object/pipeline-assets/${path}`, {
          method: "PUT",
          headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "audio/mpeg", "x-upsert": "true" },
          body: blob,
        });
        if (!up.ok) {
          up = await fetch(`${sbUrl}/storage/v1/object/pipeline-assets/${path}`, {
            method: "POST",
            headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "audio/mpeg" },
            body: blob,
          });
        }
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

    // Last resort: store the raw CDN URL so approval cards still appear.
    // Blob URLs are tab-local and cannot be used after tab close — skip them.
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

// ── ALBUM GENERATION PIPELINE ────────────────────────────────────
// job fields used: id, persona_name, lyrics_prompt (title prompt), art_prompt (art template with {{album_title}})
async function runAlbumGen(job) {
  const { id, persona_name, lyrics_prompt: titlePrompt, art_prompt: artPromptTemplate } = job;
  try {
    await updateJob(id, { status: "running", step: "title" });

    // Step 1: Ask ChatGPT for album title + track count as JSON
    const textResult = await runChatGPT(titlePrompt);
    let albumTitle = "";
    let trackCount = 10;
    try {
      const m = textResult.match(/\{[\s\S]*?\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        albumTitle = (parsed.title || "").trim().replace(/^["']|["']$/g, "");
        trackCount = Math.max(4, Math.min(20, parseInt(parsed.track_count) || 10));
      }
    } catch {}
    if (!albumTitle) {
      albumTitle = textResult.split("\n").map(l => l.trim()).find(l => l.length > 1 && l.length < 60) || "New Album";
    }

    await updateJob(id, { title: albumTitle, step: "art" });

    // Step 2: Generate album art with title substituted in
    let artUrl = null;
    if (artPromptTemplate) {
      const artPrompt = artPromptTemplate.replace(/\{\{album_title\}\}/gi, albumTitle);
      const b64 = await runChatGPTImage(artPrompt);
      if (b64 && b64.startsWith("data:image")) {
        try {
          const base64Data = b64.split(",")[1];
          const byteChars = atob(base64Data);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: "image/png" });
          artUrl = await uploadToStorage(`albums/${Date.now()}-${(persona_name || "artist").replace(/\s+/g, "_")}.png`, blob, "image/png");
        } catch {}
        if (!artUrl) artUrl = b64; // fallback: store data URL directly
      }
    }

    await updateJob(id, {
      art_url: artUrl,
      description: JSON.stringify({ track_count: trackCount }),
      status: "complete",
      step: "complete",
    });
  } catch (err) {
    await updateJob(id, { status: "error", error_message: err.message });
  }
}

// ── PLAYLIST GENERATION PIPELINE ─────────────────────────────────
// job fields used: id, lyrics_prompt (full analytics context + instructions)
async function runPlaylistGen(job) {
  const { id, lyrics_prompt: contextPrompt } = job;
  try {
    await updateJob(id, { status: "running", step: "generating" });

    const result = await runChatGPT(contextPrompt);

    let playlistData = {};
    let name = "";
    try {
      const m = result.match(/\{[\s\S]*?\}/);
      if (m) {
        playlistData = JSON.parse(m[0]);
        name = (playlistData.name || "").trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
    if (!name) {
      name = result.split("\n").map(l => l.trim()).find(l => l.length > 1 && l.length < 80) || "New Playlist";
    }

    await updateJob(id, {
      title: name,
      description: JSON.stringify(playlistData),
      status: "complete",
      step: "complete",
    });
  } catch (err) {
    await updateJob(id, { status: "error", error_message: err.message });
  }
}

// ── MAIN PIPELINE ────────────────────────────────────────────────
async function runPipeline(job) {
  const { id, lyrics_prompt, art_prompt, metadata_prompt, lyrics: existingLyrics, persona_name } = job;
  // style_tags may be updated after step 1 if ChatGPT returns a STYLE: line
  let style_tags = job.style_tags;
  // titleFromLyrics is extracted in Step 1 and used in Step 2 for album art editing
  let titleFromLyrics = job.title || null;
  // Resolve persona from DB field or from the art_prompt text
  const resolvedPersonaEarly = persona_name ||
    (art_prompt?.match(/^Create album cover art for ([^,]+),/)?.[1]?.trim()) || null;
  // Debug jobs skip all approval gates. Per-step auto_approve_steps controls individual steps.
  const isDebug         = (job.track_theme || "").startsWith("__debug:");
  const approvedSteps   = new Set(
    (job.auto_approve_steps || "").split(",").map(s => s.trim()).filter(Boolean)
  );
  // If the old boolean auto_approve is set, treat all steps as approved
  if (job.auto_approve) ["lyrics", "art", "audio", "metadata"].forEach(s => approvedSteps.add(s));
  const shouldSkip = (step) => isDebug || approvedSteps.has(step);

  try {
    await updateJob(id, { status: "running", step: "lyrics" });

    // Step 1: Generate lyrics → capture TITLE + STYLE + lyrics → pause for review
    let lyrics = existingLyrics;
    if (!lyrics && lyrics_prompt) {
      if (await isCancelled(id)) return;

      // Fetch existing track names so ChatGPT avoids duplicates
      let promptToSend = lyrics_prompt;
      if (resolvedPersonaEarly) {
        try {
          const existingRes = await fetch(
            `${db("artist_track_names")}?persona_name=eq.${encodeURIComponent(resolvedPersonaEarly)}&select=track_name&limit=50`,
            { headers }
          );
          const existingTracks = await existingRes.json();
          if (Array.isArray(existingTracks) && existingTracks.length > 0) {
            const nameList = existingTracks.map(t => `"${t.track_name}"`).join(", ");
            promptToSend = lyrics_prompt + `\n\nIMPORTANT: These track titles already exist and must NOT be used or closely imitated: ${nameList}. Your TITLE must be completely different from all of these.`;
          }
        } catch {}
      }

      const lyricsResult = await runChatGPT(promptToSend);
      lyrics = lyricsResult;
      // Extract style tags from ChatGPT's STYLE: header line — use for Suno
      const styleFromLyrics = lyricsResult.match(/^STYLE:\s*(.+)/im)?.[1]?.trim();
      titleFromLyrics = lyricsResult.match(/^TITLE:\s*(.+)/im)?.[1]?.trim() || titleFromLyrics;
      if (styleFromLyrics) style_tags = styleFromLyrics;
      const step1Update = { lyrics, step: shouldSkip("lyrics") ? "art" : "lyrics_review" };
      if (styleFromLyrics) step1Update.style_tags = styleFromLyrics;
      if (titleFromLyrics)  step1Update.title       = titleFromLyrics;
      await updateJob(id, step1Update);
      if (!shouldSkip("lyrics")) {
        await waitForApproval(id, "lyrics_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 2: Generate art → pause for review
    // If the job has a persona_name, check for an in-progress album with art and edit it with the track title.
    // Falls back to generating fresh art from scratch if no album art is available.
    let artUrl = null;
    if (art_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "art" });

      let usedAlbumArt = false;
      const resolvedPersona = resolvedPersonaEarly;
      const albumArtDebug = { persona_name, resolvedPersona, titleFromLyrics, albums: null, editResult: null, reason: null };
      if (resolvedPersona && titleFromLyrics) {
        try {
          const albumRes = await fetch(
            `${db("albums")}?persona_name=eq.${encodeURIComponent(resolvedPersona)}&status=eq.in_progress&art_url=not.is.null&select=id,art_url,has_titled_art`,
            { headers }
          );
          const openAlbums = await albumRes.json();
          albumArtDebug.albums = Array.isArray(openAlbums) ? openAlbums.map(a => ({ id: a.id, art_url: (a.art_url || "").slice(0, 80) })) : openAlbums;
          if (Array.isArray(openAlbums) && openAlbums.length > 0) {
            const album = openAlbums[Math.floor(Math.random() * openAlbums.length)];
            albumArtDebug.reason = `editing album ${album.id}`;
            const editedArt = await runChatGPTImageEdit(album.art_url, titleFromLyrics, resolvedPersona, album.has_titled_art);
            albumArtDebug.editResult = editedArt ? `ok len=${editedArt.length}` : "null";
            if (editedArt) {
              artUrl = editedArt;
              usedAlbumArt = true;
              // Upload the edited art to storage so subsequent tracks can fetch it via HTTPS
              // (data: URLs cannot be fetched from a service worker)
              try {
                const base64Data = editedArt.split(",")[1];
                const byteChars = atob(base64Data);
                const byteArr = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                const blob = new Blob([byteArr], { type: "image/png" });
                const storagePath = `albums/${album.id}-titled-${Date.now()}.png`;
                const storageUrl = await uploadToStorage(storagePath, blob, "image/png");
                const urlToSave = storageUrl || editedArt;
                await fetch(`${db("albums")}?id=eq.${album.id}`, {
                  method: "PATCH",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ art_url: urlToSave, has_titled_art: true }),
                });
              } catch {}
            }
          } else {
            albumArtDebug.reason = "no in-progress albums with art_url found";
          }
        } catch (e) {
          albumArtDebug.reason = `error: ${e.message}`;
        }
      } else {
        albumArtDebug.reason = !persona_name ? "persona_name missing from job" : "titleFromLyrics missing";
      }
      await chrome.storage.local.set({ __albumArtDebug: albumArtDebug });

      if (!usedAlbumArt) {
        artUrl = await runChatGPTImage(art_prompt);
      }

      await updateJob(id, { art_url: artUrl, step: shouldSkip("art") ? "audio" : "art_review" });
      if (!shouldSkip("art")) {
        await waitForApproval(id, "art_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 3: Generate audio in Suno → pause for review
    // Sub-jobs always have audio pre-filled; never run Suno for them.
    const isSubJob = (job.track_theme || "").startsWith("__subjob:");
    const prefilledAudio = job.audio_url;
    let audioUrl;
    if (prefilledAudio || isSubJob) {
      audioUrl = prefilledAudio;
      await updateJob(id, { step: shouldSkip("audio") ? "metadata" : "audio_review" });
      if (!shouldSkip("audio")) {
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
      await updateJob(id, { audio_url: audioUrl, step: shouldSkip("audio") ? "metadata" : "audio_review" });
      if (!shouldSkip("audio")) {
        await waitForApproval(id, "audio_review");
        if (await isCancelled(id)) return;
      }
    }

    // Step 4: Generate metadata → pause for review
    if (metadata_prompt) {
      if (await isCancelled(id)) return;
      await updateJob(id, { step: "metadata" });
      const metaResult = await runChatGPT(metadata_prompt) || "";
      const titleMatch = metaResult.match(/TITLE:\s*(.+)/i);
      const descMatch = metaResult.match(/DESCRIPTION:\s*([\s\S]+)/i);
      await updateJob(id, {
        title: titleMatch?.[1]?.trim() ?? "",
        description: descMatch?.[1]?.trim() ?? metaResult,
        step: shouldSkip("metadata") ? "approval" : "metadata_review",
      });
      if (!shouldSkip("metadata")) {
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

// ── STYLIST HELPERS ──────────────────────────────────────────────

// Convert a URL to base64 data URL (uses btoa, safe in MV3 service workers)
async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch { return null; }
}

// Attach multiple images to the current ChatGPT message box
async function attachFilesToTab(tabId, base64Array) {
  // Directly set files on the hidden file input — do NOT click the button first,
  // since clicking it opens the OS native file picker which blocks programmatic injection.
  return await injectAndRun(tabId, (b64Array) => {
    try {
      const files = b64Array.map((b64, i) => {
        const arr = b64.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let j = 0; j < bstr.length; j++) u8arr[j] = bstr.charCodeAt(j);
        return new File([u8arr], `img-${i}.jpg`, { type: mime });
      });
      const fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) return false;
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch (e) { return 'err:' + e.message; }
  }, [base64Array]);
}

// Type and send a message in the open ChatGPT tab
async function sendGPTMessage(tabId, text) {
  await injectAndRun(tabId, (t) => {
    const input = document.querySelector("#prompt-textarea") || document.querySelector('[contenteditable="true"]');
    if (!input) return;
    input.focus();
    document.execCommand("insertText", false, t);
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, [text]);
  await sleep(800);
  await injectAndRun(tabId, () => {
    const btn = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label*="Send"]');
    if (btn) btn.click();
  });
}

// Wait for ChatGPT to finish responding
async function waitForGPTDone(tabId, maxAttempts = 60) {
  await sleep(4000);
  for (let i = 0; i < maxAttempts; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(2000);
  }
  await sleep(1500);
}

// Extract the generated image URL from the ChatGPT tab.
// Returns the raw src string — caller must download via urlToBase64 in service worker
// to avoid CORS failures (files.oaiusercontent.com blocks in-page fetch).
async function extractGPTImage(tabId, existingUrls = []) {
  await sleep(5000);
  let imgSrc = "";
  for (let i = 0; i < 20 && !imgSrc; i++) {
    await injectAndRun(tabId, () => {
      (document.querySelector("main") || document.body).scrollTo(0, 999999);
    }).catch(() => {});
    await sleep(2000);
    imgSrc = await injectAndRun(tabId, (existingArr) => {
      const existingSet = new Set(existingArr);
      const userImgSrcs = new Set(
        Array.from(document.querySelectorAll('[data-message-author-role="user"] img'))
          .map(img => img.currentSrc || img.src || "").filter(Boolean)
      );
      const skip = (src) => !src || src.startsWith("data:") || src.endsWith(".svg") || userImgSrcs.has(src) || existingSet.has(src);
      // Check only the last assistant message first — that's where the Turn 3 image lives
      const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      const lastMsg = assistantMsgs[assistantMsgs.length - 1];
      if (lastMsg) {
        for (const img of Array.from(lastMsg.querySelectorAll("img"))) {
          const src = img.currentSrc || img.src || "";
          if (skip(src)) continue;
          if (img.complete && img.naturalWidth > 150 && img.naturalHeight > 150) return src;
        }
      }
      // Fallback: scan full chat in reverse for any new large image
      const imgs = Array.from((document.querySelector("main") || document.body).querySelectorAll("img")).reverse();
      for (const img of imgs) {
        const src = img.currentSrc || img.src || "";
        if (skip(src)) continue;
        const natural = img.complete && img.naturalWidth > 150 && img.naturalHeight > 150;
        const rendered = img.getBoundingClientRect().width > 150;
        if (natural || rendered) return src;
      }
      return "";
    }, [existingUrls]).catch(() => "");
    if (!imgSrc) await sleep(3000);
  }
  return imgSrc || null;
}

// ── OUTFIT IMAGE: 3-TURN CHATGPT CONVERSATION ────────────────────
async function runOutfitImageMultiTurn(job, userPhotoBase64s, itemBase64Map) {
  const { activities, weather_summary, outfit_description, clean_items } = job;

  const tabId = await openTab("https://chatgpt.com/");
  await waitForTab(tabId);
  await sleep(4000);

  // Turn 1 — Send user reference photos + intro
  if (userPhotoBase64s.length > 0) {
    await attachFilesToTab(tabId, userPhotoBase64s);
    await sleep(2000);
    await sendGPTMessage(tabId,
      `I'm attaching ${userPhotoBase64s.length} photo(s) of myself from different angles. I want you to generate a realistic fashion photo of me wearing a specific outfit. Please study my face, skin tone, body, and features carefully so you can accurately portray me in the next image. Confirm you can see me.`
    );
    await waitForGPTDone(tabId);
  }

  // Turn 2 — Send clothing item images + descriptions
  const itemsWithImages = (clean_items || []).filter(i => i.image_url && itemBase64Map[i.image_url]);
  if (itemsWithImages.length > 0) {
    const itemBase64s = itemsWithImages.map(i => itemBase64Map[i.image_url]).filter(Boolean);
    await attachFilesToTab(tabId, itemBase64s);
    await sleep(2000);
    const itemList = itemsWithImages
      .map(i => `• ${i.name}${i.color ? ` (${i.color})` : ''}${i.brand ? ` by ${i.brand}` : ''} — ${i.type}`)
      .join('\n');
    await sendGPTMessage(tabId,
      `These are the clothing items I'll be wearing today. Study each piece:\n${itemList}\n\nConfirm you can see each item.`
    );
    await waitForGPTDone(tabId);
  }

  // Turn 3 — Generate the outfit image
  const subject = userPhotoBase64s.length > 0
    ? 'me (the person shown in the first photos)'
    : 'a stylish person';
  const outfitRef = itemsWithImages.length > 0
    ? `the exact clothing items shown in the previous photos as a complete outfit — ${(outfit_description || '').slice(0, 300)}`
    : (outfit_description || 'the described outfit').slice(0, 400);
  const context = [
    activities?.length ? `Activities: ${activities.join(', ')}` : '',
    weather_summary ? `Weather: ${weather_summary}` : '',
  ].filter(Boolean).join('. ');

  // Snapshot all image URLs currently in the chat before Turn 3 fires
  const existingImgUrls = await injectAndRun(tabId, () =>
    Array.from(document.querySelectorAll("img"))
      .map(img => img.currentSrc || img.src || "").filter(Boolean)
  ).catch(() => []);

  await sendGPTMessage(tabId,
    `Generate a high-quality, realistic full-body fashion photo of ${subject} wearing the complete outfit: ${outfitRef}. ${context}. Show the full outfit head to toe. Natural studio lighting, fashion editorial style, sharp detail.`
  );

  // Wait for stop to appear (image gen takes longer)
  for (let i = 0; i < 30; i++) {
    const appeared = await injectAndRun(tabId, () =>
      !!document.querySelector('[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label*="Stop"]')
    ).catch(() => false);
    if (appeared) break;
    await sleep(2000);
  }
  for (let i = 0; i < 90; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(3000);
  }

  const imgSrc = await extractGPTImage(tabId, existingImgUrls);
  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return (typeof imgSrc === "string" && imgSrc.length > 0) ? imgSrc : null;
}

// ── STYLIST PIPELINE ─────────────────────────────────────────────
async function getStyleJob() {
  // Try pending first, then pick up jobs stuck in "running" for > 5 minutes
  let res = await fetch(`${db("stylist_jobs")}?status=eq.pending&order=created_at.asc&limit=1`, { headers });
  let rows = await res.json();
  let job = rows?.[0];
  if (!job) {
    const staleTs = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    res = await fetch(`${db("stylist_jobs")}?status=eq.running&updated_at=lt.${staleTs}&order=created_at.asc&limit=1`, { headers });
    rows = await res.json();
    job = rows?.[0];
  }
  if (!job) return null;
  const claimRes = await fetch(`${db("stylist_jobs")}?id=eq.${job.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }),
  });
  const claimed = await claimRes.json();
  if (!claimed?.length) return null;
  return claimed[0];
}

async function updateStyleJob(id, fields) {
  await fetch(`${db("stylist_jobs")}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

async function runStylePipeline(job) {
  const { id, activities, weather_summary } = job;
  console.log("[stylist] starting pipeline for job", id);

  const promptTemplates = await fetchPrompts();

  // Fetch full item data from wardrobe_items (job only stores IDs)
  let clean_items = [];
  try {
    const ids = (job.clean_items || []).filter(Boolean);
    console.log("[stylist] fetching", ids.length, "wardrobe items");
    if (ids.length > 0) {
      const res = await fetch(`${db("wardrobe_items")}?id=in.(${ids.join(",")})&select=*`, { headers });
      const rows = await res.json();
      if (Array.isArray(rows)) clean_items = rows;
      console.log("[stylist] got", clean_items.length, "items from DB");
    }
  } catch (e) {
    console.error("[stylist] wardrobe fetch error:", e);
  }

  let tabId = null;
  try {
    await updateStyleJob(id, { step: "preparing" });

    // Fetch user reference photos
    let userPhotoBase64s = [];
    try {
      const photoRes = await fetch(`${db("user_photos")}?order=created_at.asc&limit=3`, { headers });
      const photoRows = await photoRes.json();
      if (Array.isArray(photoRows)) {
        for (const row of photoRows) {
          if (row.url) {
            const b64 = await urlToBase64(row.url);
            if (b64) userPhotoBase64s.push(b64);
          }
        }
      }
    } catch {}
    console.log("[stylist]", userPhotoBase64s.length, "reference photos,", clean_items.length, "items");

    // Build item list for text prompt
    const itemsList = clean_items
      .map(i => {
        let line = `- [${i.type}] ${i.name}`;
        if (i.color) line += ` (${i.color})`;
        if (i.brand) line += ` by ${i.brand}`;
        if (i.notes) line += ` — ${i.notes}`;
        return line;
      })
      .join("\n");

    const outfitPrompt = fillTemplate(promptTemplates.outfit_selection, {
      itemsList,
      activities: (activities || []).join(", "),
      weather: weather_summary || "unknown",
    });

    // ── Single ChatGPT tab for the whole pipeline ──────────────────
    console.log("[stylist] opening ChatGPT tab...");
    tabId = await openTab("https://chatgpt.com/");
    await waitForTab(tabId);
    await sleep(4000);

    // Turn 1 (optional): send user reference photos so ChatGPT can use them for image gen
    if (userPhotoBase64s.length > 0) {
      await attachFilesToTab(tabId, userPhotoBase64s);
      await sleep(2000);
      await sendGPTMessage(tabId, "These are reference photos of me — I'll use them in a moment for outfit image generation. Just acknowledge.");
      await waitForGPTDone(tabId);
      console.log("[stylist] reference photos acknowledged");
    }

    // Turn 2: outfit selection (text only)
    await updateStyleJob(id, { step: "outfit_description" });
    await sendGPTMessage(tabId, outfitPrompt);
    await waitForGPTDone(tabId);

    const description = await injectAndRun(tabId, () => {
      const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      return msgs[msgs.length - 1]?.innerText ?? "";
    }).catch(() => "");
    console.log("[stylist] outfit text:", description.slice(0, 120));
    await updateStyleJob(id, { outfit_description: description, step: "outfit_image" });

    // Find which items were selected from the bullet list
    const descLower = description.toLowerCase();
    function buildItemDetail(item) {
      let d = item.name;
      if (item.color) d += ` in ${item.color}`;
      if (item.brand) d += ` by ${item.brand}`;
      if (item.notes) d += ` (${item.notes})`;
      return d;
    }
    const selectedItems = clean_items.filter(i => descLower.includes(i.name.toLowerCase()));

    // Turn 3: send catalog images of selected items for reference
    const itemsWithImages = selectedItems.filter(i => i.image_url);
    if (itemsWithImages.length > 0) {
      const itemBase64s = [];
      for (const item of itemsWithImages) {
        const b64 = await urlToBase64(item.image_url);
        if (b64) itemBase64s.push(b64);
      }
      if (itemBase64s.length > 0) {
        await attachFilesToTab(tabId, itemBase64s);
        await sleep(2000);
        await sendGPTMessage(tabId,
          `Here are the catalog images of the ${itemBase64s.length} item${itemBase64s.length !== 1 ? "s" : ""} I selected. Study the exact colors, silhouettes, and details of each piece carefully before generating the outfit photo.`
        );
        await waitForGPTDone(tabId);
        console.log("[stylist] item images sent:", itemBase64s.length);
      }
    }

    // Build accessory detail hints for shoes/hat
    const selectedShoes = selectedItems.find(i => i.type === "Shoes");
    const selectedHat = selectedItems.find(i => i.type === "Hat");
    let accessoryDetail = "";
    if (selectedShoes) accessoryDetail += `\nSHOES: ${buildItemDetail(selectedShoes)} — render the exact silhouette, sole shape, color blocking, and any distinctive design details with photographic clarity.`;
    if (selectedHat) accessoryDetail += `\nHEADWEAR: ${buildItemDetail(selectedHat)} — render the exact shape, brim style, crown height, color, and any logos or texture with photographic clarity.`;
    if (accessoryDetail) accessoryDetail += "\nDo not substitute, blur, or generalize the footwear or headwear — these specific items must be clearly recognizable.";

    // Snapshot existing images before image gen turn
    const existingImgUrls = await injectAndRun(tabId, () =>
      Array.from(document.querySelectorAll("img")).map(img => img.currentSrc || img.src || "").filter(Boolean)
    ).catch(() => []);

    // Turn 4: generate outfit image
    const subject = userPhotoBase64s.length > 0
      ? "me (the person shown in the photos above)"
      : "a stylish person";
    await sendGPTMessage(tabId, fillTemplate(promptTemplates.outfit_image, { subject, accessoryDetail }));
    console.log("[stylist] waiting for image generation...");

    for (let i = 0; i < 30; i++) {
      const appeared = await injectAndRun(tabId, () =>
        !!document.querySelector('[data-testid="stop-button"]') || !!document.querySelector('button[aria-label*="Stop"]')
      ).catch(() => false);
      if (appeared) break;
      await sleep(2000);
    }
    for (let i = 0; i < 90; i++) {
      const done = await injectAndRun(tabId, () =>
        !document.querySelector('[data-testid="stop-button"]') && !document.querySelector('button[aria-label*="Stop"]')
      ).catch(() => true);
      if (done) break;
      await sleep(3000);
    }

    const imgSrc = await extractGPTImage(tabId, existingImgUrls);
    await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
    tabId = null;
    console.log("[stylist] imgSrc:", imgSrc ? imgSrc.slice(0, 80) : "null");

    let imageUrl = null;
    if (imgSrc) {
      const b64 = imgSrc.startsWith("data:image") ? imgSrc : await urlToBase64(imgSrc);
      if (b64) {
        try {
          const base64 = b64.split(",")[1];
          const byteChars = atob(base64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: "image/png" });
          imageUrl = await uploadToStorage(`outfits/${Date.now()}.png`, blob, "image/png");
        } catch {}
      }
      if (!imageUrl) imageUrl = imgSrc;
    }

    console.log("[stylist] complete, imageUrl:", imageUrl ? imageUrl.slice(0, 80) : "none");
    await updateStyleJob(id, { outfit_image_url: imageUrl, status: "complete", step: "complete" });
  } catch (err) {
    console.error("[stylist] pipeline error:", err.message);
    if (tabId) await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
    await updateStyleJob(id, { status: "error", error_message: err.message });
  }
}

// ── SOCIAL MEDIA HELPERS ─────────────────────────────────────────

async function getSocialJob() {
  const res = await fetch(`${db("platform_post_jobs")}?status=eq.pending&limit=1&order=created_at.asc`, { headers });
  const rows = await res.json();
  const job = rows?.[0];
  if (!job) return null;
  const claimRes = await fetch(`${db("platform_post_jobs")}?id=eq.${job.id}&status=eq.pending`, {
    method: "PATCH", headers,
    body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }),
  });
  const claimed = await claimRes.json();
  if (!claimed?.length) return null;
  return claimed[0];
}

async function updateSocialJob(id, fields) {
  await fetch(`${db("platform_post_jobs")}?id=eq.${id}`, {
    method: "PATCH", headers,
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

async function getFanJob() {
  const res = await fetch(`${db("fan_interaction_jobs")}?status=eq.pending&limit=1&order=created_at.asc`, { headers });
  const rows = await res.json();
  const job = rows?.[0];
  if (!job) return null;
  const claimRes = await fetch(`${db("fan_interaction_jobs")}?id=eq.${job.id}&status=eq.pending`, {
    method: "PATCH", headers,
    body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }),
  });
  const claimed = await claimRes.json();
  if (!claimed?.length) return null;
  return claimed[0];
}

async function updateFanJob(id, fields) {
  await fetch(`${db("fan_interaction_jobs")}?id=eq.${id}`, {
    method: "PATCH", headers,
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

// Inject a base64 file into the first visible file input on a tab
async function injectFileFromBase64(tabId, b64, mimeType, filename) {
  return await injectAndRun(tabId, (b64, mime, fname) => {
    try {
      const arr = b64.split(",");
      const bstr = atob(arr[1] || b64);
      const u8arr = new Uint8Array(bstr.length);
      for (let j = 0; j < bstr.length; j++) u8arr[j] = bstr.charCodeAt(j);
      const file = new File([u8arr], fname, { type: mime });
      const input = document.querySelector('input[type="file"]');
      if (!input) return "no_input";
      const dt = new DataTransfer();
      dt.items.add(file);
      Object.defineProperty(input, "files", { value: dt.files, writable: false });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) { return "err:" + e.message; }
  }, [b64, mimeType, filename]);
}

// ── SOUNDCLOUD UPLOAD ────────────────────────────────────────────

async function runSoundCloudUpload(job) {
  const { audio_url, title, description, tags } = job;
  const tabId = await openTab("https://soundcloud.com/upload");
  await waitForTab(tabId);
  await sleep(5000);

  const audioB64 = await urlToBase64(audio_url);
  if (!audioB64) { await chrome.tabs.remove(tabId); return null; }

  await injectFileFromBase64(tabId, audioB64, "audio/mpeg", "track.mp3");
  await sleep(10000); // wait for SC to process the upload

  // Fill title
  await injectAndRun(tabId, (t) => {
    const el = document.querySelector(".sc-input-group input[type='text']") ||
      document.querySelector("input[placeholder*='title' i]") ||
      document.querySelector("input[name='title']");
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, t);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, [title || "New Track"]);
  await sleep(500);

  // Fill tags
  if (tags) {
    await injectAndRun(tabId, (tagStr) => {
      const el = document.querySelector("input[placeholder*='tag' i]") ||
        document.querySelector(".sc-tag-input input");
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, tagStr);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }, [tags]);
    await sleep(500);
  }

  // Fill description
  if (description) {
    await injectAndRun(tabId, (desc) => {
      const el = document.querySelector("textarea[placeholder*='description' i]") ||
        document.querySelector(".sc-input[name='description']");
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, desc);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, [description]);
    await sleep(500);
  }

  // Save / Upload
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(b =>
      ["Save", "Upload", "Save track", "Publish"].some(t => b.textContent.trim().includes(t))
    );
    if (btn) btn.click();
  });

  await sleep(5000);

  const trackUrl = await injectAndRun(tabId, () => {
    const a = document.querySelector("a[href*='/tracks/']") ||
      document.querySelector(".successMessage a");
    return a?.href ?? window.location.href;
  }).catch(() => null);

  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return trackUrl;
}

// ── TIKTOK UPLOAD ────────────────────────────────────────────────

async function runTikTokUpload(job) {
  const { video_url, audio_url, title, description, tags } = job;
  const mediaUrl = video_url || audio_url;
  if (!mediaUrl) return null;

  const tabId = await openTab("https://www.tiktok.com/creator-center/upload");
  await waitForTab(tabId);
  await sleep(7000);

  const mediaB64 = await urlToBase64(mediaUrl);
  if (!mediaB64) { await chrome.tabs.remove(tabId); return null; }

  const isVideo = mediaUrl.includes(".mp4") || !!video_url;
  await injectFileFromBase64(tabId, mediaB64, isVideo ? "video/mp4" : "audio/mpeg", isVideo ? "video.mp4" : "audio.mp3");
  await sleep(15000); // TikTok takes a while to process

  const caption = [title, description, tags].filter(Boolean).join(" ").slice(0, 2200);
  await injectAndRun(tabId, (cap) => {
    const el = document.querySelector("[data-placeholder*='caption' i]") ||
      document.querySelector(".public-DraftEditor-content") ||
      document.querySelector("[contenteditable='true']");
    if (el) {
      el.focus();
      document.execCommand("insertText", false, cap);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }, [caption]);

  await sleep(2000);

  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(b =>
      ["Post", "Publish", "Upload"].includes(b.textContent.trim())
    );
    if (btn) btn.click();
  });

  await sleep(10000);
  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return null;
}

// ── INSTAGRAM UPLOAD ─────────────────────────────────────────────

async function runInstagramUpload(job) {
  const { video_url, audio_url, description, tags } = job;
  const mediaUrl = video_url || audio_url;
  if (!mediaUrl) return null;

  const tabId = await openTab("https://www.instagram.com/");
  await waitForTab(tabId);
  await sleep(5000);

  // Click the Create (+) button
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("a, button, [role='button']")).find(el =>
      (el.getAttribute("aria-label") || "").toLowerCase().includes("creat") ||
      (el.getAttribute("aria-label") || "").toLowerCase().includes("new post")
    );
    if (btn) btn.click();
  });
  await sleep(2000);

  const mediaB64 = await urlToBase64(mediaUrl);
  if (!mediaB64) { await chrome.tabs.remove(tabId); return null; }

  const isVideo = !!video_url;
  await injectFileFromBase64(tabId, mediaB64, isVideo ? "video/mp4" : "audio/mpeg", isVideo ? "video.mp4" : "audio.mp3");
  await sleep(5000);

  // Click through "Next" steps
  for (let i = 0; i < 3; i++) {
    await injectAndRun(tabId, () => {
      const btn = Array.from(document.querySelectorAll("button")).find(b =>
        ["Next", "Share"].includes(b.textContent.trim())
      );
      if (btn) btn.click();
    });
    await sleep(2500);
  }

  // Caption
  const caption = [description, tags].filter(Boolean).join(" ").slice(0, 2200);
  await injectAndRun(tabId, (cap) => {
    const el = document.querySelector("div[aria-label*='caption' i]") ||
      document.querySelector("textarea[placeholder*='caption' i]") ||
      document.querySelector("[contenteditable='true']");
    if (el) { el.focus(); document.execCommand("insertText", false, cap); }
  }, [caption]);
  await sleep(1000);

  // Share
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Share");
    if (btn) btn.click();
  });

  await sleep(8000);
  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return null;
}

// ── FACEBOOK POST ────────────────────────────────────────────────

async function runFacebookPost(job) {
  const { video_url, audio_url, title, description, tags } = job;
  const mediaUrl = video_url || audio_url;
  if (!mediaUrl) return null;

  const tabId = await openTab("https://www.facebook.com/");
  await waitForTab(tabId);
  await sleep(6000);

  // Open video composer
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("[aria-label], [role='button']")).find(el => {
      const label = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
      return label.includes("photo") || label.includes("video") || label.includes("what") ;
    });
    if (btn) btn.click();
  });
  await sleep(2000);

  const mediaB64 = await urlToBase64(mediaUrl);
  if (mediaB64) {
    const isVideo = !!video_url;
    await injectFileFromBase64(tabId, mediaB64, isVideo ? "video/mp4" : "audio/mpeg", isVideo ? "video.mp4" : "audio.mp3");
    await sleep(12000);
  }

  // Fill post text
  const postText = [title, description, tags].filter(Boolean).join(" ");
  await injectAndRun(tabId, (text) => {
    const el = document.querySelector("[contenteditable='true'][role='textbox']") ||
      document.querySelector("[data-lexical-editor='true']") ||
      document.querySelector("[aria-placeholder*='mind' i]");
    if (el) { el.focus(); document.execCommand("insertText", false, text); }
  }, [postText]);
  await sleep(1000);

  // Click Post
  await injectAndRun(tabId, () => {
    const btn = Array.from(document.querySelectorAll("div[role='button'], button")).find(el =>
      el.getAttribute("aria-label") === "Post" || el.textContent.trim() === "Post"
    );
    if (btn) btn.click();
  });

  await sleep(8000);
  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return null;
}

// ── X / TWITTER POST ─────────────────────────────────────────────

async function runTwitterPost(job) {
  const { video_url, audio_url, title, description, tags } = job;
  const tabId = await openTab("https://x.com/compose/tweet");
  await waitForTab(tabId);
  await sleep(5000);

  // Type tweet text
  const tweetText = [title, description, tags].filter(Boolean).join(" ").slice(0, 280);
  await injectAndRun(tabId, (text) => {
    const el = document.querySelector("[data-testid='tweetTextarea_0']") ||
      document.querySelector("[contenteditable='true'][role='textbox']");
    if (el) {
      el.focus();
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }, [tweetText]);

  // Attach media if available
  const mediaUrl = video_url || audio_url;
  if (mediaUrl) {
    const mediaB64 = await urlToBase64(mediaUrl);
    if (mediaB64) {
      await injectAndRun(tabId, () => {
        const btn = document.querySelector("[data-testid='attachments'] button") ||
          document.querySelector("[aria-label*='media' i]") ||
          document.querySelector("[aria-label*='photo' i]");
        if (btn) btn.click();
      });
      await sleep(1000);
      const isVideo = !!video_url;
      await injectFileFromBase64(tabId, mediaB64, isVideo ? "video/mp4" : "audio/mpeg", isVideo ? "video.mp4" : "audio.mp3");
      await sleep(8000);
    }
  }

  // Post
  await injectAndRun(tabId, () => {
    const btn = document.querySelector("[data-testid='tweetButton']") ||
      Array.from(document.querySelectorAll("button")).find(b => ["Post", "Tweet"].includes(b.textContent.trim()));
    if (btn) btn.click();
  });

  await sleep(5000);
  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return null;
}

// ── SOCIAL PIPELINE DISPATCHER ───────────────────────────────────

async function runSocialPipeline(job) {
  const { id, platform } = job;
  try {
    let postUrl = null;
    if (platform === "soundcloud") postUrl = await runSoundCloudUpload(job);
    else if (platform === "tiktok")    await runTikTokUpload(job);
    else if (platform === "instagram") await runInstagramUpload(job);
    else if (platform === "facebook")  await runFacebookPost(job);
    else if (platform === "twitter")   await runTwitterPost(job);
    await updateSocialJob(id, { status: "complete", post_url: postUrl ?? null });
  } catch (err) {
    await updateSocialJob(id, { status: "error", error_message: err.message });
  }
}

// ── FAN INTERACTION PIPELINE ─────────────────────────────────────

async function runFanInteractionPipeline(job) {
  const { persona_name, video_id } = job;

  // Fetch persona's comment_reply prompt
  let replyTemplate = `Reply to this YouTube comment as ${persona_name} — short, in character. Comment: {comment}`;
  try {
    const res = await fetch(
      `${db("artist_prompt_configs")}?persona_name=eq.${encodeURIComponent(persona_name)}&prompt_type=eq.comment_reply`,
      { headers }
    );
    const rows = await res.json();
    if (rows?.[0]?.template) replyTemplate = rows[0].template;
  } catch {}

  let commentsReplied = 0;
  let likesGiven = 0;

  const url = video_id
    ? `https://www.youtube.com/watch?v=${video_id}`
    : "https://www.youtube.com/";

  const tabId = await openTab(url);
  await waitForTab(tabId);
  await sleep(5000);

  // Scroll to load comments
  await injectAndRun(tabId, () => window.scrollTo(0, 800)).catch(() => {});
  await sleep(4000);

  // Collect up to 5 unreplied comments
  const comments = await injectAndRun(tabId, () => {
    const threads = Array.from(document.querySelectorAll("ytd-comment-thread-renderer"));
    return threads.slice(0, 5).reduce((acc, thread, idx) => {
      const textEl = thread.querySelector("#content-text");
      const hasReplied = !!thread.querySelector("ytd-comment-replies-renderer");
      if (textEl && !hasReplied) {
        acc.push({ text: textEl.textContent.trim().slice(0, 200), idx });
      }
      return acc;
    }, []);
  }).catch(() => []);

  for (const comment of (comments || []).slice(0, 3)) {
    try {
      const prompt = replyTemplate.replace("{comment}", comment.text);
      const reply = await runChatGPT(prompt);
      if (!reply || reply.length < 2) continue;

      // Click reply on this comment
      await injectAndRun(tabId, (idx) => {
        const thread = document.querySelectorAll("ytd-comment-thread-renderer")[idx];
        const btn = thread?.querySelector("#reply-button-end button, #reply-button button");
        if (btn) btn.click();
      }, [comment.idx]);
      await sleep(2000);

      // Type reply
      await injectAndRun(tabId, (idx, text) => {
        const thread = document.querySelectorAll("ytd-comment-thread-renderer")[idx];
        if (!thread) return;
        const clickTarget = thread.querySelector("#simplebox-placeholder");
        if (clickTarget) clickTarget.click();
        const editor = thread.querySelector("div[contenteditable='true']");
        if (editor) {
          editor.focus();
          document.execCommand("insertText", false, text);
          editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
      }, [comment.idx, reply.trim()]);
      await sleep(1500);

      // Submit reply
      await injectAndRun(tabId, (idx) => {
        const thread = document.querySelectorAll("ytd-comment-thread-renderer")[idx];
        const btn = thread?.querySelector("#submit-button button, yt-button-renderer#submit-button button");
        if (btn) btn.click();
      }, [comment.idx]);
      await sleep(2000);
      commentsReplied++;
    } catch {}
  }

  // Like the video
  try {
    await injectAndRun(tabId, () => {
      const btn = document.querySelector("button[aria-label*='like' i]:not([aria-label*='dislike' i])");
      if (btn && btn.getAttribute("aria-pressed") !== "true") { btn.click(); return true; }
      return false;
    });
    likesGiven++;
  } catch {}

  await new Promise(r => chrome.tabs.remove(tabId, () => r())).catch(() => {});
  return { commentsReplied, likesGiven };
}

// ── WARDROBE SPLIT PIPELINE ──────────────────────────────────────

// ── PROMPT TEMPLATE HELPERS ──────────────────────────────────────
const DEFAULT_PROMPTS = {
  wardrobe_analysis: `{{imageNote}}

CRITICAL: Identify colors by looking at the attached image — do NOT use any color mentioned in the product name or title. Amazon listings often say "Black" even when the pack contains white, red, and navy. The image is the only source of truth for color.

Return ONLY a JSON object — no markdown, no explanation.

Product type: {{productName}}
{{brandLine}}

{{focusNote}}

{
  "count": <total individual pieces in this purchase e.g. 1 for single, 7 for a 7-pack>,
  "items": [
    {
      "item_type": "<FULL garment name — never abbreviate. 'short sleeve t-shirt' stays 'short sleeve t-shirt', never 'short'. Examples: t-shirt, polo shirt, crew neck sweatshirt, athletic shorts, boxer brief, crew sock>",
      "color": "<PRIMARY BODY COLOR of the garment AS SEEN IN THE IMAGE — the dominant fabric color only. Ignore logos, text, branding, or accent colors. e.g. black, navy blue, red with white stripe>",
      "brand": "<brand or null>",
      "occasions": [<from: Casual, Work, Gym, Going Out, Date Night, Errands, Church, Travel, Formal>],
      "style_notes": "<one sentence about cut, fit, material, and any visible pattern or print>"
    }
  ]
}

Rules:
- Colors come from the image only — ignore color words in the product name
- items[] length must NEVER exceed count
- Single item → count:1, one entry
- Multi-pack same color → count:N, one entry
- Multi-pack different colors → one entry PER unique color seen in the image
- Variety pack → list each distinct color visible, items[].length must equal count`,

  wardrobe_generation: `{{referenceNote}}Generate a clean, professional catalog photograph of this exact clothing item:

Item: {{brand}}{{color}} {{item_type}}{{styleNotes}}

Requirements:
- The item type is "{{item_type}}" — read it in FULL. Do NOT abbreviate or infer a different garment. "Short sleeve t-shirt" is a T-SHIRT (upper body), not shorts. "Athletic shorts" are shorts (lower body), not a shirt. Generate exactly what is named.
- PRIMARY GARMENT COLOR is {{color}} — this is the main fabric color of the body of the garment. Ignore any logo, text, or accent colors. The whole garment should be this color.
- If style notes mention a logo or print, add it as a subtle accent — it must NOT change the primary body color
- Plain white or very light neutral background
- NO model, NO mannequin, NO person — garment only
- Flat lay, hanging, or ghost-mannequin style — whichever looks most professional for this item type
- Full item visible, sharp focus, clean retail lighting
- Quality matching a premium brand's official product page`,

  outfit_selection: `You are a personal AI stylist. Pick a complete outfit from my available clean clothes.

Available items:
{{itemsList}}

Activities today: {{activities}}
Weather: {{weather}}

Return ONLY a plain bulleted list of the items to wear — one per line, no explanations:
• [exact item name]
• [exact item name]
(include every piece: top, bottom, shoes, outerwear if needed, AND always include underwear — never omit it)`,

  outfit_image: `Now generate a high-quality, realistic full-body fashion photo of {{subject}} wearing the exact outfit items shown in the images above. Faithfully reproduce the color, cut, and style of each piece exactly as pictured. Natural studio lighting, fashion editorial style. Show the full outfit head to toe.{{accessoryDetail}}`,
};

async function fetchPrompts() {
  try {
    const res = await fetch(`${db("prompt_templates")}?select=key,body`, { headers });
    const rows = await res.json();
    const map = { ...DEFAULT_PROMPTS };
    if (Array.isArray(rows)) rows.forEach(r => { if (r.key && r.body) map[r.key] = r.body; });
    return map;
  } catch {
    return { ...DEFAULT_PROMPTS };
  }
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function getSplitJob() {
  const res = await fetch(`${db("wardrobe_split_jobs")}?status=eq.pending&limit=1`, { headers });
  const rows = await res.json();
  const job = rows?.[0];
  if (!job) return null;
  const claimRes = await fetch(`${db("wardrobe_split_jobs")}?id=eq.${job.id}&status=eq.pending`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }),
  });
  const claimed = await claimRes.json();
  if (!claimed?.length) return null;
  return claimed[0];
}

async function updateSplitJob(id, fields) {
  await fetch(`${db("wardrobe_split_jobs")}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

async function waitForImageGen(tabId) {
  for (let i = 0; i < 30; i++) {
    const appeared = await injectAndRun(tabId, () =>
      !!document.querySelector('[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label*="Stop"]')
    ).catch(() => false);
    if (appeared) break;
    await sleep(2000);
  }
  for (let i = 0; i < 90; i++) {
    const done = await injectAndRun(tabId, () =>
      !document.querySelector('[data-testid="stop-button"]') &&
      !document.querySelector('button[aria-label*="Stop"]')
    ).catch(() => true);
    if (done) break;
    await sleep(3000);
  }
}

async function extractCatalogImage(tabId) {
  await sleep(15000);
  let imgSrc = "";
  for (let i = 0; i < 40 && !imgSrc; i++) {
    await injectAndRun(tabId, () => {
      (document.querySelector("main") || document.body).scrollTo(0, 999999);
    }).catch(() => {});
    await sleep(3000);
    imgSrc = await injectAndRun(tabId, () => {
      // 1. Search the last assistant message first — that's always where the generated image lives.
      const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      const lastMsg = assistantMsgs[assistantMsgs.length - 1];
      if (lastMsg) {
        for (const img of Array.from(lastMsg.querySelectorAll('img'))) {
          const src = img.currentSrc || img.src || "";
          if (!src || src.startsWith("data:") || src.endsWith(".svg")) continue;
          if (src.includes("oaiusercontent.com")) return src;
          const natural = img.complete && img.naturalWidth > 50;
          const rendered = img.getBoundingClientRect().width > 80;
          if (natural || rendered) return src;
        }
      }
      // 2. Broad fallback — skip user-message images, accept any oaiusercontent URL.
      const userImgSrcs = new Set(
        Array.from(document.querySelectorAll('[data-message-author-role="user"] img'))
          .map(img => img.currentSrc || img.src || "").filter(Boolean)
      );
      const imgs = Array.from((document.querySelector("main") || document.body).querySelectorAll("img")).reverse();
      for (const img of imgs) {
        const src = img.currentSrc || img.src || "";
        if (!src || src.startsWith("data:") || src.endsWith(".svg")) continue;
        if (userImgSrcs.has(src)) continue;
        if (src.includes("oaiusercontent.com")) return src;
        const natural = img.complete && img.naturalWidth > 150;
        const rendered = img.getBoundingClientRect().width > 150;
        if (natural || rendered) return src;
      }
      return "";
    }).catch(() => "");
  }
  return imgSrc || null;
}

// Map a ChatGPT item_type string to a wardrobe category
function mapWardrobeType(t) {
  const s = (t || "").toLowerCase();
  if (/shirt|tee|t-shirt|top|blouse|tank|polo|henley|hoodie|sweatshirt|crewneck|sweater|vest|bra|bralette|camisole|bodysuit|jersey|tunic/.test(s)) return "Top";
  if (/pant|jean|chino|short|trouser|legging|jogger|sweatpant|skirt|brief|boxer|underwear|thong|boyshort/.test(s)) return "Bottom";
  if (/shoe|sneaker|boot|sandal|loafer|slip-on|running|trainer|heel|flat|pump|slipper|clog|mule/.test(s)) return "Shoes";
  if (/jacket|coat|puffer|windbreaker|blazer|cardigan|fleece|parka|anorak|raincoat/.test(s)) return "Outerwear";
  if (/dress|jumpsuit|romper|overall|gown|playsuit/.test(s)) return "Dress/Jumpsuit";
  if (/hat|cap|beanie|snapback|bucket|beret|visor|fedora/.test(s)) return "Hat";
  if (/bag|backpack|tote|duffel|satchel|purse|clutch|fanny/.test(s)) return "Bag";
  if (/watch|belt|wallet|sunglasses|necklace|bracelet|ring|sock|glove|scarf|tie|bowtie|suspender/.test(s)) return "Accessory";
  return "Top";
}

async function runWardrobeSplitPipeline(job) {
  const { id, source_image_url, source_image_b64, item_name, item_type, item_brand } = job;
  try {
    const promptTemplates = await fetchPrompts();
    // ── Step 1: Get the product image as base64.
    // Prefer source_image_b64 stored by the API route (no network needed).
    // Fall back to downloading source_image_url only if base64 wasn't stored.
    console.log("[split] Getting image, has stored b64:", !!source_image_b64);
    const imageB64 = source_image_b64 || await urlToBase64(source_image_url);
    console.log("[split] Image:", imageB64 ? "ready" : "unavailable — will use text-only analysis");

    // ── Step 2: ChatGPT analysis — image (if available) + product context → item breakdown
    const analysisTabId = await openTab("https://chatgpt.com/");
    await waitForTab(analysisTabId);
    await sleep(4000);

    if (imageB64) {
      await attachFilesToTab(analysisTabId, [imageB64]);
      await sleep(2000);
    }

    const productName = item_name || item_type || "clothing item";
    const categoryHint = item_type ? ` This is categorized as a "${item_type}".` : "";
    const focusNote = item_name
      ? `The product being sold is: "${item_name}".${categoryHint} Identify ONLY this specific product. If a model is wearing other clothing in the image, ignore everything except the "${item_name}". Do NOT abbreviate the item_type — e.g. "short sleeve t-shirt" must stay "short sleeve t-shirt", never just "short".`
      : item_type
        ? `Focus ONLY on the ${item_type.toLowerCase()}. Ignore any other garments visible on a model.`
        : `Focus only on the main product being sold.`;

    const analysisPrompt = fillTemplate(promptTemplates.wardrobe_analysis, {
      imageNote: imageB64 ? "I'm showing you the product listing image." : "No image available — use the product name.",
      productName,
      brandLine: item_brand ? `Brand: ${item_brand}` : "",
      focusNote,
    });

    await sendGPTMessage(analysisTabId, analysisPrompt);

    await waitForGPTDone(analysisTabId);
    const analysisText = await injectAndRun(analysisTabId, () => {
      const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      return msgs[msgs.length - 1]?.innerText ?? "";
    });
    await new Promise(r => chrome.tabs.remove(analysisTabId, () => r())).catch(() => {});
    console.log("[split] Analysis done, raw text:", analysisText?.slice(0, 200));

    // Parse the JSON response
    let parsedItems = [];
    let totalCount = 1;
    try {
      const m = analysisText.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          parsedItems = parsed.items;
          totalCount = typeof parsed.count === "number" ? Math.max(1, Math.min(20, parsed.count)) : parsedItems.length;
        }
      }
    } catch {}

    if (parsedItems.length === 0) {
      parsedItems = [{ item_type: item_type ?? "clothing item", color: "unknown", brand: item_brand ?? null, occasions: ["Casual"], style_notes: "" }];
    }
    // Never generate more unique images than the total item count
    if (parsedItems.length > totalCount) parsedItems = parsedItems.slice(0, totalCount);
    // If totalCount=1 and analysis still returned multiple items (e.g. saw logo color as a
    // second item), collapse to the first — it's one garment, not a multi-pack.
    if (totalCount === 1 && parsedItems.length > 1) parsedItems = [parsedItems[0]];
    console.log("[split] Parsed", parsedItems.length, "unique items, total count:", totalCount);

    // ── Step 3: For each unique item, generate catalog image ──────────
    // If parsedItems has 1 entry but count > 1 → same-color pack (generate 1 image, add N entries)
    const resultItems = [];

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      console.log(`[split] Generating image ${i + 1}/${parsedItems.length}:`, item.color, item.item_type);

      const imgTabId = await openTab("https://chatgpt.com/");
      await waitForTab(imgTabId);
      await sleep(4000);

      // Attach original product image so generation can match exact colors, patterns, textures
      if (imageB64) {
        await attachFilesToTab(imgTabId, [imageB64]);
        await sleep(2000);
      }

      const brandStr = item.brand ? `${item.brand} ` : "";
      const styleNotes = item.style_notes ? ` Style details: ${item.style_notes}.` : "";
      const referenceNote = imageB64
        ? `I've attached the original product listing photo. Study it carefully — identify the PRIMARY BODY COLOR of the ${item.item_type || "garment"} (the dominant fabric color, NOT logos or branding). Now generate a new clean catalog image of just this exact item on a plain white background, faithfully reproducing its color and details.\n\n`
        : "";

      const generationPrompt = fillTemplate(promptTemplates.wardrobe_generation, {
        brand: brandStr,
        color: cap(item.color) || "unknown",
        item_type: item.item_type || "clothing item",
        styleNotes,
        referenceNote,
      });

      await sendGPTMessage(imgTabId, generationPrompt);

      await waitForImageGen(imgTabId);
      const imgSrc = await extractCatalogImage(imgTabId);
      await new Promise(r => chrome.tabs.remove(imgTabId, () => r())).catch(() => {});

      // ── Debug: record what was found at each step ──────────────────
      const dbg = { imgSrc: imgSrc ? imgSrc.slice(0, 120) : "NULL" };

      let imageUrl = null;
      if (imgSrc) {
        const imgB64 = await urlToBase64(imgSrc);
        dbg.b64 = imgB64 ? `OK len=${imgB64.length}` : "FAILED";
        if (imgB64) {
          await chrome.storage.local.set({ __uploadErr: "" });
          try {
            const base64 = imgB64.split(",")[1];
            const byteChars = atob(base64);
            const byteArr = new Uint8Array(byteChars.length);
            for (let j = 0; j < byteChars.length; j++) byteArr[j] = byteChars.charCodeAt(j);
            const blob = new Blob([byteArr], { type: "image/png" });
            imageUrl = await uploadToStorage(`wardrobe-items/${Date.now()}-${i}.png`, blob, "image/png");
          } catch (e) { dbg.uploadEx = e.message; }
          const stored = await chrome.storage.local.get(["__uploadErr"]);
          if (stored.__uploadErr) dbg.uploadErr = stored.__uploadErr;
        }
        dbg.imageUrl = imageUrl ? imageUrl.slice(0, 80) : "FAILED";
        if (!imageUrl) imageUrl = imgSrc;
      }
      await updateSplitJob(id, { item_notes: JSON.stringify(dbg) });

      const wardrobeType = mapWardrobeType(item.item_type);
      const itemName = `${brandStr}${cap(item.item_type)} — ${cap(item.color)}`;

      // How many wardrobe entries per unique color:
      // - 1 item, count 3 (same-color 3-pack) → 3 entries
      // - 3 items, count 6 (2-each-of-3-colors) → 2 entries per color
      // - 3 items, count 3 (1-each-of-3-colors) → 1 entry per color
      const perItem = parsedItems.length > 1 ? Math.round(totalCount / parsedItems.length) : totalCount;
      const entriesForThisItem = perItem > 1 ? perItem : 1;
      for (let k = 0; k < entriesForThisItem; k++) {
        resultItems.push({
          name: entriesForThisItem > 1 ? `${itemName} (${k + 1}/${entriesForThisItem})` : itemName,
          type: wardrobeType,
          color: cap(item.color),
          brand: item.brand || null,
          occasions: Array.isArray(item.occasions) ? item.occasions : ["Casual"],
          image_url: imageUrl,
        });
      }
    }

    await updateSplitJob(id, { status: "complete", result_items: resultItems });
  } catch (err) {
    await updateSplitJob(id, { status: "error", error_message: err.message });
  }
}

// ── ALARM POLLING ─────────────────────────────────────────────────
chrome.alarms.create("poll",         { periodInMinutes: 0.1 }); // every 6 seconds
chrome.alarms.create("stylist-poll", { periodInMinutes: 0.1 });
chrome.alarms.create("split-poll",   { periodInMinutes: 0.1 });
chrome.alarms.create("social-poll",  { periodInMinutes: 0.1 }); // every 6 seconds
chrome.alarms.create("fan-poll",     { periodInMinutes: 0.5 }); // every 30 seconds

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // ── Social media posting pipeline ────────────────────────────────
  if (alarm.name === "social-poll") {
    const { socialRunning } = await chrome.storage.local.get(["socialRunning"]);
    if (socialRunning) return;
    await chrome.storage.local.set({ socialRunning: true });
    try {
      const job = await getSocialJob();
      if (job) await runSocialPipeline(job);
    } catch {}
    await chrome.storage.local.set({ socialRunning: false });
    return;
  }

  // ── Fan interaction pipeline ─────────────────────────────────────
  if (alarm.name === "fan-poll") {
    const { fanRunning } = await chrome.storage.local.get(["fanRunning"]);
    if (fanRunning) return;
    await chrome.storage.local.set({ fanRunning: true });
    try {
      const job = await getFanJob();
      if (job) {
        const result = await runFanInteractionPipeline(job);
        await updateFanJob(job.id, {
          status: "complete",
          comments_replied: result?.commentsReplied ?? 0,
          likes_given: result?.likesGiven ?? 0,
        });
      }
    } catch (err) {
      try {
        const { fanCurrentJob } = await chrome.storage.local.get(["fanCurrentJob"]);
        if (fanCurrentJob) await updateFanJob(fanCurrentJob, { status: "error", error_message: err.message });
      } catch {}
    }
    await chrome.storage.local.set({ fanRunning: false });
    return;
  }

  // ── Stylist pipeline (independent lock) ──────────────────────────
  if (alarm.name === "stylist-poll") {
    if (stylistRunning) return;
    stylistRunning = true;
    try {
      const job = await getStyleJob();
      console.log("[stylist-poll] job=", job?.id ?? "none");
      if (job) await runStylePipeline(job);
    } catch (err) {
      console.error("[stylist-poll] error:", err);
    }
    stylistRunning = false;
    return;
  }

  // ── Wardrobe split pipeline ───────────────────────────────────────
  if (alarm.name === "split-poll") {
    const { splitRunning, splitRunningStarted } = await chrome.storage.local.get(["splitRunning", "splitRunningStarted"]);
    // Watchdog: auto-reset if stuck for more than 8 minutes
    if (splitRunning) {
      const staleMs = Date.now() - (splitRunningStarted ?? 0);
      if (staleMs > 8 * 60 * 1000) {
        console.log("[split-poll] watchdog: resetting stuck splitRunning after", Math.round(staleMs / 1000), "s");
        await chrome.storage.local.set({ splitRunning: false, splitRunningStarted: null });
      } else {
        console.log("[split-poll] tick, splitRunning= true for", Math.round(staleMs / 1000), "s");
        return;
      }
    }
    await chrome.storage.local.set({ splitRunning: true, splitRunningStarted: Date.now() });
    try {
      const job = await getSplitJob();
      console.log("[split-poll] job=", job?.id ?? "none");
      if (job) await runWardrobeSplitPipeline(job);
    } catch (err) {
      console.error("[split-poll] error:", err);
    }
    await chrome.storage.local.set({ splitRunning: false, splitRunningStarted: null });
    return;
  }

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
  if (job.track_theme === "__album_gen__") {
    await runAlbumGen(job);
  } else if (job.track_theme === "__playlist_gen__") {
    await runPlaylistGen(job);
  } else {
    await runPipeline(job);
  }
  await chrome.storage.local.set({ running: false, currentJob: null, step: null });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll",         { periodInMinutes: 0.1 });
  chrome.alarms.create("stylist-poll", { periodInMinutes: 0.1 });
  chrome.alarms.create("split-poll",   { periodInMinutes: 0.1 });
  chrome.alarms.create("social-poll",  { periodInMinutes: 0.1 });
  chrome.alarms.create("fan-poll",     { periodInMinutes: 0.5 });
});
