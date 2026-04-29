"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { DollarSign, Play, CheckCircle, AlertCircle, Loader2, Terminal, Puzzle, Wifi, WifiOff, KeyRound } from "lucide-react";

type Status = "idle" | "running" | "done" | "error";
interface LogEntry { text: string; status: Status; }

const steps = [
  "Open FigurePOS login page",
  "Fill credentials & log in",
  "Navigate to Timesheets",
  "Pull & process timesheet data",
  "Close FigurePOS tab",
  "Open Payroll Solutions",
  "Navigate to Asure Central",
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
  const logRef = useRef<HTMLDivElement>(null);

  // Ping extension on mount
  useEffect(() => {
    const onReady = () => setExtReady(true);
    window.addEventListener("overmind:ext:ready", onReady);
    window.dispatchEvent(new CustomEvent("overmind:ext:ping"));
    return () => window.removeEventListener("overmind:ext:ready", onReady);
  }, []);

  // Listen for log messages and credential save ack
  useEffect(() => {
    const onLog = (e: Event) => {
      const { log, status: s } = (e as CustomEvent).detail as { log: string; status: string };
      const mapped: Status = s === "done" ? "done" : s === "error" ? "error" : "running";
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
      if (s === "done") setStatus("done");
      if (s === "error") setStatus("error");
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

  const reset = () => { setStatus("idle"); setLogs([]); setCurrentStep(-1); };

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

            {/* Step tracker */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <p className="text-xs text-green-600 font-mono uppercase tracking-widest mb-3">
                <span className="text-red-500">&gt;</span> workflow steps
              </p>
              <div className="space-y-3">
                {steps.map((step, i) => {
                  const isDone = (status === "done" && i <= currentStep) || (status !== "done" && i < currentStep);
                  const isActive = i === currentStep && status === "running";
                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isDone ? "bg-green-500/20 border-green-500/50" : isActive ? "bg-green-500/10 border-green-400/50" : "bg-black/20 border-green-500/10"}`}>
                        {isDone && <CheckCircle className="w-3 h-3 text-green-400" />}
                        {isActive && <Loader2 className="w-3 h-3 text-green-400 animate-spin" />}
                        {!isDone && !isActive && <span className="text-green-900 font-mono" style={{ fontSize: "9px" }}>{i + 1}</span>}
                      </div>
                      <span className={`text-xs font-mono ${isDone ? "text-green-400" : isActive ? "text-green-300" : "text-green-700"}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Log terminal */}
          <div className="col-span-2">
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 h-full min-h-96 flex flex-col">
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
                {status === "running" && <div className="flex items-center gap-1 text-green-600"><span>&gt;</span><span className="animate-pulse">_</span></div>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
