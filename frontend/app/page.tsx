"use client";

import { useState, useEffect, useCallback } from "react";
import MarketMovers from "@/components/MarketMovers";
import SignalsTable from "@/components/SignalsTable";
import AIReport from "@/components/AIReport";
import OptionsFlow from "@/components/OptionsFlow";
import FearGreedIndex from "@/components/FearGreedIndex";
import EarningsCalendar from "@/components/EarningsCalendar";
import SectorHeatmap from "@/components/SectorHeatmap";
import NewsFeed from "@/components/NewsFeed";
import RedditSentiment from "@/components/RedditSentiment";
import PaperTrading from "@/components/PaperTrading";
import MostTraded from "@/components/MostTraded";
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
} from "@/lib/api";

type Tab = "dashboard" | "paper";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
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
  const [lastRefresh, setLastRefresh] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setError("");
      const [moversRes, signalsRes, optionsRes, reportRes, fgRes, earningsRes, sectorsRes, sparklinesRes, newsRes, redditRes, mostTradedRes] =
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
      setLastRefresh(moversRes.last_refresh ?? "");
      setLoading(stillLoading);
    } catch (e) {
      setError("Failed to load market data. Is the backend running on port 8000?");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, loading ? 10_000 : 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll, loading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceRefresh();
      const prevRefresh = lastRefresh;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        // Check the API directly — avoids stale closure on lastRefresh state
        const check = await getMovers();
        if (check.last_refresh !== prevRefresh || attempts >= 18) {
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

  const buyCount = signals.filter((s) => s.signal === "BUY").length;
  const sellCount = signals.filter((s) => s.signal === "SELL").length;
  const highConfCount = signals.filter((s) => s.confidence === "High").length;

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-[#21262d] pb-0">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px ${
            activeTab === "dashboard"
              ? "bg-[#161b22] border border-b-[#161b22] border-[#21262d] text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("paper")}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px flex items-center gap-1.5 ${
            activeTab === "paper"
              ? "bg-[#161b22] border border-b-[#161b22] border-[#21262d] text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          Paper Trading
        </button>
      </div>

      {activeTab === "paper" && (
        <PaperTrading signals={signals} movers={[...gainers, ...losers]} />
      )}

      {activeTab === "dashboard" && <>
      {/* Earnings Calendar */}
      {earnings.length > 0 && <EarningsCalendar events={earnings} />}

      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="card py-3 px-5 flex flex-col items-center min-w-[80px]">
            <span className="text-2xl font-bold text-green-400">{buyCount}</span>
            <span className="text-xs text-zinc-500 mt-0.5">BUY</span>
          </div>
          <div className="card py-3 px-5 flex flex-col items-center min-w-[80px]">
            <span className="text-2xl font-bold text-red-400">{sellCount}</span>
            <span className="text-xs text-zinc-500 mt-0.5">SELL</span>
          </div>
          <div className="card py-3 px-5 flex flex-col items-center min-w-[80px]">
            <span className="text-2xl font-bold text-blue-400">{highConfCount}</span>
            <span className="text-xs text-zinc-500 mt-0.5">HIGH CONF</span>
          </div>
          <div className="card py-3 px-5 flex flex-col items-center min-w-[80px]">
            <span className="text-2xl font-bold text-zinc-200">{signals.length}</span>
            <span className="text-xs text-zinc-500 mt-0.5">SIGNALS</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm bg-[#161b22] hover:bg-[#1c2333] border border-[#21262d] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin" : ""}>⟳</span>
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </button>
      </div>

      {/* Fear & Greed + Sector Heatmap | AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="flex flex-col gap-6">
          <FearGreedIndex data={fearGreed} />
          <SectorHeatmap sectors={sectors} />
        </div>
        <AIReport report={report} lastRefresh={lastRefresh} />
      </div>

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
      </>}
    </div>
  );
}
