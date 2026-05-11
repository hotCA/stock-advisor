import pandas as pd
import numpy as np


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def compute_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def compute_bollinger_bands(series: pd.Series, period: int = 20, std_dev: float = 2.0) -> dict:
    mid = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    return {"upper": mid + std_dev * std, "mid": mid, "lower": mid - std_dev * std}


def compute_sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def compute_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def analyze_ticker(df: pd.DataFrame) -> dict:
    """Run full technical analysis on a price DataFrame and return signal data."""
    if df is None or len(df) < 30:
        return {}

    close = df["Close"]
    volume = df["Volume"]

    rsi = compute_rsi(close)
    macd_data = compute_macd(close)
    bb = compute_bollinger_bands(close)
    sma_50 = compute_sma(close, 50)
    sma_200 = compute_sma(close, 200)
    ema_20 = compute_ema(close, 20)

    latest = close.iloc[-1]
    rsi_val = float(rsi.iloc[-1])
    macd_val = float(macd_data["macd"].iloc[-1])
    macd_sig = float(macd_data["signal"].iloc[-1])
    macd_hist = float(macd_data["histogram"].iloc[-1])
    bb_upper = float(bb["upper"].iloc[-1])
    bb_lower = float(bb["lower"].iloc[-1])
    bb_mid = float(bb["mid"].iloc[-1])
    sma50 = float(sma_50.iloc[-1]) if not pd.isna(sma_50.iloc[-1]) else None
    sma200 = float(sma_200.iloc[-1]) if not pd.isna(sma_200.iloc[-1]) else None
    ema20 = float(ema_20.iloc[-1])

    # Volume analysis
    avg_vol_20 = float(volume.rolling(20).mean().iloc[-1])
    latest_vol = float(volume.iloc[-1])
    vol_ratio = round(latest_vol / avg_vol_20, 2) if avg_vol_20 > 0 else 1.0

    # 52-week high/low
    high_52w = float(close.rolling(252).max().iloc[-1]) if len(close) >= 252 else float(close.max())
    low_52w = float(close.rolling(252).min().iloc[-1]) if len(close) >= 252 else float(close.min())

    # Support & Resistance — nearest key levels above and below current price
    candidates_support = [
        float(df["Low"].tail(20).min()),       # 20-day swing low
        float(df["Low"].tail(5).min()),        # recent week low
        bb_lower,
    ]
    if sma50: candidates_support.append(sma50)
    if sma200: candidates_support.append(sma200)

    candidates_resistance = [
        float(df["High"].tail(20).max()),      # 20-day swing high
        float(df["High"].tail(5).max()),       # recent week high
        bb_upper,
    ]
    if sma50: candidates_resistance.append(sma50)
    if sma200: candidates_resistance.append(sma200)

    price_now = float(latest)
    below = [c for c in candidates_support if c < price_now]
    above = [c for c in candidates_resistance if c > price_now]
    support_1 = round(max(below), 2) if below else round(price_now * 0.95, 2)
    resistance_1 = round(min(above), 2) if above else round(price_now * 1.05, 2)

    # Trend signals
    signals = []
    score = 0  # positive = bullish, negative = bearish

    if rsi_val < 30:
        signals.append("RSI oversold (<30)")
        score += 2
    elif rsi_val > 70:
        signals.append("RSI overbought (>70)")
        score -= 2

    if macd_hist > 0 and macd_val > macd_sig:
        signals.append("MACD bullish crossover")
        score += 1
    elif macd_hist < 0 and macd_val < macd_sig:
        signals.append("MACD bearish crossover")
        score -= 1

    if latest < bb_lower:
        signals.append("Below Bollinger lower band")
        score += 1
    elif latest > bb_upper:
        signals.append("Above Bollinger upper band")
        score -= 1

    if sma50 and latest > sma50:
        signals.append("Above 50-SMA")
        score += 1
    elif sma50:
        signals.append("Below 50-SMA")
        score -= 1

    if sma200 and sma50 and sma50 > sma200:
        signals.append("Golden cross (50>200 SMA)")
        score += 2
    elif sma200 and sma50 and sma50 < sma200:
        signals.append("Death cross (50<200 SMA)")
        score -= 2

    if vol_ratio > 2.0:
        signals.append(f"High volume ({vol_ratio:.1f}x avg)")

    if score >= 3:
        recommendation = "BUY"
    elif score <= -3:
        recommendation = "SELL"
    elif score >= 1:
        recommendation = "WATCH"
    else:
        recommendation = "HOLD"

    return {
        "price": round(float(latest), 2),
        "rsi": round(rsi_val, 1),
        "macd": round(macd_val, 4),
        "macd_signal": round(macd_sig, 4),
        "macd_histogram": round(macd_hist, 4),
        "bb_upper": round(bb_upper, 2),
        "bb_mid": round(bb_mid, 2),
        "bb_lower": round(bb_lower, 2),
        "sma_50": round(sma50, 2) if sma50 else None,
        "sma_200": round(sma200, 2) if sma200 else None,
        "ema_20": round(ema20, 2),
        "volume": int(latest_vol),
        "volume_ratio": vol_ratio,
        "high_52w": round(high_52w, 2),
        "low_52w": round(low_52w, 2),
        "score": score,
        "signals": signals,
        "recommendation": recommendation,
        "support": support_1,
        "resistance": resistance_1,
    }
