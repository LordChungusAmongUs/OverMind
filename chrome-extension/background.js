const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendLog(dashboardTabId, log, status = "running") {
  try {
    await chrome.tabs.sendMessage(dashboardTabId, { action: "payroll:log", log, status });
  } catch (_) {}
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

  // Wait for the homepage to load, then click the Log In button (top right)
  await sleep(3000);
  await sendLog(dashboardTabId, "Clicking Log In button...");
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

  // Wait for the login page to load
  await sleep(3000);
  await sendLog(dashboardTabId, "Finding email field...");

  // Get the center coordinates of the email input
  const [{ result: emailRect }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const el =
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[name="email"]') ||
        document.querySelector('input[name="username"]') ||
        document.querySelector('input[autocomplete="email"]') ||
        document.querySelector('input[autocomplete="username"]') ||
        document.querySelector('input[placeholder*="email" i]') ||
        document.querySelector('input[placeholder*="user" i]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    },
  });

  if (!emailRect) {
    await sendLog(dashboardTabId, "ERROR: Could not find email field on the login page.", "error");
    return;
  }

  await sendLog(dashboardTabId, "Clicking email field and typing credentials...");
  await chrome.debugger.attach({ tabId }, "1.3");
  try {
    // Real mouse click on the email field
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mousePressed", button: "left", clickCount: 1,
      x: emailRect.x, y: emailRect.y,
    });
    await sleep(100);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", button: "left", clickCount: 1,
      x: emailRect.x, y: emailRect.y,
    });

    await sleep(600);

    // Type email — Chrome treats this as real user input and will offer
    // to auto-fill the password when focus moves to the password field
    await chrome.debugger.sendCommand({ tabId }, "Input.insertText", {
      text: "kingsbbq2025@gmail.com",
    });

    await sleep(800);

    // Tab to password field to trigger Chrome's password auto-fill
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    });
    await sleep(150);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    });
  } finally {
    await chrome.debugger.detach({ tabId });
  }

  // Give Chrome time to auto-fill the password
  await sleep(2500);
  await sendLog(dashboardTabId, "Submitting login form...");

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const submit =
        document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.trim().toLowerCase();
          return t === "log in" || t === "login" || t === "sign in" || t === "continue";
        });
      if (submit) submit.click();
    },
  });

  await sendLog(dashboardTabId, "Waiting for login to complete...");

  // Poll until the Management sidebar appears (sign we're logged in)
  let loggedIn = false;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const text = document.body?.innerText ?? "";
          const hasPassword = !!document.querySelector('input[type="password"]');
          const hasManagement =
            text.toLowerCase().includes("management") || text.toLowerCase().includes("timesheets");
          return { hasPassword, hasManagement };
        },
      });
      if (!result.hasPassword && result.hasManagement) {
        loggedIn = true;
        break;
      }
    } catch (_) {
      // Tab still loading — keep polling
    }
  }

  if (!loggedIn) {
    await sendLog(
      dashboardTabId,
      "ERROR: Login timed out. Make sure your FigurePOS credentials are saved in Chrome.",
      "error"
    );
    return;
  }

  await sendLog(dashboardTabId, "Logged in! Looking for Management > Timesheets in the sidebar...");

  try {
    // Click "Management" first in case it's a collapsible section
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const all = Array.from(document.querySelectorAll("a, button, li, span, div"));
        const mgmt = all.find((el) => el.textContent?.trim().toLowerCase() === "management");
        if (mgmt) mgmt.click();
      },
    });

    await sleep(800);

    // Now click Timesheets
    const [{ result: clicked }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const all = Array.from(document.querySelectorAll("a, button, li, span, div"));
        const ts = all.find(
          (el) =>
            el.textContent?.trim().toLowerCase() === "timesheets" ||
            el.textContent?.trim().toLowerCase() === "timesheet"
        );
        if (ts) {
          ts.click();
          return true;
        }
        return false;
      },
    });

    if (clicked) {
      await sendLog(dashboardTabId, "Navigated to Timesheets! Ready for next step.", "done");
    } else {
      await sendLog(
        dashboardTabId,
        "Logged in but could not find Timesheets link — may need to adjust the selector.",
        "error"
      );
    }
  } catch (err) {
    await sendLog(dashboardTabId, `ERROR: ${err.message}`, "error");
  }
}  // end _runPayrollJob

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "payroll:run") {
    const dashboardTabId = sender.tab?.id;
    if (dashboardTabId) runPayrollJob(dashboardTabId);
    sendResponse({ started: true });
  }
});
