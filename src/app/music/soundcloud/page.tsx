import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { Radio, ChevronLeft, Upload, Music2, Tag } from "lucide-react";

export default function SoundCloudPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        <div className="mb-2">
          <Link href="/music" className="flex items-center gap-1 text-xs text-green-700 font-mono hover:text-green-400 transition-colors">
            <ChevronLeft className="w-3 h-3" /> back to music
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> soundcloud.exe
          </p>
          <h1 className="text-3xl font-black font-mono text-green-300">SoundCloud</h1>
          <p className="text-green-700 text-sm font-mono mt-1">@djthirstyboy · Audio distribution</p>
        </div>

        <div className="holo-card rounded-xl border border-orange-500/20 bg-black/40">
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="relative w-16 h-16 mb-6">
              <span className="ping-slow absolute inset-0 rounded-full bg-orange-500/20" />
              <div className="relative w-16 h-16 rounded-full bg-orange-500/5 border border-orange-500/30 flex items-center justify-center">
                <Radio className="w-7 h-7 text-orange-500/60" />
              </div>
            </div>
            <h3 className="font-bold font-mono text-green-400 mb-2 glow-text">COMING SOON</h3>
            <p className="text-sm text-green-700 font-mono max-w-sm mb-6">
              Auto-upload audio tracks with AI-generated titles, tags, and descriptions.
            </p>
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              {[
                { icon: Upload,  label: "Auto-upload" },
                { icon: Tag,     label: "AI tagging"  },
                { icon: Music2,  label: "7 personas"  },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="p-3 rounded-lg border border-green-500/15 bg-black/40 text-center">
                  <Icon className="w-4 h-4 text-green-700 mx-auto mb-1" />
                  <p className="text-xs text-green-800 font-mono">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
