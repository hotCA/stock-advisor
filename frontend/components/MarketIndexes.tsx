"use client";

import type { MarketIndex } from "@/lib/api";

interface Props {
  indexes: MarketIndex[];
}

// Larger, filled sparkline tuned for the hero card — has a soft area fill
// under the line so it reads as a real "card chart" rather than a tooltip glyph.
function HeroSparkline({
  prices,
  isUp,
  width = 200,
  height = 56,
}: {
  prices: number[];
  isUp: boolean;
  width?: number;
  height?: number;
}) {
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 4;
  const innerH = height - pad * 2;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - pad - ((p - min) / range) * innerH;
    return { x, y };
  });
  const line = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const area = `${points[0].x},${height} ` + line + ` ${points[points.length - 1].x},${height}`;

  const stroke = isUp ? "#22c55e" : "#ef4444";
  const fillId = `spark-fill-${isUp ? "up" : "dn"}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${fillId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IndexCard({ idx }: { idx: MarketIndex }) {
  const isUp = idx.change >= 0;
  const sign = isUp ? "+" : "";
  const accentText = isUp ? "text-green-400" : "text-red-400";
  const accentBg = isUp
    ? "from-green-500/10 via-transparent to-transparent"
    : "from-red-500/10 via-transparent to-transparent";
  const accentBar = isUp ? "bg-green-500" : "bg-red-500";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#21262d] bg-[#161b22] bg-gradient-to-br ${accentBg} p-5 group hover:border-[#30363d] transition-colors`}
    >
      {/* Left edge accent */}
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentBar}`} />

      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          {idx.name}
        </h3>
        <span className="text-[10px] font-mono text-zinc-600">{idx.short}</span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-zinc-100 tabular-nums tracking-tight">
          {idx.price.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-sm font-semibold ${accentText}`}>
          {sign}
          {idx.change.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
        </span>
        <span className={`text-xs font-medium ${accentText}`}>
          ({sign}
          {idx.change_pct.toFixed(2)}%)
        </span>
        <span className={`text-xs ${accentText} opacity-60`}>{isUp ? "▲" : "▼"}</span>
      </div>

      <div className="-mx-1">
        <HeroSparkline prices={idx.sparkline} isUp={isUp} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-zinc-600">30D</span>
        <span className="text-[10px] text-zinc-600">
          Range {Math.min(...idx.sparkline).toFixed(0)} – {Math.max(...idx.sparkline).toFixed(0)}
        </span>
      </div>
    </div>
  );
}

export default function MarketIndexes({ indexes }: Props) {
  // Reserve a sensible placeholder while data is loading so layout doesn't pop in.
  if (!indexes || indexes.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#21262d] bg-[#161b22] p-5 h-[180px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {indexes.map((idx) => (
        <IndexCard key={idx.symbol} idx={idx} />
      ))}
    </div>
  );
}
