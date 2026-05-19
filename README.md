# Stock Advisor AI

An AI-powered stock market dashboard for daily trading, built with Claude Opus 4.7, FastAPI, and Next.js.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.9+-blue) ![Next.js](https://img.shields.io/badge/next.js-15-black)

## Features

- **AI Trade Signals** — Buy/Sell/Hold/Watch signals with confidence ratings, entry points, targets, and stop losses powered by Claude Opus 4.7
- **Support & Resistance Levels** — Auto-computed key price levels for precise entries
- **Sparkline Charts** — 30-day mini price trend for every ticker
- **Fear & Greed Index** — VIX-based market sentiment gauge with historical comparison
- **Sector Heatmap** — Real-time % change across 14 market sectors
- **Market Movers** — Top gainers and losers from your watchlist
- **Earnings Calendar** — Upcoming earnings dates with EPS and revenue estimates
- **Options Flow** — Put/call ratios and unusual activity detection
- **Reddit Sentiment** — Top mentioned tickers from r/wallstreetbets, r/stocks, r/options
- **Market News** — Latest headlines per ticker
- **Watchlist** — Star tickers to pin them to the top of signals
- **Export CSV** — Download all signals as a spreadsheet
- **AI Daily Report** — Written market brief with opportunities, risks, and action plan

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Claude Opus 4.7 (Anthropic) |
| Backend | Python 3.9+, FastAPI, yfinance |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Data | Yahoo Finance, Reddit public API |

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Setup

**1. Clone the repo**
```bash
git clone https://github.com/YOUR_USERNAME/stock-advisor.git
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
# First data load takes ~90 seconds
```

**5. Frontend**
```bash
cd ../frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

## Configuration

Edit `backend/config.py` to customize:
- `SIGNAL_UNIVERSE` — tickers to analyze for signals (~65 stocks)
- `OPTIONS_WATCHLIST` — tickers to fetch options flow for
- `TOP_MOVERS_COUNT` — number of gainers/losers to show

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `ROBINHOOD_USERNAME` | No | Robinhood email (optional) |
| `ROBINHOOD_PASSWORD` | No | Robinhood password (optional) |

## Cost Estimate

| Usage | Monthly Cost |
|-------|-------------|
| 1 auto-refresh/day | ~$9 |
| 3 refreshes/day | ~$26 |

Costs are primarily Claude API usage (Opus 4.7).

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
