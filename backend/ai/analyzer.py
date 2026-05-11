import json
import re
import logging
from typing import Generator

import anthropic

from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

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
            model="claude-opus-4-7",
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


def generate_daily_report(
    signals: dict,
    movers: dict,
    options: list,
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

Write a professional, engaging market brief with these sections:
1. **Market Pulse** — Today's key themes in 2-3 sentences
2. **Top Opportunities** — Specific stocks with clear setups and entry levels
3. **Risk Radar** — Key risks to watch: support levels, earnings, macro
4. **Options Flow** — What smart money positioning suggests
5. **Action Plan** — 3 specific, prioritized trades or adjustments for today

Be direct, specific with price levels, and actionable. Avoid generic statements."""

    try:
        with client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=2000,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            return stream.get_final_message().content[0].text
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return "Daily report unavailable. Please try again later."


def stream_report(
    signals: dict,
    movers: dict,
    options: list,
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

    prompt = f"""Generate a comprehensive daily stock market brief.

TOP GAINERS:
{gainers_text}

TOP LOSERS:
{losers_text}

TRADE SIGNALS:
{signals_text}

OPTIONS SENTIMENT:
{options_text}

Write a professional market brief with sections: Market Pulse, Top Opportunities, Risk Radar, Options Flow, Action Plan. Be specific with price levels."""

    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=2000,
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text
