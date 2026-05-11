import { type SectorData } from "@/lib/api";

interface Props {
  sectors: SectorData[];
}

function tileStyle(pct: number): string {
  if (pct >= 2)   return "bg-green-600/70 text-green-50";
  if (pct >= 1)   return "bg-green-700/50 text-green-100";
  if (pct >= 0)   return "bg-green-900/40 text-green-300";
  if (pct > -1)   return "bg-red-900/40 text-red-300";
  if (pct > -2)   return "bg-red-700/50 text-red-100";
  return                 "bg-red-600/70 text-red-50";
}

function pctColor(pct: number): string {
  if (pct >= 0) return "text-green-400";
  return "text-red-400";
}

export default function SectorHeatmap({ sectors }: Props) {
  if (sectors.length === 0) return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Sector Performance
      </h2>
      <p className="text-zinc-600 text-xs">Loading...</p>
    </div>
  );

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Sector Performance
      </h2>
      <div className="grid grid-cols-2 gap-1.5">
        {sectors.map((s) => (
          <div
            key={s.symbol}
            className={`rounded-md px-2.5 py-2 flex flex-col ${tileStyle(s.change_pct)}`}
          >
            <span className="text-[10px] font-medium opacity-80 leading-none">{s.name}</span>
            <span className={`text-sm font-bold mt-1 leading-none ${pctColor(s.change_pct)}`}>
              {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
