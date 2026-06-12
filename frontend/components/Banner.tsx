"use client";

import { useState, useEffect } from "react";
import { getIndexes, getMovers, type MarketIndex, type Mover } from "@/lib/api";

const ET_TZ = "America/New_York";

type TimeParts = { weekday: string; hour: number; minute: number };

function getETParts(d: Date): TimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  return {
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
    hour: parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10),
    minute: parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10),
  };
}

function isMarketOpenET(d: Date): boolean {
  const { weekday, hour, minute } = getETParts(d);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

function formatET(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: ET_TZ }).format(d);
}

interface TapeItem {
  symbol: string;
  value: number;
  changePct: number;
}

export default function Banner() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [indexes, setIndexes] = useState<MarketIndex[]>([]);
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const [idx, mv] = await Promise.all([getIndexes(), getMovers()]);
        if (!alive) return;
        setIndexes(idx.data ?? []);
        setGainers(mv.data?.gainers ?? []);
        setLosers(mv.data?.losers ?? []);
      } catch {}
    };
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const open = mounted ? isMarketOpenET(now) : false;
  const clock = mounted
    ? formatET(now, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "—— ——";
  const dateStr = mounted
    ? formatET(now, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "";

  // Tape: indexes first, then alternating top gainers/losers for visual rhythm
  const indexItems: TapeItem[] = indexes.map((i) => ({
    symbol: i.short,
    value: i.price,
    changePct: i.change_pct,
  }));
  const moverItems: TapeItem[] = [];
  const topG = gainers.slice(0, 6);
  const topL = losers.slice(0, 6);
  const len = Math.max(topG.length, topL.length);
  for (let i = 0; i < len; i++) {
    if (topG[i]) moverItems.push({ symbol: topG[i].symbol, value: topG[i].price, changePct: topG[i].change_pct });
    if (topL[i]) moverItems.push({ symbol: topL[i].symbol, value: topL[i].price, changePct: topL[i].change_pct });
  }
  const tape: TapeItem[] = [...indexItems, ...moverItems];

  return (
    <header className="border-b border-[#21262d] bg-gradient-to-b from-[#0d1117] via-[#161b22] to-[#161b22]">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-500/40">
              <span className="relative z-10 leading-none">$</span>
              <div className="absolute inset-0 rounded-lg bg-blue-500/40 blur-md -z-10" aria-hidden />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base tracking-[0.18em] text-zinc-100">
                STOCK<span className="text-blue-400">·</span>ADVISOR
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.25em]">
                AI Trading Intelligence
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center text-[10px] text-zinc-500 border border-zinc-800 bg-[#0f1117] px-2 py-0.5 rounded font-mono ml-1">
              US · NYSE
            </span>
          </div>

          {/* Status + clock + date */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                open
                  ? "text-green-400 bg-green-500/10 border-green-500/30"
                  : "text-zinc-400 bg-zinc-500/10 border-zinc-700/60"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {open && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    open ? "bg-green-500" : "bg-zinc-500"
                  }`}
                />
              </span>
              {open ? "Market Open" : "Market Closed"}
            </div>

            <div className="hidden md:flex flex-col text-right leading-tight">
              <span className="font-mono font-semibold text-sm text-zinc-200 tabular-nums" suppressHydrationWarning>
                {clock} <span className="text-zinc-500 text-[10px] tracking-widest">ET</span>
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]" suppressHydrationWarning>
                {dateStr}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticker tape */}
      <div className="border-t border-[#21262d] bg-[#0a0d12] overflow-hidden relative">
        {/* Soft edge fades so the tape "fades in/out" at the page edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0d12] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0d12] to-transparent z-10 pointer-events-none" />

        {tape.length === 0 ? (
          <div className="py-1.5 text-center text-[10px] text-zinc-700 font-mono tracking-widest">
            ── LIVE TAPE INITIALIZING ──
          </div>
        ) : (
          <div className="ticker-scroll flex items-center gap-6 py-1.5 whitespace-nowrap will-change-transform">
            {[...tape, ...tape].map((item, i) => {
              const up = item.changePct >= 0;
              return (
                <div key={i} className="flex items-baseline gap-1.5 font-mono text-xs flex-shrink-0">
                  <span className="text-zinc-300 font-semibold tracking-wider">{item.symbol}</span>
                  <span className="text-zinc-400 tabular-nums">
                    {item.value.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={`tabular-nums font-semibold ${up ? "text-green-400" : "text-red-400"}`}
                  >
                    {up ? "▲" : "▼"} {up ? "+" : ""}
                    {item.changePct.toFixed(2)}%
                  </span>
                  <span className="text-zinc-700 ml-3 select-none">│</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
