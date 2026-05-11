import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ROBINHOOD_USERNAME = os.getenv("ROBINHOOD_USERNAME", "")
ROBINHOOD_PASSWORD = os.getenv("ROBINHOOD_PASSWORD", "")
ROBINHOOD_MFA_CODE = os.getenv("ROBINHOOD_MFA_CODE", "")

# Stocks to track for signals (expand as needed)
SIGNAL_UNIVERSE = [
    # Mega-cap tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD",
    "NFLX", "CRM", "ORCL", "INTC", "QCOM", "MU", "AVGO", "ADBE", "NOW",
    # Fintech & payments
    "PYPL", "XYZ", "COIN", "V", "MA", "AXP",
    # Growth / new tech
    "PLTR", "UBER", "SHOP", "SNOW", "NET", "DDOG", "ABNB", "RBLX",
    # Broad market ETFs
    "SPY", "QQQ", "IWM", "DIA",
    # Sector ETFs
    "XLF", "XLE", "XLV", "XLK", "XLI", "XLY", "XLP", "XLB", "SOXX", "GLD", "TLT",
    # Financials
    "JPM", "BAC", "GS", "MS", "WFC", "C", "BRK-B",
    # Energy
    "XOM", "CVX", "OXY", "COP",
    # Healthcare
    "UNH", "JNJ", "ABBV", "AMGN", "LLY", "PFE", "MRNA",
    # Consumer
    "COST", "WMT", "HD", "NKE", "SBUX",
    # Industrials
    "BA", "CAT", "DE", "GE",
]

# Options watchlist (high-liquidity tickers)
OPTIONS_WATCHLIST = [
    "SPY", "QQQ", "IWM", "AAPL", "MSFT", "NVDA", "TSLA", "AMD", "AMZN",
    "META", "GOOGL", "NFLX", "CRM", "PLTR", "COIN", "SHOP",
]

TOP_MOVERS_COUNT = 10
REPORT_CACHE_TTL_HOURS = 6
