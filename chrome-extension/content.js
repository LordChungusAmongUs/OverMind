// Respond to ping from the page
window.addEventListener("overmind:ext:ping", () => {
  window.dispatchEvent(new CustomEvent("overmind:ext:ready"));
});

function connectPayrollPort(startMsg) {
  const port = chrome.runtime.connect({ name: "payroll" });
  port.onMessage.addListener((msg) => {
    if (msg.action === "payroll:log") {
      window.dispatchEvent(new CustomEvent("overmind:payroll:log", { detail: msg }));
    }
    if (msg.action === "payroll:summary") {
      window.dispatchEvent(new CustomEvent("overmind:payroll:summary", { detail: msg }));
    }
  });
  const onInput = (e) => port.postMessage({ action: "user:input", ...e.detail });
  window.addEventListener("overmind:payroll:input", onInput);
  port.onDisconnect.addListener(() => {
    window.removeEventListener("overmind:payroll:input", onInput);
  });
  port.postMessage(startMsg);
}

// Full job
window.addEventListener("overmind:payroll:run", () => {
  connectPayrollPort({ action: "start" });
});

// Jump to a specific payroll step (uses current active tab)
window.addEventListener("overmind:payroll:run-from", (e) => {
  connectPayrollPort({ action: "start-from", step: e.detail.step });
});

// Jump to a specific login step (uses current active tab)
window.addEventListener("overmind:payroll:run-login-from", (e) => {
  connectPayrollPort({ action: "start-login-from", step: e.detail.step });
});

// Save credentials (one-off message is fine here)
window.addEventListener("overmind:ext:saveCredentials", (e) => {
  chrome.runtime.sendMessage({ action: "saveCredentials", data: e.detail }, () => {});
});

// Load saved credentials and relay back to page
window.addEventListener("overmind:ext:getCredentials", () => {
  chrome.runtime.sendMessage({ action: "getCredentials" }, (data) => {
    window.dispatchEvent(new CustomEvent("overmind:ext:credentialsLoaded", { detail: data || null }));
  });
});

// Relay credential-saved ack back to page
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "credentialsSaved") {
    window.dispatchEvent(new CustomEvent("overmind:ext:credentialsSaved"));
  }
});
