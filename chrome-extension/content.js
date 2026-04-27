// Respond to ping from the page
window.addEventListener("overmind:ext:ping", () => {
  window.dispatchEvent(new CustomEvent("overmind:ext:ready"));
});

// Relay: page → background (payroll job)
window.addEventListener("overmind:payroll:run", () => {
  chrome.runtime.sendMessage({ action: "payroll:run" });
});

// Relay: page → background (save credentials)
window.addEventListener("overmind:ext:saveCredentials", (e) => {
  chrome.runtime.sendMessage({ action: "saveCredentials", data: e.detail });
});

// Relay: background → page (log messages + credential ack)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "payroll:log") {
    window.dispatchEvent(new CustomEvent("overmind:payroll:log", { detail: msg }));
  }
  if (msg.action === "credentialsSaved") {
    window.dispatchEvent(new CustomEvent("overmind:ext:credentialsSaved"));
  }
});
