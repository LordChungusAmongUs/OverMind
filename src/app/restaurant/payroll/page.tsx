"use client";

import { useState, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { DollarSign, Play, CheckCircle, AlertCircle, Loader2, Terminal } from "lucide-react";

type Status = "idle" | "running" | "done" | "error";

interface LogEntry {
  text: string;
  status: Status;
}

const steps = [
  "Open Chrome → FigurePOS.com",
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
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, s: Status) => {
    setLogs((prev) => {
      const next = [...prev, { text, status: s }];
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, 50);
      return next;
    });
  };

  const runJob = async () => {
    setStatus("running");
    setLogs([]);
    setCurrentStep(0);

    try {
      const res = await fetch("/api/payroll/run");
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));
          const s: Status = json.status === "done" ? "done" : json.status === "error" ? "error" : "running";
          addLog(json.log, s);

          if (json.log.includes("Navigating to FigurePOS")) setCurrentStep(0);
          if (json.log.includes("Waiting for auto-login")) setCurrentStep(1);
          if (json.log.includes("Searching for Timesheets")) setCurrentStep(2);
          if (json.status === "done") { setStatus("done"); setCurrentStep(2); }
          if (json.status === "error") { setStatus("error"); }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`ERROR: ${msg}`, "error");
      setStatus("error");
    }
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

          {/* Left col: Run button + steps */}
          <div className="col-span-1 space-y-4">

            {/* Run button */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-lg font-black font-mono text-green-300 mb-1">Run Payroll Job</h2>
              <p className="text-xs text-green-700 font-mono mb-5">
                Pulls timesheets from FigurePOS and calculates pay for all employees.
              </p>

              {status === "idle" && (
                <button
                  onClick={runJob}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 font-mono font-bold hover:bg-green-500/20 hover:border-green-400/50 transition-all"
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

              {status !== "idle" && (
                <p className="text-xs text-green-800 font-mono mt-3">
                  Note: Chrome must be closed before running
                </p>
              )}
            </div>

            {/* Step tracker */}
            <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <p className="text-xs text-green-600 font-mono uppercase tracking-widest mb-3">
                <span className="text-red-500">&gt;</span> workflow steps
              </p>
              <div className="space-y-3">
                {steps.map((step, i) => {
                  const isDone = status === "done" ? i <= currentStep : i < currentStep;
                  const isActive = i === currentStep && status === "running";
                  const isLocked = i > 2; // future steps not yet built

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
                  <p className="text-green-800">Press START JOB to begin the payroll automation...</p>
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
