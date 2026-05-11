const BASE = "/api";

export interface Mover {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD" | "WATCH";
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
  entry: number;
  target: number;
  stop_loss: number;
  support?: number;
  resistance?: number;
  options_play?: string | null;
}

export interface RedditMention {
  symbol: string;
  mentions: number;
  score: number;
  titles: string[];
}

export interface OptionsData {
  symbol: string;
  price: number;
  expiry: string;
  put_call_ratio: number;
  total_call_oi: number;
  total_put_oi: number;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  unusual_activity: UnusualActivity[];
}

export interface UnusualActivity {
  type: "CALL" | "PUT";
  strike: number;
  expiry: string;
  volume: number;
  open_interest: number;
  implied_volatility: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getMovers(): Promise<{
  data: { gainers: Mover[]; losers: Mover[] } | null;
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/movers");
}

export async function getSignals(): Promise<{
  data: { signals: Signal[]; market_summary: string } | null;
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/signals");
}

export async function getOptions(): Promise<{
  data: OptionsData[] | null;
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/options");
}

export async function getReport(): Promise<{
  data: string | null;
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/report");
}

export interface SectorData {
  symbol: string;
  name: string;
  change_pct: number;
  price: number;
}

export interface FearGreedData {
  score: number;
  rating: string;
  previous_close: number;
  previous_1_week: number;
  previous_1_month: number;
  vix?: number;
}

export interface EarningsEvent {
  symbol: string;
  date: string;
  eps_estimate: number | null;
  revenue_estimate: number | null;
}

export async function getSectors(): Promise<{
  data: SectorData[];
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/sectors");
}

export async function getFearGreed(): Promise<{
  data: FearGreedData | null;
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/fear-greed");
}

export async function getEarnings(): Promise<{
  data: EarningsEvent[];
  last_refresh: string;
  loading: boolean;
}> {
  return fetchJson("/earnings");
}

export interface SparklineData {
  symbol: string;
  prices: number[];
}

export interface NewsItem {
  symbol: string;
  title: string;
  publisher: string;
  link: string;
  published: number;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
}

export interface PortfolioData {
  equity: number;
  cash: number;
  holdings: PortfolioHolding[];
}

export async function getSparklines(): Promise<{
  data: SparklineData[] | null;
  loading: boolean;
}> {
  return fetchJson("/sparklines");
}

export async function getNewsData(): Promise<{
  data: NewsItem[] | null;
  loading: boolean;
}> {
  return fetchJson("/news");
}

export async function getPortfolio(): Promise<{
  data: PortfolioData | null;
  message?: string;
}> {
  return fetchJson("/portfolio");
}

export async function getRedditSentiment(): Promise<{
  data: RedditMention[] | null;
  loading: boolean;
}> {
  return fetchJson("/reddit");
}

export async function forceRefresh(): Promise<void> {
  await fetch(`${BASE}/refresh`, { method: "POST" });
}
