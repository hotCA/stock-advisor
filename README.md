# Stock Advisor AI

An AI-powered stock market dashboard for daily trading, built with Claude Fable 5, FastAPI, and Next.js.

![status](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.9+-blue) ![Next.js](https://img.shields.io/badge/next.js-15-black) ![License](https://img.shields.io/badge/license-MIT-green)

> **Educational project — not financial advice.** See the [disclaimer](#disclaimer) below.

## Features

- **AI Trade Signals** — Buy/Sell/Hold/Watch signals with confidence ratings, entry points, targets, and stop losses, powered by Claude Fable 5 with adaptive thinking
- **AI Daily Report** — A written market brief (streamed live) covering market pulse, macro backdrop, top opportunities, risk radar, options flow, and an action plan
- **Macro & Economy Panel** — Claude researches live macro conditions via web search on every full refresh: market trends and themes moving equities, Federal Reserve news and rate expectations, employment data (payrolls, unemployment, jobless claims), economic data (CPI/PCE, GDP, PMI), consumer sentiment, and key macro risks
- **Support & Resistance Levels** — Auto-computed key price levels for precise entries
- **Technical Indicators** — RSI, MACD, Bollinger Bands, 50/200 SMA, EMA, volume ratio, and 52-week range per ticker
- **Sparkline Charts** — ~22-day mini price trend for every ticker
- **Fear & Greed Index** — VIX-based market sentiment gauge with historical comparison
- **Sector Heatmap** — % change across 14 market sectors and broad-market ETFs
- **Market Movers** — Top gainers and losers from your watchlist
- **Most Traded** — Highest-volume tickers over day / week / month windows
- **Earnings Calendar** — Upcoming earnings (next 30 days) with EPS and revenue estimates
- **Options Flow** — Put/call ratios and unusual-activity detection
- **Reddit Sentiment** — Top mentioned tickers from r/wallstreetbets, r/stocks, r/options
- **Market News** — Latest headlines per ticker
- **Paper Trading** — Track simulated positions against live prices
- **Prediction Log** — Daily signal snapshots saved for later accuracy review
- **Robinhood Portfolio** *(optional)* — View real holdings and P&L when credentials are set
- **Watchlist & CSV Export** — Pin favorite tickers and download signals as a spreadsheet

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Claude Fable 5 (Anthropic) with adaptive thinking + web search |
| Backend | Python 3.9+, FastAPI, yfinance, APScheduler |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Data | Yahoo Finance, Reddit public API |

## Architecture

The backend fetches and analyzes market data on a schedule, caches the
results in memory, and serves them instantly to the frontend.

- **Cached endpoints** — Every `/api/*` route returns from an in-memory cache,
  so the UI is always fast regardless of how long a data refresh takes.
- **Scheduled refreshes** — Data is refreshed automatically at **9:35 AM,
  1:00 PM, and 4:05 PM ET** (Mon–Fri) via APScheduler. You can also trigger a
  refresh on demand with `POST /api/refresh`.
- **Fast refresh pipeline** — A refresh downloads the entire ticker universe in
  a **single batched request**, derives movers / history / sparklines /
  volume locally from that one panel, and runs all independent network fetches
  (options, earnings, news, sectors, sentiment) **concurrently**. The
  data-gathering phase completes in ~5 seconds; AI signals and the daily report
  follow shortly after. The server starts immediately and loads the first
  refresh in the background.

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Quick setup

```bash
git clone https://github.com/hotCA/stock-advisor.git
cd stock-advisor
./setup.sh
```

`setup.sh` creates `.env`, sets up the Python venv, installs backend
dependencies, and installs the frontend packages. Then add your
`ANTHROPIC_API_KEY` to `.env` and start the two servers (below).

### Manual setup

**1. Clone the repo**
```bash
git clone https://github.com/hotCA/stock-advisor.git
cd stock-advisor
```

**2. Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**3. Environment variables**
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

**4. Start the backend**
```bash
python main.py
# Runs on http://localhost:8000
# The server is ready immediately; the first refresh loads in the background
```

**5. Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

Open **http://localhost:3000** to view the dashboard.

## Configuration

Edit `backend/config.py` to customize:
- `SIGNAL_UNIVERSE` — tickers analyzed for signals (~70 stocks and ETFs)
- `OPTIONS_WATCHLIST` — tickers to fetch options flow and news for
- `TOP_MOVERS_COUNT` — number of gainers/losers to show

Refresh times live in `backend/scheduler.py`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `ROBINHOOD_USERNAME` | No | Robinhood email — enables the portfolio view |
| `ROBINHOOD_PASSWORD` | No | Robinhood password |
| `ROBINHOOD_MFA_CODE` | No | Robinhood MFA code, if 2FA is enabled |
| `PORT` | No | Backend port (default `8000`) |

## API Endpoints

All endpoints are served from cache and return `{ data, last_refresh, loading }`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/signals` | AI trade signals + market summary |
| `GET /api/report` | AI daily market report |
| `GET /api/report/stream` | Daily report streamed via SSE |
| `GET /api/movers` | Top gainers and losers |
| `GET /api/most-traded` | Highest-volume tickers (day/week/month) |
| `GET /api/macro` | Macro brief: market trends, Fed news, employment, economic data, consumer sentiment |
| `GET /api/sectors` | Sector ETF performance |
| `GET /api/fear-greed` | Fear & Greed index |
| `GET /api/earnings` | Upcoming earnings calendar |
| `GET /api/options` | Options flow summary |
| `GET /api/news` | Latest headlines |
| `GET /api/reddit` | Reddit ticker sentiment |
| `GET /api/sparklines` | Mini price series per ticker |
| `GET /api/portfolio` | Robinhood holdings (if configured) |
| `GET /api/predictions/history` | Logged daily signal snapshots |
| `POST /api/refresh` | Trigger a background refresh |
| `GET /api/health` | Service status |

## Cost Estimate

| Usage | Monthly Cost |
|-------|-------------|
| 1 auto-refresh/day | ~$20 |
| 3 refreshes/day | ~$55 |

Costs are primarily Claude API usage (Fable 5 at $10/$50 per 1M tokens, plus
web search at $10 per 1,000 searches — each macro brief runs up to 8 searches).
System prompts use prompt caching to keep token costs down, and the long-form
daily report is generated at most once per trading day.

## Disclaimer

> **This project is for educational and informational purposes only.**

This application and all content it generates — including but not limited to trade signals, buy/sell recommendations, price targets, stop losses, options plays, and AI-generated market reports — **does not constitute financial advice**.

- I am not a licensed financial advisor, broker, or investment professional
- Past signal accuracy does not guarantee future results
- Stock trading involves substantial risk of loss and is not suitable for every investor
- You may lose some or all of your invested capital
- Always do your own research (DYOR) before making any investment decisions
- Consult a qualified financial advisor before trading

**Use this software entirely at your own risk.** The author(s) of this project accept no responsibility or liability for any financial losses incurred through the use of this application.

## License

MIT
