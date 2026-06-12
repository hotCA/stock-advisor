import type { Metadata } from "next";
import "./globals.css";
import Banner from "@/components/Banner";

export const metadata: Metadata = {
  title: "Stock Advisor AI",
  description: "Daily AI-powered market intelligence and signals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0f1117] text-[#e6edf3] antialiased" suppressHydrationWarning>
        <Banner />
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
