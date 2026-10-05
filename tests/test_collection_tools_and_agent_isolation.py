from fastapi.testclient import TestClient

from apps.api.main import app
from packages.agent_spec.models import AgentDefinition, MCPCollection
from services.control_plane.registry import registry

client = TestClient(app)

def test_inspect_and_register_collection_with_six_tools():
    """Verify inspection and discovery with 6 distinct tools."""
    sample_openapi_with_six_tools = {
        "openapi": "3.0.0",
        "info": {"title": "Full CRM Suite API", "version": "1.0.0"},
        "paths": {
            "/contacts": {
                "get": {"operationId": "list_contacts", "summary": "List all customer contacts"},
                "post": {"operationId": "create_contact", "summary": "Create a new contact record"}
            },
            "/deals": {
                "get": {"operationId": "list_deals", "summary": "List sales pipeline deals"},
                "post": {"operationId": "create_deal", "summary": "Create new deal stage"}
            },
            "/invoices": {
                "get": {"operationId": "get_invoices", "summary": "Fetch billing invoices"},
                "post": {"operationId": "issue_invoice", "summary": "Issue invoice and charge"}
            }
        }
    }

    payload = {
        "name": "CRM Enterprise Collection",
        "slug": "crm-enterprise-col",
        "collectionType": "OpenAPI Specification",
        "serverUrl": "https://api.crm.example.com/openapi.json",
        "rawSpec": sample_openapi_with_six_tools,
        "authType": "Bearer Token",
        "authConfig": {"bearerToken": "crm_token_secret"}
    }

    res = client.post("/api/v1/collections/inspect", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["discoveredToolsCount"] == 6
    assert len(data["tools"]) == 6

    tool_names = [t["name"] for t in data["tools"]]
    assert "list_contacts" in tool_names
    assert "create_contact" in tool_names
    assert "list_deals" in tool_names
    assert "create_deal" in tool_names
    assert "get_invoices" in tool_names
    assert "issue_invoice" in tool_names

    # Register this 6-tool collection
    col_obj = MCPCollection(
        collectionId="col_crm_six_tools",
        name="CRM Enterprise Collection",
        slug="crm-enterprise-col",
        collectionType="OpenAPI Specification",
        serverUrl="https://api.crm.example.com/openapi.json",
        discoveredTools=data["tools"],
        whitelistedToolNames=tool_names
    )
    res_reg = client.post("/api/v1/mcp-collections", json=col_obj.model_dump())
    assert res_reg.status_code == 200
    assert len(res_reg.json()["discoveredTools"]) == 6


def test_agent_deletion_does_not_erase_collection():
    """Guarantee that deleting an Agent leaves connected Collections 100% intact."""
    # 1. Create a 6-tool collection
    six_tools = [
        {"name": f"tool_op_{i+1}", "description": f"Operation number {i+1}", "safeToRun": True}
        for i in range(6)
    ]
    col = MCPCollection(
        collectionId="col_isolated_test",
        name="Isolated Test Collection",
        slug="isolated-test-col",
        collectionType="MCP Server",
        serverUrl="http://127.0.0.1:9000/sse",
        discoveredTools=six_tools,
        whitelistedToolNames=[t["name"] for t in six_tools]
    )
    registry.register_mcp_collection(col)
    assert registry.get_mcp_collection("col_isolated_test") is not None
    assert len(registry.get_mcp_collection("col_isolated_test").discoveredTools) == 6

    # 2. Create an Agent connected to this collection
    agent = AgentDefinition(
        agentId="agent_isolated_runner",
        name="Isolated Runner Agent",
        group="Default Workspace",
        slug="isolated-runner",
        description="Agent attached to 6-tool collection",
        mcpCollections=["col_isolated_test"]
    )
    registry.save_agent_draft(agent)
    assert registry.get_agent("agent_isolated_runner") is not None

    # 3. Delete the Agent via API
    res_del = client.delete("/api/v1/agents/agent_isolated_runner")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True
    assert registry.get_agent("agent_isolated_runner") is None

    # 4. Confirm the Collection is NOT ERASED and retains all 6 tools!
    preserved_col = registry.get_mcp_collection("col_isolated_test")
    assert preserved_col is not None
    assert preserved_col.name == "Isolated Test Collection"
    assert len(preserved_col.discoveredTools) == 6

    # Verify collection appears in list API
    res_list = client.get("/api/v1/mcp-collections")
    assert res_list.status_code == 200
    all_cols = res_list.json()
    assert any(c["collectionId"] == "col_isolated_test" for c in all_cols)


def test_collection_tool_add_and_remove_api():
    """Verify adding and removing individual tools to/from collections."""
    col = MCPCollection(
        collectionId="col_dynamic_tools",
        name="Dynamic Tools Collection",
        discoveredTools=[{"name": "tool_alpha", "description": "Alpha tool"}]
    )
    registry.register_mcp_collection(col)

    # Add 2nd tool
    res_add = client.post("/api/v1/mcp-collections/col_dynamic_tools/tools", json={
        "name": "tool_beta",
        "description": "Beta calculation tool",
        "inputSchema": {"type": "object", "properties": {"val": {"type": "number"}}}
    })
    assert res_add.status_code == 200
    tools_now = res_add.json()["discoveredTools"]
    assert len(tools_now) == 2
    assert any(t["name"] == "tool_beta" for t in tools_now)

    # Remove 1st tool
    res_del = client.delete("/api/v1/mcp-collections/col_dynamic_tools/tools/tool_alpha")
    assert res_del.status_code == 200
    tools_remaining = res_del.json()["discoveredTools"]
    assert len(tools_remaining) == 1
    assert tools_remaining[0]["name"] == "tool_beta"
