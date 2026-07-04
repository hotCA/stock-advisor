"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MarketMovers from "@/components/MarketMovers";
import SignalsTable from "@/components/SignalsTable";
import AIReport from "@/components/AIReport";
import OptionsFlow from "@/components/OptionsFlow";
import FearGreedIndex from "@/components/FearGreedIndex";
import EarningsCalendar from "@/components/EarningsCalendar";
import SectorHeatmap from "@/components/SectorHeatmap";
import NewsFeed from "@/components/NewsFeed";
import RedditSentiment from "@/components/RedditSentiment";
import MostTraded from "@/components/MostTraded";
import SignalBreakdown from "@/components/SignalBreakdown";
import MarketBreadth from "@/components/MarketBreadth";
import PersonalPortfolio from "@/components/PersonalPortfolio";
import MarketIndexes from "@/components/MarketIndexes";
import MacroPulse from "@/components/MacroPulse";
import {
  getMovers,
  getSignals,
  getOptions,
  getReport,
  getFearGreed,
  getEarnings,
  getSectors,
  getSparklines,
  getNewsData,
  getRedditSentiment,
  getMostTraded,
  getIndexes,
  getMacro,
  forceRefresh,
  type Mover,
  type Signal,
  type OptionsData,
  type FearGreedData,
  type EarningsEvent,
  type SectorData,
  type SparklineData,
  type NewsItem,
  type RedditMention,
  type MostTradedData,
  type MarketIndex,
  type MacroData,
} from "@/lib/api";

export default function Dashboard() {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [marketSummary, setMarketSummary] = useState("");
  const [options, setOptions] = useState<OptionsData[]>([]);
  const [report, setReport] = useState("");
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [sparklines, setSparklines] = useState<SparklineData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reddit, setReddit] = useState<RedditMention[]>([]);
  const [mostTraded, setMostTraded] = useState<MostTradedData | null>(null);
  const [indexes, setIndexes] = useState<MarketIndex[]>([]);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [lastFullRefresh, setLastFullRefresh] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async () => {
    // Skip overlapping fetches — at 5s cadence the previous one may not be done yet.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setError("");
      const [moversRes, signalsRes, optionsRes, reportRes, fgRes, earningsRes, sectorsRes, sparklinesRes, newsRes, redditRes, mostTradedRes, indexesRes, macroRes] =
        await Promise.all([
          getMovers(),
          getSignals(),
          getOptions(),
          getReport(),
          getFearGreed(),
          getEarnings(),
          getSectors(),
          getSparklines(),
          getNewsData(),
          getRedditSentiment(),
          getMostTraded(),
          getIndexes(),
          getMacro(),
        ]);

      const stillLoading = moversRes.loading || signalsRes.loading;

      setGainers(moversRes.data?.gainers ?? []);
      setLosers(moversRes.data?.losers ?? []);
      setSignals(signalsRes.data?.signals ?? []);
      setMarketSummary(signalsRes.data?.market_summary ?? "");
      setOptions(optionsRes.data ?? []);
      setReport(reportRes.data ?? "");
      setFearGreed(fgRes.data);
      setEarnings(earningsRes.data ?? []);
      setSectors(sectorsRes.data ?? []);
      setSparklines(sparklinesRes.data ?? []);
      setNews(newsRes.data ?? []);
      setReddit(redditRes.data ?? []);
      setMostTraded(mostTradedRes.data ?? null);
      setIndexes(indexesRes.data ?? []);
      setMacro(macroRes.data ?? null);
      setLastRefresh(moversRes.last_refresh ?? "");
      setLastFullRefresh(moversRes.last_full_refresh ?? "");
      setLoading(stillLoading);
    } catch (e) {
      setError("Failed to load market data. Is the backend running on port 8000?");
      setLoading(false);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // 10s during initial load (waiting for first data), then 5s for live polling
    const interval = setInterval(fetchAll, loading ? 10_000 : 5_000);
    return () => clearInterval(interval);
  }, [fetchAll, loading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceRefresh();
      // Watch last_full_refresh, not last_refresh — the 60s light-refresh job
      // also bumps last_refresh during market hours and would otherwise trip
      // the completion check before signals/report are actually regenerated.
      const prevFull = lastFullRefresh;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const check = await getMovers();
        if (check.last_full_refresh !== prevFull || attempts >= 18) {
          clearInterval(poll);
          await fetchAll();
          setRefreshing(false);
        }
      }, 10_000);
    } catch {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Fetching market data & running AI analysis...</p>
        <p className="text-zinc-600 text-xs">First load may take 60–90 seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchAll}
          className="text-xs bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Calendar */}
      {earnings.length > 0 && <EarningsCalendar events={earnings} />}

      {/* Hero header: title + live indicator + refresh */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Market Snapshot</h1>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Live
            </span>
          </div>
          {(lastFullRefresh || lastRefresh) && (
            <p className="text-xs text-zinc-500 mt-1">
              AI report · {new Date(lastFullRefresh || lastRefresh).toLocaleString()}
              {lastRefresh && lastFullRefresh && lastRefresh !== lastFullRefresh && (
                <span className="text-zinc-600">
                  {" "}· prices {new Date(lastRefresh).toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm bg-[#161b22] hover:bg-[#1c2333] border border-[#21262d] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin" : ""}>⟳</span>
          {refreshing ? "Refreshing..." : "Full Refresh"}
        </button>
      </div>

      {/* Major Indexes hero — S&P 500, NASDAQ, Dow Jones */}
      <MarketIndexes indexes={indexes} />

      {/* Mood row: Signal Mix | Market Breadth | Fear & Greed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SignalBreakdown signals={signals} />
        <MarketBreadth gainers={gainers} losers={losers} />
        <FearGreedIndex data={fearGreed} />
      </div>

      {/* Sector Heatmap | AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <SectorHeatmap sectors={sectors} />
        <AIReport report={report} lastRefresh={lastRefresh} />
      </div>

      {/* Macro & Economy — Fed, employment, economic data, consumer sentiment */}
      <MacroPulse macro={macro} />

      {/* Personal Portfolio */}
      <PersonalPortfolio
        signals={signals}
        movers={[...gainers, ...losers]}
        sectors={sectors}
      />

      {/* Market Movers */}
      <MarketMovers gainers={gainers} losers={losers} />

      {/* Most Traded */}
      <MostTraded data={mostTraded} />

      {/* Trade Signals */}
      <SignalsTable signals={signals} marketSummary={marketSummary} sparklines={sparklines} />

      {/* Reddit Sentiment */}
      {reddit.length > 0 && <RedditSentiment mentions={reddit} />}

      {/* News Feed */}
      {news.length > 0 && <NewsFeed news={news} />}

      {/* Options Flow */}
      {options.length > 0 && <OptionsFlow options={options} />}
    </div>
  );
}
