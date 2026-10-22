"""
Integration Registry for AgentOS Control Plane.
Manages first-class MCP Integrations decoupled from individual agents.
"""

import json
import logging
import os
import time
from typing import Any

from packages.agent_spec.models import MCPIntegration

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "registry")
os.makedirs(DATA_DIR, exist_ok=True)


class IntegrationRegistryService:
    """Manages first-class MCP and API Integrations."""

    def __init__(self, data_dir: str | None = None):
        self.data_dir = data_dir or os.environ.get("REGISTRY_DATA_DIR", DATA_DIR)
        os.makedirs(self.data_dir, exist_ok=True)
        self._integrations: dict[str, MCPIntegration] = {}
        self._load_from_disk()
        if not self._integrations:
            self._init_defaults()

    def _init_defaults(self):
        """Initializes default pre-registered integrations."""
        default_market_intel = MCPIntegration(
            id="market-intel",
            name="Market Intelligence",
            type="mcp",
            endpoint=os.environ.get("MARKET_INTEL_ENDPOINT", "http://localhost:8001/sse"),
            environment="sandbox",
            version="1.1.0",
            commit="d172c69",
            status="ready",
            credential_ref="market-intel-token",
            description="Real-time market intelligence, equity fundamentals, OHLCV candlesticks, and portfolio risk analytics powered by yfinance.",
            whitelistedToolNames=[
                "yfinance_search",
                "yfinance_get_quote",
                "yfinance_get_stock_info",
                "yfinance_get_historical_data",
                "yfinance_get_news",
                "portfolio_live_analysis"
            ]
        )
        self.register_integration(default_market_intel)

    def _load_from_disk(self):
        filepath = os.path.join(self.data_dir, "integrations.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        obj = MCPIntegration.model_validate(item)
                        self._integrations[obj.id] = obj
            except Exception as e:
                logger.error("Failed to load integrations from disk: %s", e)

    def _save_to_disk(self):
        filepath = os.path.join(self.data_dir, "integrations.json")
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump([item.model_dump() for item in self._integrations.values()], f, indent=2)
        except Exception as e:
            logger.error("Failed to save integrations to disk: %s", e)

    def register_integration(self, integration: MCPIntegration) -> MCPIntegration:
        integration.updatedAt = time.time()
        self._integrations[integration.id] = integration
        self._save_to_disk()
        return integration

    def get_integration(self, integration_id: str) -> MCPIntegration | None:
        # Check by id, then slug/case-insensitive match
        if integration_id in self._integrations:
            return self._integrations[integration_id]
        for item in self._integrations.values():
            if item.id.lower() == integration_id.lower() or item.name.lower() == integration_id.lower():
                return item
        return None

    def list_integrations(self) -> list[MCPIntegration]:
        return list(self._integrations.values())

    def update_integration(self, integration_id: str, updates: dict[str, Any]) -> MCPIntegration | None:
        item = self.get_integration(integration_id)
        if not item:
            return None
        data = item.model_dump()
        data.update(updates)
        data["updatedAt"] = time.time()
        updated = MCPIntegration.model_validate(data)
        self._integrations[updated.id] = updated
        self._save_to_disk()
        return updated

    def delete_integration(self, integration_id: str) -> bool:
        item = self.get_integration(integration_id)
        if item and item.id in self._integrations:
            del self._integrations[item.id]
            self._save_to_disk()
            return True
        return False

    def update_discovered_tools(self, integration_id: str, tools: list[dict[str, Any]]) -> MCPIntegration | None:
        item = self.get_integration(integration_id)
        if not item:
            return None
        item.discoveredTools = tools
        item.whitelistedToolNames = [t.get("name") for t in tools if t.get("name")]
        item.lastSyncedAt = time.time()
        item.updatedAt = time.time()
        item.status = "ready"
        self._save_to_disk()
        return item


integration_registry = IntegrationRegistryService()
