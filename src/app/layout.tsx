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

        {/* Layer 1 — solid near-black base */}
        <div className="fixed inset-0 bg-background" style={{ zIndex: -10 }} aria-hidden />

        {/* Layer 2 — CRT grid + orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -5 }} aria-hidden>

          {/* Subtle CRT grid lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,65,0.025) 3px, rgba(0,255,65,0.025) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,255,65,0.015) 3px, rgba(0,255,65,0.015) 4px)
            `
          }} />

          {/* Green orb — top left, dominant */}
          <div className="aurora-orb-1 absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(0,255,65,0.3) 0%, rgba(0,200,50,0.1) 40%, transparent 70%)", filter: "blur(60px)" }} />

          {/* Red orb — bottom right */}
          <div className="aurora-orb-2 absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,20,40,0.25) 0%, rgba(200,0,30,0.08) 40%, transparent 70%)", filter: "blur(70px)" }} />

          {/* Green orb — center, faint */}
          <div className="aurora-orb-3 absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ background: "radial-gradient(circle, rgba(0,180,50,0.12) 0%, transparent 65%)", filter: "blur(80px)" }} />

          {/* Red accent — top right */}
          <div className="aurora-orb-1 absolute -top-20 -right-20 w-[350px] h-[350px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,40,0,0.18) 0%, transparent 65%)", filter: "blur(50px)", animationDuration: "22s", animationDirection: "reverse" }} />

          {/* Scanline sweep */}
          <div className="scanline absolute left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.5) 40%, rgba(0,255,65,0.5) 60%, transparent 100%)" }} />

        </div>

        {/* Layer 3 — page content */}
        {children}

      </body>
    </html>
  );
}
