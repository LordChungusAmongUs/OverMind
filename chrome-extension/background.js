const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendLog(dashboardTabId, log, status = "running") {
  try {
    await chrome.tabs.sendMessage(dashboardTabId, { action: "payroll:log", log, status });
  } catch (_) {}
}

// Wait for a tab to finish loading (status === 'complete')
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

    // Already loaded?
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function runPayrollJob(dashboardTabId) {
  try {
    await _runPayrollJob(dashboardTabId);
  } catch (err) {
    await sendLog(dashboardTabId, `Fatal error: ${err.message}`, "error");
  }
}

async function _runPayrollJob(dashboardTabId) {
  await sendLog(dashboardTabId, "Opening FigurePOS in a new tab...");

  const tab = await chrome.tabs.create({ url: "https://app.figurepos.com/login" });
  const tabId = tab.id;

  await waitForTabLoad(tabId);
  await sleep(1000);

  // Log exact URL and search all frames for the email field
  const [{ result: currentUrl }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.location.href,
  });
  await sendLog(dashboardTabId, `Login page: ${currentUrl}`);

  await sendLog(dashboardTabId, "Searching all frames for email field...");
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
  const emailRect = emailResult?.result;

  if (!emailRect) {
    await sendLog(dashboardTabId, "ERROR: No email field found on login page.", "error");
    return;
  }

  // Retrieve stored credentials
  const stored = await chrome.storage.local.get("figurepos");
  if (!stored.figurepos?.password) {
    await sendLog(dashboardTabId, "ERROR: No FigurePOS password saved. Enter it in the Credentials card on the payroll page first.", "error");
    return;
  }

  const { email, password } = stored.figurepos;
  await sendLog(dashboardTabId, "Filling login form directly...");

  // Fill email + password directly — no autofill dropdown needed
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
      }
      if (pwInput) {
        setter.call(pwInput, pw);
        pwInput.dispatchEvent(new Event("input", { bubbles: true }));
        pwInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Click the submit button
      const submit =
        document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.trim().toLowerCase();
          return t === "log in" || t === "login" || t === "sign in" || t === "continue";
        });
      if (submit) (submit as HTMLElement).click();
    },
  });

  await sendLog(dashboardTabId, "Credentials submitted — waiting for dashboard...");

  // Wait for post-login page to load
  await waitForTabLoad(tabId);
  await sleep(1000);
  await sendLog(dashboardTabId, "Waiting for dashboard to appear...");

  // Poll for the Management sidebar
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
              text.toLowerCase().includes("management") ||
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
    await sendLog(dashboardTabId, "ERROR: Login timed out — check if the password field got filled.", "error");
    return;
  }

  await sendLog(dashboardTabId, "Logged in! Clicking Management > Timesheets...");

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const all = Array.from(document.querySelectorAll("a, button, li, span, div"));
        const mgmt = all.find((el) => el.textContent?.trim().toLowerCase() === "management");
        if (mgmt) mgmt.click();
      },
    });

    await sleep(800);

    const [{ result: clicked }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const all = Array.from(document.querySelectorAll("a, button, li, span, div"));
        const ts = all.find(
          (el) =>
            el.textContent?.trim().toLowerCase() === "timesheets" ||
            el.textContent?.trim().toLowerCase() === "timesheet"
        );
        if (ts) { ts.click(); return true; }
        return false;
      },
    });

    if (clicked) {
      await sendLog(dashboardTabId, "Navigated to Timesheets! Ready for next step.", "done");
    } else {
      await sendLog(dashboardTabId, "Logged in but Timesheets link not found — let me know what the sidebar looks like.", "error");
    }
  } catch (err) {
    await sendLog(dashboardTabId, `ERROR: ${err.message}`, "error");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "payroll:run") {
    const dashboardTabId = sender.tab?.id;
    if (dashboardTabId) runPayrollJob(dashboardTabId);
    sendResponse({ started: true });
  }

  if (message.action === "saveCredentials") {
    chrome.storage.local.set({ figurepos: message.data }, () => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: "credentialsSaved" });
      }
    });
    sendResponse({ ok: true });
  }
});
