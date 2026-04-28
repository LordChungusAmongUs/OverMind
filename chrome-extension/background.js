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

    // Click start date then end date in the calendar grid
    const [{ result: clickResult }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [startD, startM, startY, endD, endM, endY],
      func: (sd, sm, sy, ed, em, ey) => {
        function findDayCell(day, month, year) {
          const pad = (n) => String(n).padStart(2, "0");
          const isoDate = `${year}-${pad(month)}-${pad(day)}`;
          const monthNames = ["january","february","march","april","may","june",
                              "july","august","september","october","november","december"];
          const monthName = monthNames[month - 1];
          const ariaLabel1 = `${monthName} ${day}, ${year}`;
          const ariaLabel2 = `${month}/${day}/${year}`;

          // Try data-date attribute (ISO or M/D/Y)
          return (
            document.querySelector(`[data-date="${isoDate}"]`) ||
            document.querySelector(`[data-date="${month}/${day}/${year}"]`) ||
            document.querySelector(`[data-day="${isoDate}"]`) ||
            document.querySelector(`[data-value="${isoDate}"]`) ||
            document.querySelector(`[aria-label="${ariaLabel1}"]`) ||
            document.querySelector(`[aria-label="${ariaLabel2}"]`) ||
            // Fallback: find a cell whose sole text content is the day number
            // that sits inside a visible calendar grid
            (() => {
              const candidates = Array.from(
                document.querySelectorAll("td, th, button, div, span")
              ).filter((el) => {
                const t = el.textContent?.trim();
                return t === String(day) && el.getBoundingClientRect().width > 0;
              });
              // Pick the one deepest in the DOM (most specific) that's inside a calendar
              return candidates.find((el) => el.closest('[class*="calendar" i], [class*="picker" i], [class*="datepicker" i], [role="grid"], [role="gridcell"]'))
                || candidates[0];
            })()
          );
        }

        const startCell = findDayCell(sd, sm, sy);
        if (!startCell) return `start-cell-not-found (looking for day ${sd})`;
        startCell.click();
        return `clicked-start:${startCell.tagName}[${startCell.getAttribute("data-date") || startCell.textContent?.trim()}]`;
      },
    });

    sendLog(`Start date click: ${clickResult}`);

    if (clickResult.startsWith("start-cell-not-found")) {
      sendLog("Could not find start date cell in calendar.", "error");
      return;
    }

    await sleep(400);

    // Click end date
    const [{ result: endResult }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [endD, endM, endY],
      func: (ed, em, ey) => {
        function findDayCell(day, month, year) {
          const pad = (n) => String(n).padStart(2, "0");
          const isoDate = `${year}-${pad(month)}-${pad(day)}`;
          const monthNames = ["january","february","march","april","may","june",
                              "july","august","september","october","november","december"];
          const ariaLabel1 = `${monthNames[month - 1]} ${day}, ${year}`;
          return (
            document.querySelector(`[data-date="${isoDate}"]`) ||
            document.querySelector(`[data-day="${isoDate}"]`) ||
            document.querySelector(`[data-value="${isoDate}"]`) ||
            document.querySelector(`[aria-label="${ariaLabel1}"]`) ||
            (() => {
              const candidates = Array.from(
                document.querySelectorAll("td, th, button, div, span")
              ).filter((el) => {
                const t = el.textContent?.trim();
                return t === String(day) && el.getBoundingClientRect().width > 0;
              });
              return candidates.find((el) => el.closest('[class*="calendar" i], [class*="picker" i], [class*="datepicker" i], [role="grid"], [role="gridcell"]'))
                || candidates[0];
            })()
          );
        }
        const endCell = findDayCell(ed, em, ey);
        if (!endCell) return `end-cell-not-found (looking for day ${ed})`;
        endCell.click();
        return `clicked-end:${endCell.tagName}[${endCell.getAttribute("data-date") || endCell.textContent?.trim()}]`;
      },
    });

    sendLog(`End date click: ${endResult}`);

    if (endResult.startsWith("end-cell-not-found")) {
      sendLog("Could not find end date cell in calendar.", "error");
      return;
    }

    await sleep(400);

    // Confirm / apply the selection if there's an Apply or OK button
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const apply = Array.from(document.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.trim().toLowerCase();
          return t === "apply" || t === "ok" || t === "done" || t === "confirm";
        });
        if (apply) apply.click();
      },
    });

    sendLog("Date range selected!", "done");
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
