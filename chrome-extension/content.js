// Respond to ping from the page
window.addEventListener("overmind:ext:ping", () => {
  window.dispatchEvent(new CustomEvent("overmind:ext:ready"));
});

// Payroll job — use a persistent port so the service worker stays alive
window.addEventListener("overmind:payroll:run", () => {
  const port = chrome.runtime.connect({ name: "payroll" });

  port.onMessage.addListener((msg) => {
    if (msg.action === "payroll:log") {
      window.dispatchEvent(new CustomEvent("overmind:payroll:log", { detail: msg }));
    }
  });

  // Relay user input (e.g. MFA code) from the page back to the extension
  const onInput = (e) => port.postMessage({ action: "user:input", ...e.detail });
  window.addEventListener("overmind:payroll:input", onInput);
  port.onDisconnect.addListener(() => {
    window.removeEventListener("overmind:payroll:input", onInput);
  });

  port.postMessage({ action: "start" });
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
