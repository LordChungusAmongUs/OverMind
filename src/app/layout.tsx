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
        {/* Aurora background orbs — fixed, behind everything */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
          {/* Orb 1 — violet, top-left */}
          <div className="aurora-orb-1 absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
          {/* Orb 2 — cyan/blue, bottom-right */}
          <div className="aurora-orb-2 absolute -bottom-48 -right-48 w-[700px] h-[700px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 70%)", filter: "blur(50px)" }} />
          {/* Orb 3 — pink, center-right */}
          <div className="aurora-orb-3 absolute top-1/2 right-1/4 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(244,114,182,0.1) 0%, transparent 70%)", filter: "blur(60px)" }} />
          {/* Scanline sweep */}
          <div className="scanline absolute left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.15), rgba(96,165,250,0.1), transparent)" }} />
        </div>

        {/* Page content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
