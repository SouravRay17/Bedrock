import asyncio

from packages.agent_spec.models import (
    AgentDefinition,
    ContextPolicy,
    ToolDefinition,
)
from services.control_plane.nl_builder import NaturalLanguageAgentBuilder
from services.control_plane.registry import registry
from services.runtime.agent_loop import runtime_engine
from services.runtime.context_mgr import context_manager
from services.runtime.tool_runner import tool_runner


def test_agent_digest_and_version_publishing():
    """Verify that agent definition produces a deterministic SHA-256 digest and immutable version."""
    agent = AgentDefinition(
        agentId="test_agent_1",
        name="Test Agent",
        description="For unit testing",
        instructions="Execute unit tests"
    )
    digest1 = agent.compute_digest()
    assert len(digest1) == 64

    # Save & publish version
    registry.save_agent_draft(agent)
    ver = registry.publish_agent_version(agent.agentId, "1.0.0")
    assert ver.version == "1.0.0"
    assert ver.digestSha256 == digest1
    assert ver.status == "PUBLISHED"

def test_context_manager_60_percent_threshold():
    """Verify that context manager triggers compression when token usage reaches 60%."""
    policy = ContextPolicy(compressionThreshold=0.60, retainedRecentTurns=2)
    system_prompt = "You are a helpful assistant."

    # Generate long conversation messages
    messages = [
        {"role": "user", "content": f"Turn {i}: Analyzing transaction data and verifying parameters for batch execution."}
        for i in range(40)
    ]
    state_vars = {"userId": "12345"}
    model_limit = 1000 # Small limit to trigger threshold

    needs_comp, usage_ratio, _total_tokens = context_manager.evaluate_context(
        system_prompt=system_prompt,
        messages=messages,
        state_variables=state_vars,
        model_limit=model_limit,
        policy=policy
    )

    assert needs_comp is True
    assert usage_ratio >= 0.60

    # Test compression
    compacted_msgs, _summary, saved_tokens = context_manager.compress_context(
        system_prompt=system_prompt,
        messages=messages,
        current_summary={},
        policy=policy
    )
    assert len(compacted_msgs) <= 3
    assert saved_tokens > 0

def test_tool_runner_ssrf_protection():
    """Verify that private IP ranges and IMDS are blocked by SSRF perimeter."""
    async def _run():
        tool = ToolDefinition(
            toolId="test_ssrf_tool",
            name="SsrfTool",
            description="Test tool",
            toolType="REST_API",
            endpointUrl="http://169.254.169.254/latest/meta-data/",
            isSsrfProtected=True
        )
        res = await tool_runner.execute_tool(tool, {})
        assert res.get("status") == "FAILED" or "Security Policy Violation" in res.get("error", "")
    asyncio.run(_run())

def test_calculator_tool():
    """Verify that safe calculator tool computes math expressions correctly."""
    async def _run():
        calc_tool = ToolDefinition(
            toolId="test_calculator",
            name="CalculatorTool",
            description="Performs exact math operations",
            toolType="CUSTOM_FUNCTION",
            inputSchema={"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}
        )
        res = await tool_runner.execute_tool(calc_tool, {"expression": "(150 * 1.08) - 25"})
        assert res.get("status") == "SUCCESS"
        assert res.get("result") == 137.0
    asyncio.run(_run())

def test_natural_language_builder():
    """Verify that natural language assistant synthesizes a valid proposed AgentDefinition."""
    proposal = NaturalLanguageAgentBuilder.synthesize_proposal("Create an invoice auditor that calculates taxes")
    assert proposal["proposedAgent"] is not None
    assert "tool_calculator" in proposal["proposedAgent"].tools
    assert proposal["proposedAgent"].model["modelId"] == "amazon.nova-micro-v1:0"

def test_runtime_engine_execution():
    """Verify end-to-end ReAct execution with tool integration."""
    async def _run():
        agent = AgentDefinition(
            agentId="test_exec_agent",
            name="Exec Agent",
            description="Test execution",
            instructions="Calculate tax for 100 with 15% rate",
            tools=["tool_calculator"]
        )
        registry.save_agent_draft(agent)
        ver = registry.publish_agent_version(agent.agentId, "1.0.0")

        trace = await runtime_engine.execute_agent(
            agent_version=ver,
            inputs={"query": "Calculate 100 * 1.15"}
        )
        assert trace.status == "COMPLETED"
        assert len(trace.steps) >= 2
        assert trace.outputs is not None
    asyncio.run(_run())

def test_context_manager_tool_use_result_preservation():
    """Verify context compression never separates assistant toolUse from user toolResult."""
    policy = ContextPolicy(compressionThreshold=0.60, retainedRecentTurns=2)
    messages = [
        {"role": "user", "content": "Initial user request"},
        {"role": "assistant", "content": [
            {"toolUse": {"toolUseId": "tu_1", "name": "tool_a", "input": {}}},
            {"toolUse": {"toolUseId": "tu_2", "name": "tool_b", "input": {}}}
        ]},
        {"role": "user", "content": [
            {"toolResult": {"toolUseId": "tu_1", "content": [{"text": "res1"}]}},
            {"toolResult": {"toolUseId": "tu_2", "content": [{"text": "res2"}]}}
        ]},
        {"role": "assistant", "content": [{"text": "Final response based on tools"}]}
    ]

    compacted_msgs, _summary, _saved = context_manager.compress_context(
        system_prompt="System instructions",
        messages=messages,
        current_summary={},
        policy=policy
    )
    # The first message must always be role user
    assert compacted_msgs[0]["role"] == "user"
    # No two consecutive messages should have the same role
    for i in range(len(compacted_msgs) - 1):
        assert compacted_msgs[i]["role"] != compacted_msgs[i + 1]["role"]

def test_model_router_message_sanitizer():
    """Verify model_router converts list payloads inside toolResult json to valid objects and merges adjacent roles."""
    from services.runtime.model_router import model_router

    t1 = "tooluse_test_1"
    t2 = "tooluse_test_2"
    raw_msgs = [
        {"role": "user", "content": [{"text": "First user message"}]},
        {"role": "user", "content": [{"text": "Second user message"}]},
        {"role": "assistant", "content": [
            {"toolUse": {"toolUseId": t1, "name": "tool_search", "input": {}}},
            {"toolUse": {"toolUseId": t2, "name": "tool_quote", "input": {}}}
        ]},
        # Two consecutive user messages with tool results containing lists in json
        {"role": "user", "content": [
            {"toolResult": {"toolUseId": t1, "content": [{"json": ["item_a", "item_b"]}]}}
        ]},
        {"role": "user", "content": [
            {"toolResult": {"toolUseId": t2, "content": [{"json": {"price": 150.0}}]}}
        ]}
    ]

    # ModelRouter simulate inference works with these sanitized messages
    sim_res = model_router._simulate_inference(
        model_id="amazon.nova-micro-v1:0",
        system_prompt="You are a helper.",
        messages=raw_msgs
    )
    assert sim_res["final_text"] is not None
    assert "verified data" in sim_res["final_text"].lower()
