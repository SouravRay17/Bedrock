import json
import re
import time
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

        # Agent Identity & Connected MCP Awareness
        identity_directive = (
            f"### AGENT IDENTITY & CONNECTED CAPABILITIES\n"
            f"You are '{agent_def.name}', an enterprise autonomous AI agent built on AgentOS Studio.\n"
            f"When users ask about your identity, what tools or capabilities you have, or what you are connected to (such as MCPs, servers, or APIs):\n"
            f"- Explicitly reference the connected MCP collections and tools configured for you in `<connected_resources>`.\n"
            f"- List the connected MCPs and available tools clearly.\n"
            f"- Never say you have no connections or affiliations when tools and MCP collections are configured."
        )
        prompt_parts.append(identity_directive)

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
            kb_part = "<knowledge_context>\n" + "\n".join(f"[{idx+1}] {c.get('content')}" for idx, c in enumerate(kb_chunks)) + "\n</knowledge_context>"
            prompt_parts.append(kb_part)


        # Universal AI Data Visualization Protocol
        prompt_parts.append(
            "<visualization_capabilities>\n"
            "When presenting numeric, multi-metric, or structured findings (sales, distributions, latency, benchmarks, financials, etc.):\n"
            "You can provide a clean ```graph code block with JSON containing:\n"
            "  - `title`: Short descriptive title of the insight\n"
            "  - `graphType`: Recommended visualization ('bar' | 'line' | 'area' | 'donut' | 'scatter' | 'radar' | 'heatmap' | 'candlestick' | 'table')\n"
            "  - `recommendationReason`: Brief explanation of why this graph type best reveals the patterns in this data\n"
            "  - `data`: Array of structured records or series\n"
            "The AgentOS UI will render this graph interactively and allow users to switch between visualization representations.\n"
            "</visualization_capabilities>"
        )

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


runtime_engine = AgentRuntimeEngine()
