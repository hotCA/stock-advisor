import { type EarningsEvent } from "@/lib/api";

interface Props {
  events: EarningsEvent[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T12:00:00Z");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatRevenue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function statusLabel(days: number, reported: boolean): { text: string; cls: string } {
  if (days < 0) {
    const ago = Math.abs(days);
    return {
      text: reported ? (ago === 1 ? "Reported · 1d ago" : `Reported · ${ago}d ago`)
                     : (ago === 1 ? "1d ago" : `${ago}d ago`),
      cls: reported ? "text-emerald-400" : "text-zinc-500",
    };
  }
  if (days === 0) return { text: reported ? "Reported · Today" : "Today", cls: "text-yellow-400" };
  if (days === 1) return { text: "Tomorrow", cls: "text-yellow-400" };
  if (days <= 7) return { text: `${days}d`, cls: "text-blue-400" };
  return { text: `${days}d`, cls: "text-zinc-400" };
}

function beatMissClass(actual: number | null, estimate: number | null): string {
  if (actual == null || estimate == null) return "text-zinc-300";
  if (actual > estimate) return "text-green-400";
  if (actual < estimate) return "text-red-400";
  return "text-zinc-300";
}

function surprisePct(actual: number | null, estimate: number | null): string | null {
  if (actual == null || estimate == null || estimate === 0) return null;
  const diff = ((actual - estimate) / Math.abs(estimate)) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
}

export default function EarningsCalendar({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Earnings Calendar{" "}
        <span className="text-zinc-600 normal-case font-normal">
          (last week · next 30 days)
        </span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs border-b border-zinc-800">
              <th className="text-left pb-2 font-medium">Symbol</th>
              <th className="text-left pb-2 font-medium">Date</th>
              <th className="text-left pb-2 font-medium">Status</th>
              <th className="text-right pb-2 font-medium">Street EPS</th>
              <th className="text-right pb-2 font-medium">Actual EPS</th>
              <th className="text-right pb-2 font-medium">Street Revenue</th>
              <th className="text-right pb-2 font-medium">Actual Revenue</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const days = daysUntil(ev.date);
              const status = statusLabel(days, ev.reported);
              const epsBeat = beatMissClass(ev.eps_actual, ev.eps_estimate);
              const revBeat = beatMissClass(ev.revenue_actual, ev.revenue_estimate);
              const epsSurprise = surprisePct(ev.eps_actual, ev.eps_estimate);
              const revSurprise = surprisePct(ev.revenue_actual, ev.revenue_estimate);
              const isPast = days < 0;

              return (
                <tr
                  key={`${ev.symbol}-${ev.date}`}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    isPast ? "bg-zinc-900/30" : ""
                  }`}
                >
                  <td className="py-2.5 font-semibold text-zinc-100">{ev.symbol}</td>
                  <td className="py-2.5 text-zinc-400">{formatDate(ev.date)}</td>
                  <td className={`py-2.5 font-medium ${status.cls}`}>{status.text}</td>

                  <td className="py-2.5 text-right text-zinc-400">
                    {ev.eps_estimate != null ? `$${ev.eps_estimate.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {ev.eps_actual != null ? (
                      <>
                        <span className={`font-semibold ${epsBeat}`}>
                          ${ev.eps_actual.toFixed(2)}
                        </span>
                        {epsSurprise && (
                          <span className={`ml-1.5 text-[10px] ${epsBeat}`}>
                            {epsSurprise}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>

                  <td className="py-2.5 text-right text-zinc-400">
                    {ev.revenue_estimate != null ? formatRevenue(ev.revenue_estimate) : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {ev.revenue_actual != null ? (
                      <>
                        <span className={`font-semibold ${revBeat}`}>
                          {formatRevenue(ev.revenue_actual)}
                        </span>
                        {revSurprise && (
                          <span className={`ml-1.5 text-[10px] ${revBeat}`}>
                            {revSurprise}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-700">—</span>
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
