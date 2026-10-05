from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)

def test_inspect_openapi_collection_bedrock_format():
    payload = {
        "name": "Stripe Invoicing API",
        "slug": "stripe-invoicing-api",
        "location": "Engineering Group / collections",
        "description": "Billing and invoice operations",
        "collectionType": "OpenAPI Specification",
        "serverUrl": "https://api.stripe.com/v1/openapi.json",
        "authType": "Bearer Token",
        "authConfig": {"bearerToken": "sk_test_12345"},
        "timeoutSeconds": 45,
        "headers": [{"key": "Accept", "value": "application/json"}]
    }
    res = client.post("/api/v1/collections/inspect", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["collectionName"] == "Stripe Invoicing API"
    assert data["collectionType"] == "OpenAPI Specification"
    assert data["discoveredToolsCount"] >= 3

    # Check that AWS Bedrock Converse toolSpec is formatted properly
    first_tool = data["tools"][0]
    assert "bedrockToolSpec" in first_tool
    assert "toolSpec" in first_tool["bedrockToolSpec"]
    tool_spec = first_tool["bedrockToolSpec"]["toolSpec"]
    assert "name" in tool_spec
    assert "description" in tool_spec
    assert "inputSchema" in tool_spec
    assert "json" in tool_spec["inputSchema"]
    assert "properties" in tool_spec["inputSchema"]["json"]

def test_inspect_mcp_server_collection():
    payload = {
        "name": "DevOps Incident MCP",
        "slug": "devops-incident-mcp",
        "location": "Engineering Group / collections",
        "collectionType": "MCP Server",
        "serverUrl": "https://mcp.github.internal/sse",
        "authType": "API Key Auth",
        "authConfig": {"apiKeyName": "X-API-Key", "apiKeyValue": "key_123"},
        "timeoutSeconds": 30
    }
    res = client.post("/api/v1/collections/inspect", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["discoveredToolsCount"] >= 3
    assert all("bedrockToolSpec" in t for t in data["tools"])

def test_group_crud_and_persistence():
    group_id = "grp_test_auto"
    new_group = {
        "id": group_id,
        "name": "Automated Testing Group",
        "type": "Group",
        "slug": "automated-testing-group",
        "description": "Group for automated regression testing",
        "createdAt": "2026-09-02",
        "variables": [
            {"key": "TEST_VAR", "value": "test_val", "isSecret": False, "desc": "Test variable"}
        ],
        "children": {
            "agents": [],
            "models": [],
            "tools": [],
            "mcps": [],
            "collections": [
                {
                    "id": "col_test_1",
                    "name": "Test Payment Spec",
                    "collectionType": "OpenAPI Specification",
                    "serverUrl": "https://api.test.com/spec.json",
                    "whitelistedToolNames": ["get_status", "dispatch"]
                }
            ],
            "knowledge": []
        }
    }

    # Create / Save group
    res = client.post("/api/v1/groups", json=new_group)
    assert res.status_code == 200
    saved = res.json()
    assert saved["id"] == group_id
    assert len(saved["children"]["collections"]) == 1

    # Get group
    res = client.get(f"/api/v1/groups/{group_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Automated Testing Group"

    # Delete group
    res = client.delete(f"/api/v1/groups/{group_id}")
    assert res.status_code == 200

    # Confirm 404 after deletion
    res = client.get(f"/api/v1/groups/{group_id}")
    assert res.status_code == 404
