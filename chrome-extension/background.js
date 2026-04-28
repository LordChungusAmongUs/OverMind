const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForTabLoad(tabId, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timed out"));
    }, timeout);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function runPayrollJob(port) {
  const sendLog = (log, status = "running") => {
    try { port.postMessage({ action: "payroll:log", log, status }); } catch (_) {}
  };

  try {
    await _runPayrollJob(sendLog);
  } catch (err) {
    sendLog(`Fatal error: ${err.message}`, "error");
  }
}

async function _runPayrollJob(sendLog) {
  sendLog("Opening FigurePOS in a new tab...");

  const tab = await chrome.tabs.create({ url: "https://app.figurepos.com/login" });
  const tabId = tab.id;

  await waitForTabLoad(tabId);
  await sleep(1000);

  const [{ result: currentUrl }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.location.href,
  });
  sendLog(`Login page: ${currentUrl}`);

  sendLog("Searching all frames for email field...");
  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const el =
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[name="email"]') ||
        document.querySelector('input[name="username"]') ||
        document.querySelector('input[autocomplete="email"]') ||
        document.querySelector('input[autocomplete="username"]') ||
        document.querySelector('input[placeholder*="email" i]') ||
        document.querySelector('input[placeholder*="user" i]') ||
        document.querySelector('input[type="text"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        frameUrl: window.location.href,
      };
    },
  });

  const emailResult = frameResults.find((r) => r.result !== null);
  if (!emailResult?.result) {
    sendLog("ERROR: No email field found on login page.", "error");
    return;
  }

  const stored = await chrome.storage.local.get("figurepos");
  if (!stored.figurepos?.password) {
    sendLog("ERROR: No FigurePOS password saved. Enter it in the Credentials card first.", "error");
    return;
  }

  const { email, password } = stored.figurepos;
  sendLog("Filling login form...");

  // Step 1: fill fields
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    args: [email, password],
    func: (em, pw) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

      const emailInput =
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[name="email"]') ||
        document.querySelector('input[name="username"]') ||
        document.querySelector('input[autocomplete="email"]') ||
        document.querySelector('input[autocomplete="username"]') ||
        document.querySelector('input[placeholder*="email" i]') ||
        document.querySelector('input[type="text"]');

      const pwInput = document.querySelector('input[type="password"]');

      if (emailInput) {
        setter.call(emailInput, em);
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
        emailInput.dispatchEvent(new Event("blur", { bubbles: true }));
      }
      if (pwInput) {
        setter.call(pwInput, pw);
        pwInput.dispatchEvent(new Event("input", { bubbles: true }));
        pwInput.dispatchEvent(new Event("change", { bubbles: true }));
        pwInput.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    },
  });

  // Step 2: wait for React to process, then click submit
  await sleep(800);

  const [{ result: submitResult }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const submit =
        document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.trim().toLowerCase();
          return t === "log in" || t === "login" || t === "sign in" || t === "continue";
        });
      if (!submit) return "no-button";
      submit.click();
      return submit.textContent?.trim() || "clicked";
    },
  });

  sendLog(`Submit button: "${submitResult}" — waiting for dashboard...`);

  await waitForTabLoad(tabId);
  await sleep(1000);
  sendLog("Waiting for dashboard to appear...");

  let loggedIn = false;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const text = document.body?.innerText ?? "";
          return {
            hasPassword: !!document.querySelector('input[type="password"]'),
            hasManagement:
              text.toLowerCase().includes("reports") ||
              text.toLowerCase().includes("timesheets"),
          };
        },
      });
      if (!result.hasPassword && result.hasManagement) {
        loggedIn = true;
        break;
      }
    } catch (_) {}
  }

  if (!loggedIn) {
    sendLog("ERROR: Login timed out — check credentials.", "error");
    return;
  }

  sendLog("Dashboard detected — letting app settle...");
  await sleep(3000);

  try {
    sendLog("Navigating to Timesheets...");
    await chrome.tabs.update(tabId, { url: "https://app.figurepos.com/reports/timesheet" });
    await waitForTabLoad(tabId);
    await sleep(1500);

    // Bring the FigurePOS tab into focus so you can see the result
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });

    const [{ result: finalUrl }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.location.href,
    });
    sendLog(`Landed on: ${finalUrl}`);

    if (!finalUrl.includes("timesheet")) {
      sendLog(`App redirected to: ${finalUrl} — may need longer settle time`, "error");
      return;
    }

    sendLog("Timesheets page loaded!");

    // Calculate pay period: Friday–Thursday ending on most recent Thursday
    const { startLabel, endLabel, startM, startD, startY, endM, endD, endY } = (() => {
      const today = new Date();
      const daysSinceThursday = (today.getDay() - 4 + 7) % 7;
      const thursday = new Date(today);
      thursday.setDate(today.getDate() - daysSinceThursday);
      const friday = new Date(thursday);
      friday.setDate(thursday.getDate() - 6);
      const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      return {
        startLabel: fmt(friday),
        endLabel: fmt(thursday),
        startM: friday.getMonth() + 1,
        startD: friday.getDate(),
        startY: friday.getFullYear(),
        endM: thursday.getMonth() + 1,
        endD: thursday.getDate(),
        endY: thursday.getFullYear(),
      };
    })();

    sendLog(`Pay period: ${startLabel} → ${endLabel}`);
    sendLog("Looking for calendar icon...");

    // Click the calendar / date-range trigger
    const [{ result: calClicked }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [],
      func: () => {
        // Common patterns for date range pickers
        const btn =
          document.querySelector('[aria-label*="date" i]') ||
          document.querySelector('[aria-label*="calendar" i]') ||
          document.querySelector('[aria-label*="range" i]') ||
          document.querySelector('button[class*="date" i]') ||
          document.querySelector('button[class*="calendar" i]') ||
          document.querySelector('input[placeholder*="date" i]') ||
          // SVG calendar icons are usually inside a button — grab the button
          (() => {
            const svgs = Array.from(document.querySelectorAll("svg"));
            const calSvg = svgs.find((s) => {
              const u = s.querySelector("use");
              const title = s.querySelector("title");
              return (
                s.getAttribute("aria-label")?.toLowerCase().includes("calendar") ||
                title?.textContent?.toLowerCase().includes("calendar") ||
                u?.getAttribute("href")?.toLowerCase().includes("calendar")
              );
            });
            return calSvg?.closest("button") || calSvg;
          })();
        if (!btn) return "not-found";
        btn.click();
        return btn.tagName + (btn.className ? "." + btn.className.trim().split(" ")[0] : "");
      },
    });

    sendLog(`Calendar trigger: ${calClicked}`);

    if (calClicked === "not-found") {
      sendLog("Could not find calendar icon — send a screenshot of the Timesheets page.", "error");
      return;
    }

    await sleep(800);

    // Type directly into the MM/DD/YYYY input fields using execCommand (simulates real typing)
    const [{ result: fillResult }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [startLabel, endLabel],
      func: (start, end) => {
        const inputs = Array.from(document.querySelectorAll('input[placeholder="MM/DD/YYYY"]'));
        if (inputs.length < 2) return `only ${inputs.length} MM/DD/YYYY inputs found`;

        function typeInto(input, value) {
          input.focus();
          input.select();
          const ok = document.execCommand("insertText", false, value);
          if (!ok) {
            // execCommand fallback via native setter
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
            setter.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          input.blur();
        }

        // Try the last two inputs first (dialog inputs render after page inputs)
        const pair = inputs.length >= 4 ? inputs.slice(-2) : inputs.slice(0, 2);
        typeInto(pair[0], start);
        typeInto(pair[1], end);
        return `typed into inputs[-2] and inputs[-1]: ${start} → ${end} (${inputs.length} total found)`;
      },
    });
    sendLog(`Date fields: ${fillResult}`);

    await sleep(600);

    // Click "Apply Dates"
    const [{ result: applyResult }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.trim().toLowerCase().includes("apply")
        );
        if (!btn) return "not-found";
        if (btn.disabled) return "disabled — dates not accepted yet";
        btn.click();
        return `clicked: "${btn.textContent?.trim()}"`;
      },
    });
    if (!applyResult.startsWith("clicked")) {
      sendLog(`Apply Dates: ${applyResult}`, "error");
      return;
    }
    sendLog(`Apply Dates: ${applyResult}`);

    // Wait for page to re-render with the filtered date range
    await sleep(2500);
    sendLog("Scraping timesheet data...");

    const [{ result: rawLines }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const main = document.querySelector("main") ||
                     document.querySelector('[class*="content" i]') ||
                     document.body;
        return main.innerText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .slice(0, 200)
          .join("\n");
      },
    });

    // ── Parse ────────────────────────────────────────────────────────────
    const lines = rawLines.split("\n");

    // Common role keywords — extend as needed
    const ROLE_KEYWORDS = [
      "server", "kitchen", "host", "hostess", "manager", "bartender",
      "cook", "cashier", "dishwasher", "prep", "expo", "busser", "bar",
    ];
    const HOURS_RE = /^(\d+\.\d+)$/;           // decimal hours cell e.g. "6.50"
    const TIME_RE  = /^\d{1,2}:\d{2}\s*(am|pm)/i; // time-of-day cell
    const NAME_SKIP = /^(search|all|clock|edit|\+|shift|today|yesterday|this|last|apply|cancel|reports|timesheet|management|employee|department|position|role|date|in|out|total|hours|week|filter)/i;

    const employees = {}; // { name: { serverShifts: [{role,hours}], otherShifts: [{role,hours}] } }
    let current = null;
    let pendingRole = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect employee name: not a number, not a role keyword, not a UI label,
      // and reasonably short (2–40 chars). Adjust heuristics based on output.
      const isRole = ROLE_KEYWORDS.some((r) => line.toLowerCase().startsWith(r));
      const isHours = HOURS_RE.test(line);
      const isTime  = TIME_RE.test(line);
      const isSkip  = NAME_SKIP.test(line);
      const looksLikeName = !isRole && !isHours && !isTime && !isSkip &&
                            line.length >= 2 && line.length <= 45 &&
                            !/^\d/.test(line) && /[a-z]/i.test(line);

      if (looksLikeName && !current) {
        current = line;
        employees[current] = employees[current] || { serverShifts: [], otherShifts: [] };
        pendingRole = null;
        continue;
      }

      if (isRole) { pendingRole = line; continue; }

      if (isHours && pendingRole && current) {
        const hours = parseFloat(line);
        const isServer = pendingRole.toLowerCase().includes("server");
        if (isServer) {
          employees[current].serverShifts.push({ role: pendingRole, hours });
        } else {
          employees[current].otherShifts.push({ role: pendingRole, hours });
        }
        pendingRole = null;
        continue;
      }

      // A new name can follow once we've seen at least one shift or a blank signal
      if (looksLikeName && current && (employees[current].serverShifts.length + employees[current].otherShifts.length > 0)) {
        current = line;
        employees[current] = employees[current] || { serverShifts: [], otherShifts: [] };
        pendingRole = null;
      }
    }

    // ── Format & log results ────────────────────────────────────────────
    const names = Object.keys(employees);
    if (names.length === 0) {
      // Parser didn't match — dump raw lines so structure can be inspected
      sendLog("Parser found 0 employees. Raw page sample:");
      for (const chunk of lines.slice(0, 60)) sendLog("  " + chunk);
      sendLog("Paste the above to fix the parser.", "error");
      return;
    }

    sendLog(`Found ${names.length} employee(s):`);
    for (const name of names) {
      const emp = employees[name];
      const serverTotal = emp.serverShifts.reduce((s, x) => s + x.hours, 0);
      const otherTotal  = emp.otherShifts.reduce((s, x) => s + x.hours, 0);
      const otherRoles  = [...new Set(emp.otherShifts.map((x) => x.role))].join(", ");

      sendLog(`▸ ${name}`);
      for (const s of emp.serverShifts) {
        sendLog(`    Server: ${s.hours.toFixed(2)}h`);
      }
      if (otherTotal > 0) {
        sendLog(`    Other (${otherRoles}): ${otherTotal.toFixed(2)}h`);
      }
      if (serverTotal + otherTotal === 0) {
        sendLog(`    (no shifts parsed)`);
      }
    }

    sendLog("Timesheet scrape complete.", "done");
  } catch (err) {
    sendLog(`Navigation error: ${err.message}`, "error");
  }
}

// Persistent port keeps the service worker alive for the full payroll job
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "payroll") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "start") runPayrollJob(port);
    });
  }
});

// One-off message for saving credentials
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveCredentials") {
    chrome.storage.local.set({ figurepos: message.data }, () => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: "credentialsSaved" });
      }
    });
    sendResponse({ ok: true });
  }
});
