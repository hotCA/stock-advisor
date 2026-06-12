// Curated baseline used by the portfolio autocomplete. Merged with whatever
// tickers are live in the dashboard data, so users get sensible suggestions
// even before the backend has populated movers/signals.

export interface TickerMeta {
  symbol: string;
  name: string;
}

export const POPULAR_TICKERS: TickerMeta[] = [
  // Mega-cap tech
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet (Class A)" },
  { symbol: "GOOG", name: "Alphabet (Class C)" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "MU", name: "Micron" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "NOW", name: "ServiceNow" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "CSCO", name: "Cisco" },
  { symbol: "TXN", name: "Texas Instruments" },

  // Fintech & payments
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "AXP", name: "American Express" },
  { symbol: "PYPL", name: "PayPal" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "SQ", name: "Block (Square)" },
  { symbol: "XYZ", name: "Block" },
  { symbol: "HOOD", name: "Robinhood" },
  { symbol: "SOFI", name: "SoFi Technologies" },

  // High-growth tech
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "LYFT", name: "Lyft" },
  { symbol: "SHOP", name: "Shopify" },
  { symbol: "SNOW", name: "Snowflake" },
  { symbol: "NET", name: "Cloudflare" },
  { symbol: "DDOG", name: "Datadog" },
  { symbol: "ABNB", name: "Airbnb" },
  { symbol: "RBLX", name: "Roblox" },
  { symbol: "DASH", name: "DoorDash" },
  { symbol: "SPOT", name: "Spotify" },
  { symbol: "PINS", name: "Pinterest" },
  { symbol: "SNAP", name: "Snap" },
  { symbol: "RIVN", name: "Rivian" },
  { symbol: "LCID", name: "Lucid Motors" },

  // Broad market & sector ETFs
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "IWM", name: "Russell 2000 ETF" },
  { symbol: "DIA", name: "Dow Jones ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "VTI", name: "Total Market ETF" },
  { symbol: "XLF", name: "Financials ETF" },
  { symbol: "XLE", name: "Energy ETF" },
  { symbol: "XLV", name: "Healthcare ETF" },
  { symbol: "XLK", name: "Technology ETF" },
  { symbol: "XLI", name: "Industrials ETF" },
  { symbol: "XLY", name: "Consumer Discretionary ETF" },
  { symbol: "XLP", name: "Consumer Staples ETF" },
  { symbol: "XLB", name: "Materials ETF" },
  { symbol: "XLU", name: "Utilities ETF" },
  { symbol: "SOXX", name: "Semiconductor ETF" },
  { symbol: "GLD", name: "Gold ETF" },
  { symbol: "SLV", name: "Silver ETF" },
  { symbol: "TLT", name: "20+ Year Treasury ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },

  // Financials
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "WFC", name: "Wells Fargo" },
  { symbol: "C", name: "Citigroup" },
  { symbol: "BRK-B", name: "Berkshire Hathaway" },
  { symbol: "SCHW", name: "Charles Schwab" },
  { symbol: "BLK", name: "BlackRock" },

  // Energy
  { symbol: "XOM", name: "ExxonMobil" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "OXY", name: "Occidental Petroleum" },
  { symbol: "COP", name: "ConocoPhillips" },

  // Healthcare
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "ABBV", name: "AbbVie" },
  { symbol: "AMGN", name: "Amgen" },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "MRNA", name: "Moderna" },
  { symbol: "NVO", name: "Novo Nordisk" },

  // Consumer & retail
  { symbol: "COST", name: "Costco" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "LOW", name: "Lowe's" },
  { symbol: "TGT", name: "Target" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "SBUX", name: "Starbucks" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PG", name: "Procter & Gamble" },

  // Industrials & travel
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "DE", name: "Deere & Co" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "F", name: "Ford" },
  { symbol: "GM", name: "General Motors" },
  { symbol: "DAL", name: "Delta Air Lines" },
  { symbol: "UAL", name: "United Airlines" },

  // Crypto-linked
  { symbol: "MSTR", name: "MicroStrategy" },
  { symbol: "MARA", name: "Marathon Digital" },
  { symbol: "RIOT", name: "Riot Platforms" },
];
