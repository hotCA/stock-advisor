"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Mover, Signal, SectorData } from "@/lib/api";
import { getQuotes } from "@/lib/api";
import { POPULAR_TICKERS, type TickerMeta } from "@/lib/tickers";

const STORAGE_KEY = "personal_portfolio_v1";

interface Holding {
  id: string;
  symbol: string;
  qty: number;
  avgCost: number;
}

interface Props {
  signals: Signal[];
  movers: Mover[];
  sectors: SectorData[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const pnlClass = (v: number) => (v >= 0 ? "text-green-400" : "text-red-400");

// Pleasant categorical palette for the donut slices.
const PALETTE = [
  "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899",
  "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#ef4444",
];

function loadHoldings(): Holding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHoldings(h: Holding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

function AllocationDonut({
  slices,
  totalValue,
}: {
  slices: { label: string; value: number; color: string }[];
  totalValue: number;
}) {
  const size = 150;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#21262d" strokeWidth={stroke} />
      {totalValue > 0 &&
        slices.map((s, i) => {
          const length = (s.value / totalValue) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
        })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-zinc-100" fontSize="20" fontWeight="700">
        {slices.length}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-zinc-500" fontSize="10" letterSpacing="1.5">
        POSITIONS
      </text>
    </svg>
  );
}

interface AutoProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (sym: string) => void;
  universe: TickerMeta[];
  priceLookup: (sym: string) => number | null;
}

function SymbolAutocomplete({ value, onChange, onSelect, universe, priceLookup }: AutoProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Filter + rank: exact match → prefix match → contains match (in symbol or name)
  const suggestions = useMemo(() => {
    const q = value.trim().toUpperCase();
    if (!q) {
      // Empty query: show first 10 as a "starter" set
      return universe.slice(0, 10);
    }
    const scored: { item: TickerMeta; score: number }[] = [];
    for (const t of universe) {
      const sym = t.symbol;
      const name = t.name.toUpperCase();
      let score = -1;
      if (sym === q) score = 0;
      else if (sym.startsWith(q)) score = 1;
      else if (name.startsWith(q)) score = 2;
      else if (sym.includes(q)) score = 3;
      else if (name.includes(q)) score = 4;
      if (score >= 0) scored.push({ item: t, score });
    }
    scored.sort((a, b) => a.score - b.score || a.item.symbol.localeCompare(b.item.symbol));
    return scored.slice(0, 10).map((s) => s.item);
  }, [value, universe]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    // Reset highlight when the filtered list changes
    setHighlight(0);
  }, [value]);

  const choose = (sym: string) => {
    onSelect(sym);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && suggestions[highlight]) {
        e.preventDefault();
        choose(suggestions[highlight].symbol);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder="Symbol (e.g. AAPL)"
        autoComplete="off"
        spellCheck={false}
        className="w-full bg-[#161b22] border border-[#21262d] rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 uppercase"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-[#161b22] border border-[#21262d] rounded-md shadow-xl max-h-72 overflow-y-auto">
          {suggestions.map((s, i) => {
            const price = priceLookup(s.symbol);
            return (
              <li
                key={s.symbol}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s.symbol);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer ${
                  i === highlight ? "bg-blue-600/20" : "hover:bg-[#1c2333]"
                }`}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono font-semibold text-blue-400">{s.symbol}</span>
                  <span className="text-zinc-500 text-xs truncate">{s.name}</span>
                </div>
                {price !== null && (
                  <span className="text-zinc-400 text-xs flex-shrink-0 ml-2">
                    ${price.toFixed(2)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PersonalPortfolio({ signals, movers, sectors }: Props) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [formError, setFormError] = useState("");
  const [quotes, setQuotes] = useState<Record<string, { price: number; change_pct: number }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    setHoldings(loadHoldings());
    setLoaded(true);
  }, []);

  // Look up the current market price for a symbol, falling back to the on-demand
  // quote cache for tickers we don't already track. We deliberately skip
  // `signals` here: `Signal.entry` is the AI's recommended buy/sell level, not a
  // live quote — using it would distort P&L when entry diverges from the market.
  const lookupPrice = useCallback(
    (sym: string): number | null => {
      const s = sym.toUpperCase();
      const mover = movers.find((m) => m.symbol === s);
      if (mover) return mover.price;
      const sec = sectors.find((c) => c.symbol === s);
      if (sec) return sec.price;
      const q = quotes[s];
      if (q) return q.price;
      return null;
    },
    [movers, sectors, quotes]
  );

  // Fetch quotes for any held tickers we don't already have a price for.
  const fetchMissingQuotes = useCallback(async () => {
    if (holdings.length === 0) return;
    // Only movers + sectors carry a live market price. `signals` is not in this
    // set even though some holdings may appear there: Signal.entry is a target
    // level, not a quote, so we still need to fetch a real quote for those.
    const haveLocal = new Set<string>([
      ...movers.map((m) => m.symbol),
      ...sectors.map((s) => s.symbol),
    ]);
    const need = holdings
      .map((h) => h.symbol)
      .filter((s) => !haveLocal.has(s) && !quotes[s]);
    if (need.length === 0) return;
    try {
      const res = await getQuotes(need);
      const next: Record<string, { price: number; change_pct: number }> = {};
      for (const q of res.data) next[q.symbol] = { price: q.price, change_pct: q.change_pct };
      if (Object.keys(next).length > 0) {
        setQuotes((prev) => ({ ...prev, ...next }));
      }
    } catch {}
  }, [holdings, movers, sectors, quotes]);

  useEffect(() => {
    if (loaded) fetchMissingQuotes();
  }, [loaded, fetchMissingQuotes]);

  const refreshQuotes = async () => {
    if (holdings.length === 0) return;
    setRefreshing(true);
    try {
      const symbols = [...new Set(holdings.map((h) => h.symbol))];
      const res = await getQuotes(symbols);
      const next: Record<string, { price: number; change_pct: number }> = {};
      for (const q of res.data) next[q.symbol] = { price: q.price, change_pct: q.change_pct };
      setQuotes(next);
    } catch {}
    setRefreshing(false);
  };

  const persist = (updated: Holding[]) => {
    setHoldings(updated);
    saveHoldings(updated);
  };

  const handleSymbolChange = (val: string) => {
    const up = val.toUpperCase();
    setSymbol(up);
    setFormError("");
    // Prefill avg cost with current price if we already know it
    const price = lookupPrice(up);
    if (price && !avgCost) setAvgCost(price.toFixed(2));
  };

  // Fired when the user picks a suggestion. We also auto-fetch a quote
  // when the chosen symbol isn't in our cached data, so the avg cost field
  // can prefill from a live price even for tickers the dashboard doesn't track.
  const handleSymbolSelect = async (sym: string) => {
    setSymbol(sym);
    setFormError("");
    let price = lookupPrice(sym);
    if (price === null) {
      try {
        const res = await getQuotes([sym]);
        if (res.data[0]) {
          price = res.data[0].price;
          setQuotes((prev) => ({
            ...prev,
            [sym]: { price: res.data[0].price, change_pct: res.data[0].change_pct },
          }));
        }
      } catch {}
    }
    if (price && !avgCost) setAvgCost(price.toFixed(2));
  };

  // Build a deduped autocomplete universe from the curated list plus
  // anything live in the dashboard data (movers, signals, sectors).
  const universe = useMemo<TickerMeta[]>(() => {
    const map = new Map<string, TickerMeta>();
    for (const t of POPULAR_TICKERS) map.set(t.symbol, t);
    const addBare = (sym: string, name = "") => {
      if (!sym) return;
      const s = sym.toUpperCase();
      if (!map.has(s)) map.set(s, { symbol: s, name });
    };
    for (const m of movers) addBare(m.symbol);
    for (const g of signals) addBare(g.symbol);
    for (const c of sectors) addBare(c.symbol, c.name);
    return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [movers, signals, sectors]);

  const handleAdd = async () => {
    setFormError("");
    const sym = symbol.trim().toUpperCase();
    const q = parseFloat(qty);
    const c = parseFloat(avgCost);
    if (!sym) return setFormError("Symbol is required");
    if (!q || q <= 0 || !Number.isFinite(q)) return setFormError("Enter a valid quantity");
    if (!c || c <= 0 || !Number.isFinite(c)) return setFormError("Enter a valid average cost");

    const id = (globalThis.crypto && "randomUUID" in globalThis.crypto)
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    persist([...holdings, { id, symbol: sym, qty: q, avgCost: c }]);
    setSymbol("");
    setQty("");
    setAvgCost("");

    // Fetch a quote for the newly added symbol if we don't have one
    if (lookupPrice(sym) === null) {
      try {
        const res = await getQuotes([sym]);
        if (res.data[0]) {
          setQuotes((prev) => ({
            ...prev,
            [sym]: { price: res.data[0].price, change_pct: res.data[0].change_pct },
          }));
        }
      } catch {}
    }
  };

  const handleRemove = (id: string) => {
    persist(holdings.filter((h) => h.id !== id));
  };

  const rows = useMemo(() => {
    return holdings.map((h, idx) => {
      const price = lookupPrice(h.symbol);
      const known = price !== null;
      const current = price ?? h.avgCost;
      const value = h.qty * current;
      const cost = h.qty * h.avgCost;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      const dayChg = quotes[h.symbol]?.change_pct ?? null;
      return {
        ...h,
        idx,
        color: PALETTE[idx % PALETTE.length],
        currentPrice: current,
        priceKnown: known,
        value,
        cost,
        pnl,
        pnlPct,
        dayChange: dayChg,
      };
    });
  }, [holdings, lookupPrice, quotes]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const slices = rows
    .filter((r) => r.value > 0)
    .map((r) => ({ label: r.symbol, value: r.value, color: r.color }));

  // Max |pnl| for scaling the per-row P&L bar
  const maxAbsPnl = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));

  if (!loaded) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">My Portfolio</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track your holdings — saved locally in this browser
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshQuotes}
            disabled={refreshing || holdings.length === 0}
            className="flex items-center gap-1.5 text-xs bg-[#0f1117] hover:bg-[#1c2333] border border-[#21262d] px-3 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            <span className={refreshing ? "animate-spin" : ""}>⟳</span>
            {refreshing ? "Updating..." : "Refresh Prices"}
          </button>
          {holdings.length > 0 &&
            (!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            ) : (
              <span className="text-xs flex items-center gap-2">
                <span className="text-zinc-400">Remove all?</span>
                <button
                  onClick={() => {
                    persist([]);
                    setResetConfirm(false);
                  }}
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
            ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Value</div>
          <div className="text-lg font-bold text-zinc-100 leading-tight">{fmt(totalValue)}</div>
        </div>
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Cost Basis</div>
          <div className="text-lg font-bold text-zinc-300 leading-tight">{fmt(totalCost)}</div>
        </div>
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total P&amp;L</div>
          <div className={`text-lg font-bold leading-tight ${pnlClass(totalPnl)}`}>
            {fmt(totalPnl)}
          </div>
        </div>
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Return</div>
          <div className={`text-lg font-bold leading-tight ${pnlClass(totalPnl)}`}>
            {fmtPct(totalPnlPct)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Holdings table + add form */}
        <div>
          {rows.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6 border border-dashed border-[#21262d] rounded-md mb-4">
              No holdings yet — add your first position below.
            </p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-[#21262d]">
                    <th className="text-left pb-2 pr-2 w-3"></th>
                    <th className="text-left pb-2 pr-3">Symbol</th>
                    <th className="text-right pb-2 pr-3">Qty</th>
                    <th className="text-right pb-2 pr-3">Avg Cost</th>
                    <th className="text-right pb-2 pr-3">Current</th>
                    <th className="text-right pb-2 pr-3">Day</th>
                    <th className="text-right pb-2 pr-3">Value</th>
                    <th className="text-left pb-2 pr-3">P&amp;L</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pnlWidth = (Math.abs(r.pnl) / maxAbsPnl) * 50; // up to 50% of bar
                    return (
                      <tr key={r.id} className="border-b border-[#21262d] last:border-0">
                        <td className="py-2 pr-2">
                          <span
                            className="block w-2 h-6 rounded-sm"
                            style={{ backgroundColor: r.color }}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono font-semibold text-blue-400">
                          {r.symbol}
                          {!r.priceKnown && (
                            <span
                              className="text-[10px] text-zinc-600 ml-1 align-top"
                              title="Live price not yet available — using avg cost"
                            >
                              ?
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right text-zinc-300">{r.qty}</td>
                        <td className="py-2 pr-3 text-right text-zinc-400">{fmt(r.avgCost)}</td>
                        <td className="py-2 pr-3 text-right text-zinc-300">{fmt(r.currentPrice)}</td>
                        <td
                          className={`py-2 pr-3 text-right text-xs ${
                            r.dayChange === null
                              ? "text-zinc-600"
                              : r.dayChange >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {r.dayChange === null ? "—" : fmtPct(r.dayChange)}
                        </td>
                        <td className="py-2 pr-3 text-right text-zinc-300">{fmt(r.value)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            {/* P&L bar — left half = loss, right half = gain */}
                            <div className="relative w-24 h-1.5 bg-[#21262d] rounded-full overflow-hidden flex-shrink-0">
                              <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-700" />
                              <div
                                className={`absolute inset-y-0 ${
                                  r.pnl >= 0 ? "left-1/2 bg-green-500" : "right-1/2 bg-red-500"
                                }`}
                                style={{ width: `${pnlWidth}%` }}
                              />
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className={`text-xs font-semibold ${pnlClass(r.pnl)}`}>
                                {fmt(r.pnl)}
                              </span>
                              <span className={`text-[10px] ${pnlClass(r.pnl)}`}>
                                {fmtPct(r.pnlPct)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleRemove(r.id)}
                            className="text-zinc-600 hover:text-red-400 text-sm transition-colors"
                            title="Remove holding"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form */}
          <div className="bg-[#0f1117] border border-[#21262d] rounded-md p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Add Holding
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <SymbolAutocomplete
                value={symbol}
                onChange={handleSymbolChange}
                onSelect={handleSymbolSelect}
                universe={universe}
                priceLookup={lookupPrice}
              />
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Quantity"
                min="0"
                step="any"
                className="bg-[#161b22] border border-[#21262d] rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="Avg cost $"
                min="0"
                step="0.01"
                className="bg-[#161b22] border border-[#21262d] rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAdd}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-4 py-1.5 transition-colors"
              >
                Add
              </button>
            </div>
            {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}
          </div>
        </div>

        {/* Allocation donut */}
        <div className="bg-[#0f1117] border border-[#21262d] rounded-md p-4 flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 self-start">
            Allocation
          </div>
          {slices.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-8">
              Add positions to see your allocation breakdown.
            </p>
          ) : (
            <>
              <AllocationDonut slices={slices} totalValue={totalValue} />
              <div className="w-full mt-3 space-y-1 max-h-48 overflow-y-auto">
                {[...slices]
                  .sort((a, b) => b.value - a.value)
                  .map((s) => {
                    const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
                    return (
                      <div key={s.label} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-zinc-300 font-mono">{s.label}</span>
                        <span className="text-zinc-500 ml-auto">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
