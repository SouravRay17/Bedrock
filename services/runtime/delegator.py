from typing import Any

from packages.agent_spec.models import ChildAgentContract
from services.control_plane.registry import registry


class DelegationError(Exception):
    pass

class AgentDelegator:
    """
    Manages hierarchical multi-agent delegation with recursion protection and explicit contract validation.
    """

    MAX_HIERARCHY_DEPTH = 3

    @classmethod
    async def dispatch_child_agent(
        cls,
        contract: ChildAgentContract,
        parent_payload: dict[str, Any],
        call_stack: list[str],
        remaining_budget_tokens: int,
        runtime_engine_ref: Any
    ) -> dict[str, Any]:
        child_id = contract.childAgentId

        # 1. Depth check ($D_{max} = 3$)
        if len(call_stack) >= cls.MAX_HIERARCHY_DEPTH:
            return {
                "error": f"Max hierarchy depth ({cls.MAX_HIERARCHY_DEPTH}) exceeded. Call stack: {' -> '.join(call_stack)}",
                "status": "FAILED"
            }

        # 2. Cycle detection
        if child_id in call_stack:
            return {
                "error": f"Recursion Cycle Detected: Agent '{child_id}' is already in active call stack ({' -> '.join(call_stack)})",
                "status": "CYCLE_BLOCKED"
            }

        # 3. Retrieve child immutable version
        child_version = registry.get_agent_version(child_id, contract.childVersion)
        if not child_version:
            return {
                "error": f"Child agent '{child_id}' version '{contract.childVersion}' not found in registry.",
                "status": "NOT_FOUND"
            }

        # 4. Map scoped input payload (no complete context dump)
        scoped_input = parent_payload.get("input", parent_payload)

        new_call_stack = call_stack + [child_id]

        # 5. Execute child through runtime engine
        trace = await runtime_engine_ref.execute_agent(
            agent_version=child_version,
            inputs=scoped_input,
            call_stack=new_call_stack,
            budget_tokens=remaining_budget_tokens
        )

        return {
            "childAgentId": child_id,
            "version": child_version.version,
            "status": trace.status,
            "output": trace.outputs,
            "tokensUsed": trace.totalTokens
        }

agent_delegator = AgentDelegator()
