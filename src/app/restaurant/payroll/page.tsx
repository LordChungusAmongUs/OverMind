"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { DollarSign, Play, CheckCircle, AlertCircle, Loader2, Terminal, Puzzle, Wifi, WifiOff, KeyRound } from "lucide-react";

type Status = "idle" | "running" | "done" | "error" | "awaiting-input" | "login-complete";
interface LogEntry { text: string; status: Status; }

const loginSteps = [
  "Open FigurePOS login page",
  "Fill credentials & log in",
  "Navigate to Timesheets",
  "Pull & process timesheet data",
  "Close FigurePOS tab",
  "Open Payroll Solutions",
  "Navigate to Asure Central",
  "Enter Asure username",
  "Click Continue",
  "Enter Asure password",
  "Submit & log in to Asure",
  "Enter SMS verification code",
];

const payrollSteps = [
  "Find Payroll Processing card & click Web",
  "Select payroll with next approaching date",
  "Click Create Checks",
];

export default function PayrollPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [extReady, setExtReady] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);
  const [email, setEmail] = useState("kingsbbq2015@gmail.com");
  const [password, setPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [awaitingInput, setAwaitingInput] = useState<{ key: string; label: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [autoPayroll, setAutoPayroll] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("autoPayroll") === "true"
  );
  const [payrollStep, setPayrollStep] = useState(-1);
  const [phase, setPhase] = useState<"login" | "payroll">("login");
  const logRef = useRef<HTMLDivElement>(null);

  // Ping extension on mount; once ready, load saved credentials
  useEffect(() => {
    const onReady = () => {
      setExtReady(true);
      window.dispatchEvent(new CustomEvent("overmind:ext:getCredentials"));
    };
    const onCredsLoaded = (e: Event) => {
      const data = (e as CustomEvent).detail as { email?: string; password?: string } | null;
      if (data?.email) setEmail(data.email);
      if (data?.password) { setPassword(data.password); setCredsSaved(true); }
    };
    window.addEventListener("overmind:ext:ready", onReady);
    window.addEventListener("overmind:ext:credentialsLoaded", onCredsLoaded);
    window.dispatchEvent(new CustomEvent("overmind:ext:ping"));
    return () => {
      window.removeEventListener("overmind:ext:ready", onReady);
      window.removeEventListener("overmind:ext:credentialsLoaded", onCredsLoaded);
    };
  }, []);

  // Listen for log messages and credential save ack
  useEffect(() => {
    const onLog = (e: Event) => {
      const { log, status: s } = (e as CustomEvent).detail as { log: string; status: string };
      const mapped: Status = s === "done" ? "done" : s === "error" ? "error" : s === "awaiting-input" ? "awaiting-input" : "running";
      setLogs((prev) => {
        const next = [...prev, { text: log, status: mapped }];
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
        return next;
      });
      if (log.includes("Opening FigurePOS")) setCurrentStep(0);
      if (log.includes("Filling login")) setCurrentStep(1);
      if (log.includes("Timesheets")) setCurrentStep(2);
      if (log.includes("Scanning all employees") || log.includes("Extraction complete") || log.includes("Processing")) setCurrentStep(3);
      if (log.includes("Closing FigurePOS tab")) setCurrentStep(4);
      if (log.includes("Opening Payroll Solutions")) setCurrentStep(5);
      if (log.includes("Asure Central nav") || log.includes("looking for Asure Central")) setCurrentStep(6);
      if (log.includes("entering username")) setCurrentStep(7);
      if (log.includes("clicking Continue")) setCurrentStep(8);
      if (log.includes("waiting for password field")) setCurrentStep(9);
      if (log.includes("Password entered — clicking")) setCurrentStep(10);
      if (s === "awaiting-input") setCurrentStep(11);
      if (s === "awaiting-input") { setAwaitingInput({ key: "mfa", label: log }); setInputValue(""); }
      if (log.includes("Looking for Payroll Processing")) setPayrollStep(0);
      if (log.includes("Looking for next approaching") || log.includes("Waiting for Payroll Today")) setPayrollStep(1);
      if (log.includes("Looking for Create Checks") || log.includes("Create Checks:")) setPayrollStep(2);
      if (s === "login-complete") {
        setStatus("login-complete");
        setPhase("payroll");
        setPayrollStep(0);
        // Auto-trigger payroll if toggle is on
        const auto = localStorage.getItem("autoPayroll") === "true";
        if (auto) {
          window.dispatchEvent(new CustomEvent("overmind:payroll:input", {
            detail: { key: "run-payroll", value: "yes" },
          }));
        }
      }
      if (s === "done") { setStatus("done"); setAwaitingInput(null); }
      if (s === "error") { setStatus("error"); setAwaitingInput(null); }
    };
    const onCredsSaved = () => { setCredsSaved(true); setSavingCreds(false); };

    window.addEventListener("overmind:payroll:log", onLog);
    window.addEventListener("overmind:ext:credentialsSaved", onCredsSaved);
    return () => {
      window.removeEventListener("overmind:payroll:log", onLog);
      window.removeEventListener("overmind:ext:credentialsSaved", onCredsSaved);
    };
  }, []);

  const saveCredentials = () => {
    if (!password) return;
    setSavingCreds(true);
    window.dispatchEvent(new CustomEvent("overmind:ext:saveCredentials", {
      detail: { email, password },
    }));
    // Fallback if ack never comes
    setTimeout(() => { setSavingCreds(false); setCredsSaved(true); }, 3000);
  };

  const runJob = () => {
    if (!extReady || !credsSaved) return;
    setStatus("running");
    setLogs([]);
    setCurrentStep(0);
    window.dispatchEvent(new CustomEvent("overmind:payroll:run"));

    const timer = setTimeout(() => {
      setStatus((prev) => {
        if (prev !== "running") return prev;
        setLogs([{ text: "No response from extension — reload extension and refresh this page.", status: "error" }]);
        return "error";
      });
    }, 5000);
    const cancel = () => { clearTimeout(timer); window.removeEventListener("overmind:payroll:log", cancel); };
    window.addEventListener("overmind:payroll:log", cancel);
  };

  const submitInput = () => {
    if (!awaitingInput || !inputValue.trim()) return;
    window.dispatchEvent(new CustomEvent("overmind:payroll:input", {
      detail: { key: awaitingInput.key, value: inputValue.trim() },
    }));
    setAwaitingInput(null);
    setInputValue("");
  };

  const toggleAutoPayroll = (val: boolean) => {
    setAutoPayroll(val);
    localStorage.setItem("autoPayroll", val ? "true" : "false");
  };

  const runPayrollNow = () => {
    window.dispatchEvent(new CustomEvent("overmind:payroll:input", {
      detail: { key: "run-payroll", value: "yes" },
    }));
    setStatus("running");
  };

  const reset = () => {
    setStatus("idle"); setLogs([]); setCurrentStep(-1);
    setAwaitingInput(null); setPayrollStep(-1); setPhase("login");
  };

  // Auto-start when ?autostart=1 is in the URL and extension + creds are ready
  useEffect(() => {
    if (typeof window === "undefined") return;
    const autostart = new URLSearchParams(window.location.search).get("autostart") === "1";
    if (autostart && extReady && credsSaved && status === "idle") {
      runJob();
    }
  }, [extReady, credsSaved, status]);

  // Poll localStorage for a PIN delivered by the relay page
  useEffect(() => {
    if (!awaitingInput) return;
    const interval = setInterval(() => {
      const pin = localStorage.getItem("overmind_payroll_pin");
      if (pin) {
        localStorage.removeItem("overmind_payroll_pin");
        window.dispatchEvent(new CustomEvent("overmind:payroll:input", {
          detail: { key: "mfa", value: pin },
        }));
        setAwaitingInput(null);
        setInputValue("");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [awaitingInput]);

  const ready = extReady && credsSaved;

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> restaurant_os.exe <span className="text-green-800">/ payroll</span>
          </p>
          <h1 className="text-3xl font-black font-mono text-green-300">Payroll Automation</h1>
          <p className="text-green-700 text-sm font-mono mt-1">King&apos;s BBQ, Burgers, &amp; More · Powered by FigurePOS</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">

            {/* Credentials card */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono font-bold text-green-500 uppercase tracking-wider">FigurePOS Login</span>
                {credsSaved && <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />}
              </div>
              <p className="text-xs text-green-800 font-mono mb-1">Email</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-green-500/20 rounded px-2 py-1.5 text-xs font-mono text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500/40 mb-3"
              />
              {!credsSaved ? (
                <>
                  <p className="text-xs text-green-800 font-mono mb-1">Password <span className="text-green-900">(stored locally in extension)</span></p>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCredentials()}
                    placeholder="Enter FigurePOS password"
                    className="w-full bg-black/40 border border-green-500/20 rounded px-2 py-1.5 text-xs font-mono text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500/40 mb-2"
                  />
                  <button
                    onClick={saveCredentials}
                    disabled={!password || !extReady || savingCreds}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 font-mono text-xs font-bold hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingCreds ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : "Save Credentials"}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-green-400">
                  <CheckCircle className="w-3 h-3" /> Credentials saved
                  <button onClick={() => setCredsSaved(false)} className="ml-auto text-green-800 hover:text-green-600">change</button>
                </div>
              )}
            </div>

            {/* Run button */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-5 text-center">
              <div className={`flex items-center justify-center gap-1.5 text-xs font-mono mb-4 px-3 py-1.5 rounded-full border w-fit mx-auto ${
                extReady ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}>
                {extReady ? <><Wifi className="w-3 h-3" /> Extension connected</> : <><WifiOff className="w-3 h-3" /> Extension not detected</>}
              </div>

              {status === "idle" && (
                <button onClick={runJob} disabled={!ready}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-mono font-bold transition-all ${
                    ready ? "bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20" : "bg-black/20 border border-green-500/10 text-green-900 cursor-not-allowed"
                  }`}>
                  <Play className="w-4 h-4" /> START JOB
                </button>
              )}
              {status === "running" && (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/5 border border-green-500/20 text-green-600 font-mono font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" /> RUNNING...
                </div>
              )}
              {status === "login-complete" && !autoPayroll && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-xs font-bold">
                    <CheckCircle className="w-3 h-3" /> LOGGED IN
                  </div>
                  <button onClick={runPayrollNow}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono font-bold hover:bg-blue-500/20 transition-all">
                    <Play className="w-4 h-4" /> RUN PAYROLL
                  </button>
                </div>
              )}
              {status === "done" && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 font-mono font-bold">
                    <CheckCircle className="w-4 h-4" /> COMPLETE
                  </div>
                  <button onClick={reset} className="text-xs text-green-700 font-mono hover:text-green-500">run again</button>
                </div>
              )}
              {status === "error" && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-mono font-bold">
                    <AlertCircle className="w-4 h-4" /> FAILED
                  </div>
                  <button onClick={reset} className="text-xs text-green-700 font-mono hover:text-green-500">try again</button>
                </div>
              )}

              {!extReady && (
                <div className="mt-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Puzzle className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs font-mono text-yellow-500">Install extension first</span>
                  </div>
                  <ol className="space-y-1 text-xs text-green-800 font-mono">
                    <li><span className="text-red-500">1.</span> chrome://extensions → Developer mode</li>
                    <li><span className="text-red-500">2.</span> Load unpacked → chrome-extension/ folder</li>
                    <li><span className="text-red-500">3.</span> Refresh this page</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Auto-payroll toggle */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-bold text-green-500 uppercase tracking-wider">Auto-run Payroll</p>
                  <p className="text-xs text-green-800 font-mono mt-0.5">Start payroll automation after login</p>
                </div>
                <button
                  onClick={() => toggleAutoPayroll(!autoPayroll)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${autoPayroll ? "bg-green-500/30 border-green-500/50" : "bg-black/40 border-green-500/20"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoPayroll ? "left-5 bg-green-400" : "left-0.5 bg-green-900"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Right column — log terminal + step trackers */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 min-h-96 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20">
                <Terminal className="w-4 h-4 text-green-500" />
                <span className="text-xs font-mono font-semibold text-green-500 uppercase tracking-wider">Job Log</span>
                {status === "running" && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-mono text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
                {logs.length === 0 && (
                  <p className="text-green-800">
                    {!credsSaved ? "Save your FigurePOS password in the credentials card to get started." : extReady ? "Ready. Press START JOB." : "Extension not connected."}
                  </p>
                )}
                {logs.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-800 flex-shrink-0">{entry.status === "done" ? "✓" : entry.status === "error" ? "✗" : ">"}</span>
                    <span className={entry.status === "done" ? "text-green-400" : entry.status === "error" ? "text-red-400" : "text-green-300"}>{entry.text}</span>
                  </div>
                ))}
                {awaitingInput && (
                  <div className="mt-3 p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/5">
                    <p className="text-yellow-400 font-mono text-xs mb-2">&gt; {awaitingInput.label}</p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitInput()}
                        placeholder="000000"
                        className="flex-1 bg-black/60 border border-yellow-500/40 rounded px-2 py-1.5 text-sm font-mono text-yellow-300 placeholder-yellow-900 focus:outline-none focus:border-yellow-400/60 tracking-widest"
                      />
                      <button
                        onClick={submitInput}
                        disabled={!inputValue.trim()}
                        className="px-3 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-mono text-xs font-bold hover:bg-yellow-500/20 disabled:opacity-40"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}
                {status === "running" && !awaitingInput && <div className="flex items-center gap-1 text-green-600"><span>&gt;</span><span className="animate-pulse">_</span></div>}
              </div>
            </div>

            {/* Step trackers — side by side below log */}
            <div className="grid grid-cols-2 gap-4">

              {/* Login steps */}
              <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
                <p className="text-xs text-green-600 font-mono uppercase tracking-widest mb-3">
                  <span className="text-red-500">&gt;</span> login steps
                </p>
                <div className="space-y-2">
                  {loginSteps.map((step, i) => {
                    const isDone = i < currentStep || phase === "payroll";
                    const isActive = i === currentStep && phase === "login";
                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isDone ? "bg-green-500/20 border-green-500/50" : isActive ? "bg-green-500/10 border-green-400/50" : "bg-black/20 border-green-500/10"}`}>
                          {isDone && <CheckCircle className="w-3 h-3 text-green-400" />}
                          {isActive && <Loader2 className="w-3 h-3 text-green-400 animate-spin" />}
                          {!isDone && !isActive && <span className="text-green-900 font-mono" style={{ fontSize: "9px" }}>{i + 1}</span>}
                        </div>
                        <span className={`text-xs font-mono flex-1 ${isDone ? "text-green-400" : isActive ? "text-green-300" : "text-green-700"}`}>{step}</span>
                        <button
                          title="Run from this login step (active tab must be on the correct page)"
                          onClick={() => {
                            setStatus("running"); setLogs([]); setPhase("login"); setCurrentStep(i);
                            window.dispatchEvent(new CustomEvent("overmind:payroll:run-login-from", { detail: { step: i } }));
                          }}
                          className="px-2 py-1 rounded bg-green-500/25 border border-green-400/60 text-green-300 font-mono text-xs font-bold hover:bg-green-500/50 hover:text-white transition-all"
                        >▶</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payroll steps */}
              <div className="holo-card rounded-xl border border-blue-500/20 bg-black/40 p-4">
                <p className="text-xs text-blue-600 font-mono uppercase tracking-widest mb-3">
                  <span className="text-red-500">&gt;</span> payroll steps
                </p>
                <div className="space-y-2">
                  {payrollSteps.map((step, i) => {
                    const isDone = status === "done" && i <= payrollStep;
                    const isActive = i === payrollStep && status === "running";
                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isDone ? "bg-blue-500/20 border-blue-500/50" : isActive ? "bg-blue-500/10 border-blue-400/50" : "bg-black/20 border-blue-500/10"}`}>
                          {isDone && <CheckCircle className="w-3 h-3 text-blue-400" />}
                          {isActive && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                          {!isDone && !isActive && <span className="text-green-900 font-mono" style={{ fontSize: "9px" }}>{i + 1}</span>}
                        </div>
                        <span className={`text-xs font-mono flex-1 ${isDone ? "text-blue-400" : isActive ? "text-blue-300" : "text-green-700"}`}>{step}</span>
                        <button
                          title="Run this payroll step on the active tab"
                          onClick={() => {
                            setStatus("running"); setLogs([]); setPhase("payroll"); setPayrollStep(i);
                            window.dispatchEvent(new CustomEvent("overmind:payroll:run-from", { detail: { step: i } }));
                          }}
                          className="px-2 py-1 rounded bg-blue-500/25 border border-blue-400/60 text-blue-300 font-mono text-xs font-bold hover:bg-blue-500/50 hover:text-white transition-all"
                        >▶</button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
