"""
Natural Language Agent Builder for AgentOS Control Plane.
Translates conversational user requests into an AgentDefinition attached to Integration & Tool catalogs.
"""

import uuid
from typing import Any

from packages.agent_spec.models import AgentDefinition
from services.control_plane.integration_registry import integration_registry
from services.control_plane.registry import registry


class NaturalLanguageAgentBuilder:
    """
    Translates natural-language intent into an AgentDefinition referencing
    first-class Integrations and Reusable Tools.
    """

    @classmethod
    def synthesize_proposal(cls, user_prompt: str, project_id: str = "default_project") -> dict[str, Any]:
        prompt_lower = user_prompt.lower()

        # 1. Generate identity & role
        title = "Custom Autonomous Assistant"
        if "market" in prompt_lower or "stock" in prompt_lower or "equity" in prompt_lower or "portfolio" in prompt_lower or "finance" in prompt_lower:
            title = "Market Intelligence & Portfolio Risk Auditor"
        elif "research" in prompt_lower:
            title = "Research & Synthesis Agent"
        elif "invoice" in prompt_lower or "budget" in prompt_lower:
            title = "Financial & Invoice Auditor"
        elif "customer" in prompt_lower or "support" in prompt_lower:
            title = "Customer Operations Specialist"
        elif "devops" in prompt_lower or "code" in prompt_lower or "git" in prompt_lower:
            title = "DevOps & Engineering Agent"
        else:
            words = [w.capitalize() for w in user_prompt.split()[:4] if len(w) > 2]
            if words:
                title = f"{' '.join(words)} Agent"

        # 2. Select default model
        free_models = registry.list_models(free_tier_only=True)
        selected_model = free_models[0].modelId if free_models else "amazon.nova-micro-v1:0"

        # 3. Match from Integration Registry
        matched_integration_ids: list[str] = []
        matched_tool_ids: list[str] = []
        available_integrations = integration_registry.list_integrations()

        for integ in available_integrations:
            integ_text = f"{integ.id} {integ.name} {integ.description}".lower()
            if (integ.id == "market-intel" and any(w in prompt_lower for w in ["stock", "equity", "quote", "portfolio", "candle", "yfinance", "market"])) or any(w in integ_text for w in prompt_lower.split() if len(w) > 3):
                matched_integration_ids.append(integ.id)
                matched_tool_ids.extend([f"{integ.id}.{t}" for t in integ.whitelistedToolNames])

        # Deduplicate
        matched_integration_ids = list(set(matched_integration_ids))
        matched_tool_ids = list(set(matched_tool_ids))

        # 4. Match Knowledge Bases
        matched_kb: list[str] = []
        if any(w in prompt_lower for w in ["policy", "document", "sop", "internal", "manual", "handbook", "guideline"]):
            matched_kb.append("kb_sample_enterprise_docs")

        # 5. Synthesize Instructions
        instructions = (
            f"You are {title}. Your core mission is: {user_prompt.strip()}\n\n"
            "Operating Guidelines:\n"
            "1. Leverage attached MCP integrations and tools whenever precise data, calculations, or real-time metrics are needed.\n"
            "2. When analyzing financial portfolios or stock tickers, execute the appropriate market-intel tools to verify quotes, historical candles, and beta risks.\n"
            "3. Format all analytical outputs strictly in clean GitHub-flavored Markdown with structured tables and clear conclusions."
        )

        agent_id = f"agent_{uuid.uuid4().hex[:8]}"

        proposed_agent = AgentDefinition(
            agentId=agent_id,
            projectId=project_id,
            name=title,
            description=user_prompt[:150] + ("..." if len(user_prompt) > 150 else ""),
            instructions=instructions,
            model={
                "provider": "bedrock",
                "modelId": selected_model
            },
            integration_ids=matched_integration_ids,
            tool_ids=matched_tool_ids,
            tools=matched_tool_ids, # compatibility
            knowledgeBases=matched_kb
        )

        return {
            "proposalId": f"prop_{uuid.uuid4().hex[:6]}",
            "userPrompt": user_prompt,
            "agent": proposed_agent.model_dump(),
            "matchedIntegrations": [i.model_dump() for i in available_integrations if i.id in matched_integration_ids],
            "matchedToolsCount": len(matched_tool_ids)
        }
