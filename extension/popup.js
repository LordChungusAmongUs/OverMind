const STEP_ORDER = ["lyrics", "art", "audio", "metadata", "complete"];

function updateUI(running, step, status) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  dot.className = "dot";
  if (status === "error") {
    dot.classList.add("error");
    text.textContent = "Error — check dashboard";
  } else if (running) {
    dot.classList.add("running");
    text.textContent = `Running: ${step ?? "starting"}...`;
  } else if (status === "complete") {
    dot.classList.add("complete");
    text.textContent = "Complete — check dashboard";
  } else {
    dot.classList.add("idle");
    text.textContent = "Idle — waiting for job";
  }

  // Update step indicators
  const stepEls = document.querySelectorAll(".step");
  stepEls.forEach(el => {
    el.className = "step";
    el.querySelector(".step-icon").textContent = "○";
  });

  if (!step) return;
  const currentIdx = STEP_ORDER.indexOf(step);

  stepEls.forEach(el => {
    const s = el.dataset.step;
    const idx = STEP_ORDER.indexOf(s);
    if (idx < currentIdx) {
      el.classList.add("done");
      el.querySelector(".step-icon").textContent = "✓";
    } else if (idx === currentIdx) {
      el.classList.add("active");
      el.querySelector(".step-icon").textContent = "▶";
    }
  });
}

async function refresh() {
  const data = await chrome.storage.local.get(["running", "currentJob", "step"]);
  updateUI(data.running, data.step, null);
}

refresh();
setInterval(refresh, 2000);
