"use client";

import { useState, useEffect } from "react";
import type { Signal, Mover, PredictionEntry } from "@/lib/api";
import { getPredictionsHistory } from "@/lib/api";

const STORAGE_KEY = "paper_trading_account";
const STARTING_BALANCE = 100_000;

interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  qty: number;
  price: number;
  timestamp: number;
}

interface Holding {
  symbol: string;
  qty: number;
  avgCost: number;
}

interface PaperAccount {
  cash: number;
  startingBalance: number;
  holdings: Holding[];
  trades: Trade[];
}

function defaultAccount(): PaperAccount {
  return { cash: STARTING_BALANCE, startingBalance: STARTING_BALANCE, holdings: [], trades: [] };
}

function loadAccount(): PaperAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultAccount();
}

function saveAccount(a: PaperAccount) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

function lookupPrice(symbol: string, signals: Signal[], movers: Mover[]): number | null {
  const sym = symbol.toUpperCase();
  const mover = movers.find((m) => m.symbol.toUpperCase() === sym);
  if (mover) return mover.price;
  const sig = signals.find((s) => s.symbol.toUpperCase() === sym);
  if (sig) return sig.entry;
  return null;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const pnlClass = (v: number) => (v >= 0 ? "text-green-400" : "text-red-400");

interface Props {
  signals: Signal[];
  movers: Mover[];
}

export default function PaperTrading({ signals, movers }: Props) {
  const [account, setAccount] = useState<PaperAccount>(defaultAccount());
  const [loaded, setLoaded] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeError, setTradeError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [predictionLog, setPredictionLog] = useState<PredictionEntry[]>([]);
  const [showPredictions, setShowPredictions] = useState(true);

  useEffect(() => {
    setAccount(loadAccount());
    setLoaded(true);
    getPredictionsHistory().then((res) => setPredictionLog(res.data)).catch(() => {});
  }, []);

  const persist = (updated: PaperAccount) => {
    setAccount(updated);
    saveAccount(updated);
  };

  const handleSymbolChange = (val: string) => {
    const sym = val.toUpperCase();
    setTradeSymbol(sym);
    setTradeError("");
    const price = lookupPrice(sym, signals, movers);
    if (price) setTradePrice(price.toFixed(2));
  };

  const handleTrade = () => {
    setTradeError("");
    const symbol = tradeSymbol.trim().toUpperCase();
    const qty = parseFloat(tradeQty);
    const price = parseFloat(tradePrice);

    if (!symbol) return setTradeError("Symbol is required");
    if (!qty || qty <= 0 || !Number.isFinite(qty)) return setTradeError("Enter a valid quantity");
    if (!price || price <= 0 || !Number.isFinite(price)) return setTradeError("Enter a valid price");

    const cost = qty * price;
    const updated: PaperAccount = {
      ...account,
      holdings: [...account.holdings],
      trades: [...account.trades],
    };

    if (tradeType === "BUY") {
      if (cost > account.cash)
        return setTradeError(`Need ${fmt(cost)} but only have ${fmt(account.cash)} cash`);
      const idx = updated.holdings.findIndex((h) => h.symbol === symbol);
      if (idx >= 0) {
        const h = updated.holdings[idx];
        const totalQty = h.qty + qty;
        updated.holdings[idx] = { symbol, qty: totalQty, avgCost: (h.qty * h.avgCost + cost) / totalQty };
      } else {
        updated.holdings.push({ symbol, qty, avgCost: price });
      }
      updated.cash -= cost;
    } else {
      const idx = updated.holdings.findIndex((h) => h.symbol === symbol);
      if (idx < 0) return setTradeError(`No ${symbol} position to sell`);
      const h = updated.holdings[idx];
      if (qty > h.qty) return setTradeError(`Only ${h.qty} shares of ${symbol} held`);
      updated.cash += qty * price;
      if (qty === h.qty) updated.holdings.splice(idx, 1);
      else updated.holdings[idx] = { ...h, qty: h.qty - qty };
    }

    updated.trades.unshift({ id: crypto.randomUUID(), symbol, type: tradeType, qty, price, timestamp: Date.now() });
    persist(updated);
    setTradeSymbol("");
    setTradeQty("");
    setTradePrice("");
  };

  if (!loaded) return null;

  const holdingsWithValue = account.holdings.map((h) => {
    const currentPrice = lookupPrice(h.symbol, signals, movers) ?? h.avgCost;
    const currentValue = h.qty * currentPrice;
    const costBasis = h.qty * h.avgCost;
    const pnl = currentValue - costBasis;
    return { ...h, currentPrice, currentValue, pnl, pnlPct: (pnl / costBasis) * 100 };
  });

  const totalEquity = holdingsWithValue.reduce((s, h) => s + h.currentValue, 0);
  const totalValue = account.cash + totalEquity;
  const totalPnl = totalValue - account.startingBalance;
  const totalPnlPct = (totalPnl / account.startingBalance) * 100;

  const qty = parseFloat(tradeQty);
  const price = parseFloat(tradePrice);
  const orderTotal = qty > 0 && price > 0 ? qty * price : null;

  const quickFillSignals = signals.filter((s) => s.signal === "BUY" || s.signal === "SELL").slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card py-3 px-5 flex flex-col">
          <span className="text-xs text-zinc-500 mb-1">TOTAL VALUE</span>
          <span className="text-xl font-bold text-zinc-100">{fmt(totalValue)}</span>
        </div>
        <div className="card py-3 px-5 flex flex-col">
          <span className="text-xs text-zinc-500 mb-1">CASH</span>
          <span className="text-xl font-bold text-zinc-100">{fmt(account.cash)}</span>
        </div>
        <div className="card py-3 px-5 flex flex-col">
          <span className="text-xs text-zinc-500 mb-1">INVESTED</span>
          <span className="text-xl font-bold text-zinc-100">{fmt(totalEquity)}</span>
        </div>
        <div className="card py-3 px-5 flex flex-col">
          <span className="text-xs text-zinc-500 mb-1">TOTAL P&amp;L</span>
          <span className={`text-xl font-bold ${pnlClass(totalPnl)}`}>
            {fmt(totalPnl)}{" "}
            <span className="text-sm font-normal">({fmtPct(totalPnlPct)})</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Positions table */}
        <div className="card">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Open Positions</h3>
          {holdingsWithValue.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">
              No open positions. Use the trade form to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-[#21262d]">
                    <th className="text-left pb-2">Symbol</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Avg Cost</th>
                    <th className="text-right pb-2">Current</th>
                    <th className="text-right pb-2">Value</th>
                    <th className="text-right pb-2">P&amp;L</th>
                    <th className="text-right pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsWithValue.map((h) => (
                    <tr key={h.symbol} className="border-b border-[#21262d] last:border-0">
                      <td className="py-2.5 font-mono font-semibold text-blue-400">{h.symbol}</td>
                      <td className="py-2.5 text-right text-zinc-300">{h.qty}</td>
                      <td className="py-2.5 text-right text-zinc-400">{fmt(h.avgCost)}</td>
                      <td className="py-2.5 text-right text-zinc-300">{fmt(h.currentPrice)}</td>
                      <td className="py-2.5 text-right text-zinc-300">{fmt(h.currentValue)}</td>
                      <td className={`py-2.5 text-right ${pnlClass(h.pnl)}`}>
                        {fmt(h.pnl)}
                        <br />
                        <span className="text-xs">{fmtPct(h.pnlPct)}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            setTradeSymbol(h.symbol);
                            setTradeType("SELL");
                            setTradePrice(h.currentPrice.toFixed(2));
                            setTradeQty(String(h.qty));
                            setTradeError("");
                          }}
                          className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-400 px-2 py-1 rounded transition-colors"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trade form */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Place Trade</h3>

          <div className="flex rounded-lg overflow-hidden border border-[#21262d]">
            <button
              onClick={() => setTradeType("BUY")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                tradeType === "BUY"
                  ? "bg-green-700 text-white"
                  : "bg-[#0f1117] text-zinc-400 hover:bg-[#161b22]"
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setTradeType("SELL")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                tradeType === "SELL"
                  ? "bg-red-700 text-white"
                  : "bg-[#0f1117] text-zinc-400 hover:bg-[#161b22]"
              }`}
            >
              SELL
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Symbol</label>
            <input
              type="text"
              value={tradeSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              placeholder="e.g. AAPL"
              className="w-full bg-[#0f1117] border border-[#21262d] rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Quantity (shares)</label>
            <input
              type="number"
              value={tradeQty}
              onChange={(e) => setTradeQty(e.target.value)}
              placeholder="0"
              min="1"
              className="w-full bg-[#0f1117] border border-[#21262d] rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Price per share ($)</label>
            <input
              type="number"
              value={tradePrice}
              onChange={(e) => setTradePrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full bg-[#0f1117] border border-[#21262d] rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {orderTotal !== null && (
            <div className="text-xs bg-[#0f1117] border border-[#21262d] rounded px-3 py-2 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Order total</span>
                <span className="text-zinc-200 font-semibold">{fmt(orderTotal)}</span>
              </div>
              {tradeType === "BUY" && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cash remaining</span>
                  <span className={pnlClass(account.cash - orderTotal)}>{fmt(account.cash - orderTotal)}</span>
                </div>
              )}
            </div>
          )}

          {tradeError && <p className="text-red-400 text-xs">{tradeError}</p>}

          <button
            onClick={handleTrade}
            className={`w-full py-2.5 rounded text-sm font-semibold transition-colors ${
              tradeType === "BUY"
                ? "bg-green-700 hover:bg-green-600 text-white"
                : "bg-red-700 hover:bg-red-600 text-white"
            }`}
          >
            {tradeType} {tradeSymbol || "Stock"}
          </button>

          {quickFillSignals.length > 0 && (
            <div>
              <p className="text-xs text-zinc-600 mb-2">Quick-fill from AI signals:</p>
              <div className="flex flex-wrap gap-1.5">
                {quickFillSignals.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setTradeSymbol(s.symbol);
                      setTradeType(s.signal as "BUY" | "SELL");
                      setTradePrice(s.entry.toFixed(2));
                      setTradeError("");
                    }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      s.signal === "BUY"
                        ? "border-green-800 text-green-400 hover:bg-green-900/30"
                        : "border-red-800 text-red-400 hover:bg-red-900/30"
                    }`}
                  >
                    {s.signal} {s.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prediction Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300">Prediction Log</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              AI signals logged each refresh — validate accuracy after 5–7 days
            </p>
          </div>
          <button
            onClick={() => setShowPredictions(!showPredictions)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {showPredictions ? "Hide" : `Show (${predictionLog.length} days)`}
          </button>
        </div>

        {showPredictions && predictionLog.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-6">
            No predictions logged yet. Predictions are saved on each data refresh.
          </p>
        )}

        {showPredictions && predictionLog.length > 0 && (
          <div className="space-y-4">
            {[...predictionLog].reverse().map((entry) => {
              const entryDate = new Date(entry.timestamp);
              const ageMs = Date.now() - entryDate.getTime();
              const ageDays = ageMs / (1000 * 60 * 60 * 24);
              const canEvaluate = ageDays >= 5;

              return (
                <div key={entry.timestamp} className="border border-[#21262d] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-zinc-300">
                      {entryDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {canEvaluate
                        ? `${Math.floor(ageDays)}d old — compare to current prices`
                        : `${Math.floor(ageDays)}d old — check back in ${5 - Math.floor(ageDays)}d`}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-zinc-600 border-b border-[#21262d]">
                          <th className="text-left pb-1.5">Symbol</th>
                          <th className="text-left pb-1.5">Signal</th>
                          <th className="text-left pb-1.5">Conf</th>
                          <th className="text-right pb-1.5">Entry</th>
                          <th className="text-right pb-1.5">Target</th>
                          <th className="text-right pb-1.5">Stop</th>
                          {canEvaluate && <th className="text-right pb-1.5">Now</th>}
                          {canEvaluate && <th className="text-right pb-1.5">Result</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.signals.map((s) => {
                          const currentPrice = lookupPrice(s.symbol, signals, movers);
                          let result: { label: string; cls: string } | null = null;
                          if (canEvaluate && currentPrice !== null) {
                            if (s.signal === "BUY") {
                              if (currentPrice >= s.target) result = { label: "Hit Target", cls: "text-green-400" };
                              else if (currentPrice <= s.stop_loss) result = { label: "Stopped Out", cls: "text-red-400" };
                              else result = { label: "In Progress", cls: "text-yellow-400" };
                            } else {
                              if (currentPrice <= s.target) result = { label: "Hit Target", cls: "text-green-400" };
                              else if (currentPrice >= s.stop_loss) result = { label: "Stopped Out", cls: "text-red-400" };
                              else result = { label: "In Progress", cls: "text-yellow-400" };
                            }
                          }
                          return (
                            <tr key={s.symbol} className="border-b border-[#21262d] last:border-0">
                              <td className="py-1.5 font-mono text-blue-400">{s.symbol}</td>
                              <td className="py-1.5">
                                <span className={s.signal === "BUY" ? "badge-buy" : "badge-sell"}>{s.signal}</span>
                              </td>
                              <td className={`py-1.5 ${s.confidence === "High" ? "text-blue-400" : s.confidence === "Medium" ? "text-yellow-400" : "text-zinc-500"}`}>
                                {s.confidence}
                              </td>
                              <td className="py-1.5 text-right text-zinc-400">{fmt(s.entry)}</td>
                              <td className="py-1.5 text-right text-green-500">{fmt(s.target)}</td>
                              <td className="py-1.5 text-right text-red-500">{fmt(s.stop_loss)}</td>
                              {canEvaluate && (
                                <td className="py-1.5 text-right text-zinc-300">
                                  {currentPrice !== null ? fmt(currentPrice) : "—"}
                                </td>
                              )}
                              {canEvaluate && (
                                <td className={`py-1.5 text-right font-semibold ${result?.cls ?? "text-zinc-500"}`}>
                                  {result?.label ?? "—"}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Trade History</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {showHistory ? "Hide" : `Show (${account.trades.length})`}
            </button>
            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                Reset Account
              </button>
            ) : (
              <span className="text-xs flex items-center gap-2">
                <span className="text-zinc-400">
                  Reset to {fmt(account.startingBalance)}?
                </span>
                <button
                  onClick={() => { persist(defaultAccount()); setResetConfirm(false); }}
                  className="text-red-400 hover:text-red-300 font-semibold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  No
                </button>
              </span>
            )}
          </div>
        </div>

        {showHistory && account.trades.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-4">No trades yet.</p>
        )}

        {showHistory && account.trades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-[#21262d]">
                  <th className="text-left pb-2">Time</th>
                  <th className="text-left pb-2">Type</th>
                  <th className="text-left pb-2">Symbol</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {account.trades.slice(0, 30).map((t) => (
                  <tr key={t.id} className="border-b border-[#21262d] last:border-0">
                    <td className="py-2 text-zinc-500 text-xs">
                      {new Date(t.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={t.type === "BUY" ? "badge-buy" : "badge-sell"}>{t.type}</span>
                    </td>
                    <td className="py-2 font-mono text-blue-400">{t.symbol}</td>
                    <td className="py-2 text-right text-zinc-300">{t.qty}</td>
                    <td className="py-2 text-right text-zinc-400">{fmt(t.price)}</td>
                    <td className="py-2 text-right text-zinc-300">{fmt(t.qty * t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
