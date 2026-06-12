"use client";

import type { MacroData, MacroIndicator } from "@/lib/api";

interface Props {
  macro: MacroData | null;
}

const OUTLOOK_STYLES: Record<string, string> = {
  Bullish: "text-green-400 bg-green-500/10 border-green-500/30",
  Bearish: "text-red-400 bg-red-500/10 border-red-500/30",
  Neutral: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

const IMPACT_STYLES: Record<string, string> = {
  Positive: "text-green-400 bg-green-500/10",
  Negative: "text-red-400 bg-red-500/10",
  Mixed: "text-yellow-400 bg-yellow-500/10",
};

function TrendArrow({ trend }: { trend: MacroIndicator["trend"] }) {
  if (trend === "up") return <span className="text-green-400">▲</span>;
  if (trend === "down") return <span className="text-red-400">▼</span>;
  return <span className="text-zinc-500">—</span>;
}

function IndicatorList({ indicators }: { indicators: MacroIndicator[] }) {
  if (!indicators?.length) return null;
  return (
    <div className="space-y-1.5 mt-2">
      {indicators.map((ind, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-zinc-400 truncate" title={ind.note || ind.name}>
            {ind.name}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-200 whitespace-nowrap">
            {ind.value} <TrendArrow trend={ind.trend} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[#58a6ff] uppercase tracking-wider mb-2">
        {title}
      </h3>
      {summary && <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>}
      {children}
    </div>
  );
}

export default function MacroPulse({ macro }: Props) {
  if (!macro) {
    return (
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Macro &amp; Economy
        </h2>
        <p className="text-zinc-500 text-sm">
          Macro brief loading... (generated on each full refresh)
        </p>
      </div>
    );
  }

  const outlookStyle = OUTLOOK_STYLES[macro.outlook] ?? OUTLOOK_STYLES.Neutral;

  return (
    <div className="card">
      {/* Header: title + outlook badge */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Macro &amp; Economy
        </h2>
        <div className="flex items-center gap-3">
          {macro.generated_at && (
            <span className="text-xs text-zinc-500">
              {new Date(macro.generated_at).toLocaleString()}
            </span>
          )}
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest border rounded-full px-2.5 py-0.5 ${outlookStyle}`}
          >
            {macro.outlook}
          </span>
        </div>
      </div>

      {macro.outlook_summary && (
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{macro.outlook_summary}</p>
      )}

      {/* Market trends / themes */}
      {macro.market_trends?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[#58a6ff] uppercase tracking-wider mb-2">
            Market Trends &amp; Themes
          </h3>
          <div className="space-y-2">
            {macro.market_trends.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                    IMPACT_STYLES[t.impact] ?? IMPACT_STYLES.Mixed
                  }`}
                >
                  {t.impact}
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-zinc-100">{t.theme}</span>
                  {t.detail ? ` — ${t.detail}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fed / Employment / Economy / Consumer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <SectionCard title="Fed Watch" summary={macro.fed_watch?.summary}>
          {macro.fed_watch?.next_meeting && (
            <p className="text-xs text-zinc-400 mt-2">
              Next FOMC: <span className="text-zinc-200">{macro.fed_watch.next_meeting}</span>
            </p>
          )}
          {macro.fed_watch?.rate_expectations && (
            <p className="text-xs text-zinc-400 mt-1">
              Rates: <span className="text-zinc-200">{macro.fed_watch.rate_expectations}</span>
            </p>
          )}
          {macro.fed_watch?.headlines?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {macro.fed_watch.headlines.map((h, i) => (
                <li key={i} className="text-xs text-zinc-400 leading-relaxed">
                  • {h}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Employment" summary={macro.employment?.summary}>
          <IndicatorList indicators={macro.employment?.indicators ?? []} />
        </SectionCard>

        <SectionCard title="Economic Data" summary={macro.economic_data?.summary}>
          <IndicatorList indicators={macro.economic_data?.indicators ?? []} />
          {(macro.economic_data?.upcoming?.length ?? 0) > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Upcoming
              </p>
              {macro.economic_data.upcoming!.map((u, i) => (
                <p key={i} className="text-xs text-zinc-400 leading-relaxed">
                  • {u}
                </p>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Consumer Sentiment" summary={macro.consumer_sentiment?.summary}>
          <IndicatorList indicators={macro.consumer_sentiment?.indicators ?? []} />
        </SectionCard>
      </div>

      {/* Risks */}
      {macro.risks?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400/80 uppercase tracking-wider mb-2">
            Macro Risks
          </h3>
          <div className="flex flex-wrap gap-2">
            {macro.risks.map((r, i) => (
              <span
                key={i}
                className="text-xs text-zinc-300 bg-red-500/5 border border-red-500/20 rounded px-2 py-1"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
