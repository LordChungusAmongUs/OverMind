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

function makeWaitForInput(port, sendLog) {
  return (key, label) => new Promise((resolve) => {
    sendLog(label, "awaiting-input");
    chrome.storage.local.remove("inputResponse");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      port.onMessage.removeListener(handler);
      clearInterval(poll);
      chrome.storage.local.remove("inputResponse");
      resolve(value);
    };
    const handler = (msg) => {
      if (msg.action === "user:input" && msg.key === key) finish(msg.value);
    };
    port.onMessage.addListener(handler);
    const poll = setInterval(() => {
      chrome.storage.local.get("inputResponse", ({ inputResponse }) => {
        if (!done && inputResponse?.key === key) finish(inputResponse.value);
      });
    }, 500);
    setTimeout(() => finish(null), 300000);
  });
}

async function runPayrollJob(port) {
  const sendLog = (log, status = "running") => {
    try { port.postMessage({ action: "payroll:log", log, status }); } catch (_) {}
  };
  const sendData = (data) => { try { port.postMessage(data); } catch (_) {} };
  const waitForInput = makeWaitForInput(port, sendLog);

  try {
    await _runPayrollJob(sendLog, waitForInput, sendData);
  } catch (err) {
    sendLog(`Fatal error: ${err.message}`, "error");
  }
}

async function _runPayrollJob(sendLog, waitForInput, sendData = null) {
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
    const timesheetSummary = [];

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

      timesheetSummary.push({ name: emp.name, serverHours: serverTotal, otherHours: otherTotal, totalHours: grandTotal, hourlyRate: null, totalPay: null });

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
    await chrome.storage.local.set({ timesheetSummary });
    sendLog(`Saved timesheet data for ${timesheetSummary.length} employee(s).`);

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

    sendLog("Password entered — clicking Continue...");
    await sleep(500);

    const [{ result: submitResult }] = await chrome.scripting.executeScript({
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

    sendLog(`Submit: ${submitResult}`);

    if (submitResult === "not-found") {
      sendLog("Could not find Continue button after password.", "error");
      return;
    }

    sendLog("Credentials submitted — waiting for MFA page to load...");
    await waitForTabLoad(asureTabId, 20000);
    await sleep(1500);

    const mfaCode = await waitForInput("mfa", "Enter the 6-digit SMS code sent to your phone:");
    if (!mfaCode) {
      sendLog("MFA timed out — no code entered within 5 minutes.", "error");
      return;
    }

    sendLog(`SMS code received — filling field...`);

    let mfaResult = "not-found";
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const frames = await chrome.scripting.executeScript({
        target: { tabId: asureTabId, allFrames: true },
        func: (code) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          const input =
            document.querySelector('input[name="code"]') ||
            document.querySelector('input[name="otp"]') ||
            document.querySelector('input[name="token"]') ||
            document.querySelector('input[autocomplete="one-time-code"]') ||
            document.querySelector('input[inputmode="numeric"]') ||
            document.querySelector('input[placeholder*="code" i]') ||
            document.querySelector('input[placeholder*="pin" i]') ||
            document.querySelector('input[type="tel"]') ||
            document.querySelector('input[type="number"]') ||
            document.querySelector('input[type="text"]');
          if (!input) return "not-found";
          input.focus();
          setter.call(input, code);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.blur();
          return `filled: name="${input.name}" type="${input.type}"`;
        },
        args: [mfaCode],
      });
      const hit = frames.find((f) => f.result && f.result !== "not-found");
      if (hit) { mfaResult = hit.result; break; }
      sendLog(`  waiting for MFA field... (${i + 1}s)`);
    }

    sendLog(`MFA field: ${mfaResult}`);
    if (mfaResult === "not-found") {
      sendLog("Could not find MFA code input.", "error");
      return;
    }

    sendLog("MFA code entered — clicking Continue...");
    await sleep(500);

    const [{ result: mfaSubmit }] = await chrome.scripting.executeScript({
      target: { tabId: asureTabId },
      func: () => {
        const btn =
          document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll("button")).find((b) => {
            const t = b.textContent?.trim().toLowerCase();
            return t === "continue" || t === "next" || t === "verify" || t === "submit";
          });
        if (!btn) return "not-found";
        btn.click();
        return `clicked: "${btn.textContent?.trim()}"`;
      },
    });

    sendLog(`MFA submit: ${mfaSubmit}`);

    if (mfaSubmit === "not-found") {
      sendLog("Could not find Continue button on MFA page.", "error");
      return;
    }

    sendLog("Logged in to Asure Central.", "login-complete");

    // Wait for payroll trigger — auto-sent by dashboard if toggle is on
    const runPayroll = await waitForInput("run-payroll", "");
    if (runPayroll === "yes") {
      await _runPayrollAutomation(sendLog, waitForInput, asureTabId, 0, sendData);
    } else {
      sendLog("Login complete. Payroll automation skipped.", "done");
    }
  } catch (err) {
    sendLog(`Navigation error: ${err.message}`, "error");
  }
}

async function _runPayrollAutomation(sendLog, waitForInput, tabId, fromStep = 0, sendData = null) {
  try {
    if (fromStep > 0) sendLog(`Jumping to payroll step ${fromStep + 1}...`);
    else sendLog("Starting payroll automation...");

    // ── Step 0: find Payroll Processing card and click Web ──────────
    if (fromStep <= 0) {
      sendLog("Scanning page for interactive elements...");
      await sleep(3000);

      // ── Diagnostic: dump every button/link/role=button from all frames ──
      const diagFrames = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => {
          const sel = 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]';
          const els = Array.from(document.querySelectorAll(sel));
          const rows = els.map((el) => {
            const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
            return [
              el.tagName,
              text || "(empty)",
              el.id || "",
              el.getAttribute("aria-label") || "",
              el.getAttribute("data-testid") || "",
              el.getAttribute("role") || "",
            ].join(" | ");
          });
          return JSON.stringify({
            url: window.location.href,
            iframes: Array.from(document.querySelectorAll("iframe")).map((f) => f.src || f.name),
            rows: rows.slice(0, 80),
          });
        },
      });

      for (const { result } of diagFrames) {
        if (!result) continue;
        const { url, iframes, rows } = JSON.parse(result);
        sendLog(`FRAME: ${url}`);
        if (iframes.length) sendLog(`  iframes: ${iframes.join(", ")}`);
        for (const row of rows) sendLog(`  ${row}`);
      }

      // ── Diagnostic: shadow DOM ──
      const shadowDiag = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const found = [];
          const walk = (root) => {
            for (const el of root.querySelectorAll("*")) {
              if (el.shadowRoot) {
                for (const s of el.shadowRoot.querySelectorAll('button, a, [role="button"]')) {
                  const t = s.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
                  if (t) found.push(`SHADOW ${s.tagName} | ${t}`);
                }
                walk(el.shadowRoot);
              }
            }
          };
          walk(document);
          return JSON.stringify(found.slice(0, 30));
        },
      });
      const shadowItems = JSON.parse(shadowDiag[0]?.result || "[]");
      if (shadowItems.length) {
        sendLog(`Shadow DOM elements:`);
        for (const s of shadowItems) sendLog(`  ${s}`);
      }

      // ── Click attempt: allFrames, any element whose trimmed text === "Web" ──
      sendLog("Attempting to click Web button...");
      let webClicked = null;
      for (let i = 0; i < 15; i++) {
        await sleep(2000);

        // Try regular DOM across all frames — only "Web" that is near "Classic"
        const frameResults = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: () => {
            const isWeb = (el) => el.textContent?.trim().toLowerCase() === "web";
            const isClassic = (el) => el.textContent?.trim().toLowerCase() === "classic";

            // Strategy 1: find any element whose parent also contains a "Classic" sibling
            const allEls = Array.from(document.querySelectorAll(
              'button, a, [role="button"], [role="link"], span, div, li'
            ));
            const webEls = allEls.filter(isWeb);

            let best = null;
            for (const el of webEls) {
              // Walk up to find a container that also has a "Classic" element
              let node = el.parentElement;
              for (let depth = 0; depth < 8 && node; depth++) {
                const siblings = Array.from(node.querySelectorAll(
                  'button, a, [role="button"], [role="link"], span, div, li'
                ));
                if (siblings.some(isClassic)) { best = el; break; }
                node = node.parentElement;
              }
              if (best) break;
            }

            // Strategy 2: find the "Classic" button first, then look for "Web" nearby
            if (!best) {
              const classicEl = allEls.find(isClassic);
              if (classicEl) {
                const container = classicEl.closest("[class]") || classicEl.parentElement;
                if (container) {
                  best = Array.from(container.querySelectorAll("*")).find(isWeb) ||
                    Array.from(container.parentElement?.querySelectorAll("*") || []).find(isWeb);
                }
              }
            }

            if (!best) return null;
            const rect = best.getBoundingClientRect();
            best.scrollIntoView({ behavior: "instant", block: "center" });
            best.click();
            return `${best.tagName} "${best.textContent?.trim()}" at (${Math.round(rect.left)},${Math.round(rect.top)}) in ${window.location.pathname}`;
          },
        });
        const hit = frameResults.find((r) => r.result);
        if (hit) { webClicked = hit.result; break; }

        // Shadow DOM fallback — same logic
        const shadowHit = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const walk = (root) => {
              for (const el of root.querySelectorAll("*")) {
                if (el.shadowRoot) { const r = walk(el.shadowRoot); if (r) return r; }
                if (el.textContent?.trim().toLowerCase() !== "web") continue;
                if (!["BUTTON","A","SPAN","DIV","LI"].includes(el.tagName)) continue;
                let node = el.parentElement;
                for (let d = 0; d < 8 && node; d++) {
                  if (Array.from(node.querySelectorAll("*")).some(
                    (s) => s.textContent?.trim().toLowerCase() === "classic"
                  )) {
                    el.click();
                    return `SHADOW ${el.tagName} "${el.textContent?.trim()}"`;
                  }
                  node = node.parentElement;
                }
              }
              return null;
            };
            return walk(document);
          },
        });
        if (shadowHit[0]?.result) { webClicked = shadowHit[0].result; break; }

        sendLog(`  waiting for Web button... (${i + 1})`);
      }

      if (!webClicked) {
        sendLog("Could not find Web button — see element dump above.", "error");
        return;
      }
      sendLog(`Clicked: ${webClicked}`);
      sendLog("Waiting for Payroll Today page...");
      await waitForTabLoad(tabId, 20000);
      await sleep(2000);
    }

    // ── Step 1: find payroll with closest upcoming date and click it ─
    if (fromStep <= 1) {
      sendLog("Looking for next approaching payroll...");
      let payrollClicked = null;
      for (let i = 0; i < 10; i++) {
        await sleep(1000);
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const headings = Array.from(document.querySelectorAll("*")).filter((el) =>
              el.childElementCount === 0 &&
              el.textContent?.trim().toLowerCase() === "payroll today"
            );
            if (!headings.length) return "no-section";
            const links = Array.from(document.querySelectorAll("a, button, [role='link']")).filter((el) =>
              el.textContent?.trim().toLowerCase().includes("regular payroll")
            );
            const unfinished = links.filter((el) => {
              const t = el.textContent?.trim();
              return !t.endsWith("- 1") && !t.endsWith("-1");
            });
            if (!unfinished.length) return "all-complete";

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let best = null, bestDate = null;
            for (const el of unfinished) {
              const m = el.textContent?.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
              if (!m) continue;
              let y = m[3].length === 2 ? "20" + m[3] : m[3];
              const d = new Date(parseInt(y), parseInt(m[1]) - 1, parseInt(m[2]));
              if (!bestDate || d < bestDate) { bestDate = d; best = el; }
            }
            if (!best) best = unfinished[0];
            const label = best.textContent?.trim();
            best.click();
            return `clicked: "${label}"`;
          },
        });
        if (result && result !== "no-section" && result !== "all-complete") {
          payrollClicked = result;
          sendLog(`Next payroll: ${result}`);
          break;
        }
        if (result === "all-complete") {
          sendLog("All payrolls in this period are already complete.", "done");
          return;
        }
        sendLog(`  waiting for Payroll Today section... (${i + 1})`);
      }
      if (!payrollClicked) {
        sendLog("Could not find next payroll link.", "error");
        return;
      }
      sendLog("Waiting for payroll detail page...");
      await waitForTabLoad(tabId, 20000);
      await sleep(2000);
    }

    // ── Step 2: click Create Checks ──────────────────────────────────
    if (fromStep <= 2) {
      sendLog("Looking for Create Checks button...");
      let createChecksClicked = null;
      for (let i = 0; i < 15; i++) {
        await sleep(1500);
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const btn = Array.from(document.querySelectorAll("button, a, [role='button']")).find((el) => {
              const t = el.textContent?.trim().toLowerCase();
              return t === "create checks" || t.includes("create checks");
            });
            if (!btn) return "not-found";
            btn.click();
            return `clicked: "${btn.textContent?.trim()}"`;
          },
        });
        if (result && result !== "not-found") {
          createChecksClicked = result;
          sendLog(`Create Checks: ${result}`);
          break;
        }
        sendLog(`  waiting for Create Checks... (${i + 1})`);
      }
      if (!createChecksClicked) {
        sendLog("Could not find Create Checks button.", "error");
        return;
      }
    }

    // ── Step 3: fill employee checks & send summary for approval ─────
    if (fromStep <= 3) {
      if (fromStep < 3) {
        sendLog("Waiting for check entry page to load...");
        await waitForTabLoad(tabId, 20000);
        await sleep(2000);
      }

      const stored = await chrome.storage.local.get("timesheetSummary");
      const summary = stored.timesheetSummary || [];

      if (!summary.length) {
        sendLog("No timesheet data found — run the full job first to scrape FigurePOS.", "error");
        return;
      }

      sendLog(`Filling checks for ${summary.length} employee(s)...`);

      const [{ result: fillResult }] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [summary],
        func: (employees) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          const filled = [], notFound = [];
          for (const emp of employees) {
            const nameEl = Array.from(document.querySelectorAll("*")).find(
              (el) => el.childElementCount === 0 && el.textContent?.trim() === emp.name
            );
            if (!nameEl) { notFound.push(emp.name); continue; }
            const row = nameEl.closest("tr") || nameEl.closest("[class*='row']") || nameEl.parentElement;
            const inputs = row ? Array.from(row.querySelectorAll("input[type='text'],input[type='number']")) : [];
            if (!inputs.length) { notFound.push(emp.name + " (no input)"); continue; }
            setter.call(inputs[0], emp.totalHours.toFixed(2));
            inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
            inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
            inputs[0].blur();
            filled.push(emp.name);
          }
          return { filled, notFound };
        },
      });

      if (fillResult?.filled?.length) sendLog(`Filled: ${fillResult.filled.join(", ")}`);
      if (fillResult?.notFound?.length) sendLog(`Not matched on page: ${fillResult.notFound.join(", ")}`);

      await sleep(1000);

      // Try to read pay rates and computed totals back from the page
      const [{ result: ratesJson }] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [summary.map((e) => e.name)],
        func: (names) => {
          const out = {};
          for (const name of names) {
            const nameEl = Array.from(document.querySelectorAll("*")).find(
              (el) => el.childElementCount === 0 && el.textContent?.trim() === name
            );
            if (!nameEl) continue;
            const row = nameEl.closest("tr") || nameEl.closest("[class*='row']") || nameEl.parentElement;
            if (!row) continue;
            const cells = Array.from(row.querySelectorAll("td, [class*='cell']"));
            const text = cells.map((c) => c.innerText?.trim()).filter(Boolean);
            const amounts = text.map((t) => parseFloat(t.replace(/[$,]/g, ""))).filter((n) => !isNaN(n) && n > 0);
            if (amounts.length >= 2) {
              out[name] = { hourlyRate: amounts[0], totalPay: amounts[amounts.length - 1] };
            }
          }
          return JSON.stringify(out);
        },
      });

      const rates = (() => { try { return JSON.parse(ratesJson); } catch { return {}; } })();
      const enriched = summary.map((e) => ({
        ...e,
        hourlyRate: rates[e.name]?.hourlyRate ?? null,
        totalPay: rates[e.name]?.totalPay ?? null,
      }));

      sendLog("Sending check summary to dashboard for review...");
      if (sendData) sendData({ action: "payroll:summary", employees: enriched });

      const approval = await waitForInput("approve-payroll", "Review the payroll summary and click Approve or Cancel.");
      if (approval === "approved") {
        sendLog("Approved — submitting payroll...", "running");
        const [{ result: submitResult }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const btn = Array.from(document.querySelectorAll("button, [role='button']")).find((el) => {
              const t = el.textContent?.trim().toLowerCase();
              return t === "submit" || t === "confirm" || t === "post" || t === "approve";
            });
            if (!btn) return "not-found";
            btn.click();
            return `clicked: "${btn.textContent?.trim()}"`;
          },
        });
        sendLog(`Submit: ${submitResult}`);
        sendLog("Payroll submitted.", "done");
      } else {
        sendLog("Payroll cancelled — no changes submitted.", "done");
      }
    }
  } catch (err) {
    sendLog(`Payroll error: ${err.message}`, "error");
  }
}

async function runFromLoginStep(port, stepIndex) {
  const sendLog = (log, status = "running") => {
    try { port.postMessage({ action: "payroll:log", log, status }); } catch (_) {}
  };
  const waitForInput = makeWaitForInput(port, sendLog);
  try {
    sendLog(`Running full login sequence (step ${stepIndex + 1} selected)...`);
    await _runPayrollJob(sendLog, waitForInput);
  } catch (err) {
    sendLog(`Error: ${err.message}`, "error");
  }
}

async function runFromStep(port, stepIndex) {
  const sendLog = (log, status = "running") => {
    try { port.postMessage({ action: "payroll:log", log, status }); } catch (_) {}
  };
  const sendData = (data) => { try { port.postMessage(data); } catch (_) {} };
  const waitForInput = makeWaitForInput(port, sendLog);
  try {
    // Find the Asure HCM tab; fall back to active tab
    const allTabs = await chrome.tabs.query({});
    const asureTab = allTabs.find((t) =>
      t.url?.includes("asurehcm.com") ||
      t.url?.includes("asureforce.net") ||
      t.url?.includes("authentication.identity")
    );

    let targetTab;
    if (asureTab) {
      sendLog(`Found Asure tab: ${asureTab.url}`);
      await chrome.tabs.update(asureTab.id, { active: true });
      await chrome.windows.update(asureTab.windowId, { focused: true });
      targetTab = asureTab;
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) { sendLog("No active tab found.", "error"); return; }
      sendLog(`No Asure tab found — using active tab: ${activeTab.url}`);
      targetTab = activeTab;
    }

    await _runPayrollAutomation(sendLog, waitForInput, targetTab.id, stepIndex, sendData);
  } catch (err) {
    sendLog(`Error: ${err.message}`, "error");
  }
}

// Persistent port keeps the service worker alive for the full payroll job
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "payroll") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "start") runPayrollJob(port);
      if (msg.action === "start-from") runFromStep(port, msg.step);
      if (msg.action === "start-login-from") runFromLoginStep(port, msg.step);
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
