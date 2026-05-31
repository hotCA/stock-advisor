import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Advisor AI",
  description: "Daily AI-powered market intelligence and signals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0f1117] text-[#e6edf3] antialiased" suppressHydrationWarning>
        <header className="border-b border-[#21262d] bg-[#161b22]">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                AI
              </div>
              <span className="font-semibold text-lg tracking-tight">Stock Advisor</span>
              <span className="text-xs text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded">
                US Markets
              </span>
            </div>
            <div className="text-sm text-zinc-400">
              Powered by Claude Opus 4.7
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
