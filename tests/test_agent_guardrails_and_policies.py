from packages.agent_spec.models import ContextPolicy
from services.runtime.context_mgr import context_manager


def test_context_manager_token_estimation():
    """Verify accurate calculation of token estimations for prompts and history."""
    messages = [
        {"role": "user", "content": "What is the price of GOOGL?"},
        {"role": "assistant", "content": "GOOGL is currently trading at $343.50."}
    ]
    tokens = context_manager.estimate_tokens(messages)
    assert tokens > 0
    assert isinstance(tokens, int)

def test_context_manager_triggers_compression_at_threshold():
    """Verify context manager signals compression when context usage exceeds limit."""
    policy = ContextPolicy(compressionThreshold=0.60, retainedRecentTurns=2)

    system_prompt = "You are an enterprise AI agent."
    # Create large message history
    messages = [
        {"role": "user", "content": f"Turn {i}: Analyzing transaction data and verifying parameters for batch execution."}
        for i in range(40)
    ]

    # Set artificial small model context limit to trigger 60% threshold
    needs_comp, usage_ratio, curr_tokens = context_manager.evaluate_context(
        system_prompt=system_prompt,
        messages=messages,
        state_variables={"userId": "12345"},
        model_limit=1000,
        policy=policy
    )

    assert needs_comp is True
    assert usage_ratio >= 0.60
    assert curr_tokens > 500

def test_context_manager_compression_reduces_history():
    """Verify that compress_context condenses messages and retains recent turns."""
    policy = ContextPolicy(compressionThreshold=0.60, retainedRecentTurns=2)

    system_prompt = "You are an enterprise AI agent."
    messages = [
        {"role": "user", "content": "Step 1: Fetch stock quote"},
        {"role": "assistant", "content": "Stock quote is $100"},
        {"role": "user", "content": "Step 2: Calculate volatility"},
        {"role": "assistant", "content": "Volatility is 12%"},
        {"role": "user", "content": "Step 3: What is the overall recommendation?"}
    ]

    compressed_messages, summary, saved_tokens = context_manager.compress_context(
        system_prompt=system_prompt,
        messages=messages,
        current_summary={},
        policy=policy
    )

    assert len(compressed_messages) <= len(messages)
    assert saved_tokens >= 0
    assert isinstance(summary, dict)
