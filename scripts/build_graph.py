import json
from pathlib import Path


def build_codebase_graph():
    out_dir = Path("graphify-out")
    out_dir.mkdir(exist_ok=True)

    nodes = [
        {"id": "AgentOS_App", "label": "AgentOS Studio Shell", "category": "Frontend"},
        {"id": "HomeView", "label": "Home Dashboard & Analytics", "category": "Frontend"},
        {"id": "ExploreView", "label": "Explore Registry Catalog", "category": "Frontend"},
        {"id": "PlaygroundView", "label": "Interactive Agent Playground & Tracer", "category": "Frontend"},
        {"id": "AgentDetailView", "label": "Agent Studio Configuration", "category": "Frontend"},
        {"id": "FastAPI_Server", "label": "FastAPI Control & Runtime API", "category": "API"},
        {"id": "RegistryService", "label": "Registry Subsystem", "category": "ControlPlane"},
        {"id": "NL_BuilderService", "label": "NL Synthesis Engine", "category": "ControlPlane"},
        {"id": "AgentRuntimeEngine", "label": "ReAct Reasoning Runtime", "category": "Runtime"},
        {"id": "ModelRouter", "label": "Bedrock Model Adapter", "category": "Runtime"},
        {"id": "ContextManager", "label": "Dynamic 60% Context Manager", "category": "Runtime"},
        {"id": "ToolRunner", "label": "Sandboxed Tool & SSRF Runner", "category": "Runtime"},
        {"id": "MCPRouter", "label": "MCP Protocol Dispatcher", "category": "Runtime"},
        {"id": "KnowledgeRouter", "label": "Bedrock Knowledge Base RAG", "category": "Runtime"},
        {"id": "AgentDelegator", "label": "Hierarchical Multi-Agent Delegator", "category": "Runtime"},
        {"id": "AgentDefinition_Spec", "label": "Canonical Declarative Agent Spec", "category": "Spec"}
    ]

    edges = [
        {"source": "AgentOS_App", "target": "HomeView", "relation": "renders"},
        {"source": "AgentOS_App", "target": "ExploreView", "relation": "renders"},
        {"source": "AgentOS_App", "target": "PlaygroundView", "relation": "renders"},
        {"source": "AgentOS_App", "target": "AgentDetailView", "relation": "renders"},
        {"source": "FastAPI_Server", "target": "RegistryService", "relation": "routes_registry"},
        {"source": "FastAPI_Server", "target": "AgentRuntimeEngine", "relation": "routes_execution"},
        {"source": "AgentRuntimeEngine", "target": "ModelRouter", "relation": "invokes_inference"},
        {"source": "AgentRuntimeEngine", "target": "ContextManager", "relation": "evaluates_token_threshold"},
        {"source": "AgentRuntimeEngine", "target": "ToolRunner", "relation": "dispatches_tools"},
        {"source": "AgentRuntimeEngine", "target": "MCPRouter", "relation": "dispatches_mcp"},
        {"source": "AgentRuntimeEngine", "target": "KnowledgeRouter", "relation": "queries_rag"},
        {"source": "AgentRuntimeEngine", "target": "AgentDelegator", "relation": "delegates_child"},
        {"source": "AgentDelegator", "target": "AgentRuntimeEngine", "relation": "recursive_execution"},
        {"source": "RegistryService", "target": "AgentDefinition_Spec", "relation": "validates_and_stores"}
    ]

    graph_data = {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "project": "AgentOS (Bedrock Canvas)",
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "generatedAt": "2026-09-01T19:47:00Z"
        }
    }

    (out_dir / "graph.json").write_text(json.dumps(graph_data, indent=2), encoding="utf-8")

    report = f"""# GRAPH_REPORT: AgentOS Platform Knowledge Graph

## Overview
- **Total Nodes:** {len(nodes)}
- **Total Relationships:** {len(edges)}
- **Architecture Paradigm:** Registry-Driven No-Code Agent Operating System

## God Nodes (Core Hubs)
1. **AgentRuntimeEngine**: Central coordinator connecting ModelRouter, ContextManager, ToolRunner, KnowledgeRouter, and AgentDelegator.
2. **RegistryService**: Single source of truth for all reusable primitives (Models, Tools, MCP, KBs, and AgentVersions).
3. **AgentOS_App**: Unified Studio frontend coordinating Simple (NL), Advanced (Canvas), and Expert (JSON) creation workflows.

## Surprising Connections
- **AgentDelegator $\\leftrightarrow$ AgentRuntimeEngine**: Recursive self-delegation loop enabled with hard depth boundary ($D_{{max}}=3$) and cycle trapping.
- **ContextManager $\\rightarrow$ AgentRuntimeEngine**: Dynamic 60% capacity threshold monitoring with automated structured state compression.

## Suggested Questions
1. "How does the ContextManager prevent loss of critical system instructions during 60% summarization?"
2. "How does AgentDelegator enforce the $D_{{max}}=3$ hierarchy limit across multi-tier child swarms?"
"""
    (out_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    print(f"Graph generated: {len(nodes)} nodes, {len(edges)} edges in graphify-out/")

if __name__ == "__main__":
    build_codebase_graph()
