import asyncio
import os

from fastapi.testclient import TestClient

from apps.api.main import app
from packages.agent_spec.models import AgentDefinition, MCPCollection
from services.control_plane.registry import registry
from services.runtime.agent_loop import runtime_engine
from services.runtime.mcp_router import mcp_router

client = TestClient(app)

def test_mcp_auth_token_dynamic_resolution():
    """Verify dynamic resolution of {{MCP_AUTH_TOKEN}} from group variables and authConfig."""
    # 1. Scoped Group Variables resolution
    scoped_vars = [
        {"key": "MCP_AUTH_TOKEN", "value": "mcp_pat_custom_devops_secret_9988", "isSecret": True}
    ]
    resolved = mcp_router.resolve_auth_token("{{MCP_AUTH_TOKEN}}", scoped_variables=scoped_vars)
    assert resolved == "mcp_pat_custom_devops_secret_9988"

    # 2. Collection authConfig direct resolution
    col = MCPCollection(
        collectionId="col_finance_test",
        name="Finance MCP Collection",
        authType="Bearer Token",
        authConfig={"bearerToken": "mcp_pat_finance_secret_1122"}
    )
    resolved_col = mcp_router.resolve_auth_token("{{MCP_AUTH_TOKEN}}", collection=col)
    assert resolved_col == "mcp_pat_finance_secret_1122"

    # 3. Environment Variable fallback
    os.environ["MCP_AUTH_TOKEN"] = "mcp_pat_env_token_4455"
    resolved_env = mcp_router.resolve_auth_token("{{MCP_AUTH_TOKEN}}")
    assert resolved_env == "mcp_pat_env_token_4455"
    del os.environ["MCP_AUTH_TOKEN"]

def test_bedrock_tool_spec_zero_token_exposure():
    """
    Verify that Bedrock tool specifications generated for models NEVER expose MCP_AUTH_TOKEN or secrets.
    """
    res = client.post("/api/v1/collections/inspect", json={
        "name": "DevOps Incident MCP",
        "slug": "devops-incident-mcp",
        "collectionType": "MCP Server",
        "serverUrl": "https://mcp-gateway.client.internal/sse",
        "authType": "Bearer Token",
        "authConfig": {"bearerToken": "{{MCP_AUTH_TOKEN}}"},
        "timeoutSeconds": 30
    })
    assert res.status_code == 200
    data = res.json()
    assert data["discoveredToolsCount"] >= 3

    # Check all bedrockToolSpecs - none should contain bearerToken or secret values
    for tool in data["tools"]:
        spec = tool["bedrockToolSpec"]["toolSpec"]
        assert "name" in spec
        assert "inputSchema" in spec
        # Check serialization has no token
        spec_str = str(spec)
        assert "{{MCP_AUTH_TOKEN}}" not in spec_str
        assert "bearerToken" not in spec_str
        assert "Authorization" not in spec_str

def test_mcp_tool_execution_with_token_injection():
    """Verify that MCPRouter executes tool with Bearer authorization and logs masked token."""
    async def _run():
        col = MCPCollection(
            collectionId="col_test_execution",
            name="Test Incident Collection",
            serverUrl="https://mcp-gateway.client.internal/sse",
            authType="Bearer Token",
            authConfig={"bearerToken": "mcp_pat_enterprise_99887766"},
            discoveredTools=[{"name": "search_issues", "description": "Search repo issues"}]
        )
        registry.register_mcp_collection(col)

        result = await mcp_router.execute_mcp_tool(
            collection_id="col_test_execution",
            tool_name="search_issues",
            tool_input={"query": "login latency"}
        )
        assert result["status"] == "SUCCESS"
        assert result["authenticated"] is True
        # Verify Bearer token was applied and masked for security
        assert "mcp_pat" in result["authHeader"]
        assert "••••••••" in result["authHeader"]
        assert "search_issues" in result["tool"]
    asyncio.run(_run())

def test_end_to_end_agent_execution_with_mcp_collection():
    """Verify that an Agent with attached MCP collection executes ReAct loop through Gateway."""
    async def _run():
        # Setup MCP collection
        col = MCPCollection(
            collectionId="col_auto_devops",
            name="Auto DevOps MCP Collection",
            serverUrl="https://mcp-gateway.client.internal/sse",
            authType="Bearer Token",
            authConfig={"bearerToken": "mcp_pat_secret_sandbox_5566"},
            discoveredTools=[
                {
                    "name": "search_issues",
                    "description": "Searches git repository issues",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": "search_issues",
                            "description": "Searches git repository issues",
                            "inputSchema": {"json": {"type": "object", "properties": {"query": {"type": "string"}}}}
                        }
                    }
                }
            ]
        )
        registry.register_mcp_collection(col)

        agent = AgentDefinition(
            agentId="agent_mcp_orchestrator",
            name="MCP Incident Orchestrator",
            description="Autonomous agent using MCP tools",
            instructions="You are an automated triage agent. Use search_issues to find bug reports.",
            mcpCollections=["col_auto_devops"]
        )
        registry.save_agent_draft(agent)
        ver = registry.publish_agent_version(agent.agentId, "1.0.0")

        trace = await runtime_engine.execute_agent(
            agent_version=ver,
            inputs={"query": "search issues for login timeout bug"}
        )
        assert trace.status == "COMPLETED"
        # Check that an MCP_CALL step was generated
        mcp_steps = [s for s in trace.steps if s.stepType == "MCP_CALL"]
        assert len(mcp_steps) >= 1
        first_mcp_step = mcp_steps[0]
        assert "search_issues" in first_mcp_step.title
        assert first_mcp_step.outputPayload.get("authenticated") is True
    asyncio.run(_run())

def test_mcp_ssrf_protection():
    """Verify that private IP ranges and IMDS are blocked by SSRF perimeter on MCP server URLs."""
    async def _run():
        col = MCPCollection(
            collectionId="col_ssrf_test",
            name="SSRF Attempt MCP",
            serverUrl="http://169.254.169.254/latest/meta-data",
            discoveredTools=[{"name": "steal_credentials"}]
        )
        registry.register_mcp_collection(col)

        result = await mcp_router.execute_mcp_tool("col_ssrf_test", "steal_credentials", {})
        assert result.get("status") == "BLOCKED"
        assert "SSRF perimeter defense" in result.get("error", "")
    asyncio.run(_run())

def test_mcp_output_secret_sanitization():
    """Verify that returned tokens and secrets are automatically masked in output payloads."""
    dirty_data = {
        "status": "active",
        "api_token": "sk_live_1234567890abcdef",
        "auth_header": "Bearer secret_jwt_token_12345",
        "nested": {
            "password": "my_super_secret_password",
            "info": "User session token: mcp_pat_secret_9988776655"
        }
    }
    clean_data = mcp_router.sanitize_response_data(dirty_data)
    assert clean_data["api_token"] == "••••••••"
    assert clean_data["auth_header"] == "••••••••"
    assert clean_data["nested"]["password"] == "••••••••"
    assert "mcp_pat_••••••••" in clean_data["nested"]["info"]

