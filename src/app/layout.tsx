import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Overmind",
  description: "Your AI-powered command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>

        {/* Layer 1 — solid dark base (lowest) */}
        <div className="fixed inset-0 bg-background" style={{ zIndex: -10 }} aria-hidden />

        {/* Layer 2 — aurora orbs on top of base, below content */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -5 }} aria-hidden>
          {/* Violet orb — top left */}
          <div className="aurora-orb-1 absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)", filter: "blur(60px)" }} />
          {/* Cyan orb — bottom right */}
          <div className="aurora-orb-2 absolute -bottom-48 -right-48 w-[800px] h-[800px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0.08) 40%, transparent 70%)", filter: "blur(70px)" }} />
          {/* Pink orb — center right */}
          <div className="aurora-orb-3 absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(244,114,182,0.2) 0%, rgba(244,114,182,0.06) 40%, transparent 70%)", filter: "blur(80px)" }} />
          {/* Scanline sweep */}
          <div className="scanline absolute left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.4) 30%, rgba(96,165,250,0.3) 60%, transparent 100%)" }} />
        </div>

        {/* Layer 3 — page content */}
        {children}

      </body>
    </html>
  );
}
