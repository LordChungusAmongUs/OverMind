import Sidebar from "@/components/layout/Sidebar";
import SkateGame from "@/components/skate/SkateGame";

export const metadata = {
  title: "Skate · Overmind",
  description: "Top-down arcade skateboarding — 4-quarter score battle.",
};

export default function SkatePage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 flex flex-col items-center">
        <div className="w-full max-w-3xl mb-4">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase">
            Arcade · Top-Down · 4-Quarter PSL
          </p>
          <h1 className="text-3xl font-black mt-2 font-mono">
            <span className="gradient-text">Pixel Skate League</span>
          </h1>
          <p className="text-green-600 text-sm mt-1 font-mono">
            <span className="text-red-500">&gt;</span> Click the screen to focus, then push (Space) and start landing tricks.
          </p>
        </div>

        <SkateGame />
      </main>
    </div>
  );
}
