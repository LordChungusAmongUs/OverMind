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

    // Lazy-scroll loop — count shift tables, not page height
    // (FigurePOS loads employees into a fixed container; height may not change)
    sendLog("Loading all employee blocks (lazy scroll)...");

    // Find the scrollable employee-list container once, then reuse it
    const [{ result: scrollDiag }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Walk up from the first shift table to find ALL scrollable ancestors
        const table = Array.from(document.querySelectorAll("table")).find((t) => {
          const hs = Array.from(t.querySelectorAll("th,thead td")).map((c) => c.innerText.toLowerCase());
          return hs.some((h) => h.includes("payable"));
        });
        if (!table) return "no-shift-table-found";

        const scrollables = [];
        let el = table.parentElement;
        while (el && el !== document.documentElement) {
          const s = window.getComputedStyle(el);
          const oy = s.overflowY;
          if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 50) {
            scrollables.push({
              tag: el.tagName,
              cls: (el.className || "").toString().slice(0, 60),
              scrollH: el.scrollHeight,
              clientH: el.clientHeight,
              scrollTop: el.scrollTop,
            });
          }
          el = el.parentElement;
        }
        // Also check body/html
        scrollables.push({
          tag: "BODY",
          cls: "",
          scrollH: document.body.scrollHeight,
          clientH: document.body.clientHeight,
          scrollTop: document.body.scrollTop,
        });
        return JSON.stringify(scrollables);
      },
    });

    sendLog("Scrollable ancestors: " + scrollDiag);

    // Parse scrollable containers - pick the outermost non-table one
    let scrollContainerCls = null;
    try {
      const scrollables = JSON.parse(scrollDiag);
      // Outermost = last in list (walked up from table); skip ant-table internals
      const outer = [...scrollables].reverse().find(
        (s) => !s.cls.includes("ant-table") && s.scrollH > s.clientH + 50
      );
      if (outer) scrollContainerCls = outer.cls.split(" ")[0];
    } catch (_) {}

    sendLog(`Scroll target class: ${scrollContainerCls || "window"}`);

    const countShiftTables = () => chrome.scripting.executeScript({
      target: { tabId },
      func: () => Array.from(document.querySelectorAll("table")).filter((t) => {
        const hdrs = Array.from(t.querySelectorAll("th, thead td"))
          .map((c) => c.innerText.trim().toLowerCase());
        return hdrs.some((h) => h.includes("payable")) && hdrs.some((h) => h.includes("position"));
      }).length,
    }).then(([{ result }]) => result);

    const scrollDown = (cls) => chrome.scripting.executeScript({
      target: { tabId },
      args: [cls],
      func: (targetCls) => {
        // Always scroll the window
        window.scrollBy(0, 900);
        document.documentElement.scrollTop += 900;
        document.body.scrollTop += 900;

        // Scroll the identified container by class
        if (targetCls) {
          const el = document.querySelector(`.${targetCls}`);
          if (el) el.scrollTop += 900;
        }

        // Also scroll every overflowing div that isn't an ant-table internal
        Array.from(document.querySelectorAll("div")).forEach((el) => {
          try {
            const s = window.getComputedStyle(el);
            const oy = s.overflowY;
            if ((oy === "auto" || oy === "scroll") &&
                el.scrollHeight > el.clientHeight + 50 &&
                !(el.className || "").includes("ant-table")) {
              el.scrollTop += 900;
            }
          } catch (_) {}
        });
      },
    });

    let lastCount = 0;
    let stableRounds = 0;
    const MAX_ROUNDS = 60;

    for (let round = 0; round < MAX_ROUNDS && stableRounds < 4; round++) {
      await scrollDown(scrollContainerCls);
      await sleep(3500);

      const count = await countShiftTables();
      if (count === lastCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        lastCount = count;
        sendLog(`Scrolling... (${count} employees loaded)`);
      }
    }

    sendLog(`All content loaded — ${lastCount} employee block(s) found. Extracting...`);

    sendLog("Extracting timesheet data from DOM...");

    const [{ result: jsonData }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const out = [];

        // Every employee block = a name header + a table ending with a Totals row.
        // Find all tables on the page and identify the ones that look like shift tables
        // by checking if their header row contains "Payable" and "Position".
        const tables = Array.from(document.querySelectorAll("table"));

        // Diagnostic: capture structure around the first shift table found
        let diagDone = false;

        for (const table of tables) {
          // Get all header cells (thead or first <tr>)
          const headerRow =
            table.querySelector("thead tr") ||
            table.querySelector("tr:first-child");
          if (!headerRow) continue;

          const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
          const headers = headerCells.map((c) => c.innerText.trim().toLowerCase());

          // Column indices — position MUST be present
          const ci = (kw) => headers.findIndex((h) => h.includes(kw));
          const iClockIn   = ci("clock in");
          const iClockOut  = ci("clock out");
          const iPayable   = ci("payable");
          const iPosition  = ci("position");

          if (iPayable < 0 || iPosition < 0) continue; // not a shift table

          // ── Diagnostic: log parent structure once ─────────────────────
          if (!diagDone) {
            diagDone = true;
            const diag = [];
            let p = table.parentElement;
            for (let d = 0; d < 5; d++) {
              if (!p) break;
              const childTags = Array.from(p.children).map((c) => {
                const tag = c.tagName;
                const cls = c.className?.toString().slice(0, 30) || "";
                const txt = c.innerText?.trim().slice(0, 40).replace(/\n/g, " ") || "";
                return `${tag}[${cls}]="${txt}"`;
              });
              diag.push(`depth${d} parent <${p.tagName} class="${p.className?.toString().slice(0,40)}">: ${childTags.join(" | ")}`);
              p = p.parentElement;
            }
            out.push({ __diag: diag });
          }

          // ── Find employee name ────────────────────────────────────────
          const NAME_SKIP_RE = /^(clock|payable|position|total|hours|break|location|cost|rate|search|edit|\+|shift|in|out)$/i;
          let empName = null;

          // Strategy 1: Ant Design structure — name is a sibling of .ant-spin-nested-loading
          const spinWrapper = table.closest(".ant-spin-nested-loading") ||
                              table.closest(".ant-spin-container")?.parentElement;
          if (spinWrapper) {
            let sib = spinWrapper.previousElementSibling;
            while (sib && !empName) {
              // Try the element's own text first
              const t = sib.innerText?.trim();
              if (t && t.length >= 2 && t.length <= 60 && /[a-zA-Z]/.test(t) && !NAME_SKIP_RE.test(t)) {
                // Pick just the first non-empty line if multi-line
                const line = t.split("\n").map((l) => l.trim()).find(
                  (l) => l.length >= 2 && l.length <= 60 && /[a-zA-Z]/.test(l) && !NAME_SKIP_RE.test(l)
                );
                if (line) empName = line;
              }
              // Try deepest leaf element with a short name
              if (!empName) {
                const leaf = Array.from(sib.querySelectorAll("*"))
                  .reverse()
                  .find((c) => {
                    const ct = c.children.length === 0 && c.innerText?.trim();
                    return ct && ct.length >= 2 && ct.length <= 60 && /[a-zA-Z]/.test(ct) && !NAME_SKIP_RE.test(ct);
                  });
                if (leaf) empName = leaf.innerText.trim();
              }
              sib = sib.previousElementSibling;
            }
          }

          // Strategy 2: walk up DOM siblings (fallback)
          if (!empName) {
            let el = spinWrapper || table;
            outer:
            for (let depth = 0; depth < 8; depth++) {
              const parent = el.parentElement;
              if (!parent) break;
              const siblings = Array.from(parent.children);
              const idx = siblings.indexOf(el);
              for (let i = idx - 1; i >= 0; i--) {
                const sib = siblings[i];
                if (sib.tagName === "TABLE") continue;
                const t = sib.innerText?.trim();
                const line = t?.split("\n").map((l) => l.trim()).find(
                  (l) => l.length >= 2 && l.length <= 60 && /[a-zA-Z]/.test(l) && !NAME_SKIP_RE.test(l)
                );
                if (line) { empName = line; break outer; }
              }
              el = parent;
            }
          }

          // Collect shift rows (exclude header and Totals row)
          const bodyRows = Array.from(
            table.querySelectorAll("tbody tr, tr:not(:first-child)")
          );

          const shifts = [];
          for (const row of bodyRows) {
            const cells = Array.from(row.querySelectorAll("td"));
            if (!cells.length) continue;

            // Skip totals row
            const firstText = cells[0]?.innerText?.trim().toLowerCase();
            if (firstText === "totals" || firstText === "total") continue;

            const clockIn  = iClockIn  >= 0 ? cells[iClockIn]?.innerText?.trim()  : "";
            const clockOut = iClockOut >= 0 ? cells[iClockOut]?.innerText?.trim() : "";
            const payable  = cells[iPayable]?.innerText?.trim();
            const position = cells[iPosition]?.innerText?.trim();

            if (!payable || payable === "") continue;

            shifts.push({ clockIn, clockOut, payable, position: position || "" });
          }

          if (shifts.length > 0) {
            out.push({ name: empName || "Unknown", shifts });
          }
        }

        return JSON.stringify(out);
      },
    });

    // ── Aggregate & format ────────────────────────────────────────────────
    let parsed;
    try { parsed = JSON.parse(jsonData); } catch { parsed = []; }

    // Pull out and log the diagnostic block if present
    const diagEntry = parsed.find((e) => e.__diag);
    if (diagEntry) {
      sendLog("DOM structure around first shift table:");
      for (const line of diagEntry.__diag) sendLog("  " + line);
      parsed = parsed.filter((e) => !e.__diag);
    }

    if (!parsed.length) {
      sendLog("No employee shift tables found in DOM.", "error");
      return;
    }

    sendLog(`Found ${parsed.length} employee block(s):`);

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
