import { type NewsItem } from "@/lib/api";

interface Props {
  news: NewsItem[];
}

function timeAgo(unixTs: number): string {
  if (!unixTs) return "";
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsFeed({ news }: Props) {
  if (news.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Market News
      </h2>
      <div className="flex flex-col divide-y divide-zinc-800">
        {news.map((item, i) => (
          <div key={i} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                {item.symbol}
              </span>
              <span className="text-[10px] text-zinc-600">{item.publisher}</span>
              <span className="text-[10px] text-zinc-700 ml-auto">{timeAgo(item.published)}</span>
            </div>
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-300 hover:text-blue-400 transition-colors leading-snug line-clamp-2"
              >
                {item.title}
              </a>
            ) : (
              <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{item.title}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
