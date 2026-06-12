import json
import re
import logging
from datetime import datetime
from typing import Generator, Optional

import anthropic

from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

MODEL = "claude-fable-5"

# Stable system prompt — cached via prompt caching
SYSTEM_PROMPT = """You are an elite stock market analyst specializing in US equities and options markets. You combine technical analysis with market microstructure and options flow to generate high-conviction trade signals.

Your technical framework:
- RSI: <30 oversold (bullish), >70 overbought (bearish)
- MACD: histogram direction and crossovers
- Bollinger Bands: price vs upper/lower bands indicates overbought/oversold
- Moving averages: price vs 50/200 SMA, golden/death cross
- Volume: high volume confirms moves; low volume divergences are suspicious
- Score: composite score where >=3 = BUY, <=-3 = SELL, 1-2 = WATCH, else HOLD

Options flow interpretation:
- Put/Call ratio >1.2 = bearish sentiment
- Put/Call ratio <0.7 = bullish sentiment
- Unusual activity (volume >> open interest) = smart money positioning

Signal confidence:
- High: multiple confirming indicators aligned, strong conviction
- Medium: mixed signals but directional bias clear
- Low: early setup, monitor for confirmation

Always output valid JSON when asked for structured signals. Be specific with price levels."""


def _extract_json(text: str) -> dict:
    """Extract JSON object from Claude's text response."""
    # Try to find JSON block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return {}


def generate_signals(technical_data: dict) -> dict:
    """Generate buy/sell signals from technical indicators using Claude."""
    formatted = []
    for sym, data in technical_data.items():
        if not data:
            continue
        sig_list = ", ".join(data.get("signals", []))
        formatted.append(
            f"{sym}: price=${data['price']}, RSI={data['rsi']}, "
            f"MACD_hist={data['macd_histogram']:.4f}, score={data['score']}, "
            f"vol_ratio={data['volume_ratio']}x, 52w_high={data['high_52w']}, "
            f"52w_low={data['low_52w']}, support=${data.get('support', 'N/A')}, "
            f"resistance=${data.get('resistance', 'N/A')}, signals=[{sig_list}]"
        )

    prompt = (
        "Analyze the following technical data and generate actionable daily trading signals.\n\n"
        + "\n".join(formatted)
        + """

For each ticker use the provided support/resistance levels to determine precise entries:
- BUY entry: near support or confirmed breakout above resistance
- SELL entry: near resistance or break below support
- Stop loss: just below key support (BUY) or above resistance (SELL)
- Target: next resistance level (BUY) or next support level (SELL)

Return ONLY a JSON object (no markdown, no explanation):
{
  "signals": [
    {
      "symbol": "TICKER",
      "signal": "BUY|SELL|HOLD|WATCH",
      "confidence": "High|Medium|Low",
      "reasoning": "1-2 sentence explanation citing specific indicators and levels",
      "entry": 0.00,
      "target": 0.00,
      "stop_loss": 0.00,
      "support": 0.00,
      "resistance": 0.00,
      "options_play": "e.g. Buy AAPL $150 calls 30DTE or null"
    }
  ],
  "market_summary": "2-3 sentence overall market assessment"
}"""
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": prompt}],
        )

        text = next((b.text for b in response.content if b.type == "text"), "")
        result = _extract_json(text)
        if not result:
            logger.error("Failed to parse signals JSON")
            return {"signals": [], "market_summary": "Analysis unavailable"}
        return result

    except Exception as e:
        logger.error(f"Signal generation failed: {e}")
        return {"signals": [], "market_summary": "Analysis unavailable"}


MACRO_SYSTEM_PROMPT = """You are a macroeconomic strategist covering US markets. You synthesize Federal Reserve policy, employment data, inflation and growth indicators, and consumer sentiment into a trading-relevant macro picture. You always cite the most recent data releases with their actual values and dates. Always output valid JSON when asked for structured analysis."""

# Server-side web search — Anthropic runs the searches; no extra API keys needed.
MACRO_TOOLS = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 8}]


def generate_macro_brief() -> dict:
    """Research current macro conditions via web search and return structured JSON.

    Covers market trends/themes, consumer sentiment, Federal Reserve news,
    employment data, and broader economic data. Each full refresh regenerates
    this so Fed headlines and data releases stay current.
    """
    today = datetime.now().strftime("%A, %B %d, %Y")
    prompt = f"""Today is {today}. Research the CURRENT state of the US macro environment using web search, then produce a structured brief for daily equity traders.

Research these five areas (search for the latest available data and news):
1. Market trends — the 3-5 dominant themes/topics moving US equities this week
2. Consumer sentiment — latest University of Michigan sentiment, Conference Board confidence, retail spending signals
3. Federal Reserve — latest FOMC decisions/minutes, recent Fed official speeches, next meeting date, market-implied rate expectations
4. Employment — latest nonfarm payrolls, unemployment rate, jobless claims, wage growth
5. Economic data — latest CPI/PCE inflation, GDP, PMI/ISM, housing, and any releases due this week

Return ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{{
  "outlook": "Bullish|Neutral|Bearish",
  "outlook_summary": "2-3 sentence overall macro read for equity traders",
  "market_trends": [
    {{"theme": "short theme name", "impact": "Positive|Negative|Mixed", "detail": "1-2 sentences on how it is moving markets"}}
  ],
  "consumer_sentiment": {{
    "summary": "1-2 sentences",
    "indicators": [{{"name": "indicator + period", "value": "actual value", "trend": "up|down|flat", "note": "brief context"}}]
  }},
  "fed_watch": {{
    "summary": "1-2 sentences on the policy picture",
    "next_meeting": "date of next FOMC meeting",
    "rate_expectations": "what markets are pricing in",
    "headlines": ["2-4 recent Fed-related headlines"]
  }},
  "employment": {{
    "summary": "1-2 sentences",
    "indicators": [{{"name": "indicator + period", "value": "actual value", "trend": "up|down|flat", "note": "brief context"}}]
  }},
  "economic_data": {{
    "summary": "1-2 sentences",
    "indicators": [{{"name": "indicator + period", "value": "actual value", "trend": "up|down|flat", "note": "brief context"}}],
    "upcoming": ["1-3 notable releases coming up, with dates"]
  }},
  "risks": ["2-4 key macro risks for traders to watch"]
}}

Use real, current numbers from your searches. If a data point cannot be found, omit that indicator rather than guessing."""

    messages = [{"role": "user", "content": prompt}]
    try:
        # Web search can pause the server-side tool loop (stop_reason
        # "pause_turn"); re-send to let it resume, with a bounded retry.
        for _ in range(3):
            with client.messages.stream(
                model=MODEL,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                tools=MACRO_TOOLS,
                system=[{
                    "type": "text",
                    "text": MACRO_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=messages,
            ) as stream:
                response = stream.get_final_message()

            if response.stop_reason == "pause_turn":
                messages = [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": response.content},
                ]
                continue
            break

        text_blocks = [b.text for b in response.content if b.type == "text"]
        if not text_blocks:
            logger.error("Macro brief returned no text")
            return {}
        # The structured JSON is in the final text block, after any
        # search narration.
        result = _extract_json(text_blocks[-1]) or _extract_json("\n".join(text_blocks))
        if not result:
            logger.error("Failed to parse macro brief JSON")
            return {}
        result["generated_at"] = datetime.utcnow().isoformat() + "Z"
        return result

    except Exception as e:
        logger.error(f"Macro brief generation failed: {e}")
        return {}


def _macro_context(macro: Optional[dict]) -> str:
    """Condense the macro brief into prompt context for the daily report."""
    if not macro:
        return ""
    trends = "; ".join(
        f"{t.get('theme', '')} ({t.get('impact', '')})"
        for t in macro.get("market_trends", [])[:5]
    )
    fed = macro.get("fed_watch", {})
    parts = [
        f"Macro outlook: {macro.get('outlook', 'N/A')} — {macro.get('outlook_summary', '')}",
        f"Market themes: {trends}" if trends else "",
        f"Fed: {fed.get('summary', '')} Next meeting: {fed.get('next_meeting', 'N/A')}. Rates: {fed.get('rate_expectations', '')}",
        f"Employment: {macro.get('employment', {}).get('summary', '')}",
        f"Economy: {macro.get('economic_data', {}).get('summary', '')}",
        f"Consumer: {macro.get('consumer_sentiment', {}).get('summary', '')}",
        f"Risks: {'; '.join(macro.get('risks', [])[:4])}",
    ]
    return "\n".join(p for p in parts if p.strip())


def generate_daily_report(
    signals: dict,
    movers: dict,
    options: list,
    macro: Optional[dict] = None,
) -> str:
    """Generate a comprehensive daily market report (streaming, returns full text)."""

    gainers_text = "\n".join(
        f"  {g['symbol']}: +{g['change_pct']}% @ ${g['price']}"
        for g in movers.get("gainers", [])[:5]
    )
    losers_text = "\n".join(
        f"  {l['symbol']}: {l['change_pct']}% @ ${l['price']}"
        for l in movers.get("losers", [])[:5]
    )

    top_signals = [
        s for s in signals.get("signals", [])
        if s.get("signal") in ("BUY", "SELL")
    ][:8]
    signals_text = "\n".join(
        f"  {s['signal']} {s['symbol']} (conf: {s['confidence']}): {s['reasoning']}"
        for s in top_signals
    )

    options_text = "\n".join(
        f"  {o['symbol']}: P/C ratio={o['put_call_ratio']} ({o['sentiment']}), "
        f"call OI={o['total_call_oi']:,}, put OI={o['total_put_oi']:,}"
        for o in options[:5]
    )

    macro_text = _macro_context(macro)

    prompt = f"""Generate a comprehensive daily stock market brief based on today's data.

TOP GAINERS:
{gainers_text}

TOP LOSERS:
{losers_text}

TRADE SIGNALS:
{signals_text}

MARKET SUMMARY: {signals.get('market_summary', '')}

OPTIONS SENTIMENT:
{options_text}

MACRO ENVIRONMENT:
{macro_text or 'No macro data available.'}

Write a professional, engaging market brief with these sections:
1. **Market Pulse** — Today's key themes in 2-3 sentences
2. **Macro Backdrop** — How Fed policy, employment, economic data, and consumer sentiment frame today's setup
3. **Top Opportunities** — Specific stocks with clear setups and entry levels
4. **Risk Radar** — Key risks to watch: support levels, earnings, macro
5. **Options Flow** — What smart money positioning suggests
6. **Action Plan** — 3 specific, prioritized trades or adjustments for today

Be direct, specific with price levels, and actionable. Avoid generic statements."""

    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=8000,
            thinking={"type": "adaptive"},
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            response = stream.get_final_message()
        return next((b.text for b in response.content if b.type == "text"), "")
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return "Daily report unavailable. Please try again later."


def stream_report(
    signals: dict,
    movers: dict,
    options: list,
    macro: Optional[dict] = None,
) -> Generator[str, None, None]:
    """Stream the daily report token by token for SSE."""
    gainers_text = "\n".join(
        f"  {g['symbol']}: +{g['change_pct']}% @ ${g['price']}"
        for g in movers.get("gainers", [])[:5]
    )
    losers_text = "\n".join(
        f"  {l['symbol']}: {l['change_pct']}% @ ${l['price']}"
        for l in movers.get("losers", [])[:5]
    )
    top_signals = [
        s for s in signals.get("signals", [])
        if s.get("signal") in ("BUY", "SELL")
    ][:8]
    signals_text = "\n".join(
        f"  {s['signal']} {s['symbol']} (conf: {s['confidence']}): {s['reasoning']}"
        for s in top_signals
    )
    options_text = "\n".join(
        f"  {o['symbol']}: P/C ratio={o['put_call_ratio']} ({o['sentiment']})"
        for o in options[:5]
    )

    macro_text = _macro_context(macro)

    prompt = f"""Generate a comprehensive daily stock market brief.

TOP GAINERS:
{gainers_text}

TOP LOSERS:
{losers_text}

TRADE SIGNALS:
{signals_text}

OPTIONS SENTIMENT:
{options_text}

MACRO ENVIRONMENT:
{macro_text or 'No macro data available.'}

Write a professional market brief with sections: Market Pulse, Macro Backdrop, Top Opportunities, Risk Radar, Options Flow, Action Plan. Be specific with price levels."""

    with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text
