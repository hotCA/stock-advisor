"use client";

import { useState } from "react";
import type { MostTradedData, MostTradedItem } from "@/lib/api";

type Window = "day" | "week" | "month";

const WINDOW_LABELS: Record<Window, string> = {
  day: "Today",
  week: "This Week",
  month: "This Month",
};

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

interface Props {
  data: MostTradedData | null;
}

export default function MostTraded({ data }: Props) {
  const [activeWindow, setActiveWindow] = useState<Window>("day");

  const items: MostTradedItem[] = data?.[activeWindow] ?? [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-300">Most Traded</h2>
        <div className="flex gap-1">
          {(["day", "week", "month"] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setActiveWindow(w)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeWindow === w
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#21262d]"
              }`}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-6">No data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-[#21262d]">
                <th className="text-left pb-2 w-8">#</th>
                <th className="text-left pb-2">Symbol</th>
                <th className="text-right pb-2">Volume</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-right pb-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.symbol} className="border-b border-[#21262d] last:border-0">
                  <td className="py-2 text-zinc-600 text-xs">{i + 1}</td>
                  <td className="py-2 font-mono font-semibold text-blue-400">{item.symbol}</td>
                  <td className="py-2 text-right text-zinc-300 font-mono">{fmtVol(item.volume)}</td>
                  <td className="py-2 text-right text-zinc-400">{fmtPrice(item.price)}</td>
                  <td
                    className={`py-2 text-right font-medium ${
                      item.change_pct >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {item.change_pct >= 0 ? "+" : ""}
                    {item.change_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
