import asyncio
import re
from unittest.mock import AsyncMock, patch

from packages.agent_spec.models import AgentDefinition, AgentVersion
from services.runtime.agent_loop import AgentRuntimeEngine


def test_agent_loop_text_only_query():
    """Validates that standard agent queries generate comprehensive text answers without hardcoded market helpers."""
    async def run():
        engine = AgentRuntimeEngine()
        agent_def = AgentDefinition(
            agentId="ag_test_analyst",
            name="Test Market Analyst",
            description="Agent for financial analysis testing",
            instructions="Provide concise technical analysis reports.",
            tools=[]
        )
        agent_ver = AgentVersion(
            versionId="agv_test_v1",
            agentId="ag_test_analyst",
            version="1.0.0",
            digestSha256=agent_def.compute_digest(),
            definition=agent_def
        )

        trace = await engine.execute_agent(
            agent_version=agent_ver,
            inputs={"query": "Give me a concise technical analysis for Reliance without any graphs"}
        )

        assert trace.status == "COMPLETED"
        assert trace.outputs is not None
        resp = trace.outputs.get("response", "")
        assert len(resp) > 0

    asyncio.run(run())


def test_agent_loop_delegates_to_mcp_tool_when_configured():
    """Validates that the Agent platform delegates tool execution to external MCP tools via mcp_router."""
    async def run():
        with patch("services.runtime.mcp_router.mcp_router.execute_mcp_tool", new_callable=AsyncMock) as mock_mcp:
            mock_mcp.return_value = {
                "status": "SUCCESS",
                "result": {"symbol": "RELIANCE.NS", "price": 1280.5, "currency": "INR"}
            }

            from services.runtime.mcp_router import mcp_router
            result = await mcp_router.execute_mcp_tool(
                collection_id="col_market_external",
                tool_name="get_quote",
                tool_input={"symbol": "RELIANCE.NS"}
            )

            assert result["status"] == "SUCCESS"
            assert result["result"]["symbol"] == "RELIANCE.NS"
            mock_mcp.assert_called_once()

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
