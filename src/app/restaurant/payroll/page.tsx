"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { DollarSign, Play, CheckCircle, AlertCircle, Loader2, Terminal, Puzzle, Wifi, WifiOff } from "lucide-react";

type Status = "idle" | "running" | "done" | "error";

interface LogEntry {
  text: string;
  status: Status;
}

const steps = [
  "Open FigurePOS in new tab",
  "Wait for auto-login",
  "Navigate to Timesheets",
  "Pull timesheet data",
  "Calculate payroll",
  "Generate pay stubs",
];

export default function PayrollPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [extReady, setExtReady] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Ping the extension; it pongs back with overmind:ext:ready
  useEffect(() => {
    const onReady = () => setExtReady(true);
    window.addEventListener("overmind:ext:ready", onReady);
    window.dispatchEvent(new CustomEvent("overmind:ext:ping"));
    return () => window.removeEventListener("overmind:ext:ready", onReady);
  }, []);

  // Listen for log messages from the extension
  useEffect(() => {
    const handler = (e: Event) => {
      const { log, status: s } = (e as CustomEvent).detail as { log: string; status: string };
      const mapped: Status = s === "done" ? "done" : s === "error" ? "error" : "running";

      setLogs((prev) => {
        const next = [...prev, { text: log, status: mapped }];
        setTimeout(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        }, 50);
        return next;
      });

      if (log.includes("Opening FigurePOS")) setCurrentStep(0);
      if (log.includes("Waiting for auto-login")) setCurrentStep(1);
      if (log.includes("Looking for Management")) setCurrentStep(2);
      if (s === "done") setStatus("done");
      if (s === "error") setStatus("error");
    };

    window.addEventListener("overmind:payroll:log", handler);
    return () => window.removeEventListener("overmind:payroll:log", handler);
  }, []);

  const runJob = () => {
    if (!extReady) return;
    setStatus("running");
    setLogs([]);
    setCurrentStep(0);
    window.dispatchEvent(new CustomEvent("overmind:payroll:run"));
  };

  const reset = () => {
    setStatus("idle");
    setLogs([]);
    setCurrentStep(-1);
  };

  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> restaurant_os.exe <span className="text-green-800">/ payroll</span>
          </p>
          <h1 className="text-3xl font-black font-mono text-green-300">Payroll Automation</h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            King&apos;s BBQ, Burgers, &amp; More · Powered by FigurePOS
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Left col */}
          <div className="col-span-1 space-y-4">

            {/* Run button card */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-lg font-black font-mono text-green-300 mb-1">Run Payroll Job</h2>
              <p className="text-xs text-green-700 font-mono mb-4">
                Pulls timesheets from FigurePOS and calculates pay for all employees.
              </p>

              {/* Extension status badge */}
              <div className={`flex items-center justify-center gap-1.5 text-xs font-mono mb-5 px-3 py-1.5 rounded-full border w-fit mx-auto ${
                extReady
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}>
                {extReady
                  ? <><Wifi className="w-3 h-3" /> Extension connected</>
                  : <><WifiOff className="w-3 h-3" /> Extension not detected</>
                }
              </div>

              {status === "idle" && (
                <button
                  onClick={runJob}
                  disabled={!extReady}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-mono font-bold transition-all ${
                    extReady
                      ? "bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 hover:border-green-400/50"
                      : "bg-black/20 border border-green-500/10 text-green-900 cursor-not-allowed"
                  }`}
                >
                  <Play className="w-4 h-4" />
                  START JOB
                </button>
              )}

              {status === "running" && (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/5 border border-green-500/20 text-green-600 font-mono font-bold cursor-default">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  RUNNING...
                </div>
              )}

              {status === "done" && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 font-mono font-bold">
                    <CheckCircle className="w-4 h-4" />
                    COMPLETE
                  </div>
                  <button onClick={reset} className="w-full text-xs text-green-700 font-mono hover:text-green-500 transition-colors">
                    run again
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-mono font-bold">
                    <AlertCircle className="w-4 h-4" />
                    FAILED
                  </div>
                  <button onClick={reset} className="w-full text-xs text-green-700 font-mono hover:text-green-500 transition-colors">
                    try again
                  </button>
                </div>
              )}
            </div>

            {/* Extension install instructions (shown when not connected) */}
            {!extReady && (
              <div className="holo-card rounded-xl border border-yellow-500/20 bg-black/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Puzzle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Install Extension</span>
                </div>
                <p className="text-xs text-green-700 font-mono mb-3">
                  One-time setup — lets Overmind control your existing Chrome window.
                </p>
                <ol className="space-y-1.5 text-xs text-green-700 font-mono">
                  <li><span className="text-red-500">1.</span> Go to <span className="text-green-400">chrome://extensions</span></li>
                  <li><span className="text-red-500">2.</span> Enable <span className="text-green-400">Developer mode</span> (top right)</li>
                  <li><span className="text-red-500">3.</span> Click <span className="text-green-400">Load unpacked</span></li>
                  <li><span className="text-red-500">4.</span> Select the <span className="text-green-400">chrome-extension/</span> folder in the Overmind project</li>
                  <li><span className="text-red-500">5.</span> Refresh this page</li>
                </ol>
              </div>
            )}

            {/* Step tracker */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <p className="text-xs text-green-600 font-mono uppercase tracking-widest mb-3">
                <span className="text-red-500">&gt;</span> workflow steps
              </p>
              <div className="space-y-3">
                {steps.map((step, i) => {
                  const isDone = (status === "done" && i <= currentStep) || (status !== "done" && i < currentStep);
                  const isActive = i === currentStep && status === "running";
                  const isLocked = i > 2;

                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        isDone ? "bg-green-500/20 border-green-500/50" :
                        isActive ? "bg-green-500/10 border-green-400/50" :
                        "bg-black/20 border-green-500/10"
                      }`}>
                        {isDone && <CheckCircle className="w-3 h-3 text-green-400" />}
                        {isActive && <Loader2 className="w-3 h-3 text-green-400 animate-spin" />}
                        {!isDone && !isActive && (
                          <span className="text-green-900 font-mono" style={{ fontSize: "9px" }}>{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-xs font-mono ${
                        isDone ? "text-green-400" :
                        isActive ? "text-green-300" :
                        isLocked ? "text-green-900" :
                        "text-green-700"
                      }`}>
                        {step}
                        {isLocked && <span className="ml-1 text-green-900">[ soon ]</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right col: Log terminal */}
          <div className="col-span-2">
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 h-full min-h-96 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20">
                <Terminal className="w-4 h-4 text-green-500" />
                <span className="text-xs font-mono font-semibold text-green-500 uppercase tracking-wider">Job Log</span>
                {status === "running" && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-mono text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
                {logs.length === 0 && (
                  <p className="text-green-800">
                    {extReady
                      ? "Extension connected. Press START JOB to begin."
                      : "Waiting for extension... Install it using the guide on the left, then refresh this page."}
                  </p>
                )}
                {logs.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-800 flex-shrink-0">
                      {entry.status === "done" ? "✓" : entry.status === "error" ? "✗" : ">"}
                    </span>
                    <span className={
                      entry.status === "done" ? "text-green-400" :
                      entry.status === "error" ? "text-red-400" :
                      "text-green-300"
                    }>
                      {entry.text}
                    </span>
                  </div>
                ))}
                {status === "running" && (
                  <div className="flex items-center gap-1 text-green-600">
                    <span>&gt;</span>
                    <span className="animate-pulse">_</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
