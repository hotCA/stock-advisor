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
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export default function EarningsCalendar({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Earnings Calendar <span className="text-zinc-600 normal-case font-normal">(next 30 days)</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs border-b border-zinc-800">
              <th className="text-left pb-2 font-medium">Symbol</th>
              <th className="text-left pb-2 font-medium">Date</th>
              <th className="text-left pb-2 font-medium">In</th>
              <th className="text-right pb-2 font-medium">EPS Est.</th>
              <th className="text-right pb-2 font-medium">Revenue Est.</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const days = daysUntil(ev.date);
              const urgency =
                days <= 2 ? "text-yellow-400" : days <= 7 ? "text-blue-400" : "text-zinc-400";
              return (
                <tr
                  key={`${ev.symbol}-${ev.date}`}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-2.5 font-semibold text-zinc-100">{ev.symbol}</td>
                  <td className="py-2.5 text-zinc-400">{formatDate(ev.date)}</td>
                  <td className={`py-2.5 font-medium ${urgency}`}>
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                  </td>
                  <td className="py-2.5 text-right text-zinc-300">
                    {ev.eps_estimate != null ? `$${ev.eps_estimate.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 text-right text-zinc-300">
                    {ev.revenue_estimate != null ? formatRevenue(ev.revenue_estimate) : "—"}
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
