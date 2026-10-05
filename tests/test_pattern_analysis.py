import asyncio
import re

from services.runtime.agent_loop import AgentRuntimeEngine


def test_fulfill_market_query_google_pattern():
    async def run():
        engine = AgentRuntimeEngine()
        inputs = {"query": "can you check the google and give me the patterns forming"}
        messages = [{"role": "user", "content": "can you check the google and give me the patterns forming"}]
        trace = type("Trace", (), {"steps": []})()

        res = await engine._fulfill_market_query_if_needed(
            final_response="executing yfinance_",
            inputs=inputs,
            messages=messages,
            trace=trace,
            event_callback=None
        )

        assert "Alphabet Inc." in res or "GOOGL" in res
        assert "Executive Summary & Market Stance" in res
        assert "Technical Patterns Forming" in res
        assert "Key Support & Resistance Levels" in res

    asyncio.run(run())


def test_fulfill_market_query_omit_graph_when_requested():
    async def run():
        engine = AgentRuntimeEngine()
        inputs = {"query": "give me patterns forming for google, i dont want graph, text answers only"}
        messages = [{"role": "user", "content": "give me patterns forming for google, i dont want graph, text answers only"}]
        trace = type("Trace", (), {"steps": []})()

        res = await engine._fulfill_market_query_if_needed(
            final_response="executing yfinance_",
            inputs=inputs,
            messages=messages,
            trace=trace,
            event_callback=None
        )

        assert "```candlestick" not in res
        assert "Technical Patterns Forming" in res
        assert "Visual chart graph omitted" in res

    asyncio.run(run())


def test_fulfill_market_query_apple_with_chart():
    async def run():
        engine = AgentRuntimeEngine()
        inputs = {"query": "show me the chart and pattern analysis for apple"}
        messages = [{"role": "user", "content": "show me the chart and pattern analysis for apple"}]
        trace = type("Trace", (), {"steps": []})()

        res = await engine._fulfill_market_query_if_needed(
            final_response="executing yfinance_",
            inputs=inputs,
            messages=messages,
            trace=trace,
            event_callback=None
        )

        assert "AAPL" in res or "Apple" in res
        assert "```candlestick" in res
        assert "Executive Summary & Market Stance" in res
        assert "Key Support & Resistance Levels" in res

    asyncio.run(run())


def test_entity_disambiguation_separates_analysis_from_company():
    """Verify regex and alias extractor isolates the actual company name and does not treat analytical phrases as companies."""
    known_aliases = {
        "google": "GOOGL",
        "apple": "AAPL",
        "reliance": "RELIANCE.NS",
        "tcs": "TCS.NS"
    }

    fillers = [
        r"\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:check|analyze|look\s+at|examine|inspect|plot|show|give|display|fetch|get|tell)\b",
        r"\b(?:please\s+)?(?:check|analyze|look\s+at|examine|inspect|plot|show|give|display|provide|fetch|get|tell)\s*(?:me\s+)?",
        r"\b(?:what\s+is\s+(?:the\s+)?(?:current\s+)?(?:price|chart|quote|trend|pattern|analysis)\s+(?:of|for)\s+)",
        r"\b(?:patterns?\s+forming|chart\s*patterns?|patterns?|formations?)\b",
        r"\b(?:technical\s+analysis|concise\s+report|in\s*depth\s*analysis|stock\s*analysis|text\s*answers?)\b",
        r"\b(?:candlestick|candle\s*stick|ohlcv?|trading|stock|share|equity)\s+(?:charts?|grahps?|grpahs?|graphs?|plots?|data|prices?|quotes?)\b",
        r"\b(?:candlestick|candle\s*stick|charts?|grahps?|grpahs?|graphs?|plots?|quotes?|prices?|shares?|stocks?)\b",
        r"\b(?:1d|5d|1m|1mo|3m|3mo|6m|6mo|1y|1yr|1year|3y|5y|all)\s*(?:timeframe|horizon|chart|period)?\b",
        r"\b(?:days?|months?|years?|daily|weekly|monthly)\b",
        r"\b(?:about|the|a|an|and|for|of|on|in|to|with|forming)\b"
    ]

    def extract(q):
        raw = q.strip().lower()
        for k in sorted(known_aliases.keys(), key=len, reverse=True):
            if re.search(r"\b" + re.escape(k) + r"\b", raw):
                return k
        c = raw
        for p in fillers:
            c = re.sub(p, " ", c, flags=re.IGNORECASE)
        c = re.sub(r"[^\w\s&\.]", " ", c)
        return " ".join(c.split())

    assert extract("can you check the google and give me the patterns forming") == "google"
    assert extract("analyze reliance stock and tell me the breakout pattern") == "reliance"
    assert extract("give me concise report on apple") == "apple"
    assert extract("check tcs and give me patterns forming") == "tcs"
