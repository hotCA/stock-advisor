"use client";

import type { Mover } from "@/lib/api";

interface Props {
  gainers: Mover[];
  losers: Mover[];
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

export default function MarketBreadth({ gainers, losers }: Props) {
  const gCount = gainers.length;
  const lCount = losers.length;
  const total = gCount + lCount;
  const gPct = total > 0 ? (gCount / total) * 100 : 50;
  const lPct = 100 - gPct;

  const avgGain = avg(gainers.map((m) => m.change_pct));
  const avgLoss = avg(losers.map((m) => m.change_pct));

  // Tilt indicator: positive = bullish, negative = bearish
  const breadth = gCount - lCount;
  const breadthLabel =
    Math.abs(breadth) <= 2
      ? "Mixed"
      : breadth > 0
      ? breadth > 8
        ? "Strongly Bullish"
        : "Bullish"
      : breadth < -8
      ? "Strongly Bearish"
      : "Bearish";

  const breadthColor =
    Math.abs(breadth) <= 2
      ? "text-zinc-400"
      : breadth > 0
      ? "text-green-400"
      : "text-red-400";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Market Breadth
        </h2>
        <span className={`text-xs font-semibold ${breadthColor}`}>
          {breadthLabel}
        </span>
      </div>

      {/* Seesaw bar */}
      <div className="flex h-7 w-full rounded-md overflow-hidden bg-[#0f1117] border border-[#21262d]">
        <div
          className="bg-gradient-to-r from-green-600/80 to-green-500/60 flex items-center justify-start px-2 transition-all"
          style={{ width: `${gPct}%` }}
        >
          {gPct >= 18 && (
            <span className="text-[11px] font-bold text-green-50">
              ▲ {gCount}
            </span>
          )}
        </div>
        <div
          className="bg-gradient-to-l from-red-600/80 to-red-500/60 flex items-center justify-end px-2 transition-all"
          style={{ width: `${lPct}%` }}
        >
          {lPct >= 18 && (
            <span className="text-[11px] font-bold text-red-50">
              ▼ {lCount}
            </span>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Avg Gainer
          </div>
          <div className="text-base font-bold text-green-400 leading-tight">
            +{avgGain.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Avg Loser
          </div>
          <div className="text-base font-bold text-red-400 leading-tight">
            {avgLoss.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
