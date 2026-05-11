import { type RedditMention } from "@/lib/api";

interface Props {
  mentions: RedditMention[];
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function heatColor(mentions: number, max: number): string {
  const pct = mentions / max;
  if (pct >= 0.7) return "text-orange-400 bg-orange-400/10";
  if (pct >= 0.4) return "text-yellow-400 bg-yellow-400/10";
  return "text-zinc-300 bg-zinc-800/60";
}

export default function RedditSentiment({ mentions }: Props) {
  if (mentions.length === 0) return null;

  const max = mentions[0]?.mentions ?? 1;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Reddit Buzz
        </h2>
        <span className="text-[10px] text-zinc-600">r/wallstreetbets · r/stocks · r/options</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mb-4">
        {mentions.slice(0, 10).map((m) => (
          <div
            key={m.symbol}
            className={`rounded-md px-3 py-2 flex flex-col ${heatColor(m.mentions, max)}`}
            title={m.titles.join("\n")}
          >
            <span className="text-sm font-bold leading-none">{m.symbol}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] opacity-75">{m.mentions} mentions</span>
              <span className="text-[10px] opacity-50">·</span>
              <span className="text-[10px] opacity-75">▲ {formatScore(m.score)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top post titles for #1 ticker */}
      {mentions[0]?.titles.length > 0 && (
        <div className="border-t border-zinc-800 pt-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">
            Top posts mentioning {mentions[0].symbol}
          </p>
          {mentions[0].titles.map((title, i) => (
            <p key={i} className="text-xs text-zinc-400 leading-snug mb-1 line-clamp-1">
              • {title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
