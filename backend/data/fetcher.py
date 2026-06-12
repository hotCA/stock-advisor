import yfinance as yf
import pandas as pd
import httpx
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict

# Replace yfinance's SQLite timezone cache with its built-in no-op cache.
# The SQLite cache serializes on a file lock and raises "database is locked"
# when several downloads run concurrently (threads=True / our thread pool),
# intermittently dropping tickers. The dummy cache just re-resolves the
# timezone from each chart response, which removes the contention entirely.
try:
    from yfinance import cache as _yf_cache
    _yf_cache._TzCacheManager._tz_cache = _yf_cache._TzCacheDummy()
except Exception:  # pragma: no cover - fall back to a private temp dir
    import tempfile as _tempfile
    yf.set_tz_cache_location(_tempfile.gettempdir())
import logging

try:
    import robin_stocks.robinhood as rh
    ROBINHOOD_AVAILABLE = True
except ImportError:
    ROBINHOOD_AVAILABLE = False

logger = logging.getLogger(__name__)


def download_universe(symbols: List[str], period: str = "3mo") -> pd.DataFrame:
    """One batched OHLCV download for the whole universe.

    The 3-month panel is a superset of what movers (2d), sparklines (1mo),
    most-traded (1mo) and per-ticker history (3mo) each need, so we fetch it
    once and slice locally instead of hitting Yahoo four separate times.
    threads=True lets yfinance parallelize the underlying requests.
    """
    return yf.download(
        symbols,
        period=period,
        interval="1d",
        progress=False,
        auto_adjust=True,
        threads=True,
        group_by="column",
    )


def _ticker_ohlcv(panel: pd.DataFrame, sym: str) -> Optional[pd.DataFrame]:
    """Extract a single ticker's OHLCV frame from a multi-ticker panel."""
    if not isinstance(panel.columns, pd.MultiIndex):
        # Single-ticker download: columns are already Open/High/Low/Close/Volume
        return panel.dropna(how="all")
    try:
        df = panel.xs(sym, axis=1, level=1)
    except KeyError:
        return None
    return df.dropna(how="all")


def get_sp500_movers(top_n: int = 10, panel: Optional[pd.DataFrame] = None) -> dict:
    """Fetch top gainers and losers from a curated S&P 500 subset."""
    from config import SIGNAL_UNIVERSE

    tickers = panel if panel is not None else download_universe(SIGNAL_UNIVERSE)

    if tickers.empty:
        return {"gainers": [], "losers": []}

    close = tickers["Close"]
    if len(close) < 2:
        return {"gainers": [], "losers": []}

    pct_change = ((close.iloc[-1] - close.iloc[-2]) / close.iloc[-2] * 100).dropna()
    volume_data = tickers["Volume"].iloc[-1]

    results = []
    for sym in pct_change.index:
        price = float(close.iloc[-1][sym]) if sym in close.columns else 0
        vol = int(volume_data[sym]) if sym in volume_data.index else 0
        results.append({
            "symbol": sym,
            "price": round(price, 2),
            "change_pct": round(float(pct_change[sym]), 2),
            "volume": vol,
        })

    results.sort(key=lambda x: x["change_pct"], reverse=True)
    gainers = results[:top_n]
    losers = list(reversed(results))[:top_n]

    return {"gainers": gainers, "losers": losers}


def get_stock_history(symbol: str, period: str = "3mo") -> pd.DataFrame:
    """Fetch OHLCV history for a single ticker."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, auto_adjust=True)
    return df


def get_batch_history(
    symbols: List[str],
    period: str = "3mo",
    panel: Optional[pd.DataFrame] = None,
) -> Dict[str, pd.DataFrame]:
    """Fetch OHLCV history for multiple tickers in a single batched download.

    Replaces the previous per-ticker loop (~70 sequential HTTP requests) with
    one batched call, slicing each ticker's frame out of the shared panel.
    """
    if panel is None:
        panel = download_universe(symbols, period)
    if panel.empty:
        return {}

    result = {}
    for sym in symbols:
        df = _ticker_ohlcv(panel, sym)
        if df is not None and not df.empty:
            result[sym] = df
    return result


def get_options_flow(symbol: str) -> Optional[dict]:
    """Fetch options chain data and compute put/call ratio + unusual activity."""
    try:
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        if not expirations:
            return None

        # Use the nearest expiration within 30 days
        nearest = expirations[0]
        chain = ticker.option_chain(nearest)
        calls = chain.calls
        puts = chain.puts

        total_call_oi = int(calls["openInterest"].sum()) if not calls.empty else 0
        total_put_oi = int(puts["openInterest"].sum()) if not puts.empty else 0
        pc_ratio = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0

        # Unusual activity = options with volume > 2x open interest
        unusual_calls = calls[calls["volume"] > calls["openInterest"] * 2].head(3)
        unusual_puts = puts[puts["volume"] > puts["openInterest"] * 2].head(3)

        def format_rows(df: pd.DataFrame, kind: str) -> list:
            out = []
            for _, row in df.iterrows():
                out.append({
                    "type": kind,
                    "strike": float(row.get("strike", 0)),
                    "expiry": nearest,
                    "volume": int(row.get("volume", 0)),
                    "open_interest": int(row.get("openInterest", 0)),
                    "implied_volatility": round(float(row.get("impliedVolatility", 0)) * 100, 1),
                })
            return out

        unusual = format_rows(unusual_calls, "CALL") + format_rows(unusual_puts, "PUT")
        unusual.sort(key=lambda x: x["volume"], reverse=True)

        # fast_info avoids the slow .info scrape (a full quote-summary HTTP call)
        try:
            price = ticker.fast_info.get("lastPrice") or 0
        except Exception:
            price = 0

        return {
            "symbol": symbol,
            "price": round(float(price), 2),
            "expiry": nearest,
            "put_call_ratio": pc_ratio,
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "unusual_activity": unusual[:5],
            "sentiment": "Bearish" if pc_ratio > 1.2 else "Bullish" if pc_ratio < 0.7 else "Neutral",
        }
    except Exception as e:
        logger.warning(f"Options fetch failed for {symbol}: {e}")
        return None


def get_options_summary(symbols: List[str]) -> List[dict]:
    """Get options flow for a list of symbols (fetched in parallel)."""
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = [d for d in ex.map(get_options_flow, symbols) if d]
    results.sort(key=lambda x: x["put_call_ratio"], reverse=True)
    return results


def _vix_to_score(vix: float) -> float:
    """Convert VIX level to a 0-100 fear/greed score (inverted: high VIX = fear)."""
    # VIX <12 → ~90 (Extreme Greed), VIX >35 → ~5 (Extreme Fear)
    score = 100 - (vix - 10) * 3.5
    return round(max(0.0, min(100.0, score)), 1)


def _score_to_rating(score: float) -> str:
    if score >= 75: return "Extreme Greed"
    if score >= 55: return "Greed"
    if score >= 45: return "Neutral"
    if score >= 25: return "Fear"
    return "Extreme Fear"


SECTOR_MAP = {
    "SPY":  "S&P 500",
    "QQQ":  "Nasdaq",
    "XLK":  "Technology",
    "XLF":  "Financials",
    "XLE":  "Energy",
    "XLV":  "Healthcare",
    "XLI":  "Industrials",
    "XLY":  "Cons. Discr.",
    "XLP":  "Cons. Staples",
    "XLB":  "Materials",
    "SOXX": "Semis",
    "GLD":  "Gold",
    "TLT":  "Bonds",
    "IWM":  "Small Caps",
}


def get_sector_performance() -> List[dict]:
    """Fetch today's % change for major sector ETFs."""
    tickers = list(SECTOR_MAP.keys())
    try:
        raw = yf.download(tickers, period="2d", interval="1d",
                          progress=False, auto_adjust=True, threads=False)
        close = raw["Close"]
        if len(close) < 2:
            return []
        pct = ((close.iloc[-1] - close.iloc[-2]) / close.iloc[-2] * 100).dropna()
        results = []
        for sym, name in SECTOR_MAP.items():
            if sym in pct.index:
                results.append({
                    "symbol": sym,
                    "name": name,
                    "change_pct": round(float(pct[sym]), 2),
                    "price": round(float(close.iloc[-1][sym]), 2),
                })
        return results
    except Exception as e:
        logger.warning(f"Sector performance fetch failed: {e}")
        return []


def get_fear_greed_index() -> Optional[dict]:
    """Compute Fear & Greed score from VIX + SPY momentum (no external API needed)."""
    try:
        # Fetch separately — ^VIX doesn't play well in batch downloads
        vix_series = yf.Ticker("^VIX").history(period="6mo", auto_adjust=True)["Close"].dropna()
        spy_series = yf.Ticker("SPY").history(period="6mo", auto_adjust=True)["Close"].dropna()

        if vix_series.empty or spy_series.empty:
            return None

        vix_now   = float(vix_series.iloc[-1])
        vix_prev  = float(vix_series.iloc[-2])
        vix_1w    = float(vix_series.iloc[-6]) if len(vix_series) >= 6 else vix_now
        vix_1mo   = float(vix_series.iloc[-22]) if len(vix_series) >= 22 else vix_now

        # SPY momentum: % above/below 50-day MA shifts score ±10
        spy_50ma = float(spy_series.tail(50).mean())
        spy_now  = float(spy_series.iloc[-1])
        momentum_adj = min(10.0, max(-10.0, (spy_now - spy_50ma) / spy_50ma * 100))

        score       = round(max(0.0, min(100.0, _vix_to_score(vix_now) + momentum_adj)), 1)
        score_prev  = round(max(0.0, min(100.0, _vix_to_score(vix_prev))), 1)
        score_1w    = round(max(0.0, min(100.0, _vix_to_score(vix_1w))), 1)
        score_1mo   = round(max(0.0, min(100.0, _vix_to_score(vix_1mo))), 1)

        return {
            "score": score,
            "rating": _score_to_rating(score),
            "previous_close": score_prev,
            "previous_1_week": score_1w,
            "previous_1_month": score_1mo,
            "vix": round(vix_now, 2),
        }
    except Exception as e:
        logger.warning(f"Fear & Greed fetch failed: {e}")
        return None


_ETF_TICKERS = {
    "SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLV", "XLK",
    "XLI", "XLY", "XLP", "XLB", "SOXX", "GLD", "TLT",
    "SLV", "VXX", "UVXY", "SQQQ", "TQQQ",
}


def _street_consensus(df) -> Optional[float]:
    """Extract analyst consensus (avg) from a yfinance estimates DataFrame.

    DataFrame is indexed by horizon (0q current quarter, +1q next quarter,
    0y current FY, +1y next FY) with columns including `avg`. We want the
    current-quarter Street average — that's the published consensus for the
    upcoming earnings event. Falls back to next quarter if the current one
    is missing or NaN.
    """
    if df is None:
        return None
    try:
        if not hasattr(df, "empty") or df.empty or "avg" not in df.columns:
            return None
        for period in ("0q", "+1q"):
            if period not in df.index:
                continue
            v = df.at[period, "avg"]
            if v is None:
                continue
            v = float(v)
            if v != v:  # NaN
                continue
            return v
        return None
    except Exception:
        return None


def _actuals_for_report(ticker, report_date: datetime) -> tuple:
    """Look up actuals for the fiscal quarter being reported on `report_date`.

    Returns (eps_actual, revenue_actual) — either may be None if yfinance
    doesn't expose actuals for that ticker, OR if the upcoming quarter hasn't
    actually been reported yet. The window is tight on purpose: a typical
    fiscal quarter ends 30-60 days before the announcement (with a hard floor
    around 7 days to allow late reporters). Using `<= report_date` instead
    would silently grab the PREVIOUS quarter's actuals for any upcoming event
    whose calendar date is in the past (yfinance returns dates at 00:00 UTC,
    so an after-hours report on `today` looks past from midnight onward).
    """
    eps_actual: Optional[float] = None
    rev_actual: Optional[int] = None
    rd = pd.Timestamp(report_date.replace(tzinfo=None) if report_date.tzinfo else report_date)
    earliest = rd - pd.Timedelta(days=100)
    latest = rd - pd.Timedelta(days=7)

    # EPS actual: earnings_history is keyed by fiscal quarter-end date
    try:
        eh = getattr(ticker, "earnings_history", None)
        if eh is not None and hasattr(eh, "empty") and not eh.empty and "epsActual" in eh.columns:
            candidates = []
            for ts in eh.index:
                ts_p = pd.Timestamp(ts)
                if earliest <= ts_p <= latest:
                    v = eh.at[ts, "epsActual"]
                    if v is not None and v == v:  # not NaN
                        candidates.append((ts_p, float(v)))
            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                eps_actual = round(candidates[0][1], 2)
    except Exception:
        pass

    # Revenue actual: quarterly_income_stmt's "Total Revenue" row
    try:
        qis = getattr(ticker, "quarterly_income_stmt", None)
        if qis is not None and hasattr(qis, "empty") and not qis.empty and "Total Revenue" in qis.index:
            tr = qis.loc["Total Revenue"]
            candidates = []
            for ts in tr.index:
                ts_p = pd.Timestamp(ts)
                if earliest <= ts_p <= latest:
                    v = tr[ts]
                    if v is not None and v == v:
                        candidates.append((ts_p, float(v)))
            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                rev_actual = int(candidates[0][1])
    except Exception:
        pass

    return eps_actual, rev_actual


def _earnings_for_symbol(sym: str, start: datetime, cutoff: datetime, now: datetime) -> Optional[dict]:
    """Fetch the next earnings event for a single ticker within the window."""
    try:
        ticker = yf.Ticker(sym)
        cal = ticker.calendar
        if cal is None:
            return None

        # calendar can be a dict or DataFrame depending on yfinance version
        if isinstance(cal, dict):
            dates = cal.get("Earnings Date", [])
            cal_eps = cal.get("EPS Estimate", None)
            cal_rev = cal.get("Revenue Estimate", None)
        elif hasattr(cal, "columns"):
            row = cal.iloc[:, 0] if not cal.empty else {}
            dates = row.get("Earnings Date", []) if isinstance(row, dict) else []
            cal_eps = row.get("EPS Estimate", None)
            cal_rev = row.get("Revenue Estimate", None)
        else:
            return None

        if not dates:
            return None

        # dates may be a list of Timestamps or a single Timestamp
        if not isinstance(dates, (list, tuple)):
            dates = [dates]

        # Pull the Street consensus (analyst average) — the calendar field is often
        # missing for many tickers, but earnings_estimate / revenue_estimate carries
        # the published consensus for nearly everything covered by analysts.
        street_eps = None
        street_rev = None
        try:
            street_eps = _street_consensus(getattr(ticker, "earnings_estimate", None))
        except Exception:
            pass
        try:
            street_rev = _street_consensus(getattr(ticker, "revenue_estimate", None))
        except Exception:
            pass

        # Prefer the Street consensus; fall back to whatever the calendar shipped
        eps_est = street_eps if street_eps is not None else (
            float(cal_eps) if cal_eps is not None else None
        )
        rev_est = street_rev if street_rev is not None else (
            float(cal_rev) if cal_rev is not None else None
        )

        for dt in dates:
            try:
                # yfinance may return a tz-aware datetime, a naive datetime, or a
                # plain datetime.date. Normalize all to a tz-aware UTC datetime.
                # (datetime is a subclass of date, so check it first.)
                if isinstance(dt, datetime):
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                elif isinstance(dt, date):
                    dt = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
                else:
                    continue
                if start <= dt <= cutoff:
                    # Always attempt the actuals lookup — the window inside
                    # `_actuals_for_report` excludes the previous quarter, so a
                    # future event harmlessly returns (None, None) until the
                    # company actually files. `reported` is then driven by the
                    # PRESENCE of actuals rather than the calendar clock,
                    # avoiding the 00:00-UTC false-positive on report day.
                    eps_actual, rev_actual = _actuals_for_report(ticker, dt)
                    has_actual = eps_actual is not None or rev_actual is not None
                    return {
                        "symbol": sym,
                        "date": dt.strftime("%Y-%m-%d"),
                        "eps_estimate": round(eps_est, 2) if eps_est is not None else None,
                        "revenue_estimate": int(rev_est) if rev_est is not None else None,
                        "eps_actual": eps_actual,
                        "revenue_actual": rev_actual,
                        "reported": has_actual,
                    }
            except Exception:
                continue
        return None
    except Exception as e:
        logger.warning(f"Earnings calendar failed for {sym}: {e}")
        return None


def get_earnings_calendar(symbols: List[str]) -> List[dict]:
    """Return earnings events from the past 7 days through the next 30.

    Keeping just-reported events in the calendar for a week lets the dashboard
    show actuals + beat/miss alongside the original estimates, instead of having
    the row disappear the moment the report date passes.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    cutoff = now + timedelta(days=30)

    # ETFs don't have earnings — skip them to avoid 404 noise
    symbols = [s for s in symbols if s not in _ETF_TICKERS]

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = [
            r for r in ex.map(lambda s: _earnings_for_symbol(s, start, cutoff, now), symbols)
            if r
        ]

    results.sort(key=lambda x: x["date"])
    return results


_EXCLUDE_WORDS = {
    "AI", "US", "UK", "EU", "CEO", "CFO", "CTO", "IPO", "ETF", "SEC", "FED",
    "GDP", "CPI", "IMO", "WSB", "DD", "OTM", "ITM", "ATM", "DTE", "IV", "TA",
    "PT", "EPS", "PE", "ATH", "EOD", "EOW", "YOLO", "THE", "FOR", "AND", "BUT",
    "NOT", "ARE", "WAS", "HAS", "HAD", "IRS", "GDP", "PCE", "NFP", "ADP",
    "LLC", "INC", "ETF", "USD", "CAD", "EUR", "GBP", "JPY", "BTC", "ETH",
    "NOW", "NEW", "ALL", "ONE", "TWO", "TOP", "BIG", "GET", "USE", "BUY",
    "SELL", "HOLD", "CALL", "PUT", "SHORT", "LONG", "BULL", "BEAR", "HIGH",
    "LOW", "UP", "DOWN", "OUT", "OFF", "ON", "IN", "AT", "TO", "FROM",
}

import re as _re
_TICKER_RE = _re.compile(r'\b([A-Z]{2,5})\b')


def get_reddit_sentiment() -> List[dict]:
    """Fetch top mentioned tickers from r/wallstreetbets, r/stocks, r/options."""
    from collections import defaultdict
    mention_counts: dict = defaultdict(int)
    mention_scores: dict = defaultdict(int)
    mention_titles: dict = defaultdict(list)

    headers = {"User-Agent": "StockAdvisorBot/1.0 (educational)"}
    subreddits = ["wallstreetbets", "stocks", "options"]

    with httpx.Client(timeout=15) as client:
        for sub in subreddits:
            try:
                resp = client.get(
                    f"https://www.reddit.com/r/{sub}/hot.json?limit=100",
                    headers=headers,
                )
                if resp.status_code != 200:
                    continue
                posts = resp.json().get("data", {}).get("children", [])
                for post in posts:
                    d = post.get("data", {})
                    title = d.get("title", "")
                    score = int(d.get("score", 0))
                    text = title + " " + d.get("selftext", "")[:300]
                    tickers = set(_TICKER_RE.findall(text.upper())) - _EXCLUDE_WORDS
                    for t in tickers:
                        mention_counts[t] += 1
                        mention_scores[t] += score
                        if len(mention_titles[t]) < 2:
                            mention_titles[t].append(title[:120])
            except Exception as e:
                logger.warning(f"Reddit fetch failed for r/{sub}: {e}")

    results = []
    for ticker, count in mention_counts.items():
        if count >= 2 or mention_scores[ticker] >= 200:
            results.append({
                "symbol": ticker,
                "mentions": count,
                "score": mention_scores[ticker],
                "titles": mention_titles[ticker],
            })

    results.sort(key=lambda x: x["mentions"] * 5 + x["score"] / 500, reverse=True)
    return results[:25]


def get_sparklines(symbols: List[str], panel: Optional[pd.DataFrame] = None) -> List[dict]:
    """Return ~22 trading days of close prices for mini sparkline charts."""
    try:
        raw = panel if panel is not None else download_universe(symbols, "1mo")
        if raw.empty:
            return []
        close = raw["Close"] if hasattr(raw["Close"], "columns") else raw["Close"].to_frame()
        # Limit to the most recent month so sparklines stay short even when fed
        # the shared 3-month panel.
        close = close.tail(22)
        results = []
        for sym in symbols:
            col = sym if sym in close.columns else None
            if col is None:
                continue
            prices = close[col].dropna().tolist()
            if prices:
                results.append({"symbol": sym, "prices": [round(float(p), 2) for p in prices]})
        return results
    except Exception as e:
        logger.warning(f"Sparklines fetch failed: {e}")
        return []


def _news_for_symbol(sym: str) -> List[dict]:
    """Fetch up to 3 recent headlines for a single ticker."""
    out = []
    try:
        ticker = yf.Ticker(sym)
        news_items = ticker.news or []
        for item in news_items[:3]:
            # Support both old and new yfinance news formats
            content = item.get("content", {})
            title = item.get("title") or content.get("title", "")
            link = (item.get("link") or
                    content.get("canonicalUrl", {}).get("url", "") or
                    content.get("clickThroughUrl", {}).get("url", ""))
            publisher = (item.get("publisher") or
                         content.get("provider", {}).get("displayName", ""))
            pub_time = item.get("providerPublishTime") or 0
            if title:
                out.append({
                    "symbol": sym,
                    "title": title,
                    "publisher": publisher,
                    "link": link,
                    "published": pub_time,
                })
    except Exception as e:
        logger.warning(f"News fetch failed for {sym}: {e}")
    return out


def get_news(symbols: List[str]) -> List[dict]:
    """Fetch recent news headlines for key tickers (in parallel)."""
    with ThreadPoolExecutor(max_workers=8) as ex:
        batches = ex.map(_news_for_symbol, symbols[:14])
    results = [item for batch in batches for item in batch]
    results.sort(key=lambda x: x["published"], reverse=True)
    return results[:30]


def get_most_traded(top_n: int = 20, panel: Optional[pd.DataFrame] = None) -> dict:
    """Return top tickers by volume over day, week, and month windows."""
    from config import SIGNAL_UNIVERSE
    try:
        raw = panel if panel is not None else download_universe(SIGNAL_UNIVERSE, "1mo")
        if raw.empty:
            return {"day": [], "week": [], "month": []}

        # Most recent month only, so the "month" window stays ~22 sessions even
        # when fed the shared 3-month panel.
        volume = raw["Volume"].tail(22).dropna(how="all")
        close = raw["Close"].tail(22)

        def top_by_volume(vol_series: pd.Series, n: int) -> list:
            ranked = vol_series.sort_values(ascending=False).head(n)
            result = []
            for sym in ranked.index:
                # Skip rows where yfinance returned NaN for the latest close —
                # otherwise the response carries a NaN float and FastAPI's JSON
                # encoder raises "Out of range float values are not JSON compliant".
                if sym not in close.columns:
                    continue
                price = float(close.iloc[-1][sym])
                if price != price:  # NaN
                    continue
                if len(close) >= 2:
                    prev = float(close.iloc[-2][sym])
                    if prev != prev or not prev:
                        change_pct = 0.0
                    else:
                        change_pct = round((price - prev) / prev * 100, 2)
                else:
                    change_pct = 0.0
                vol = ranked[sym]
                if vol != vol:  # NaN
                    continue
                result.append({
                    "symbol": sym,
                    "volume": int(vol),
                    "price": round(price, 2),
                    "change_pct": change_pct,
                })
            return result

        return {
            "day": top_by_volume(volume.iloc[-1].dropna(), top_n),
            "week": top_by_volume(volume.tail(5).sum().dropna(), top_n),
            "month": top_by_volume(volume.sum().dropna(), top_n),
        }
    except Exception as e:
        logger.warning(f"Most traded fetch failed: {e}")
        return {"day": [], "week": [], "month": []}


def login_robinhood(username: str, password: str, mfa_code: str = "") -> bool:
    """Log in to Robinhood (optional)."""
    if not ROBINHOOD_AVAILABLE or not username or not password:
        return False
    try:
        kwargs = {"username": username, "password": password, "store_session": True}
        if mfa_code:
            kwargs["mfa_code"] = mfa_code
        rh.login(**kwargs)
        return True
    except Exception as e:
        logger.warning(f"Robinhood login failed: {e}")
        return False


def get_robinhood_portfolio() -> Optional[dict]:
    """Fetch Robinhood portfolio data (requires login)."""
    if not ROBINHOOD_AVAILABLE:
        return None
    try:
        profile = rh.load_portfolio_profile()
        positions = rh.get_open_stock_positions()

        holdings = []
        for pos in (positions or []):
            instrument_url = pos.get("instrument", "")
            try:
                info = rh.get_instrument_by_url(instrument_url)
                symbol = info.get("symbol", "")
                qty = float(pos.get("quantity", 0))
                avg_price = float(pos.get("average_buy_price", 0))
                quotes = rh.get_quotes([symbol])
                current = float(quotes[0].get("last_trade_price", 0)) if quotes else 0
                holdings.append({
                    "symbol": symbol,
                    "quantity": qty,
                    "avg_price": round(avg_price, 2),
                    "current_price": round(current, 2),
                    "pnl": round((current - avg_price) * qty, 2),
                    "pnl_pct": round((current - avg_price) / avg_price * 100, 2) if avg_price else 0,
                })
            except Exception:
                continue

        return {
            "equity": float(profile.get("equity", 0) or 0),
            "cash": float(profile.get("withdrawable_amount", 0) or 0),
            "holdings": holdings,
        }
    except Exception as e:
        logger.warning(f"Portfolio fetch failed: {e}")
        return None


MARKET_INDEXES = [
    {"symbol": "^GSPC", "name": "S&P 500", "short": "SPX"},
    {"symbol": "^IXIC", "name": "NASDAQ Composite", "short": "IXIC"},
    {"symbol": "^DJI", "name": "Dow Jones", "short": "DJI"},
]


def get_market_indexes() -> List[dict]:
    """Fetch current value + 30-day sparkline for the three major US indexes.

    Returns one row per index with: name, short label, price, day change, day %,
    and a small sparkline of recent closes. Falls back to an empty list on error.
    """
    out: List[dict] = []
    for meta in MARKET_INDEXES:
        try:
            t = yf.Ticker(meta["symbol"])
            hist = t.history(period="1mo", auto_adjust=True)["Close"].dropna()
            if len(hist) < 2:
                continue
            last = float(hist.iloc[-1])
            prev = float(hist.iloc[-2])
            change = last - prev
            change_pct = (change / prev * 100) if prev else 0
            prices = [round(float(p), 2) for p in hist.tail(30).tolist()]
            out.append({
                "symbol": meta["symbol"],
                "name": meta["name"],
                "short": meta["short"],
                "price": round(last, 2),
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "sparkline": prices,
            })
        except Exception as e:
            logger.warning(f"Index fetch failed for {meta['symbol']}: {e}")
            continue
    return out


def get_quotes(symbols: List[str]) -> List[dict]:
    """Batch-fetch last price + day % change for arbitrary tickers.

    Used by the personal portfolio so users can hold any ticker, not just
    those already in our cached universe. Returns one row per resolvable symbol.
    """
    symbols = [s.strip().upper() for s in symbols if s and s.strip()]
    if not symbols:
        return []
    try:
        raw = yf.download(
            symbols, period="2d", interval="1d",
            progress=False, auto_adjust=True, threads=True, group_by="column",
        )
        if raw.empty:
            return []
        # Single-symbol downloads come back without a MultiIndex on columns.
        if not isinstance(raw.columns, pd.MultiIndex):
            close = raw["Close"].dropna()
            if len(close) < 1:
                return []
            last = float(close.iloc[-1])
            prev = float(close.iloc[-2]) if len(close) >= 2 else last
            change_pct = ((last - prev) / prev * 100) if prev else 0
            return [{
                "symbol": symbols[0],
                "price": round(last, 2),
                "change_pct": round(change_pct, 2),
            }]
        close = raw["Close"]
        results = []
        for sym in symbols:
            if sym not in close.columns:
                continue
            series = close[sym].dropna()
            if len(series) < 1:
                continue
            last = float(series.iloc[-1])
            prev = float(series.iloc[-2]) if len(series) >= 2 else last
            change_pct = ((last - prev) / prev * 100) if prev else 0
            results.append({
                "symbol": sym,
                "price": round(last, 2),
                "change_pct": round(change_pct, 2),
            })
        return results
    except Exception as e:
        logger.warning(f"Quote fetch failed for {symbols}: {e}")
        return []
