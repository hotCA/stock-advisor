import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import (
    SIGNAL_UNIVERSE,
    OPTIONS_WATCHLIST,
    TOP_MOVERS_COUNT,
    ROBINHOOD_USERNAME,
    ROBINHOOD_PASSWORD,
    ROBINHOOD_MFA_CODE,
)
from data.fetcher import (
    download_universe,
    get_sp500_movers,
    get_batch_history,
    get_options_summary,
    get_fear_greed_index,
    get_earnings_calendar,
    get_sector_performance,
    login_robinhood,
    get_robinhood_portfolio,
    get_sparklines,
    get_news,
    get_reddit_sentiment,
    get_most_traded,
)
from data.indicators import analyze_ticker
from ai.analyzer import generate_signals, generate_daily_report, stream_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stock Advisor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache
_cache: dict = {
    "movers": None,
    "signals": None,
    "options": None,
    "report": None,
    "portfolio": None,
    "fear_greed": None,
    "earnings": None,
    "sectors": None,
    "sparklines": None,
    "news": None,
    "reddit": None,
    "most_traded": None,
    "last_refresh": None,
}


def _refresh_all() -> None:
    """Fetch fresh data and run analysis. Called by scheduler and on-demand.

    Strategy: download the whole universe once, derive the price-based panels
    (movers, history, sparklines, most-traded) locally, and run every
    independent network fetch concurrently so wall-clock time is bounded by the
    slowest single call rather than the sum of all of them.
    """
    logger.info("Refreshing market data...")
    start = time.time()

    # Single batched download — reused for movers, history, sparklines, volume
    panel = download_universe(SIGNAL_UNIVERSE, period="3mo")

    # Kick off the independent network-bound fetches in parallel
    with ThreadPoolExecutor(max_workers=6) as ex:
        f_options = ex.submit(get_options_summary, OPTIONS_WATCHLIST)
        f_sectors = ex.submit(get_sector_performance)
        f_fear_greed = ex.submit(get_fear_greed_index)
        f_earnings = ex.submit(get_earnings_calendar, SIGNAL_UNIVERSE)
        f_news = ex.submit(get_news, OPTIONS_WATCHLIST)
        f_reddit = ex.submit(get_reddit_sentiment)

        # Meanwhile, derive everything that comes from the shared panel (CPU-only)
        movers = get_sp500_movers(TOP_MOVERS_COUNT, panel=panel)
        _cache["movers"] = movers
        _cache["sparklines"] = get_sparklines(SIGNAL_UNIVERSE, panel=panel)
        _cache["most_traded"] = get_most_traded(panel=panel)

        history_map = get_batch_history(SIGNAL_UNIVERSE, panel=panel)
        technical_data = {sym: analyze_ticker(df) for sym, df in history_map.items()}

        # Collect the parallel network results
        options = f_options.result()
        _cache["options"] = options
        _cache["sectors"] = f_sectors.result()
        _cache["fear_greed"] = f_fear_greed.result()
        _cache["earnings"] = f_earnings.result()
        _cache["news"] = f_news.result()
        _cache["reddit"] = f_reddit.result()

    # AI signals (depends on technical_data) then daily report (depends on signals)
    signals = generate_signals(technical_data)
    _cache["signals"] = signals

    report = generate_daily_report(signals, movers, options)
    _cache["report"] = report
    _cache["last_refresh"] = datetime.utcnow().isoformat() + "Z"

    # Log predictions snapshot for future validation
    _log_predictions(signals)

    logger.info(f"Refresh complete in {time.time() - start:.1f}s")


PREDICTIONS_LOG = os.path.join(os.path.dirname(__file__), "data", "predictions_log.json")


def _log_predictions(signals) -> None:
    """Append current signals snapshot to predictions_log.json for future accuracy tracking."""
    if not signals:
        return
    try:
        if os.path.exists(PREDICTIONS_LOG):
            with open(PREDICTIONS_LOG, "r") as f:
                log = json.load(f)
        else:
            log = []

        # Build a serializable snapshot of each signal
        signal_list = signals.get("signals", []) if isinstance(signals, dict) else signals
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "signals": [
                {
                    "symbol": s.get("symbol", ""),
                    "signal": s.get("signal", ""),
                    "confidence": s.get("confidence", ""),
                    "entry": s.get("entry", 0),
                    "target": s.get("target", 0),
                    "stop_loss": s.get("stop_loss", 0),
                }
                for s in signal_list
                if s.get("signal") in ("BUY", "SELL")
            ],
        }

        # Deduplicate: skip if we already logged today
        if log and log[-1].get("date") == entry["date"]:
            log[-1] = entry  # replace with fresh run
        else:
            log.append(entry)

        # Keep last 90 days
        log = log[-90:]

        with open(PREDICTIONS_LOG, "w") as f:
            json.dump(log, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to log predictions: {e}")


_loading = False

def _ensure_data() -> None:
    """No-op — data loads in background at startup."""
    pass


@app.on_event("startup")
async def startup() -> None:
    import threading

    # Attempt Robinhood login
    if ROBINHOOD_USERNAME and ROBINHOOD_PASSWORD:
        logged_in = login_robinhood(ROBINHOOD_USERNAME, ROBINHOOD_PASSWORD, ROBINHOOD_MFA_CODE)
        if logged_in:
            portfolio = get_robinhood_portfolio()
            _cache["portfolio"] = portfolio
            logger.info("Robinhood connected")

    # Start scheduler
    from scheduler import start_scheduler
    start_scheduler()

    # Run initial data load in background so server starts immediately
    thread = threading.Thread(target=_refresh_all, daemon=True)
    thread.start()
    logger.info("Initial data load running in background — dashboard ready in ~90s")


@app.get("/api/movers")
def get_movers():
    return {"data": _cache["movers"], "last_refresh": _cache["last_refresh"], "loading": _cache["movers"] is None}


@app.get("/api/signals")
def get_signals():
    return {"data": _cache["signals"], "last_refresh": _cache["last_refresh"], "loading": _cache["signals"] is None}


@app.get("/api/options")
def get_options():
    return {"data": _cache["options"], "last_refresh": _cache["last_refresh"], "loading": _cache["options"] is None}


@app.get("/api/report")
def get_report():
    return {"data": _cache["report"], "last_refresh": _cache["last_refresh"], "loading": _cache["report"] is None}


@app.get("/api/sectors")
def get_sectors():
    return {"data": _cache["sectors"], "last_refresh": _cache["last_refresh"], "loading": _cache["sectors"] is None}


@app.get("/api/fear-greed")
def get_fear_greed():
    return {"data": _cache["fear_greed"], "last_refresh": _cache["last_refresh"], "loading": _cache["fear_greed"] is None}


@app.get("/api/earnings")
def get_earnings():
    return {"data": _cache["earnings"], "last_refresh": _cache["last_refresh"], "loading": _cache["earnings"] is None}


@app.get("/api/sparklines")
def get_sparklines_endpoint():
    return {"data": _cache["sparklines"], "loading": _cache["sparklines"] is None}

@app.get("/api/news")
def get_news_endpoint():
    return {"data": _cache["news"], "loading": _cache["news"] is None}

@app.get("/api/reddit")
def get_reddit():
    return {"data": _cache["reddit"], "loading": _cache["reddit"] is None}

@app.get("/api/report/stream")
def stream_daily_report():
    """Stream the report via SSE for live generation."""
    _ensure_data()

    def event_generator():
        try:
            for chunk in stream_report(
                _cache["signals"] or {},
                _cache["movers"] or {},
                _cache["options"] or [],
            ):
                # SSE format
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: [Error: {e}]\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/portfolio")
def get_portfolio():
    if _cache["portfolio"] is None:
        return {"data": None, "message": "Robinhood not connected or credentials not set"}
    return {"data": _cache["portfolio"], "last_refresh": _cache["last_refresh"]}


_refresh_running = False

@app.post("/api/refresh")
def force_refresh():
    """Kick off a background refresh and return immediately."""
    global _refresh_running
    if _refresh_running:
        return {"status": "already_running", "last_refresh": _cache["last_refresh"]}
    import threading
    def _run():
        global _refresh_running
        _refresh_running = True
        try:
            _refresh_all()
        finally:
            _refresh_running = False
    threading.Thread(target=_run, daemon=True).start()
    return {"status": "started", "last_refresh": _cache["last_refresh"]}


@app.get("/api/most-traded")
def get_most_traded_endpoint():
    return {"data": _cache["most_traded"], "last_refresh": _cache["last_refresh"], "loading": _cache["most_traded"] is None}


@app.get("/api/predictions/history")
def get_predictions_history():
    """Return logged daily prediction snapshots for accuracy tracking."""
    if not os.path.exists(PREDICTIONS_LOG):
        return {"data": [], "count": 0}
    try:
        with open(PREDICTIONS_LOG, "r") as f:
            log = json.load(f)
        return {"data": log, "count": len(log)}
    except Exception as e:
        logger.warning(f"Failed to read predictions log: {e}")
        return {"data": [], "count": 0}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "last_refresh": _cache["last_refresh"],
        "data_ready": _cache["movers"] is not None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
