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

  const tab = await chrome.tabs.create({ url: "https://www.figurepos.com" });
  const tabId = tab.id;

  await waitForTabLoad(tabId);
  await sleep(1000);
  await sendLog(dashboardTabId, "Homepage loaded — clicking Log In...");

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const all = Array.from(document.querySelectorAll("a, button"));
      const loginBtn = all.find((el) => {
        const t = el.textContent?.trim().toLowerCase();
        return t === "log in" || t === "login" || t === "sign in";
      });
      if (loginBtn) loginBtn.click();
    },
  });

  // Log In opens a modal on the same page — no navigation, just wait for it to render
  await sleep(2000);

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
    await sendLog(dashboardTabId, "ERROR: No email field found in any frame. Copy the URL above and send it.", "error");
    return;
  }

  await sendLog(dashboardTabId, `Email field found (frame: ${emailRect.frameUrl}) — clicking...`);

  await chrome.debugger.attach({ tabId }, "1.3");
  try {
    // Click the email field
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mousePressed", button: "left", clickCount: 1,
      x: emailRect.x, y: emailRect.y,
    });
    await sleep(80);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", button: "left", clickCount: 1,
      x: emailRect.x, y: emailRect.y,
    });

    await sleep(500);
    await sendLog(dashboardTabId, "Typing email...");

    await chrome.debugger.sendCommand({ tabId }, "Input.insertText", {
      text: "kingsbbq2025@gmail.com",
    });

    await sleep(800);

    // Tab to password field — Chrome auto-fills the saved password
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    });
    await sleep(150);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    });

    await sleep(2000);
    await sendLog(dashboardTabId, "Submitting...");

    // Press Enter to submit
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13,
    });
    await sleep(100);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13,
    });
  } finally {
    await chrome.debugger.detach({ tabId });
  }

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
});
