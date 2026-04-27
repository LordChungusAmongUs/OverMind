// Respond to ping from the page (called after React mounts)
window.addEventListener("overmind:ext:ping", () => {
  window.dispatchEvent(new CustomEvent("overmind:ext:ready"));
});

// Relay from dashboard page → background
window.addEventListener("overmind:payroll:run", () => {
  chrome.runtime.sendMessage({ action: "payroll:run" });
});

// Relay from background → dashboard page
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "payroll:log") {
    window.dispatchEvent(new CustomEvent("overmind:payroll:log", { detail: msg }));
  }
});
