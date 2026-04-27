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

  port.postMessage({ action: "start" });
});

// Save credentials (one-off message is fine here)
window.addEventListener("overmind:ext:saveCredentials", (e) => {
  chrome.runtime.sendMessage({ action: "saveCredentials", data: e.detail }, () => {});
});

// Relay credential-saved ack back to page
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "credentialsSaved") {
    window.dispatchEvent(new CustomEvent("overmind:ext:credentialsSaved"));
  }
});
