"use client";

import type { OptionsData } from "@/lib/api";

const SENTIMENT_COLOR: Record<string, string> = {
  Bullish: "text-green-400",
  Bearish: "text-red-400",
  Neutral: "text-zinc-400",
};

interface Props {
  options: OptionsData[];
}

export default function OptionsFlow({ options }: Props) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Options Flow & Sentiment
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((o) => (
          <div
            key={o.symbol}
            className="bg-[#0f1117] border border-[#21262d] rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold">{o.symbol}</span>
              <span className={`text-xs font-semibold ${SENTIMENT_COLOR[o.sentiment]}`}>
                {o.sentiment}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mb-3">${o.price.toFixed(2)} · Exp: {o.expiry}</div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">P/C Ratio</span>
                <span
                  className={
                    o.put_call_ratio > 1.2
                      ? "text-red-400"
                      : o.put_call_ratio < 0.7
                      ? "text-green-400"
                      : "text-zinc-300"
                  }
                >
                  {o.put_call_ratio.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Call OI</span>
                <span className="text-green-400">{o.total_call_oi.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Put OI</span>
                <span className="text-red-400">{o.total_put_oi.toLocaleString()}</span>
              </div>
            </div>

            {o.unusual_activity.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#21262d]">
                <p className="text-xs text-zinc-500 mb-1">Unusual Activity</p>
                {o.unusual_activity.slice(0, 2).map((u, i) => (
                  <div key={i} className="text-xs flex justify-between">
                    <span
                      className={u.type === "CALL" ? "text-green-400" : "text-red-400"}
                    >
                      {u.type} ${u.strike}
                    </span>
                    <span className="text-zinc-400">
                      {u.volume.toLocaleString()} vol · {u.implied_volatility.toFixed(0)}% IV
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
