"use client";

import type { Mover } from "@/lib/api";

interface Props {
  gainers: Mover[];
  losers: Mover[];
}

function MoverRow({ m, isGainer }: { m: Mover; isGainer: boolean }) {
  const color = isGainer ? "text-green-400" : "text-red-400";
  const sign = isGainer ? "+" : "";
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#21262d] last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm w-14">{m.symbol}</span>
        <span className="text-zinc-400 text-sm">${m.price.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-500">{(m.volume / 1e6).toFixed(1)}M vol</span>
        <span className={`font-bold text-sm ${color}`}>
          {sign}{m.change_pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function MarketMovers({ gainers, losers }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Top Gainers
        </h2>
        {gainers.slice(0, 8).map((m) => (
          <MoverRow key={m.symbol} m={m} isGainer />
        ))}
      </div>
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Top Losers
        </h2>
        {losers.slice(0, 8).map((m) => (
          <MoverRow key={m.symbol} m={m} isGainer={false} />
        ))}
      </div>
    </div>
  );
}
