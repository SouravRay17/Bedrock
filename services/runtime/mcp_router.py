"""
MCP Router for AgentOS Runtime.
Routes tool calls dynamically to registered MCP Integrations with Bearer {{MCP_AUTH_TOKEN}} isolation.
"""

import logging
import os
import re
from typing import Any

import httpx

from packages.agent_spec.models import MCPCollection, MCPIntegration
from services.control_plane.integration_registry import integration_registry
from services.control_plane.registry import registry

logger = logging.getLogger(__name__)


class MCPRouter:
    """
    Routes tool and resource calls to registered Model Context Protocol (MCP) servers
    and integrations with dynamic credential resolution and token isolation.
    """

    def resolve_auth_token(
        self,
        token_ref: str | None,
        integration: MCPIntegration | None = None,
        collection: MCPCollection | None = None,
        scoped_variables: list[dict[str, Any]] | None = None
    ) -> str:
        """Dynamically resolves variable templates like {{MCP_AUTH_TOKEN}} or credential_ref."""
        if not token_ref:
            token_ref = (integration.credential_ref if integration else None) or "{{MCP_AUTH_TOKEN}}"

        clean_key = re.sub(r"[{}\$]", "", token_ref).strip()

        # 1. Search in scoped group variables
        if scoped_variables:
            for v in scoped_variables:
                if isinstance(v, dict) and v.get("key") == clean_key:
                    return str(v.get("value", ""))

        # 2. Check collection authConfig
        if collection and collection.authConfig and isinstance(collection.authConfig, dict):
            val = collection.authConfig.get("bearerToken") or collection.authConfig.get("apiKeyValue")
            if val and not (val.startswith("{{") and val.endswith("}}")):
                return str(val)

        # 3. Check Host Environment Variables
        if clean_key in os.environ:
            return os.environ[clean_key]
        if "MCP_AUTH_TOKEN" in os.environ:
            return os.environ["MCP_AUTH_TOKEN"]
        if "MCP_API_KEY" in os.environ:
            return os.environ["MCP_API_KEY"]

        return "sandbox-secret-key-12345"

    @classmethod
    def mask_token(cls, token: str) -> str:
        """Helper to mask sensitive tokens."""
        if not token or len(token) <= 8:
            return "••••••••"
        return f"{token[:4]}••••••••{token[-4:]}"

    @classmethod
    def sanitize_response_data(cls, data: Any) -> Any:
        """Strips inadvertent tokens and sensitive keys from output payloads."""
        if isinstance(data, dict):
            clean = {}
            for k, v in data.items():
                if any(sec in k.lower() for sec in ["token", "secret", "password", "auth", "bearer", "apikey", "api_key", "private_key"]):
                    clean[k] = "••••••••"
                else:
                    clean[k] = cls.sanitize_response_data(v)
            return clean
        if isinstance(data, list):
            return [cls.sanitize_response_data(item) for item in data]
        if isinstance(data, str):
            masked = re.sub(r"(Bearer\s+)[A-Za-z0-9_\-\.]{8,}", r"\1••••••••", data, flags=re.IGNORECASE)
            masked = re.sub(r"(mcp_pat_)[A-Za-z0-9_]+", r"\1••••••••", masked)
            return masked
        return data

    async def execute_mcp_tool(
        self,
        collection_id: str | None = None,
        integration_id: str | None = None,
        tool_name: str = "",
        tool_input: dict[str, Any] | None = None,
        scoped_variables: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """
        Executes an MCP tool by resolving integration -> current endpoint -> secure execution.
        """
        tool_input = tool_input or {}
        # Parse 'market-intel.portfolio_live_analysis' shorthand
        if "." in tool_name and not integration_id:
            integration_id, tool_name = tool_name.split(".", 1)

        # 1. Resolve Integration from Integration Registry
        target_endpoint = None
        target_auth_token = None
        integration = None
        collection = None

        if integration_id:
            integration = integration_registry.get_integration(integration_id)
            if integration:
                target_endpoint = integration.endpoint
                target_auth_token = self.resolve_auth_token(integration.credential_ref, integration=integration, scoped_variables=scoped_variables)

        # 2. Fallback to Collection Registry
        if not target_endpoint and collection_id:
            collection = registry.get_mcp_collection(collection_id)
            if collection:
                target_endpoint = collection.serverUrl
                target_auth_token = self.resolve_auth_token("{{MCP_AUTH_TOKEN}}", collection=collection, scoped_variables=scoped_variables)

        # 3. Default fallback for local testing
        if not target_endpoint:
            target_endpoint = "http://localhost:8001"
            target_auth_token = "sandbox-secret-key-12345"

        base_url = re.sub(r"/(sse|messages|health|openapi\.json)$", "", target_endpoint.rstrip("/"))
        headers = {
            "Authorization": f"Bearer {target_auth_token}",
            "Content-Type": "application/json"
        }

        # Map tool name to REST endpoint if applicable
        tool_path_map = {
            "yfinance_search": "/api/search",
            "yfinance_get_quote": "/api/quote",
            "yfinance_get_stock_info": "/api/stock_info",
            "yfinance_get_historical_data": "/api/historical_data",
            "yfinance_get_news": "/api/news",
            "portfolio_live_analysis": "/api/portfolio_live_analysis",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try direct REST endpoint first
            if tool_name in tool_path_map:
                url = f"{base_url}{tool_path_map[tool_name]}"
                try:
                    resp = await client.post(url, json=tool_input, headers=headers)
                    if resp.status_code == 200:
                        return self.sanitize_response_data(resp.json())
                    # If POST not allowed or requires query params, try GET
                    resp_get = await client.get(url, params=tool_input, headers=headers)
                    if resp_get.status_code == 200:
                        return self.sanitize_response_data(resp_get.json())
                except Exception as exc:
                    logger.warning("Direct REST call to %s failed: %s", url, exc)

            # Try MCP JSON-RPC protocol
            rpc_url = f"{base_url}/messages"
            try:
                rpc_payload = {
                    "jsonrpc": "2.0",
                    "id": "exec_call",
                    "method": "tools/call",
                    "params": {
                        "name": tool_name,
                        "arguments": tool_input
                    }
                }
                resp = await client.post(rpc_url, json=rpc_payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    res = data.get("result", data)
                    return self.sanitize_response_data(res)
            except Exception as exc:
                logger.error("MCP JSON-RPC tools/call failed on %s: %s", rpc_url, exc)

        return {
            "status": "FALLBACK_MOCK",
            "tool": tool_name,
            "integration": integration_id or (integration.id if integration else "market-intel"),
            "result": f"Executed tool '{tool_name}' on integration '{integration_id or 'market-intel'}' with input {tool_input}"
        }


mcp_router = MCPRouter()
