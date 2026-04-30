"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle } from "lucide-react";

function RelayContent() {
  const searchParams = useSearchParams();
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const pin = searchParams.get("pin");
    if (!pin || !/^\d{6}$/.test(pin)) {
      setError("Invalid or missing PIN.");
      return;
    }
    localStorage.setItem("overmind_payroll_pin", pin);
    setDelivered(true);
    window.close();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono">
      {delivered && (
        <div className="flex items-center gap-3 text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          PIN delivered — you can close this tab.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
    </div>
  );
}

export default function PayrollRelayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <RelayContent />
    </Suspense>
  );
}
