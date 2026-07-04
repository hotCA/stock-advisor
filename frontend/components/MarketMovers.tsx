"use client";

import type { Mover } from "@/lib/api";

interface Props {
  gainers: Mover[];
  losers: Mover[];
}

function MoverRow({
  m,
  isGainer,
  maxAbsPct,
}: {
  m: Mover;
  isGainer: boolean;
  maxAbsPct: number;
}) {
  const color = isGainer ? "text-green-400" : "text-red-400";
  const sign = isGainer ? "+" : "";
  const barColor = isGainer
    ? "bg-gradient-to-r from-green-500/15 to-green-500/40"
    : "bg-gradient-to-l from-red-500/15 to-red-500/40";
  // Bar length proportional to this row's |% change| vs the section's max.
  const widthPct =
    maxAbsPct > 0 ? Math.min(100, (Math.abs(m.change_pct) / maxAbsPct) * 100) : 0;

  return (
    <div className="relative py-2 border-b border-[#21262d] last:border-0">
      {/* Background bar */}
      <div
        className={`absolute inset-y-1 rounded ${barColor} ${isGainer ? "left-0" : "right-0"}`}
        style={{ width: `${widthPct}%` }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm w-14">{m.symbol}</span>
          <span className="text-zinc-400 text-sm">${m.price.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">
            {(m.volume / 1e6).toFixed(1)}M vol
          </span>
          <span className={`font-bold text-sm ${color}`}>
            {sign}
            {m.change_pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MarketMovers({ gainers, losers }: Props) {
  const topGainers = gainers.slice(0, 8);
  const topLosers = losers.slice(0, 8);
  const maxGain = Math.max(...topGainers.map((m) => m.change_pct), 0);
  const maxLoss = Math.max(...topLosers.map((m) => Math.abs(m.change_pct)), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Top Gainers
        </h2>
        {topGainers.map((m) => (
          <MoverRow key={m.symbol} m={m} isGainer maxAbsPct={maxGain} />
        ))}
      </div>
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Top Losers
        </h2>
        {topLosers.map((m) => (
          <MoverRow key={m.symbol} m={m} isGainer={false} maxAbsPct={maxLoss} />
        ))}
      </div>
    </div>
  );
}
