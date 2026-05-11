import { type FearGreedData } from "@/lib/api";

interface Props {
  data: FearGreedData | null;
}

function getColor(score: number): string {
  if (score <= 25) return "#ef4444"; // red - extreme fear
  if (score <= 45) return "#f97316"; // orange - fear
  if (score <= 55) return "#eab308"; // yellow - neutral
  if (score <= 75) return "#84cc16"; // light green - greed
  return "#22c55e";                  // green - extreme greed
}

function getRatingLabel(rating: string): string {
  return rating
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function GaugeArc({ score }: { score: number }) {
  const radius = 60;
  const cx = 80;
  const cy = 75;
  // Arc goes from 180° to 0° (left to right), score maps 0→180deg rotation
  const angle = (score / 100) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const x = cx + radius * Math.cos(rad);
  const y = cy - radius * Math.sin(rad);
  const color = getColor(score);

  return (
    <svg width="160" height="90" viewBox="0 0 160 90">
      {/* Background arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#27272a"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Colored segments */}
      {[
        { pct: 0.25, color: "#ef4444" },
        { pct: 0.45, color: "#f97316" },
        { pct: 0.55, color: "#eab308" },
        { pct: 0.75, color: "#84cc16" },
        { pct: 1.0,  color: "#22c55e" },
      ].map((seg, i, arr) => {
        const start = i === 0 ? 0 : arr[i - 1].pct;
        const startAngle = ((1 - start) * 180 * Math.PI) / 180;
        const endAngle = ((1 - seg.pct) * 180 * Math.PI) / 180;
        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy - radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy - radius * Math.sin(endAngle);
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 0 ${x2} ${y2}`}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.35"
          />
        );
      })}
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </svg>
  );
}

export default function FearGreedIndex({ data }: Props) {
  if (!data) return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Fear &amp; Greed Index
      </h2>
      <p className="text-zinc-600 text-xs">Loading...</p>
    </div>
  );

  const color = getColor(data.score);

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Fear &amp; Greed Index
      </h2>
      <div className="flex items-center gap-2">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <GaugeArc score={data.score} />
          <span className="text-2xl font-bold leading-none" style={{ color }}>
            {data.score}
          </span>
          <span className="text-xs font-semibold mt-0.5" style={{ color }}>
            {getRatingLabel(data.rating)}
          </span>
        </div>

        {/* Historical comparison */}
        <div className="flex flex-col text-xs">
          {[
            { label: "Prev Close", value: data.previous_close },
            { label: "Week Ago", value: data.previous_1_week },
            { label: "Month Ago", value: data.previous_1_month },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3 py-1 border-b border-zinc-800">
              <span className="text-zinc-500">{label}</span>
              <span className="font-medium" style={{ color: getColor(value) }}>
                {value}
              </span>
            </div>
          ))}
          {data.vix != null && (
            <div className="flex items-center gap-3 py-0.5 border-t border-zinc-800 mt-0.5 pt-1">
              <span className="text-zinc-500">VIX</span>
              <span className="font-medium text-zinc-300">{data.vix}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
