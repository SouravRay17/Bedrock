import json
import time
from typing import Any

from packages.agent_spec.models import ContextPolicy


class ContextManager:
    """
    Continuous, model-aware context tracking and sliding-window summarizer.
    Triggers adaptive compression when context utilization reaches 60% of model limit.
    """

    @staticmethod
    def estimate_tokens(text: Any) -> int:
        """Lightweight token estimator: ~4 chars per token for English text & JSON."""
        if text is None:
            return 0
        if isinstance(text, (dict, list)):
            text = json.dumps(text)
        return max(1, len(str(text)) // 4)

    @classmethod
    def evaluate_context(
        cls,
        system_prompt: str,
        messages: list[dict[str, Any]],
        state_variables: dict[str, Any],
        model_limit: int,
        policy: ContextPolicy
    ) -> tuple[bool, float, int]:
        """
        Calculates context usage ratio.
        Returns: (needs_compression, usage_ratio, total_tokens)
        """
        system_tokens = cls.estimate_tokens(system_prompt)
        messages_tokens = sum(cls.estimate_tokens(m.get("content", "")) for m in messages)
        state_tokens = cls.estimate_tokens(state_variables)

        total_tokens = system_tokens + messages_tokens + state_tokens
        usage_ratio = total_tokens / max(model_limit, 1000)

        needs_compression = usage_ratio >= policy.compressionThreshold
        return needs_compression, usage_ratio, total_tokens

    @classmethod
    def compress_context(
        cls,
        system_prompt: str,
        messages: list[dict[str, Any]],
        current_summary: dict[str, Any],
        policy: ContextPolicy
    ) -> tuple[list[dict[str, Any]], dict[str, Any], int]:
        """
        Compresses older turns into a structured JSON summary document while preserving:
        1. System directives and constraints
        2. Extracted facts and decisions
        3. Last N turns (default 2) for immediate conversational continuity.

        Returns: (compacted_messages, updated_summary, tokens_saved)
        """
        if len(messages) <= policy.retainedRecentTurns:
            return messages, current_summary, 0

        # Split into older turns to compress and recent turns to retain
        cutoff = max(1, len(messages) - policy.retainedRecentTurns)

        # Ensure we never slice between an assistant toolUse turn and its user toolResult turn
        while cutoff > 0:
            msg_at_cutoff = messages[cutoff]
            content = msg_at_cutoff.get("content", [])
            has_tool_result = False
            if isinstance(content, list):
                has_tool_result = any(isinstance(b, dict) and "toolResult" in b for b in content)
            elif isinstance(content, str):
                has_tool_result = "toolresult" in content.lower()
            if has_tool_result and cutoff > 0 and messages[cutoff - 1].get("role") == "assistant":
                cutoff -= 1
            else:
                break

        older_turns = messages[:cutoff]
        recent_turns = messages[cutoff:]

        # Extract structured facts from older turns
        extracted_facts = current_summary.get("facts", {})
        decisions = current_summary.get("decisions", [])
        tool_outputs = current_summary.get("tool_results", [])

        for msg in older_turns:
            content = str(msg.get("content", ""))
            role = msg.get("role", "")

            if role == "tool" or "tool result" in content.lower():
                tool_outputs.append(content[:200])
            elif role == "assistant":
                decisions.append(content[:150])

        updated_summary = {
            "compressedAt": time.time(),
            "originalTurnCount": len(older_turns),
            "preservedFacts": extracted_facts,
            "keyDecisions": decisions[-5:], # Retain top 5 decisions
            "lastToolOutputs": tool_outputs[-3:]
        }

        # Build compacted message list: Merge summary into leading user turn or prepend
        summary_injection_text = (
            f"[SYSTEM CONTEXT COMPRESSION RECORD (Threshold 60% Reached)]\n"
            f"Previous state and decisions summary: {json.dumps(updated_summary)}"
        )

        if recent_turns and recent_turns[0].get("role") == "user":
            first_turn = dict(recent_turns[0])
            first_content = first_turn.get("content")
            if isinstance(first_content, str):
                first_turn["content"] = f"{summary_injection_text}\n\n{first_content}"
            elif isinstance(first_content, list):
                first_turn["content"] = [{"text": summary_injection_text}] + first_content
            else:
                first_turn["content"] = [{"text": summary_injection_text}]
            compacted_messages = [first_turn] + recent_turns[1:]
        else:
            compacted_messages = [{"role": "user", "content": summary_injection_text}] + recent_turns

        tokens_before = sum(cls.estimate_tokens(m.get("content", "")) for m in messages)
        tokens_after = sum(cls.estimate_tokens(m.get("content", "")) for m in compacted_messages)
        tokens_saved = max(0, tokens_before - tokens_after)

        return compacted_messages, updated_summary, tokens_saved

context_manager = ContextManager()
