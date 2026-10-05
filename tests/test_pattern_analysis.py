import asyncio

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
