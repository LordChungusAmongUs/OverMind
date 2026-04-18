import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { Music2, ChevronLeft } from "lucide-react";

export default function NSFWPage_tiktok() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">
        <div className="mb-2">
          <Link href="/nsfw" className="flex items-center gap-1 text-xs text-green-700 font-mono hover:text-green-400 transition-colors">
            <ChevronLeft className="w-3 h-3" /> back to nsfw
          </Link>
        </div>
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1"><span className="text-red-500">&gt;</span> tiktok.exe</p>
          <h1 className="text-3xl font-black font-mono text-green-300">Tiktok</h1>
          <p className="text-green-700 text-sm font-mono mt-1">@djthirstyboy</p>
        </div>
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="relative w-16 h-16 mb-6">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-16 h-16 rounded-full bg-black/60 border border-green-500/20 flex items-center justify-center">
                <Music2 className="w-7 h-7 text-green-700" />
              </div>
            </div>
            <h3 className="font-bold font-mono text-green-400 mb-2 glow-text">COMING SOON</h3>
            <p className="text-sm text-green-700 font-mono max-w-sm">Short-form content and duet automation</p>
          </div>
        </div>
      </main>
    </div>
  );
}
