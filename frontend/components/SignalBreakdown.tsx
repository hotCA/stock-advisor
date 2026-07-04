"use client";

import type { Signal } from "@/lib/api";

interface Props {
  signals: Signal[];
}

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "#22c55e",
  SELL: "#ef4444",
  WATCH: "#eab308",
  HOLD: "#71717a",
};

const CONF_COLORS: Record<string, string> = {
  High: "#3b82f6",
  Medium: "#eab308",
  Low: "#52525b",
};

function Donut({
  segments,
  total,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  total: number;
  centerLabel: string | number;
  centerSub: string;
}) {
  const size = 140;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#21262d"
        strokeWidth={stroke}
      />
      {total > 0 &&
        segments.map((seg, i) => {
          const length = (seg.value / total) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
        })}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-zinc-100"
        fontSize="28"
        fontWeight="700"
      >
        {centerLabel}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="fill-zinc-500"
        fontSize="10"
        letterSpacing="1.5"
      >
        {centerSub}
      </text>
    </svg>
  );
}

export default function SignalBreakdown({ signals }: Props) {
  const counts = {
    BUY: signals.filter((s) => s.signal === "BUY").length,
    SELL: signals.filter((s) => s.signal === "SELL").length,
    WATCH: signals.filter((s) => s.signal === "WATCH").length,
    HOLD: signals.filter((s) => s.signal === "HOLD").length,
  };
  const confCounts = {
    High: signals.filter((s) => s.confidence === "High").length,
    Medium: signals.filter((s) => s.confidence === "Medium").length,
    Low: signals.filter((s) => s.confidence === "Low").length,
  };
  const total = signals.length;

  const segments = [
    { value: counts.BUY, color: SIGNAL_COLORS.BUY, label: "BUY" },
    { value: counts.SELL, color: SIGNAL_COLORS.SELL, label: "SELL" },
    { value: counts.WATCH, color: SIGNAL_COLORS.WATCH, label: "WATCH" },
    { value: counts.HOLD, color: SIGNAL_COLORS.HOLD, label: "HOLD" },
  ];

  return (
    <div className="card flex flex-col">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Signal Mix
      </h2>

      <div className="flex items-center gap-5">
        <Donut
          segments={segments}
          total={total}
          centerLabel={total}
          centerSub="SIGNALS"
        />

        <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {segments.map((seg) => {
            const pct = total ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div key={seg.label} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-zinc-400 w-12">{seg.label}</span>
                <span className="text-zinc-200 font-semibold">{seg.value}</span>
                <span className="text-zinc-600 text-[10px]">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confidence stacked bar */}
      <div className="mt-4 pt-4 border-t border-[#21262d]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
            Confidence
          </span>
          <span className="text-[10px] text-zinc-600">
            {confCounts.High} High · {confCounts.Medium} Med · {confCounts.Low} Low
          </span>
        </div>
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-[#21262d]">
          {(["High", "Medium", "Low"] as const).map((k) => {
            const v = confCounts[k];
            const pct = total ? (v / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={k}
                style={{ width: `${pct}%`, backgroundColor: CONF_COLORS[k] }}
                title={`${k}: ${v}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
