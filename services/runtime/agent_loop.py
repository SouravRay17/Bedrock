import json
import re
import time
import urllib.parse
import urllib.request
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from packages.agent_spec.models import (
    AgentVersion,
    ExecutionStep,
    ExecutionTrace,
)
from services.control_plane.registry import registry
from services.runtime.context_mgr import context_manager
from services.runtime.delegator import agent_delegator
from services.runtime.knowledge_router import knowledge_router
from services.runtime.mcp_router import mcp_router
from services.runtime.model_router import model_router
from services.runtime.tool_runner import tool_runner


def html_to_markdown(text: str | None) -> str:
    """Converts HTML markup to clean, well-formatted Markdown (.md format) and strips leftover tags."""
    if not text:
        return ""
    if not re.search(r"<[a-zA-Z\/][^>]*>", text):
        return text

    md = text
    # Convert headings
    for i in range(6, 0, -1):
        md = re.sub(rf"<h{i}[^>]*>(.*?)</h{i}>", rf"\n\n{'#' * i} \1\n\n", md, flags=re.IGNORECASE | re.DOTALL)

    # Paragraphs and line breaks
    md = re.sub(r"<p[^>]*>", "\n\n", md, flags=re.IGNORECASE)
    md = re.sub(r"</p>", "\n", md, flags=re.IGNORECASE)
    md = re.sub(r"<br\s*/?>", "\n", md, flags=re.IGNORECASE)
    md = re.sub(r"<hr\s*/?>", "\n\n---\n\n", md, flags=re.IGNORECASE)

    # Bold & Italic
    md = re.sub(r"<(strong|b)[^>]*>(.*?)</\1>", r"**\2**", md, flags=re.IGNORECASE | re.DOTALL)
    md = re.sub(r"<(em|i)[^>]*>(.*?)</\1>", r"*\2*", md, flags=re.IGNORECASE | re.DOTALL)

    # Code blocks and inline code
    md = re.sub(r"<pre><code>([\s\S]*?)</code></pre>", r"\n```\n\1\n```\n", md, flags=re.IGNORECASE)
    md = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", md, flags=re.IGNORECASE | re.DOTALL)

    # Lists
    md = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", md, flags=re.IGNORECASE | re.DOTALL)
    md = re.sub(r"</?[ou]l[^>]*>", "\n", md, flags=re.IGNORECASE)

    # Links
    md = re.sub(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', r"[\2](\1)", md, flags=re.IGNORECASE | re.DOTALL)

    # Strip any remaining tags
    md = re.sub(r"<[^>]+>", "", md)

    # Clean up excessive blank lines
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md


class AgentRuntimeEngine:
    """
    Core ReAct Reasoning & Execution Engine for immutable Agent Versions.
    """

    def __init__(self):
        self._traces: dict[str, ExecutionTrace] = {}

    async def execute_agent(
        self,
        agent_version: AgentVersion,
        inputs: dict[str, Any],
        session_id: str | None = None,
        call_stack: list[str] | None = None,
        budget_tokens: int | None = None,
        event_callback: Callable[[dict[str, Any]], Awaitable[None]] | None = None
    ) -> ExecutionTrace:
        exec_id = f"exec_{uuid.uuid4().hex[:8]}"
        session_id = session_id or f"sess_{uuid.uuid4().hex[:6]}"
        call_stack = call_stack or [agent_version.agentId]
        agent_def = agent_version.definition
        budget_tokens = budget_tokens or agent_def.runtime.budgetLimitTokens

        trace = ExecutionTrace(
            executionId=exec_id,
            agentId=agent_version.agentId,
            version=agent_version.version,
            sessionId=session_id,
            status="RUNNING",
            inputs=inputs,
            startedAt=time.time()
        )
        self._traces[exec_id] = trace

        if event_callback:
            await event_callback({
                "event": "status",
                "data": {
                    "status": "PROCESSING",
                    "agentId": agent_version.agentId,
                    "agentName": agent_def.name,
                    "executionId": exec_id,
                    "sessionId": session_id,
                    "inputs": inputs,
                    "timestamp": time.time(),
                    "message": f"Agent '{agent_def.name}' started processing query."
                }
            })

        # Resolve Model metadata
        model_id = agent_def.model.get("modelId", "amazon.nova-micro-v1:0")
        model_meta = registry.get_model(model_id)
        max_context = model_meta.maxContextTokens if model_meta else 128000

        # Resolve Attached Tools
        resolved_tools = []
        for tid in agent_def.tools:
            t = registry.get_tool(tid)
            if t:
                resolved_tools.append(t)

        # Resolve Attached MCP Collections & Discovered Tools
        resolved_mcp_collections = []
        mcp_tool_map: dict[str, Any] = {} # tool_name -> MCPCollection
        for col_id in agent_def.mcpCollections:
            col = registry.get_mcp_collection(col_id)
            if not col:
                # Search by slug / name fallback
                for c in registry.list_mcp_collections():
                    if c.slug == col_id or c.name == col_id:
                        col = c
                        break
            if col:
                resolved_mcp_collections.append(col)
                # Map tools from discoveredTools or servers
                for dt in col.discoveredTools:
                    if isinstance(dt, dict):
                        t_name = dt.get("name") or dt.get("bedrockToolSpec", {}).get("toolSpec", {}).get("name")
                        if t_name:
                            mcp_tool_map[t_name] = col
                # Also check server tools if present
                for s_id in col.servers:
                    srv = registry.get_mcp_server(s_id)
                    if srv:
                        for cap in srv.discoveredTools:
                            mcp_tool_map[cap.name] = col

        # Resolve Attached Knowledge Bases (Pre-fetch relevant chunks if query exists)
        kb_chunks = []
        user_query = str(inputs.get("query", json.dumps(inputs)))
        for kb_id in agent_def.knowledgeBases:
            kb = registry.get_knowledge_base(kb_id)
            if kb:
                chunks = knowledge_router.retrieve_chunks(kb, user_query)
                if chunks:
                    kb_chunks.extend(chunks)
                    # Record KB step
                    step = ExecutionStep(
                        stepIndex=len(trace.steps) + 1,
                        stepType="KB_RETRIEVAL",
                        title=f"Retrieved from Knowledge Base: {kb.name}",
                        inputPayload={"query": user_query},
                        outputPayload=chunks
                    )
                    trace.steps.append(step)
                    if event_callback:
                        await event_callback({"event": "step", "data": step.model_dump()})

        # Assemble Initial System Instructions with Guardrails, Resources & KB Context
        prompt_parts = []
        # Strict Markdown Output Directive
        md_directive = (
            "### OUTPUT FORMAT SPECIFICATION\n"
            "You MUST format all responses strictly in GitHub-flavored Markdown (.md format).\n"
            "- NEVER return raw HTML tags (e.g. <div>, <p>, <table>, <html>, <br>).\n"
            "- Format all structure using Markdown: headers (##, ###), bullet lists (- ), numbered lists, bold (**text**), and Markdown tables (| col | col |).\n"
            "- For code, scripts, or tabular data, use fenced code blocks (```language ... ```).\n"
            "- All output must be clean, readable, and ready to be saved directly as a .md file."
        )
        prompt_parts.append(md_directive)
        if agent_def.instructions:
            prompt_parts.append(agent_def.instructions)

        # Check for modular prompt sections
        extra_sections = getattr(agent_def, "promptSections", None) or getattr(agent_version, "promptSections", None)
        if isinstance(extra_sections, list):
            for sec in extra_sections:
                if isinstance(sec, dict) and sec.get("title") and sec.get("content"):
                    prompt_parts.append(f"### {sec['title']}\n{sec['content']}")

        # Build Connected Resources Manifest for Full Agent Self-Awareness
        resource_lines = []
        if resolved_mcp_collections:
            resource_lines.append("Connected MCP Collections:")
            for col in resolved_mcp_collections:
                c_tools = []
                for dt in col.discoveredTools:
                    if isinstance(dt, dict):
                        tn = dt.get("name") or dt.get("bedrockToolSpec", {}).get("toolSpec", {}).get("name")
                        if tn:
                            c_tools.append(tn)
                tools_str = ", ".join(c_tools) if c_tools else "None"
                resource_lines.append(f"- Collection '{col.name}' (ID: {col.collectionId}, Type: {col.collectionType}): Tools [{tools_str}] - {col.description or 'Custom collection'}")

        if resolved_tools:
            resource_lines.append("Connected Direct Tools:")
            for t in resolved_tools:
                resource_lines.append(f"- Tool '{t.name}' (ID: {t.toolId}): {t.description or 'Tool function'}")

        if agent_def.knowledgeBases:
            resource_lines.append("Connected Knowledge Bases:")
            for kb_id in agent_def.knowledgeBases:
                kb_obj = registry.get_knowledge_base(kb_id)
                kb_name = kb_obj.name if kb_obj else kb_id
                resource_lines.append(f"- Knowledge Base '{kb_name}' (ID: {kb_id})")

        if resource_lines:
            prompt_parts.append("<connected_resources>\n" + "\n".join(resource_lines) + "\n</connected_resources>")

        if kb_chunks:
            kb_part = "<knowledge_context>\n"
            for idx, c in enumerate(kb_chunks):
                kb_part += f"[{idx+1}] {c.get('content')}\n"
        # Contextual, Tool-Enforced & Visual Charting Directive
        two_stage_directive = (
            "### MANDATORY REAL-TIME TOOL USAGE, TICKER SEARCH & CHARTING DIRECTIVE\n"
            "CRITICAL: You are equipped with live financial tools (`yfinance_search`, `yfinance_get_quote`, `yfinance_get_historical_data`, `yfinance_get_stock_info`).\n"
            "RULE 1: COMPANY NAME SEARCH & TICKER RESOLUTION:\n"
            "   - When the user asks about ANY company by name, brand, product, or colloquial/misspelled name (e.g. 'Google', 'Alphabet', 'Amara Raja', 'Tata Motors', 'Reliance', 'State Bank of India', 'Tesla'):\n"
            "   - CRITICAL ENTITY RECOGNITION: Distinguish between the target company and analytical keywords! Words such as 'patterns forming', 'patterns', 'pattern', 'analysis', 'report', 'chart', 'trend', 'support', 'resistance', 'breakout' are analytical tasks, NOT company names! For example, 'can you check the google and give me the patterns forming' refers strictly to GOOGLE (Alphabet Inc. -> 'GOOGL'), NEVER Pattern Group Inc!\n"
            "   - You MUST call `yfinance_search(query=...)` with the actual company name to discover the official name, exchange, and ticker symbol.\n"
            "   - NEVER assume Apple / AAPL unless the user explicitly asked for Apple! ALWAYS resolve the user's specific requested company.\n"
            "RULE 2: NO HALLUCINATION:\n"
            "   - NEVER fabricate, invent, or make up stock quotes, numbers, dates, or prices! Whenever a user asks for stock prices, quotes, or historical charts, you MUST call the corresponding MCP tool using the resolved ticker symbol.\n"
            "RULE 3: TEXT ANALYSIS FIRST & CONCISE REPORT (MANDATORY):\n"
            "   - NEVER reply with ONLY a chart or raw metrics without in-depth textual analysis and explanations!\n"
            "   - When the user asks for 'patterns forming', 'analysis', 'report', 'explain', or 'insights', you MUST provide:\n"
            "     * Executive Summary & Trend Stance (Bullish, Bearish, or Neutral/Consolidating).\n"
            "     * Technical Patterns Forming (e.g. Higher Highs/Lows, Consolidations, Breakout Levels, Candlestick formations like Engulfing, Hammer, Doji).\n"
            "     * Key Support, Resistance Price Levels and Moving Averages.\n"
            "     * Actionable Takeaways & Risk Considerations in clear bullet points.\n"
            "   - If the user specifies 'text answers', 'concise report', 'no graph', or 'don't want graph', prioritize deep textual explanation and omit graphs.\n"
            "RULE 4: CHARTS & HISTORICAL TIME HORIZONS:\n"
            "   - When a chart or visual plot is requested, call `yfinance_get_historical_data(symbol_or_name=..., period=..., interval=...)` and include the ```candlestick code block alongside your detailed text analysis.\n"
            "RULE 5: SUMMARY & ACCURACY:\n"
            "   - Present clear, concise takeaways: official company name, exact ticker symbol, currency (₹ for Indian stocks, $ for US stocks), current price, period high/low, net percentage change, and trend direction."
        )
        prompt_parts.append(two_stage_directive)

        system_prompt = "\n\n".join(prompt_parts)

        # Initialize Working Context with multi-turn conversation history if provided
        messages = []
        raw_history = inputs.get("history") or inputs.get("messages")
        if raw_history and isinstance(raw_history, list):
            for m in raw_history:
                if isinstance(m, dict) and m.get("role") and m.get("content"):
                    messages.append({"role": m["role"], "content": m["content"]})

        # Ensure latest user query is present at the end
        if not messages or messages[-1].get("content") != user_query:
            messages.append({"role": "user", "content": user_query})

        state_summary = {}
        total_tokens = 0
        step_count = 0
        final_response = None

        # --- ReAct Execution Loop ---
        while step_count < agent_def.runtime.maxExecutionSteps:
            step_count += 1
            step_start_time = time.time()

            # 1. Dynamic Context Token Check & 60% Summarization Trigger
            needs_comp, usage_ratio, _curr_tokens = context_manager.evaluate_context(
                system_prompt=system_prompt,
                messages=messages,
                state_variables=inputs,
                model_limit=max_context,
                policy=agent_def.contextPolicy
            )
            trace.contextUsagePercent = round(usage_ratio * 100, 2)

            if needs_comp:
                messages, state_summary, saved_tokens = context_manager.compress_context(
                    system_prompt=system_prompt,
                    messages=messages,
                    current_summary=state_summary,
                    policy=agent_def.contextPolicy
                )
                trace.contextCompressedCount += 1
                comp_step = ExecutionStep(
                    stepIndex=len(trace.steps) + 1,
                    stepType="CONTEXT_COMPRESSION",
                    title=f"Context Compression Activated ({trace.contextUsagePercent}% capacity reached)",
                    inputPayload={"usageRatio": usage_ratio, "tokensSaved": saved_tokens},
                    outputPayload=state_summary
                )
                trace.steps.append(comp_step)
                if event_callback:
                    await event_callback({"event": "step", "data": comp_step.model_dump()})

            # 2. Format Tool Specs for Model (Zero Credentials/Tokens - Pure Bedrock Schema)
            tool_specs = [
                {
                    "name": t.name,
                    "description": t.description,
                    "inputSchema": t.inputSchema
                }
                for t in resolved_tools
            ]

            # Add MCP Collection Tools to Bedrock toolSpecs (Bedrock Converse format, NO TOKENS)
            for col in resolved_mcp_collections:
                for dt in col.discoveredTools:
                    if isinstance(dt, dict):
                        spec = dt.get("bedrockToolSpec", {}).get("toolSpec", {})
                        t_name = spec.get("name") or dt.get("name")
                        t_desc = spec.get("description") or dt.get("description", f"Tool from {col.name}")
                        t_schema = spec.get("inputSchema", {}).get("json") or dt.get("inputSchema", {"type": "object", "properties": {}})
                        if t_name and not any(ts["name"] == t_name for ts in tool_specs):
                            tool_specs.append({
                                "name": t_name,
                                "description": t_desc,
                                "inputSchema": t_schema
                            })
                for s_id in col.servers:
                    srv = registry.get_mcp_server(s_id)
                    if srv:
                        for cap in srv.discoveredTools:
                            if not any(ts["name"] == cap.name for ts in tool_specs):
                                tool_specs.append({
                                    "name": cap.name,
                                    "description": cap.description or f"MCP tool from {srv.name}",
                                    "inputSchema": cap.inputSchema or {"type": "object", "properties": {}}
                                })

            # Add Child Agent Delegation specs as available tools
            for child_contract in agent_def.childAgents:
                tool_specs.append({
                    "name": f"delegate_to_{child_contract.childAgentId}",
                    "description": child_contract.delegationTrigger,
                    "inputSchema": child_contract.inputMappingSchema or {"type": "object", "properties": {"task": {"type": "string"}}}
                })

            # 3. Model Inference Step
            inf_result = model_router.converse(
                model_id=model_id,
                system_prompt=system_prompt,
                messages=messages,
                tools=tool_specs,
                inference_params=agent_def.model.get("inferenceParameters"),
                guardrail_config=agent_def.guardrails.model_dump() if agent_def.guardrails else None
            )
            step_tokens = inf_result.get("tokens_used", 50)
            total_tokens += step_tokens

            # Record Thought Step
            thought_step = ExecutionStep(
                stepIndex=len(trace.steps) + 1,
                stepType="THOUGHT",
                title=f"Reasoning Step {step_count} ({model_id})",
                outputPayload=inf_result.get("thought"),
                tokensUsed=step_tokens,
                durationMs=int((time.time() - step_start_time) * 1000)
            )
            trace.steps.append(thought_step)
            if event_callback:
                await event_callback({"event": "step", "data": thought_step.model_dump()})
                await event_callback({
                    "event": "thought",
                    "data": {
                        "stepIndex": thought_step.stepIndex,
                        "thought": thought_step.outputPayload,
                        "tokens": step_tokens,
                        "durationMs": thought_step.durationMs
                    }
                })

            tool_calls = inf_result.get("tool_calls", [])

            # 4. Handle Final Output or Tool Calls
            if not tool_calls:
                final_response = inf_result.get("final_text", "Task complete.")
                break

            # Append assistant message with toolUse blocks to maintain Bedrock Converse session protocol
            raw_assistant = inf_result.get("raw_content")
            if not raw_assistant:
                raw_assistant = []
                if inf_result.get("thought"):
                    raw_assistant.append({"text": inf_result["thought"]})
                for tc in tool_calls:
                    raw_assistant.append({
                        "toolUse": {
                            "toolUseId": tc.get("tool_use_id") or f"call_{uuid.uuid4().hex[:6]}",
                            "name": tc.get("tool_name"),
                            "input": tc.get("input", {})
                        }
                    })
            messages.append({"role": "assistant", "content": raw_assistant})

            # Execute Tool Calls or Child Delegations and accumulate results for a single user turn
            turn_tool_results = []
            for tc in tool_calls:
                t_name = tc.get("tool_name")
                t_input = tc.get("input", {})
                tu_id = tc.get("tool_use_id") or f"call_{uuid.uuid4().hex[:6]}"
                t_start = time.time()

                # Notify listeners BEFORE tool execution begins!
                if event_callback:
                    await event_callback({
                        "event": "tool_calling",
                        "data": {
                            "tool": t_name,
                            "input": t_input,
                            "toolUseId": tu_id,
                            "status": "CALLING",
                            "stepIndex": len(trace.steps) + 1,
                            "message": f"Calling tool '{t_name}'..."
                        }
                    })

                # Check if it's a child agent delegation
                if t_name.startswith("delegate_to_"):
                    child_id = t_name.replace("delegate_to_", "")
                    contract = next((c for c in agent_def.childAgents if c.childAgentId == child_id), None)
                    if contract:
                        delegation_result = await agent_delegator.dispatch_child_agent(
                            contract=contract,
                            parent_payload=t_input,
                            call_stack=call_stack,
                            remaining_budget_tokens=budget_tokens - total_tokens,
                            runtime_engine_ref=self
                        )
                    else:
                        delegation_result = {"error": f"Child agent contract for '{child_id}' not found.", "status": "FAILED"}

                    t_dur = int((time.time() - t_start) * 1000)
                    del_step = ExecutionStep(
                        stepIndex=len(trace.steps) + 1,
                        stepType="CHILD_DELEGATION",
                        title=f"Delegated to Child Agent: {child_id}",
                        inputPayload=t_input,
                        outputPayload=delegation_result,
                        durationMs=t_dur
                    )
                    trace.steps.append(del_step)
                    if event_callback:
                        await event_callback({
                            "event": "tool_completed",
                            "data": {
                                "tool": t_name,
                                "input": t_input,
                                "output": delegation_result,
                                "durationMs": t_dur,
                                "status": "SUCCESS" if not (isinstance(delegation_result, dict) and delegation_result.get("error")) else "FAILED",
                                "stepIndex": len(trace.steps),
                                "message": f"Delegation to '{child_id}' completed in {t_dur}ms"
                            }
                        })
                        await event_callback({"event": "step", "data": del_step.model_dump()})

                    is_err = isinstance(delegation_result, dict) and bool(delegation_result.get("error"))
                    if isinstance(delegation_result, dict):
                        tc_content = [{"json": delegation_result}]
                    elif isinstance(delegation_result, list):
                        tc_content = [{"json": {"result": delegation_result}}]
                    else:
                        tc_content = [{"text": str(delegation_result) if delegation_result is not None else ""}]

                    turn_tool_results.append({
                        "toolResult": {
                            "toolUseId": tu_id,
                            "content": tc_content,
                            "status": "error" if is_err else "success"
                        }
                    })

                elif t_name in mcp_tool_map:
                    # Execute MCP Tool via Host Gateway Router with dynamic Bearer {{MCP_AUTH_TOKEN}}
                    target_col = mcp_tool_map[t_name]
                    scoped_vars = inputs.get("variables", [])
                    context_meta = {
                        "agent_id": agent_version.agentId,
                        "session_id": session_id,
                        "execution_id": exec_id
                    }
                    if isinstance(t_input, dict) and "idempotency_key" not in t_input:
                        t_input["idempotency_key"] = f"idem_{session_id[:6]}_{step_count}_{len(trace.steps)}"

                    mcp_out = await mcp_router.execute_mcp_tool(
                        collection_id=target_col.collectionId,
                        tool_name=t_name,
                        tool_input=t_input,
                        scoped_variables=scoped_vars,
                        context_metadata=context_meta
                    )
                    t_dur = int((time.time() - t_start) * 1000)
                    mcp_step = ExecutionStep(
                        stepIndex=len(trace.steps) + 1,
                        stepType="MCP_CALL",
                        title=f"Executed MCP Tool via Gateway: {t_name} (Bearer Auth Resolved)",
                        inputPayload=t_input,
                        outputPayload=mcp_out,
                        durationMs=t_dur
                    )
                    trace.steps.append(mcp_step)
                    if event_callback:
                        await event_callback({
                            "event": "tool_completed",
                            "data": {
                                "tool": t_name,
                                "input": t_input,
                                "output": mcp_out,
                                "durationMs": t_dur,
                                "status": "SUCCESS" if not (isinstance(mcp_out, dict) and mcp_out.get("error")) else "FAILED",
                                "stepIndex": len(trace.steps),
                                "message": f"MCP Tool '{t_name}' completed in {t_dur}ms"
                            }
                        })
                        await event_callback({"event": "step", "data": mcp_step.model_dump()})

                    res_content = mcp_out.get("result") or mcp_out
                    is_err = isinstance(mcp_out, dict) and (bool(mcp_out.get("error")) or mcp_out.get("status") in ["FAILED", "BLOCKED"])
                    if isinstance(res_content, dict):
                        tc_content = [{"json": res_content}]
                    elif isinstance(res_content, list):
                        tc_content = [{"json": {"result": res_content}}]
                    else:
                        tc_content = [{"text": str(res_content) if res_content is not None else ""}]

                    turn_tool_results.append({
                        "toolResult": {
                            "toolUseId": tu_id,
                            "content": tc_content,
                            "status": "error" if is_err else "success"
                        }
                    })

                else:
                    # Execute Standard Registered Tool
                    target_tool = next((t for t in resolved_tools if t.name == t_name or t.toolId == t_name), None)
                    if not target_tool:
                        # Fallback search by registry
                        target_tool = registry.get_tool(t_name)

                    if target_tool:
                        tool_out = await tool_runner.execute_tool(target_tool, t_input)
                    else:
                        tool_out = {"error": f"Tool '{t_name}' is not configured on agent.", "status": "FAILED"}

                    t_dur = int((time.time() - t_start) * 1000)
                    t_step = ExecutionStep(
                        stepIndex=len(trace.steps) + 1,
                        stepType="TOOL_CALL",
                        title=f"Executed Tool: {t_name}",
                        inputPayload=t_input,
                        outputPayload=tool_out,
                        durationMs=t_dur
                    )
                    trace.steps.append(t_step)
                    if event_callback:
                        await event_callback({
                            "event": "tool_completed",
                            "data": {
                                "tool": t_name,
                                "input": t_input,
                                "output": tool_out,
                                "durationMs": t_dur,
                                "status": "SUCCESS" if not (isinstance(tool_out, dict) and tool_out.get("error")) else "FAILED",
                                "stepIndex": len(trace.steps),
                                "message": f"Tool '{t_name}' completed in {t_dur}ms"
                            }
                        })
                        await event_callback({"event": "step", "data": t_step.model_dump()})

                    is_err = isinstance(tool_out, dict) and (bool(tool_out.get("error")) or tool_out.get("status") == "FAILED")
                    if isinstance(tool_out, dict):
                        tc_content = [{"json": tool_out}]
                    elif isinstance(tool_out, list):
                        tc_content = [{"json": {"result": tool_out}}]
                    else:
                        tc_content = [{"text": str(tool_out) if tool_out is not None else ""}]

                    turn_tool_results.append({
                        "toolResult": {
                            "toolUseId": tu_id,
                            "content": tc_content,
                            "status": "error" if is_err else "success"
                        }
                    })

            # Append accumulated tool results as a single user message turn for Converse protocol compliance
            if turn_tool_results:
                messages.append({
                    "role": "user",
                    "content": turn_tool_results
                })

        # Intercept hallucinated excuses or simulated tool texts and auto-fulfill market charts/quotes
        final_response = await self._fulfill_market_query_if_needed(
            inputs=inputs,
            messages=messages,
            final_response=final_response,
            trace=trace,
            event_callback=event_callback
        )

        # Finalize Execution Trace
        if final_response:
            final_response = html_to_markdown(final_response)

        trace.status = "COMPLETED"
        trace.outputs = {"response": final_response, "confidence": 0.95}
        trace.totalTokens = total_tokens
        trace.completedAt = time.time()

        # Output Step
        final_step = ExecutionStep(
            stepIndex=len(trace.steps) + 1,
            stepType="FINAL_OUTPUT",
            title="Final Response Formulated & Validated",
            outputPayload=trace.outputs
        )
        trace.steps.append(final_step)
        if event_callback:
            await event_callback({"event": "final_output", "data": {"response": final_response, "executionId": exec_id, "agentId": agent_version.agentId, "tokens": total_tokens}})
            await event_callback({"event": "step", "data": final_step.model_dump()})
            await event_callback({"event": "complete", "data": trace.model_dump()})
            await event_callback({
                "event": "status",
                "data": {
                    "status": "IDLE",
                    "agentId": agent_version.agentId,
                    "agentName": agent_def.name,
                    "executionId": exec_id,
                    "timestamp": time.time(),
                    "message": f"Agent '{agent_def.name}' finished. Runtime is idle."
                }
            })

        return trace

    def get_trace(self, execution_id: str) -> ExecutionTrace | None:
        return self._traces.get(execution_id)

    async def _fulfill_market_query_if_needed(
        self,
        inputs: dict[str, Any],
        messages: list[dict[str, Any]],
        final_response: str | None,
        trace: ExecutionTrace,
        event_callback: Callable[[dict[str, Any]], Awaitable[None]] | None = None
    ) -> str | None:
        """
        Intelligently reasons about financial market queries (candlestick charts, stock quotes, historical data),
        extracts the requested company or stock ticker dynamically, and fulfills it with live market data
        and interactive charts.
        """
        user_query = str(inputs.get("query") or "").strip()
        user_texts = [
            str(m.get("content", ""))
            for m in messages
            if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str)
        ]
        all_user_text = " ".join(user_texts + ([user_query] if user_query else ""))
        all_user_lower = all_user_text.lower()

        market_keywords = (
            "candlestick", "candle stick", "candle", "candles", "ohlc", "chart", "charts",
            "graph", "graphs", "grpah", "plot", "plots", "stock", "stocks", "share", "shares",
            "ticker", "quote", "quotes", "price", "prices", "market", "trading", "invest",
            "nifty", "sensex", "bse", "nse", "nasdaq", "nyse", "pattern", "patterns",
            "formation", "formations", "breakout", "technical", "analysis", "report"
        )
        if not any(kw in all_user_lower for kw in market_keywords):
            return final_response

        resp_str = final_response or ""
        resp_lower = resp_str.lower()

        excuse_phrases = (
            "can't directly plot", "cannot directly plot", "can not directly plot",
            "unfortunately, i can't", "unfortunately, i cannot",
            "visualization tool", "install matplotlib", "install mplfinance",
            "pip install", "plot_candlestick.py", "python script to plot",
            "here is how you can plot", "sample script to plot"
        )
        is_excuse = any(p in resp_lower for p in excuse_phrases)

        simulated_tool_phrases = (
            "executing yfinance_", "i will call yfinance_", "yfinance_search(query=",
            "yfinance_get_historical_data(", "step 1: resolve company name",
            "step 2: retrieve historical data", "step 3: present the candlestick chart"
        )
        is_simulated = any(p in resp_lower for p in simulated_tool_phrases)

        is_chart_requested = any(w in all_user_lower for w in ("candlestick", "candle stick", "candle", "graph", "chart", "plot", "grpah"))
        is_analysis_requested = any(w in all_user_lower for w in ("pattern", "patterns", "technical", "analysis", "report", "insights", "formation"))
        has_chart_block = "```candlestick" in resp_str

        should_fulfill = is_excuse or is_simulated or is_analysis_requested or (is_chart_requested and not has_chart_block)
        if not should_fulfill:
            return final_response

        # 1. Smart Dynamic Entity Extraction
        known_aliases = {
            "google": "GOOGL",
            "alphabet": "GOOGL",
            "zomato": "ETERNAL.NS",
            "amarraja": "ARE&M.NS",
            "amara raja": "ARE&M.NS",
            "amarrather": "ARE&M.NS",
            "eternal": "ETERNAL.NS",
            "tata motors": "TMCV.NS",
            "tata steel": "TATASTEEL.NS",
            "tata power": "TATAPOWER.NS",
            "tcs": "TCS.NS",
            "infosys": "INFY.NS",
            "wipro": "WIPRO.NS",
            "hcl": "HCLTECH.NS",
            "reliance": "RELIANCE.NS",
            "state bank of india": "SBIN.NS",
            "sbi": "SBIN.NS",
            "hdfc": "HDFCBANK.NS",
            "hdfc bank": "HDFCBANK.NS",
            "icici": "ICICIBANK.NS",
            "maruti": "MARUTI.NS",
            "maruti suzuki": "MARUTI.NS",
            "l&t": "LT.NS",
            "itc": "ITC.NS",
            "bhel": "BHEL.NS",
            "suzlon": "SUZLON.NS",
            "polycab": "POLYCAB.NS",
            "trent": "TRENT.NS",
            "cdsl": "CDSL.NS",
            "mazagon dock": "MAZDOCK.NS",
            "apple": "AAPL",
            "tesla": "TSLA",
            "microsoft": "MSFT",
            "nvidia": "NVDA",
            "boeing": "BA",
            "amazon": "AMZN",
            "meta": "META",
            "amd": "AMD",
        }

        def extract_target_entity(q_str: str) -> str:
            raw = (q_str or "").strip().lower()
            # A. Match known aliases first
            for k in sorted(known_aliases.keys(), key=len, reverse=True):
                if re.search(r"\b" + re.escape(k) + r"\b", raw):
                    return k

            # B. Strip analytical and conversational filler phrases
            c = raw
            fillers = [
                r"\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:check|analyze|look\s+at|examine|inspect|plot|show|give|display|fetch|get|tell)\b",
                r"\b(?:please\s+)?(?:check|analyze|look\s+at|examine|inspect|plot|show|give|display|provide|fetch|get|tell)\s*(?:me\s+)?",
                r"\b(?:what\s+is\s+(?:the\s+)?(?:current\s+)?(?:price|chart|quote|trend|pattern|analysis)\s+(?:of|for)\s+)",
                r"\b(?:patterns?\s+forming|chart\s*patterns?|patterns?|formations?)\b",
                r"\b(?:technical\s+analysis|concise\s+report|in\s*depth\s*analysis|stock\s*analysis|text\s*answers?)\b",
                r"\b(?:candlestick|candle\s*stick|ohlcv?|trading|stock|share|equity)\s+(?:charts?|grahps?|grpahs?|graphs?|plots?|data|prices?|quotes?)\b",
                r"\b(?:candlestick|candle\s*stick|charts?|grahps?|grpahs?|graphs?|plots?|quotes?|prices?|shares?|stocks?)\b",
                r"\b(?:1d|5d|1m|1mo|3m|3mo|6m|6mo|1y|1yr|1year|3y|5y|all)\s*(?:timeframe|horizon|chart|period)?\b",
                r"\b(?:days?|months?|years?|daily|weekly|monthly)\b",
                r"\b(?:about|the|a|an|and|for|of|on|in|to|with|forming)\b"
            ]
            for p in fillers:
                c = re.sub(p, " ", c, flags=re.IGNORECASE)
            c = re.sub(r"[^\w\s&\.]", " ", c)
            c = " ".join(c.split())
            return c

        entity = extract_target_entity(user_query)
        if (len(entity) < 2 or entity.lower() in ("graph", "chart", "candle", "candlestick", "grpah", "pattern", "patterns")) and messages:
            for m in reversed(messages):
                if isinstance(m, dict) and m.get("role") == "user":
                    cand = extract_target_entity(str(m.get("content") or ""))
                    if len(cand) >= 2 and cand.lower() not in ("graph", "chart", "candle", "candlestick", "grpah", "pattern", "patterns"):
                        entity = cand
                        break
                elif isinstance(m, dict) and m.get("role") == "assistant":
                    text = str(m.get("content") or "")
                    tm = re.search(r"\b([A-Z0-9&]{1,10}\.(?:NS|BO)|[A-Z]{2,5})\b", text)
                    if tm and tm.group(1) not in ("NSE", "BSE", "USD", "INR", "HTTP", "JSON", "GET", "POST", "STEP", "PTRN"):
                        entity = tm.group(1)
                        break

        if not entity or entity.lower() in ("pattern", "patterns", "chart"):
            entity = "google"

        # Resolve timeframe
        period = "1mo"
        interval = "1d"
        if any(p in all_user_lower for p in ("5y", "5 year", "5 years")):
            period, interval = "5y", "1wk"
        elif any(p in all_user_lower for p in ("3y", "3 year", "3 years")):
            period, interval = "3y", "1wk"
        elif any(p in all_user_lower for p in ("1y", "1 year", "1 years", "12 month", "12 months")):
            period, interval = "1y", "1d"
        elif any(p in all_user_lower for p in ("6m", "6 month", "6 months")):
            period, interval = "6mo", "1d"
        elif any(p in all_user_lower for p in ("3m", "3 month", "3 months")):
            period, interval = "3mo", "1d"
        elif any(p in all_user_lower for p in ("5d", "5 day", "5 days")):
            period, interval = "5d", "15m"
        elif any(p in all_user_lower for p in ("1d", "1 day", "today")):
            period, interval = "1d", "5m"

        t_start = time.time()
        try:
            import yfinance as yf

            clean_ent = entity.strip()
            clean_lower = clean_ent.lower()
            candidates = []

            # A. Check known aliases
            for k, v in known_aliases.items():
                if k == clean_lower or (len(k) >= 4 and k in clean_lower):
                    candidates.append(v)
                    break

            # B. Yahoo finance autocomplete search
            try:
                url = f"https://query2.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(clean_ent)}&quotesCount=8"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                with urllib.request.urlopen(req, timeout=4) as s_resp:
                    data = json.loads(s_resp.read().decode("utf-8"))
                    for q in data.get("quotes", []):
                        if q.get("quoteType") in ("EQUITY", "ETF", "INDEX"):
                            s = q.get("symbol")
                            if s and s not in candidates:
                                candidates.append(s)
            except Exception:  # noqa: BLE001
                pass

            # C. Direct uppercase variations
            sym_raw = re.sub(r"[^A-Za-z0-9&]", "", clean_ent).upper()
            if sym_raw:
                for suffix in [".NS", "", ".BO"]:
                    c = f"{sym_raw}{suffix}"
                    if c not in candidates:
                        candidates.append(c)

            # D. Test candidates and extract candles
            resolved_sym = None
            resolved_candles = []
            target_ticker_obj = None

            for sym in candidates:
                try:
                    t = yf.Ticker(sym)
                    hist = t.history(period=period, interval=interval)
                    if not hist.empty and len(hist) > 0:
                        resolved_sym = sym
                        target_ticker_obj = t
                        for idx_ts, row in hist.iterrows():
                            resolved_candles.append({
                                "date": str(idx_ts).split(" ")[0].split("T")[0],
                                "open": round(float(row["Open"]), 2),
                                "high": round(float(row["High"]), 2),
                                "low": round(float(row["Low"]), 2),
                                "close": round(float(row["Close"]), 2),
                                "volume": int(row.get("Volume", 0))
                            })
                        break
                except Exception:  # noqa: BLE001
                    continue

            # E. Web search fallback if still unresolved
            if not resolved_sym or not resolved_candles:
                try:
                    q_enc = urllib.parse.quote(f"{clean_ent} stock ticker Yahoo Finance")
                    url = f"https://lite.duckduckgo.com/lite/?q={q_enc}"
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                    with urllib.request.urlopen(req, timeout=4) as resp:
                        html = resp.read().decode("utf-8", errors="ignore")
                        web_tickers = re.findall(r"finance\.yahoo\.com/quote/([A-Za-z0-9&_\.\-]+)", html)
                        for wt in web_tickers:
                            clean_wt = wt.strip("/").upper()
                            if clean_wt and not clean_wt.startswith("STATIC") and clean_wt not in candidates:
                                try:
                                    t = yf.Ticker(clean_wt)
                                    hist = t.history(period=period, interval=interval)
                                    if not hist.empty and len(hist) > 0:
                                        resolved_sym = clean_wt
                                        target_ticker_obj = t
                                        for idx_ts, row in hist.iterrows():
                                            resolved_candles.append({
                                                "date": str(idx_ts).split(" ")[0].split("T")[0],
                                                "open": round(float(row["Open"]), 2),
                                                "high": round(float(row["High"]), 2),
                                                "low": round(float(row["Low"]), 2),
                                                "close": round(float(row["Close"]), 2),
                                                "volume": int(row.get("Volume", 0))
                                            })
                                        break
                                except Exception:  # noqa: BLE001
                                    continue
                except Exception:  # noqa: BLE001
                    pass

            if not resolved_sym or not resolved_candles:
                return final_response

            symbol = resolved_sym
            candles = resolved_candles
            t = target_ticker_obj or yf.Ticker(symbol)
            fast = t.fast_info

            # Retrieve rich pricing & metrics
            last_price = float(fast.get("lastPrice", 0.0) or fast.get("regularMarketPrice", 0.0))
            if not last_price and candles:
                last_price = candles[-1]["close"]

            prev_close = float(fast.get("previousClose", 0.0) or last_price)
            day_change = round(last_price - prev_close, 2)
            pct_change = round((day_change / prev_close) * 100, 2) if prev_close else 0.0

            high_52 = round(float(fast.get("yearHigh", 0.0) or last_price), 2)
            low_52 = round(float(fast.get("yearLow", 0.0) or last_price), 2)
            mkt_cap = float(fast.get("marketCap", 0.0))

            is_indian = symbol.endswith((".NS", ".BO")) or fast.get("currency") == "INR"
            curr = "₹" if is_indian else "$"
            exchange = "NSE" if symbol.endswith(".NS") else ("BSE" if symbol.endswith(".BO") else "NASDAQ/NYSE")

            # Format company name
            comp_name = None
            try:
                comp_name = t.info.get("longName") or t.info.get("shortName")
            except Exception:  # noqa: BLE001
                pass
            if not comp_name:
                comp_name = clean_ent.title()

            if day_change >= 0:
                chg_str = f"+{curr}{day_change:,.2f} (+{pct_change:.2f}%)"
            else:
                chg_str = f"-{curr}{abs(day_change):,.2f} ({pct_change:.2f}%)"

            if is_indian and mkt_cap:
                mkt_cap_str = f"₹{mkt_cap / 10000000:,.2f} Cr"
            elif mkt_cap:
                mkt_cap_str = f"${mkt_cap / 1000000000:,.2f} B"
            else:
                mkt_cap_str = "N/A"

            # Technical Pattern Recognition & Trend Analysis
            patterns_detected = []
            closes = [c["close"] for c in candles]
            highs = [c["high"] for c in candles]
            lows = [c["low"] for c in candles]

            if len(candles) >= 3:
                c2, c3 = candles[-2], candles[-1]
                body3 = abs(c3["close"] - c3["open"])
                rng3 = c3["high"] - c3["low"]
                lower_shadow3 = min(c3["open"], c3["close"]) - c3["low"]
                upper_shadow3 = c3["high"] - max(c3["open"], c3["close"])

                # Candlestick Formations
                if rng3 > 0 and (body3 / rng3) <= 0.15:
                    patterns_detected.append("**Doji / Market Indecision**: Open and close are nearly identical, showing buyers and sellers in equilibrium.")
                elif lower_shadow3 >= (2.0 * max(body3, 0.01)) and upper_shadow3 <= (0.4 * max(body3, 0.01)):
                    if c3["close"] >= c3["open"]:
                        patterns_detected.append("**Bullish Hammer**: Intraday selloff was aggressively rejected by dip buyers, signaling upside support.")
                    else:
                        patterns_detected.append("**Hanging Man**: High volatility with downward pressure testing recent support levels.")
                elif upper_shadow3 >= (2.0 * max(body3, 0.01)) and lower_shadow3 <= (0.4 * max(body3, 0.01)):
                    if c3["close"] < c3["open"]:
                        patterns_detected.append("**Bearish Shooting Star**: Push higher met immediate supply resistance, signaling potential consolidation or pullback.")
                    else:
                        patterns_detected.append("**Inverted Hammer**: Buyers attempted a recovery push off support.")

                if c3["close"] > c3["open"] and c2["close"] < c2["open"] and c3["close"] >= c2["open"] and c3["open"] <= c2["close"]:
                    patterns_detected.append("**Bullish Engulfing**: Current green body completely engulfs prior session red body, indicating strong buyer takeover.")
                elif c3["close"] < c3["open"] and c2["close"] > c2["open"] and c3["close"] <= c2["open"] and c3["open"] >= c2["close"]:
                    patterns_detected.append("**Bearish Engulfing**: Current red body completely engulfs prior session green body, indicating distribution.")

            # Swing & Range Structure
            if len(closes) >= 5:
                recent_high = max(highs[-5:])
                recent_low = min(lows[-5:])
                period_range = (recent_high - recent_low) / (closes[-1] if closes[-1] else 1.0)
                if period_range < 0.035:
                    patterns_detected.append(f"**Tight Consolidation Channel**: Price is coiling inside a narrow range ({curr}{recent_low:,.2f} - {curr}{recent_high:,.2f}), suggesting an imminent volatility expansion/breakout.")
                elif closes[-1] > closes[-3] > closes[-5]:
                    patterns_detected.append(f"**Ascending Structure (Higher Highs / Higher Lows)**: Consistent upward momentum sustaining above recent swing support of {curr}{recent_low:,.2f}.")
                elif closes[-1] < closes[-3] < closes[-5]:
                    patterns_detected.append(f"**Descending Structure (Lower Highs / Lower Lows)**: Sustained pullback facing resistance at {curr}{recent_high:,.2f}.")

            if not patterns_detected:
                patterns_detected.append(f"**Horizontal Range-Bound Consolidation**: Price oscillating around {curr}{last_price:,.2f} without high-probability reversal confirmation.")

            # Support & Resistance Calculation
            immediate_res = max(highs[-10:]) if len(highs) >= 10 else max(highs)
            immediate_sup = min(lows[-10:]) if len(lows) >= 10 else min(lows)
            sma_10 = round(sum(closes[-10:]) / len(closes[-10:]), 2) if len(closes) >= 10 else last_price

            trend_stance = "Bullish" if last_price >= sma_10 else ("Consolidating / Neutral" if abs(last_price - sma_10) / sma_10 < 0.015 else "Cautious / Pullback")

            chart_json = json.dumps({
                "symbol": symbol,
                "period": period,
                "interval": interval,
                "candles": candles
            }, indent=2)

            duration_ms = int((time.time() - t_start) * 1000)
            mcp_step = ExecutionStep(
                stepIndex=len(trace.steps) + 1,
                stepType="MCP_CALL",
                title=f"Executed MCP Tool via Gateway: yfinance_get_historical_data ({symbol})",
                inputPayload={"symbol_or_name": symbol, "period": period, "interval": interval},
                outputPayload={"symbol": symbol, "candles_count": len(candles), "period": period, "interval": interval},
                durationMs=duration_ms
            )
            trace.steps.append(mcp_step)

            if event_callback:
                await event_callback({
                    "event": "tool_completed",
                    "data": {
                        "tool": "yfinance_get_historical_data",
                        "input": {"symbol_or_name": symbol, "period": period, "interval": interval},
                        "output": {"symbol": symbol, "candles_count": len(candles), "period": period},
                        "durationMs": duration_ms,
                        "status": "SUCCESS",
                        "stepIndex": len(trace.steps),
                        "message": f"MCP Tool 'yfinance_get_historical_data' fulfilled for {symbol} ({len(candles)} candles)"
                    }
                })
                await event_callback({"event": "step", "data": mcp_step.model_dump()})

            # Check if user explicitly asked for text answers / concise report / no graph
            no_graph_requested = any(w in all_user_lower for w in (
                "no graph", "no chart", "don't want graph", "dont want graph", "don't want all the graph",
                "dont want all the graph", "don't want the graph", "dont want the graph", "not always a graph",
                "not a graph", "text answers", "text answer", "text only", "concise report", "i want some text answers"
            ))

            patterns_markdown = "\n".join(f"- {p}" for p in patterns_detected)

            response_sections = [
                f"## Technical & Pattern Analysis: {comp_name} ({exchange}: {symbol})\n",
                "### 1. Executive Summary & Market Stance",
                f"- **Overall Market Stance**: **{trend_stance}**",
                f"- **Current Trading Price**: **{curr}{last_price:,.2f}** ({chg_str})",
                f"- **10-Period Simple Moving Average (SMA)**: {curr}{sma_10:,.2f} ({'Trading above SMA' if last_price >= sma_10 else 'Trading below SMA'})",
                f"- **52-Week Range**: {curr}{low_52:,.2f} — {curr}{high_52:,.2f}",
                f"- **Market Capitalization**: {mkt_cap_str}\n",
                "### 2. Technical Patterns Forming",
                patterns_markdown + "\n",
                "### 3. Key Support & Resistance Levels",
                f"- **Immediate Resistance (Upper Ceiling)**: **{curr}{immediate_res:,.2f}** (Recent period swing high)",
                f"- **Immediate Support (Lower Floor)**: **{curr}{immediate_sup:,.2f}** (Recent period swing low)",
                f"- **Pivot Zone**: {curr}{round((immediate_res + immediate_sup + last_price) / 3, 2):,.2f}\n",
                "### 4. Actionable Outlook & Key Takeaways",
                f"- **Bullish Breakout Scenario**: A decisive daily close above **{curr}{immediate_res:,.2f}** with volume expansion confirms continuation towards higher targets.",
                f"- **Risk & Defense Level**: Maintain stop-loss / risk defense below **{curr}{immediate_sup:,.2f}**; a drop below this level indicates breakdown into lower liquidity pools.",
                f"- **Timeframe Evaluated**: {period.upper()} (Interval: {interval})\n"
            ]

            # If user wanted a chart, or did not explicitly reject graphs, provide interactive chart as visual complement
            if not no_graph_requested:
                response_sections.append("### 5. Interactive Candlestick Chart & Historical Price Action\n")
                response_sections.append(f"```candlestick\n{chart_json}\n```\n")
                response_sections.append(
                    "> **Interactive Chart Controls**: Use the timeframe buttons directly above the chart (**1D**, **5D**, **1M**, **3M**, **6M**, **1Y**, **5Y**, **ALL**) to dynamically load candles. You can also scroll with your mouse wheel to zoom in/out, or click and drag across the chart canvas to pan historical price action."
                )
            else:
                response_sections.append(
                    "> *Note: Visual chart graph omitted as requested. Showing concise textual technical analysis report.*"
                )

            return "\n".join(response_sections)
        except Exception as e:  # noqa: BLE001
            print(f"[_fulfill_market_query_if_needed] Failed: {e}")
            return final_response

runtime_engine = AgentRuntimeEngine()
