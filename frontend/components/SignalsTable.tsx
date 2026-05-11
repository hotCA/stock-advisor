"use client";

import { useState, useEffect } from "react";
import type { Signal, SparklineData } from "@/lib/api";
import Sparkline from "@/components/Sparkline";

const BADGE: Record<string, string> = {
  BUY: "badge-buy",
  SELL: "badge-sell",
  HOLD: "badge-hold",
  WATCH: "badge-watch",
};

const CONF_COLOR: Record<string, string> = {
  High: "text-blue-400",
  Medium: "text-yellow-400",
  Low: "text-zinc-400",
};

interface Props {
  signals: Signal[];
  marketSummary: string;
  sparklines: SparklineData[];
}

const WL_KEY = "watchlist";

function loadWatchlist(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(WL_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function exportCsv(signals: Signal[]) {
  const header = "Symbol,Signal,Confidence,Entry,Target,StopLoss,Reasoning";
  const rows = signals.map((s) =>
    [
      s.symbol,
      s.signal,
      s.confidence,
      s.entry?.toFixed(2) ?? "",
      s.target?.toFixed(2) ?? "",
      s.stop_loss?.toFixed(2) ?? "",
      `"${(s.reasoning ?? "").replace(/"/g, "'")}"`,
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SignalsTable({ signals, marketSummary, sparklines }: Props) {
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWatchlist(loadWatchlist());
  }, []);

  const toggleWatchlist = (symbol: string) => {
    const updated = new Set(watchlist);
    if (updated.has(symbol)) updated.delete(symbol);
    else updated.add(symbol);
    setWatchlist(updated);
    localStorage.setItem(WL_KEY, JSON.stringify([...updated]));
  };

  const sparkMap = new Map(sparklines.map((s) => [s.symbol, s.prices]));

  const sorted = [...signals].sort((a, b) => {
    const aW = watchlist.has(a.symbol) ? -1 : 0;
    const bW = watchlist.has(b.symbol) ? -1 : 0;
    if (aW !== bW) return aW - bW;
    const order: Record<string, number> = { BUY: 0, SELL: 1, WATCH: 2, HOLD: 3 };
    return (order[a.signal] ?? 4) - (order[b.signal] ?? 4);
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          AI Trade Signals
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{signals.length} signals</span>
          <button
            onClick={() => exportCsv(signals)}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded transition-colors text-zinc-300"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {marketSummary && (
        <p className="text-sm text-zinc-400 bg-[#0f1117] rounded-lg p-3 mb-4 border border-[#21262d]">
          {marketSummary}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase border-b border-[#21262d]">
              <th className="text-left pb-2 pr-2 w-6"></th>
              <th className="text-left pb-2 pr-4">Symbol</th>
              <th className="text-left pb-2 pr-4">Signal</th>
              <th className="text-left pb-2 pr-4">Conf.</th>
              <th className="text-left pb-2 pr-4">Trend</th>
              <th className="text-right pb-2 pr-4">Support</th>
              <th className="text-right pb-2 pr-4">Entry</th>
              <th className="text-right pb-2 pr-4">Resist.</th>
              <th className="text-right pb-2 pr-4">Target</th>
              <th className="text-right pb-2 pr-4">Stop</th>
              <th className="text-left pb-2">Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const isWatched = mounted && watchlist.has(s.symbol);
              const prices = sparkMap.get(s.symbol);
              return (
                <tr
                  key={s.symbol}
                  className={`border-b border-[#21262d] last:border-0 hover:bg-[#1c2333] transition-colors ${
                    isWatched ? "bg-blue-950/20" : ""
                  }`}
                >
                  <td className="py-3 pr-2">
                    <button
                      onClick={() => toggleWatchlist(s.symbol)}
                      className={`text-sm transition-colors ${isWatched ? "text-yellow-400" : "text-zinc-700 hover:text-zinc-400"}`}
                      title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {isWatched ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="py-3 pr-4 font-bold">{s.symbol}</td>
                  <td className="py-3 pr-4">
                    <span className={BADGE[s.signal]}>{s.signal}</span>
                  </td>
                  <td className={`py-3 pr-4 font-medium ${CONF_COLOR[s.confidence]}`}>
                    {s.confidence}
                  </td>
                  <td className="py-3 pr-4">
                    {prices ? <Sparkline prices={prices} /> : <span className="text-zinc-700 text-xs">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-right text-orange-400 text-xs">
                    {s.support ? `$${s.support.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right text-zinc-300">
                    ${s.entry?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right text-purple-400 text-xs">
                    {s.resistance ? `$${s.resistance.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right text-green-400">
                    ${s.target?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right text-red-400">
                    ${s.stop_loss?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-3 text-zinc-400 text-xs max-w-xs">
                    <p className="line-clamp-2">{s.reasoning}</p>
                    {s.options_play && s.options_play !== "null" && (
                      <p className="text-blue-400 mt-1">📈 {s.options_play}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
