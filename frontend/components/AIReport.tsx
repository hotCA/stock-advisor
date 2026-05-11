"use client";

interface Props {
  report: string;
  lastRefresh: string;
}

function formatReport(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      nodes.push(
        <h3 key={i} className="font-bold text-[#58a6ff] mt-4 mb-1 text-sm uppercase tracking-wider">
          {line.replace(/\*\*/g, "")}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h3 key={i} className="font-bold text-[#58a6ff] mt-4 mb-1 text-sm uppercase tracking-wider">
          {line.replace("## ", "")}
        </h3>
      );
    } else if (line.startsWith("**") && line.includes("**")) {
      // inline bold
      const parts = line.split(/\*\*(.*?)\*\*/g);
      nodes.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
          )}
        </p>
      );
    } else if (line.match(/^\d+\./)) {
      nodes.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1 pl-2">
          {line}
        </p>
      );
    } else if (line.startsWith("- ")) {
      nodes.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1 pl-4">
          • {line.slice(2)}
        </p>
      );
    } else if (line.trim()) {
      nodes.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-2">
          {line}
        </p>
      );
    }
  });

  return nodes;
}

export default function AIReport({ report, lastRefresh }: Props) {
  const refreshTime = lastRefresh
    ? new Date(lastRefresh).toLocaleString()
    : "Unknown";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          AI Daily Market Brief
        </h2>
        <span className="text-xs text-zinc-500">Updated {refreshTime}</span>
      </div>
      <div className="prose prose-invert max-w-none">
        {report ? (
          formatReport(report)
        ) : (
          <p className="text-zinc-500 text-sm">Report loading...</p>
        )}
      </div>
    </div>
  );
}
