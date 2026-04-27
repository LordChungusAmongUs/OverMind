const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendLog(dashboardTabId, log, status = "running") {
  try {
    await chrome.tabs.sendMessage(dashboardTabId, { action: "payroll:log", log, status });
  } catch (_) {}
}

async function runPayrollJob(dashboardTabId) {
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
  await sendLog(dashboardTabId, "Filling in email and password...");

  await chrome.scripting.executeScript({
    target: { tabId },
    args: ["Kingsbbq2015@gmail.com"],
    func: (email) => {
      // Find the email / username field
      const emailInput =
        document.querySelector('input[type="email"]') ||
        document.querySelector('input[name="email"]') ||
        document.querySelector('input[name="username"]') ||
        document.querySelector('input[autocomplete="email"]') ||
        document.querySelector('input[autocomplete="username"]') ||
        document.querySelector('input[placeholder*="email" i]') ||
        document.querySelector('input[placeholder*="user" i]');

      if (!emailInput) return;

      // Set value via native setter so React/Vue controlled inputs register the change
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      nativeSetter.call(emailInput, email);
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Focus the password field — Chrome should auto-fill it once it sees the email
      const pwInput = document.querySelector('input[type="password"]');
      if (pwInput) {
        pwInput.click();
        pwInput.focus();
      }
    },
  });

  // Give Chrome a moment to auto-fill the password
  await sleep(2000);
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
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "payroll:run") {
    const dashboardTabId = sender.tab?.id;
    if (dashboardTabId) runPayrollJob(dashboardTabId);
    sendResponse({ started: true });
  }
});
