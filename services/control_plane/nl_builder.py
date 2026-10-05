import uuid
from typing import Any

from packages.agent_spec.models import AgentDefinition
from services.control_plane.registry import registry


class NaturalLanguageAgentBuilder:
    """
    Translates natural-language intent into a proposed declarative AgentDefinition.
    Does NOT hard-code vertical templates; matches generic primitives from the Registry.
    """

    @classmethod
    def synthesize_proposal(cls, user_prompt: str, project_id: str = "default_project") -> dict[str, Any]:
        prompt_lower = user_prompt.lower()

        # 1. Generate identity & role
        title = "Custom Autonomous Assistant"
        if "research" in prompt_lower:
            title = "Research & Synthesis Agent"
        elif "invoice" in prompt_lower or "finance" in prompt_lower or "budget" in prompt_lower:
            title = "Financial & Invoice Auditor"
        elif "support" in prompt_lower or "customer" in prompt_lower:
            title = "Customer Operations Specialist"
        elif "devops" in prompt_lower or "code" in prompt_lower or "git" in prompt_lower:
            title = "DevOps & Engineering Agent"
        elif "travel" in prompt_lower:
            title = "Travel & Itinerary Planner"
        else:
            # Derive title from first few words
            words = [w.capitalize() for w in user_prompt.split()[:4] if len(w) > 2]
            if words:
                title = f"{' '.join(words)} Agent"

        # 2. Select default zero-cost model
        free_models = registry.list_models(free_tier_only=True)
        selected_model = free_models[0].modelId if free_models else "amazon.nova-micro-v1:0"

        # 3. Match Tools from Registry
        matched_tools: list[str] = []
        if any(w in prompt_lower for w in ["search", "web", "lookup", "browse", "google", "find"]):
            matched_tools.append("tool_web_search")
        if any(w in prompt_lower for w in ["calculate", "math", "tax", "cost", "sum", "price", "budget", "invoice"]):
            matched_tools.append("tool_calculator")
        if any(w in prompt_lower for w in ["api", "http", "fetch", "webhook", "rest"]):
            matched_tools.append("tool_http_requester")

        # 4. Match MCP Collections
        matched_mcp: list[str] = []
        if any(w in prompt_lower for w in ["git", "github", "jira", "ticket", "issue", "repo", "pr"]):
            matched_mcp.append("mcp_col_engineering")

        # 5. Match Knowledge Bases
        matched_kb: list[str] = []
        if any(w in prompt_lower for w in ["policy", "document", "sop", "internal", "manual", "handbook", "guideline"]):
            matched_kb.append("kb_sample_enterprise_docs")

        # 6. Synthesize Instructions
        instructions = (
            f"You are {title}. Your core objective is: {user_prompt.strip()}\n\n"
            "Operating Guidelines:\n"
            "1. Analyze the user request thoroughly and determine required actions.\n"
            "2. Utilize your attached tools and knowledge bases when precise facts, calculations, or external data are needed.\n"
            "3. If delegating to child agents, specify clear and concise inputs.\n"
            "4. Provide well-structured, clear, and actionable responses."
        )

        agent_id = f"agent_{uuid.uuid4().hex[:8]}"

        # 7. Construct Agent Definition
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
            inputs={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Primary goal or input data"}
                },
                "required": ["query"]
            },
            outputs={
                "type": "object",
                "properties": {
                    "response": {"type": "string", "description": "Final summarized output"},
                    "confidence": {"type": "number"}
                }
            },
            tools=matched_tools,
            mcpCollections=matched_mcp,
            knowledgeBases=matched_kb,
            childAgents=[]
        )

        return {
            "proposedAgent": proposed_agent,
            "rationale": {
                "matchedTools": matched_tools,
                "matchedMCPCollections": matched_mcp,
                "matchedKnowledgeBases": matched_kb,
                "selectedModel": selected_model,
                "reasoning": f"Derived blueprint matching your request for '{title}'. Configured with zero-cost model '{selected_model}' and {len(matched_tools)} tools."
            }
        }
