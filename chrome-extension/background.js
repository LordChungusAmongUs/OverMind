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

    // Virtual-scroll accumulator — extract at each scroll position, merge by name
    sendLog("Scanning all employees (virtual scroll)...");

    // Inline extractor: returns employee objects currently in the DOM
    const EXTRACTOR = () => {
      const out = [];
      const NAME_SKIP = /^(clock|payable|position|total|hours|break|location|cost|rate|search|edit|\+|shift|in|out)$/i;

      function findName(table) {
        const spinWrapper = table.closest(".ant-spin-nested-loading") ||
                            table.closest(".ant-spin-container")?.parentElement;
        const start = spinWrapper || table;
        let el = start;
        for (let depth = 0; depth < 10; depth++) {
          const parent = el.parentElement;
          if (!parent) break;
          const siblings = Array.from(parent.children);
          const idx = siblings.indexOf(el);
          for (let i = idx - 1; i >= 0; i--) {
            const sib = siblings[i];
            if (sib.tagName === "TABLE") continue;
            const lines = (sib.innerText || "").split("\n").map((l) => l.trim());
            const name = lines.find(
              (l) => l.length >= 2 && l.length <= 60 && /[a-zA-Z]/.test(l) && !NAME_SKIP.test(l)
            );
            if (name) return name;
          }
          el = parent;
        }
        return null;
      }

      for (const table of Array.from(document.querySelectorAll("table"))) {
        const headerRow = table.querySelector("thead tr") || table.querySelector("tr:first-child");
        if (!headerRow) continue;
        const headers = Array.from(headerRow.querySelectorAll("th,td")).map((c) => c.innerText.trim().toLowerCase());
        const ci = (kw) => headers.findIndex((h) => h.includes(kw));
        const iClockIn = ci("clock in"), iClockOut = ci("clock out");
        const iPayable = ci("payable"), iPosition = ci("position");
        if (iPayable < 0 || iPosition < 0) continue;

        const name = findName(table) || "Unknown";
        const shifts = [];
        for (const row of Array.from(table.querySelectorAll("tbody tr, tr:not(:first-child)"))) {
          const cells = Array.from(row.querySelectorAll("td"));
          if (!cells.length) continue;
          const ft = cells[0]?.innerText?.trim().toLowerCase();
          if (ft === "totals" || ft === "total") continue;
          const payable = cells[iPayable]?.innerText?.trim();
          if (!payable) continue;
          shifts.push({
            clockIn:  iClockIn  >= 0 ? cells[iClockIn]?.innerText?.trim()  : "",
            clockOut: iClockOut >= 0 ? cells[iClockOut]?.innerText?.trim() : "",
            payable,
            position: cells[iPosition]?.innerText?.trim() || "",
          });
        }
        if (shifts.length) out.push({ name, shifts });
      }
      return JSON.stringify(out);
    };

    // Scroll the virtual list container (no class, scrollH>>clientH, not ant-table)
    const SCROLL_AND_CHECK = () => {
      function findContainer() {
        const tbl = Array.from(document.querySelectorAll("table")).find((t) => {
          const hs = Array.from(t.querySelectorAll("th,thead td")).map((c) => c.innerText.toLowerCase());
          return hs.some((h) => h.includes("payable"));
        });
        if (!tbl) return null;
        let el = tbl.parentElement;
        while (el && el !== document.documentElement) {
          const oy = window.getComputedStyle(el).overflowY;
          const cls = (el.className || "").toString();
          if ((oy === "auto" || oy === "scroll") && el.scrollHeight > 800 && !cls.includes("ant-table")) {
            return el;
          }
          el = el.parentElement;
        }
        return null;
      }
      const c = findContainer();
      if (!c) { window.scrollBy(0, 400); return { atBottom: false }; }
      const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
      c.scrollTop += c.clientHeight;
      return { atBottom, scrollTop: c.scrollTop, scrollH: c.scrollHeight };
    };

    const allEmployees = {}; // name → { name, shifts } — accumulated across positions
    let stableRounds = 0;
    const MAX_ROUNDS = 80;

    for (let round = 0; round < MAX_ROUNDS && stableRounds < 4; round++) {
      // Extract what's visible right now
      const [{ result: chunkJson }] = await chrome.scripting.executeScript({ target: { tabId }, func: EXTRACTOR });
      const chunk = (() => { try { return JSON.parse(chunkJson); } catch { return []; } })();

      let newCount = 0;
      for (const emp of chunk) {
        if (!allEmployees[emp.name]) { allEmployees[emp.name] = emp; newCount++; }
      }
      if (newCount > 0) {
        sendLog(`Found ${Object.keys(allEmployees).length} employees so far...`);
        stableRounds = 0;
      } else {
        stableRounds++;
      }

      // Scroll to next position
      const [{ result: scrollResult }] = await chrome.scripting.executeScript({ target: { tabId }, func: SCROLL_AND_CHECK });
      if (scrollResult?.atBottom) stableRounds = Math.max(stableRounds, 2);
      await sleep(3000);
    }

    const parsed = Object.values(allEmployees);
    sendLog(`Extraction complete — ${parsed.length} unique employee(s).`);

    if (!parsed.length) {
      sendLog("No employee data captured.", "error");
      return;
    }

    sendLog(`Processing ${parsed.length} employee(s)...`);

    const csvRows = ["employee,server_hours,other_hours,other_breakdown,grand_total"];

    for (const emp of parsed) {
      const serverShifts = [];
      const otherByRole  = {}; // role → total hours

      let blankPosition = false;

      for (const shift of emp.shifts) {
        if (!shift.position) { blankPosition = true; break; }
        const hrs = parseFloat(shift.payable) || 0;
        if (shift.position.toLowerCase() === "server") {
          serverShifts.push({ ...shift, hrs });
        } else {
          otherByRole[shift.position] = (otherByRole[shift.position] || 0) + hrs;
        }
      }

      if (blankPosition) {
        sendLog(`⚠ ${emp.name}: blank Position on a shift — stopping.`, "error");
        return;
      }

      const serverTotal = serverShifts.reduce((s, x) => s + x.hrs, 0);
      const otherTotal  = Object.values(otherByRole).reduce((s, x) => s + x, 0);
      const grandTotal  = serverTotal + otherTotal;

      // Per-employee detail
      sendLog(`▸ ${emp.name}`);
      sendLog(`    Shifts:`);
      for (const s of emp.shifts) {
        const hrs = parseFloat(s.payable) || 0;
        sendLog(`      ${s.clockIn} – ${s.clockOut}   ${s.position}   ${hrs.toFixed(2)}h`);
      }
      sendLog(`    Totals:`);
      sendLog(`      Server: ${serverTotal.toFixed(2)} hrs`);
      const otherBreakdown = Object.entries(otherByRole).map(([r, h]) => `${r}: ${h.toFixed(2)}`).join("; ");
      sendLog(`      Other:  ${otherTotal.toFixed(2)} hrs   (${otherBreakdown || "none"})`);
      sendLog(`      Grand:  ${grandTotal.toFixed(2)} hrs`);

      // CSV row
      csvRows.push(
        `"${emp.name}",${serverTotal.toFixed(2)},${otherTotal.toFixed(2)},"${otherBreakdown}",${grandTotal.toFixed(2)}`
      );
    }

    sendLog("── CSV SUMMARY ──");
    for (const row of csvRows) sendLog(row);

    sendLog("Timesheet scrape complete.");

    sendLog("Closing FigurePOS tab...");
    await chrome.tabs.remove(tabId);
    await sleep(500);

    sendLog("Opening Payroll Solutions...");
    const payrollTab = await chrome.tabs.create({ url: "https://www.payrollsolutions.com" });
    await waitForTabLoad(payrollTab.id, 30000);
    await sleep(2000);
    const payrollTabInfo = await chrome.tabs.get(payrollTab.id);
    await chrome.tabs.update(payrollTab.id, { active: true });
    await chrome.windows.update(payrollTabInfo.windowId, { focused: true });
    // Poll for the Asure Central button to appear (SPA may render it late)
    sendLog("Waiting for Asure Central button...");
    let asureInfo = null;
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: payrollTab.id, allFrames: false },
        func: () => {
          const el = Array.from(document.querySelectorAll("*")).find((e) => {
            const t = e.textContent?.trim();
            return t?.toLowerCase() === "asure central" || t?.toLowerCase() === "asure central";
          });
          if (!el) return null;
          const anchor = el.tagName === "A" ? el : el.closest("a");
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: el.textContent?.trim(),
            href: anchor?.href || null,
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2),
          };
        },
      });
      if (result) { asureInfo = result; break; }
      sendLog(`  waiting... (${i + 1}s)`);
    }

    if (!asureInfo) {
      sendLog("Could not find 'Asure Central' button after 15s — check payrollsolutions.com.", "error");
      return;
    }

    sendLog(`Found: ${asureInfo.tag} "${asureInfo.text}" href=${asureInfo.href} at (${asureInfo.x}, ${asureInfo.y})`);

    // Use debugger to simulate a real mouse click at the button's coordinates
    await chrome.debugger.attach({ tabId: payrollTab.id }, "1.3");
    await chrome.debugger.sendCommand({ tabId: payrollTab.id }, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: asureInfo.x, y: asureInfo.y,
      button: "left", clickCount: 1,
    });
    await chrome.debugger.sendCommand({ tabId: payrollTab.id }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: asureInfo.x, y: asureInfo.y,
      button: "left", clickCount: 1,
    });
    await chrome.debugger.detach({ tabId: payrollTab.id });
    sendLog("Clicked Asure Central — waiting for login page...");

    // Wait for the tab to navigate away from payrollsolutions.com
    let asureTabId = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const tab = await chrome.tabs.get(payrollTab.id);
      sendLog(`  tab url: ${tab.url}`);
      if (tab.url && !tab.url.includes("payrollsolutions.com") && !tab.url.startsWith("chrome")) {
        asureTabId = payrollTab.id;
        await waitForTabLoad(payrollTab.id, 20000);
        break;
      }
    }

    // Also check if a new tab opened instead
    if (!asureTabId) {
      const allTabs = await chrome.tabs.query({});
      const found = allTabs.find((t) =>
        t.url?.includes("asurehcm.com") || t.url?.includes("authentication.identity")
      );
      if (found) {
        asureTabId = found.id;
        await waitForTabLoad(asureTabId, 20000);
      }
    }

    if (!asureTabId) {
      sendLog("Timed out — page did not navigate away from payrollsolutions.com.", "error");
      return;
    }

    const asureTabInfo = await chrome.tabs.get(asureTabId);
    sendLog(`Asure tab URL: ${asureTabInfo.url}`);
    await chrome.tabs.update(asureTabId, { active: true });

    sendLog("Asure Central login page ready — entering username...");
    await sleep(2000);

    // Poll for the username field to appear (OAuth pages render the form async)
    let usernameResult = "not-found";
    for (let i = 0; i < 10; i++) {
      const frames = await chrome.scripting.executeScript({
        target: { tabId: asureTabId, allFrames: true },
        func: (username) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          const input =
            document.querySelector('input[name="username"]') ||
            document.querySelector('input[id*="username" i]') ||
            document.querySelector('input[name="email"]') ||
            document.querySelector('input[type="email"]') ||
            document.querySelector('input[autocomplete="username"]') ||
            document.querySelector('input[placeholder*="user" i]') ||
            document.querySelector('input[placeholder*="email" i]') ||
            document.querySelector('input[type="text"]');
          if (!input) return "not-found";
          input.focus();
          setter.call(input, username);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.blur();
          return `filled: name="${input.name}" id="${input.id}" type="${input.type}"`;
        },
        args: ["Stephen.Owens"],
      });
      const hit = frames.find((f) => f.result && f.result !== "not-found");
      if (hit) { usernameResult = hit.result; break; }
      sendLog(`  waiting for username field... (${i + 1}s)`);
      await sleep(1000);
    }

    sendLog(`Username field: ${usernameResult}`);

    if (usernameResult === "not-found") {
      sendLog("Could not find username input on Asure login page.", "error");
      return;
    }

    sendLog("Username entered — clicking Continue...");
    await sleep(500);

    const [{ result: continueResult }] = await chrome.scripting.executeScript({
      target: { tabId: asureTabId },
      func: () => {
        const btn =
          document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll("button")).find((b) => {
            const t = b.textContent?.trim().toLowerCase();
            return t === "continue" || t === "next" || t === "sign in" || t === "log in";
          });
        if (!btn) return "not-found";
        btn.click();
        return `clicked: "${btn.textContent?.trim()}"`;
      },
    });

    sendLog(`Continue button: ${continueResult}`);

    if (continueResult === "not-found") {
      sendLog("Could not find Continue button.", "error");
      return;
    }

    sendLog("Continue clicked — waiting for password field...");

    let passwordResult = "not-found";
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const frames = await chrome.scripting.executeScript({
        target: { tabId: asureTabId, allFrames: true },
        func: (pw) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          const input = document.querySelector('input[type="password"]');
          if (!input) return "not-found";
          input.focus();
          setter.call(input, pw);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.blur();
          return `filled: name="${input.name}" id="${input.id}"`;
        },
        args: ["Stevenpwns1337!"],
      });
      const hit = frames.find((f) => f.result && f.result !== "not-found");
      if (hit) { passwordResult = hit.result; break; }
      sendLog(`  waiting for password field... (${i + 1}s)`);
    }

    sendLog(`Password field: ${passwordResult}`);

    if (passwordResult === "not-found") {
      sendLog("Could not find password input.", "error");
      return;
    }

    sendLog("Password entered.", "done");
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

// One-off messages for credentials
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveCredentials") {
    chrome.storage.local.set({ figurepos: message.data }, () => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: "credentialsSaved" });
      }
    });
    sendResponse({ ok: true });
  }
  if (message.action === "getCredentials") {
    chrome.storage.local.get("figurepos", (stored) => {
      sendResponse(stored.figurepos || null);
    });
    return true; // keep channel open for async response
  }
});
