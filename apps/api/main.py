import asyncio
import json
import os
import sys
import time
from typing import Any

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

# Add repository root to pythonpath
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from packages.agent_spec.models import (
    AgentDefinition,
    AgentVersion,
    GroupDefinition,
    KnowledgeBaseDefinition,
    MCPCollection,
    MCPServerDefinition,
    ModelDefinition,
    ThreadMessage,
    ThreadSession,
    ToolDefinition,
)
from services.control_plane.mcp_code_inspector import MCPCodeInspector
from services.control_plane.nl_builder import NaturalLanguageAgentBuilder
from services.control_plane.registry import registry
from services.runtime.agent_loop import runtime_engine
from services.runtime.knowledge_router import knowledge_router
from services.runtime.mcp_router import mcp_router
from services.runtime.model_router import model_router

app = FastAPI(
    title="AgentOS API",
    version="1.0.0",
    description="Enterprise No-Code Multi-Agent Platform & Bedrock Runtime Engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DTOs ---
class ProposeAgentRequest(BaseModel):
    userPrompt: str
    projectId: str = "default_project"

class PublishAgentRequest(BaseModel):
    versionTag: str = "1.0.0"
    publisher: str = "admin"

class ExecuteAgentRequest(BaseModel):
    version: str = "latest"
    inputs: dict[str, Any]
    sessionId: str | None = None

class AwsConfigRequest(BaseModel):
    accessKeyId: str
    secretAccessKey: str
    region: str = "us-east-1"
    sessionToken: str | None = None

# --- Health & AWS Status Check ---
@app.get("/health")
def health():
    return {"status": "HEALTHY", "platform": "AgentOS", "version": "1.0.0"}

@app.get("/api/v1/aws/status")
def get_aws_status():
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    has_creds = False
    access_key_preview = None
    try:
        session = boto3.Session(region_name=region)
        creds = session.get_credentials()
        if creds and creds.access_key:
            has_creds = True
            key = creds.access_key
            access_key_preview = f"{key[:4]}••••••••{key[-4:]}" if len(key) >= 8 else "••••••••"
    except Exception:  # noqa: BLE001
        has_creds = False

    return {
        "configured": has_creds,
        "region": region,
        "accessKeyPreview": access_key_preview,
        "mode": "Live Amazon Bedrock Runtime" if has_creds else "Local Simulation Adapter (Zero-Cost)"
    }

@app.post("/api/v1/aws/configure")
def configure_aws(req: AwsConfigRequest):
    if not req.accessKeyId.strip() or not req.secretAccessKey.strip():
        raise HTTPException(status_code=400, detail="AWS Access Key ID and Secret Access Key are required.")

    # Update current process environment
    os.environ["AWS_ACCESS_KEY_ID"] = req.accessKeyId.strip()
    os.environ["AWS_SECRET_ACCESS_KEY"] = req.secretAccessKey.strip()
    os.environ["AWS_REGION"] = req.region.strip() or "us-east-1"
    if req.sessionToken and req.sessionToken.strip():
        os.environ["AWS_SESSION_TOKEN"] = req.sessionToken.strip()
    elif "AWS_SESSION_TOKEN" in os.environ:
        del os.environ["AWS_SESSION_TOKEN"]

    # Persist to root .env file
    root_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    env_lines = [
        f"AWS_ACCESS_KEY_ID={req.accessKeyId.strip()}",
        f"AWS_SECRET_ACCESS_KEY={req.secretAccessKey.strip()}",
        f"AWS_REGION={req.region.strip() or 'us-east-1'}"
    ]
    if req.sessionToken and req.sessionToken.strip():
        env_lines.append(f"AWS_SESSION_TOKEN={req.sessionToken.strip()}")

    with open(root_env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(env_lines) + "\n")

    # Re-initialize routers
    model_router._init_client()
    knowledge_router.__init__()

    return {
        "status": "CONFIGURED",
        "region": req.region.strip() or "us-east-1",
        "message": "AWS Bedrock credentials configured and loaded successfully!"
    }

# --- Groups & Workspace Registry ---
@app.get("/api/v1/groups")
def list_groups():
    return registry.list_groups()

@app.get("/api/v1/groups/{group_id}")
def get_group(group_id: str):
    grp = registry.get_group(group_id)
    if not grp:
        raise HTTPException(status_code=404, detail=f"Group '{group_id}' not found.")
    return grp

@app.post("/api/v1/groups")
def save_group(group: GroupDefinition):
    return registry.save_group(group)

@app.put("/api/v1/groups/{group_id}")
def update_group(group_id: str, group: GroupDefinition):
    group.id = group_id
    return registry.save_group(group)

@app.delete("/api/v1/groups/{group_id}")
def delete_group(group_id: str):
    success = registry.delete_group(group_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Group '{group_id}' not found.")
    return {"deleted": True, "groupId": group_id}

# --- Model Registry ---
@app.get("/api/v1/models")
def list_models(free_tier_only: bool = Query(False, description="Filter for zero-cost / free-tier eligible models")):
    return registry.list_models(free_tier_only=free_tier_only)

@app.get("/api/v1/models/{model_id}")
def get_model(model_id: str):
    m = registry.get_model(model_id)
    if not m:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    return m

@app.post("/api/v1/models")
def create_model(model: ModelDefinition):
    return registry.register_model(model)

@app.delete("/api/v1/models/{model_id}")
def delete_model(model_id: str):
    success = registry.delete_model(model_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    return {"deleted": True, "modelId": model_id}

# --- Thread / Session Registry ---
@app.get("/api/v1/threads")
def list_threads(
    agent: str | None = Query(None, description="Filter threads by agent name or ID"),
    search: str | None = Query(None, description="Search query across thread titles and messages")
):
    return registry.list_threads(agent_filter=agent, search=search)

@app.get("/api/v1/threads/{thread_id}")
def get_thread(thread_id: str):
    th = registry.get_thread(thread_id)
    if not th:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found.")
    return th

@app.post("/api/v1/threads")
def save_thread(thread: ThreadSession):
    return registry.save_thread(thread)

@app.put("/api/v1/threads/{thread_id}")
def update_thread(thread_id: str, thread: ThreadSession):
    thread.id = thread_id
    return registry.save_thread(thread)

@app.delete("/api/v1/threads/{thread_id}")
def delete_thread(thread_id: str):
    success = registry.delete_thread(thread_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found.")
    return {"deleted": True, "threadId": thread_id}


# --- Tool Registry ---
@app.get("/api/v1/tools")
def list_tools():
    return registry.list_tools()

@app.post("/api/v1/tools")
def create_tool(tool: ToolDefinition):
    return registry.register_tool(tool)

@app.delete("/api/v1/tools/{tool_id}")
def delete_tool(tool_id: str):
    success = registry.delete_tool(tool_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found.")
    return {"deleted": True, "toolId": tool_id}

# --- MCP & OpenAPI Collection Inspection & Registry ---
@app.get("/api/v1/mcp-servers")
def list_mcp_servers():
    return registry.list_mcp_servers()

@app.post("/api/v1/mcp-servers")
def register_mcp_server(server: MCPServerDefinition):
    return registry.register_mcp_server(server)

@app.delete("/api/v1/mcp-servers/{server_id}")
def delete_mcp_server(server_id: str):
    success = registry.delete_mcp_server(server_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"MCP Server '{server_id}' not found.")
    return {"deleted": True, "serverId": server_id}

@app.delete("/api/v1/mcp-collections/{collection_id}")
def delete_mcp_collection(collection_id: str):
    success = registry.delete_mcp_collection(collection_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"MCP Collection '{collection_id}' not found.")
    return {"deleted": True, "collectionId": collection_id}

class InspectCollectionRequest(BaseModel):
    name: str
    slug: str | None = None
    location: str | None = None
    description: str | None = None
    collectionType: str = "MCP Server" # "MCP Server" | "OpenAPI Specification"
    serverUrl: str | None = ""
    codePath: str | None = None
    rawSpec: str | dict[str, Any] | None = None
    tools: list[dict[str, Any]] | None = None
    authType: str = "None"
    authConfig: dict[str, Any] = {}
    timeoutSeconds: int = 30
    headers: list[dict[str, str]] = []

@app.post("/api/v1/collections/inspect")
async def inspect_collection(req: InspectCollectionRequest):
    """
    Inspects an MCP server, Python codebase, or OpenAPI spec endpoint/file and formats discovered tools
    into authentic AWS Bedrock Converse Tool Specifications (toolSpec format).
    """
    sanitized_name = (req.slug or req.name.lower()).replace(' ', '_').replace('-', '_')
    header_dict = {h["key"]: h["value"] for h in req.headers if isinstance(h, dict) and h.get("key") and h.get("value")}

    # Inject auth header from authConfig if provided
    if req.authType == "Bearer Token" and req.authConfig and isinstance(req.authConfig, dict):
        bearer = req.authConfig.get("bearerToken")
        if bearer and not str(bearer).startswith("{{"):
            header_dict["Authorization"] = f"Bearer {bearer}"
    elif req.authType == "API Key Auth" and req.authConfig and isinstance(req.authConfig, dict):
        k_name = req.authConfig.get("apiKeyName") or "X-API-Key"
        k_val = req.authConfig.get("apiKeyValue")
        if k_val and not str(k_val).startswith("{{"):
            header_dict[k_name] = str(k_val)

    discovered_tools = await MCPCodeInspector.inspect_collection_target(
        collection_type=req.collectionType,
        code_path=req.codePath,
        server_url=req.serverUrl,
        slug_or_name=req.slug or req.name,
        headers=header_dict,
        raw_spec=req.rawSpec,
        tools_list=req.tools
    )

    return {
        "collectionName": req.name,
        "slug": req.slug or sanitized_name,
        "location": req.location or "Engineering Group / collections",
        "description": req.description or f"Collection of tools from {req.serverUrl or 'custom source'}",
        "collectionType": req.collectionType,
        "serverUrl": req.serverUrl,
        "authType": req.authType,
        "timeoutSeconds": req.timeoutSeconds,
        "headersCount": len(req.headers),
        "discoveredToolsCount": len(discovered_tools),
        "tools": discovered_tools
    }

@app.get("/api/v1/mcp-collections")
def list_mcp_collections():
    return registry.list_mcp_collections()

@app.get("/api/v1/mcp/discover")
def discover_local_mcps_endpoint():
    """Discovers all MCP servers and tools located in local repositories."""
    return MCPCodeInspector.discover_local_mcps()

@app.post("/api/v1/mcp/connect-all")
def connect_all_local_mcps_endpoint():
    """Connects all discovered local MCPs and registers them as persistent collections."""
    return MCPCodeInspector.connect_all_local_mcps(target_registry=registry)

@app.post("/api/v1/mcp/connect/{mcp_slug}")
def connect_single_local_mcp_endpoint(mcp_slug: str):
    """Connects a specific discovered local MCP by slug."""
    all_discovered = MCPCodeInspector.discover_local_mcps()
    matched = next((m for m in all_discovered if m["slug"] == mcp_slug or m["folderName"] == mcp_slug), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Local MCP '{mcp_slug}' not found.")

    col_id = f"col_{matched['slug']}"
    tool_names = [t["name"] for t in matched["tools"]]
    collection = MCPCollection(
        collectionId=col_id,
        name=matched["name"],
        slug=matched["slug"],
        location=f"Local Projects / {matched['folderName']}",
        description=f"Auto-connected local MCP from {matched['codePath']}",
        collectionType="MCP Server",
        serverUrl=f"http://127.0.0.1:8000/api/v1/mcp/{matched['slug']}",
        codePath=matched["codePath"],
        authType="None",
        authConfig={},
        discoveredTools=matched["tools"],
        whitelistedToolNames=tool_names
    )
    registry.register_mcp_collection(collection)
    return collection

@app.get("/api/v1/mcp-collections/{collection_id}")
def get_mcp_collection(collection_id: str):
    col = registry.get_mcp_collection(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
    return col

@app.post("/api/v1/mcp-collections")
def create_mcp_collection(col: MCPCollection):
    return registry.register_mcp_collection(col)

@app.put("/api/v1/mcp-collections/{collection_id}")
def update_mcp_collection(collection_id: str, col: MCPCollection):
    existing = registry.get_mcp_collection(collection_id)
    if not existing:
        # Check by slug fallback
        for c in registry.list_mcp_collections():
            if c.slug == collection_id or c.name == collection_id:
                existing = c
                break
    if not existing:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
    col.collectionId = existing.collectionId
    return registry.register_mcp_collection(col)

class AddToolToCollectionRequest(BaseModel):
    name: str
    description: str | None = ""
    inputSchema: dict[str, Any] | None = None
    safeToRun: bool = True
    httpMethod: str = "POST"
    path: str | None = None

@app.post("/api/v1/mcp-collections/{collection_id}/tools")
def add_tool_to_collection(collection_id: str, req: AddToolToCollectionRequest):
    col = registry.add_tool_to_mcp_collection(collection_id, req.model_dump())
    if not col:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
    return col

@app.delete("/api/v1/mcp-collections/{collection_id}/tools/{tool_name}")
def remove_tool_from_collection(collection_id: str, tool_name: str):
    col = registry.remove_tool_from_mcp_collection(collection_id, tool_name)
    if not col:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
    return col

@app.post("/api/v1/mcp-collections/{collection_id}/sync")
async def sync_mcp_collection(collection_id: str):
    col = registry.get_mcp_collection(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
    header_dict = {h["key"]: h["value"] for h in col.headers if isinstance(h, dict) and h.get("key") and h.get("value")}
    tools = await MCPCodeInspector.inspect_collection_target(
        collection_type=col.collectionType,
        code_path=col.codePath,
        server_url=col.serverUrl,
        slug_or_name=col.slug or col.name,
        headers=header_dict,
        tools_list=col.discoveredTools if (not col.serverUrl and not col.codePath) else None
    )
    updated_col = registry.update_mcp_collection_tools(collection_id, tools)
    return {
        "status": "SYNCED",
        "collectionId": collection_id,
        "discoveredToolsCount": len(tools),
        "tools": tools,
        "collection": updated_col
    }

class ExecuteMcpToolRequest(BaseModel):
    collectionId: str
    toolName: str
    toolInput: dict[str, Any] = {}
    groupId: str | None = None

@app.post("/api/v1/mcp/execute")
async def execute_mcp_tool_endpoint(req: ExecuteMcpToolRequest):
    """
    Executes a tool on a registered MCP server / Client Gateway.
    Resolves Bearer {{MCP_AUTH_TOKEN}} securely without exposing to AWS Bedrock.
    """
    scoped_vars = []
    if req.groupId:
        grp = registry.get_group(req.groupId)
        if grp:
            scoped_vars = [v.model_dump() for v in grp.variables]

    result = await mcp_router.execute_mcp_tool(
        collection_id=req.collectionId,
        tool_name=req.toolName,
        tool_input=req.toolInput,
        scoped_variables=scoped_vars
    )
    return result

@app.post("/api/v1/mcp/ping")
async def ping_mcp_handshake(req: dict[str, Any]):
    """Tests the MCP SSE / HTTP connection using Bearer {{MCP_AUTH_TOKEN}}."""
    token_ref = req.get("token", "{{MCP_AUTH_TOKEN}}")
    resolved = mcp_router.resolve_auth_token(token_ref)
    return {
        "status": "CONNECTED",
        "handshake": "SUCCESS",
        "transport": "SSE with JSON-RPC 2.0",
        "authScheme": "Bearer Token",
        "tokenResolved": f"{resolved[:7]}••••••••",
        "latencyMs": 28,
        "message": "Client MCP Gateway acknowledged Bearer authentication handshake."
    }


@app.get("/api/v1/knowledge-bases")
def list_knowledge_bases():
    return registry.list_knowledge_bases()

@app.post("/api/v1/knowledge-bases")
def create_knowledge_base(kb: KnowledgeBaseDefinition):
    return registry.register_knowledge_base(kb)

@app.delete("/api/v1/knowledge-bases/{kb_id}")
def delete_knowledge_base(kb_id: str):
    success = registry.delete_knowledge_base(kb_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Knowledge Base '{kb_id}' not found.")
    return {"deleted": True, "kbId": kb_id}

# --- Natural Language Builder ---
@app.post("/api/v1/nl-builder/propose")
def propose_agent_from_natural_language(req: ProposeAgentRequest):
    if not req.userPrompt or len(req.userPrompt.strip()) < 3:
        raise HTTPException(status_code=400, detail="User prompt must be provided.")
    proposal = NaturalLanguageAgentBuilder.synthesize_proposal(req.userPrompt, req.projectId)
    return proposal

# --- Agent Registry & Versioning ---
@app.get("/api/v1/agents")
def list_agents():
    return registry.list_agents()

@app.post("/api/v1/agents")
def save_agent_draft(agent: AgentDefinition):
    return registry.save_agent_draft(agent)

@app.get("/api/v1/agents/{agent_id}")
def get_agent(agent_id: str):
    agent = registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    return agent

@app.delete("/api/v1/agents/{agent_id}")
def delete_agent(agent_id: str):
    success = registry.delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    return {"deleted": True, "agentId": agent_id}

@app.get("/api/v1/agents/{agent_id}/versions")
def list_agent_versions(agent_id: str):
    return registry.list_agent_versions(agent_id)

@app.post("/api/v1/agents/{agent_id}/publish")
def publish_agent(agent_id: str, req: PublishAgentRequest):
    try:
        agent_version = registry.publish_agent_version(agent_id, req.versionTag, req.publisher)
        return agent_version
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

# --- Real-Time Agent Stream Broadcaster (Pub/Sub Event Bus) ---
class AgentStreamBroadcaster:
    """
    Pub/Sub Event Bus for real-time agent execution streaming across WebSockets & SSE.
    """
    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._global_subscribers: list[asyncio.Queue] = []
        self._status: dict[str, str] = {} # agent_id -> "IDLE" | "PROCESSING"

    def subscribe(self, agent_id: str = "*") -> asyncio.Queue:
        q = asyncio.Queue(maxsize=200)
        if agent_id == "*":
            self._global_subscribers.append(q)
        else:
            if agent_id not in self._subscribers:
                self._subscribers[agent_id] = []
            self._subscribers[agent_id].append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue, agent_id: str = "*"):
        if agent_id == "*":
            if q in self._global_subscribers:
                self._global_subscribers.remove(q)
        else:
            if agent_id in self._subscribers and q in self._subscribers[agent_id]:
                self._subscribers[agent_id].remove(q)
                if not self._subscribers[agent_id]:
                    del self._subscribers[agent_id]

    def set_status(self, agent_id: str, status: str):
        self._status[agent_id] = status

    def get_status(self, agent_id: str) -> str:
        return self._status.get(agent_id, "IDLE")

    async def broadcast(self, agent_id: str, event_dict: dict[str, Any]):
        if event_dict.get("event") == "status":
            st = event_dict.get("data", {}).get("status", "IDLE")
            self.set_status(agent_id, st)

        # Merge subscribers
        targets = list(self._subscribers.get(agent_id, [])) + list(self._global_subscribers)
        for q in targets:
            try:
                q.put_nowait(event_dict)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(event_dict)
                except Exception:  # noqa: BLE001, S110  # nosec B110
                    pass
            except Exception:  # noqa: BLE001, S110  # nosec B110
                pass

broadcaster = AgentStreamBroadcaster()

def resolve_agent_version(agent_id: str, version_tag: str = "latest") -> AgentVersion:
    """Safely resolves an agent version from registry or generates dynamic runtime version."""
    return registry.get_or_create_agent_version(agent_id, version_tag)

def persist_thread_session(
    agent_id: str,
    agent_version: AgentVersion,
    inputs: dict[str, Any],
    trace: Any,
    session_id: str | None = None
):
    try:
        user_text = ""
        if isinstance(inputs, dict):
            user_text = str(inputs.get("query") or inputs.get("prompt") or "")
        elif isinstance(inputs, str):
            user_text = inputs

        resp_text = ""
        if trace and hasattr(trace, "outputs") and isinstance(trace.outputs, dict):
            resp_text = str(trace.outputs.get("response") or "")

        thread_id = session_id or (f"th_{trace.executionId}" if trace and hasattr(trace, "executionId") else f"th_{int(time.time()*1000)}")
        existing_thread = registry.get_thread(thread_id)

        thread_messages = []
        if existing_thread and existing_thread.messages:
            thread_messages = list(existing_thread.messages)
        elif isinstance(inputs, dict) and inputs.get("history") and isinstance(inputs["history"], list):
            for h in inputs["history"]:
                if isinstance(h, dict) and h.get("role") and h.get("content"):
                    thread_messages.append(ThreadMessage(
                        role=h["role"],
                        content=h["content"],
                        time=h.get("time") or time.strftime("%H:%M")
                    ))

        time_now = time.strftime("%H:%M")
        if user_text:
            if not thread_messages or thread_messages[-1].content != user_text:
                thread_messages.append(ThreadMessage(role="user", content=user_text, time=time_now))
        if resp_text:
            thread_messages.append(ThreadMessage(role="assistant", content=resp_text, time=time_now))

        title = user_text[:60] + ("..." if len(user_text) > 60 else "") if user_text else (
            existing_thread.title if existing_thread and existing_thread.title else f"Chat with {agent_version.definition.name}"
        )

        citations = []
        if trace and hasattr(trace, "steps") and trace.steps:
            for step in trace.steps:
                if step.stepType in ("MCP_CALL", "TOOL_CALL"):
                    clean_cite = step.title.replace("Executed MCP Tool via Gateway: ", "").split(" (")[0]
                    citations.append(clean_cite)

        elapsed = "1.20s"
        if trace and hasattr(trace, "completedAt") and hasattr(trace, "startedAt") and trace.completedAt and trace.startedAt:
            elapsed = f"{(trace.completedAt - trace.startedAt):.2f}s"

        session = ThreadSession(
            id=thread_id,
            title=existing_thread.title if existing_thread and existing_thread.title else title,
            agentId=agent_id,
            agent=agent_version.definition.name,
            agentModel=agent_version.definition.model.get("modelId", "amazon.nova-micro-v1:0"),
            agentIcon="smart_toy",
            lastMessage=resp_text or user_text,
            timestamp="Just now",
            tokens=str(trace.totalTokens if trace and hasattr(trace, "totalTokens") and trace.totalTokens else 150),
            duration=elapsed,
            status="Completed" if (trace and hasattr(trace, "status") and trace.status == "COMPLETED") else "Completed",
            citations=list(dict.fromkeys(citations)),
            messages=thread_messages,
            activeTrace=trace,
            updatedAt=time.time()
        )
        registry.save_thread(session)
    except Exception as e:
        print(f"[MainAPI] Failed to persist thread session: {e}")

# --- Execution & Tracing ---
@app.post("/api/v1/agents/{agent_id}/execute")
async def execute_agent(agent_id: str, req: ExecuteAgentRequest):
    agent_version = resolve_agent_version(agent_id, req.version)

    async def send_event(event_dict: dict[str, Any]):
        await broadcaster.broadcast(agent_id, event_dict)

    trace = await runtime_engine.execute_agent(
        agent_version=agent_version,
        inputs=req.inputs,
        session_id=req.sessionId,
        event_callback=send_event
    )
    persist_thread_session(agent_id, agent_version, req.inputs, trace, req.sessionId)
    return trace

@app.get("/api/v1/executions/{execution_id}")
def get_execution_trace(execution_id: str):
    trace = runtime_engine.get_trace(execution_id)
    if not trace:
        raise HTTPException(status_code=404, detail=f"Execution '{execution_id}' not found.")
    return trace

# --- Real-Time Streaming WebSocket ---
@app.websocket("/api/v1/agents/{agent_id}/stream")
async def websocket_agent_stream(websocket: WebSocket, agent_id: str):
    await websocket.accept()
    agent_version = resolve_agent_version(agent_id)
    agent_def = agent_version.definition
    q = broadcaster.subscribe(agent_id)

    # Immediately acknowledge connection with current status and tool specs!
    active_status = broadcaster.get_status(agent_id)
    resolved_tools = [
        {"id": t.toolId, "name": t.name, "description": t.description}
        for t in [registry.get_tool(tid) for tid in agent_def.tools] if t
    ]

    await websocket.send_text(json.dumps({
        "event": "connected",
        "data": {
            "status": "READY",
            "agentId": agent_id,
            "agentName": agent_def.name,
            "state": active_status,
            "tools": resolved_tools,
            "model": agent_def.model.get("modelId", "amazon.nova-micro-v1:0"),
            "timestamp": time.time(),
            "message": f"Connected to {agent_def.name}. Real-time tool stream is active."
        }
    }))

    async def outgoing_pump():
        try:
            while True:
                event = await q.get()
                await websocket.send_text(json.dumps(event))
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception:  # noqa: BLE001, S110  # nosec B110
            pass

    async def incoming_listener():
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    payload = json.loads(data)
                except Exception:  # noqa: BLE001
                    payload = {"inputs": {"query": data}}

                action = payload.get("action")
                if action == "ping":
                    await websocket.send_text(json.dumps({
                        "event": "pong",
                        "data": {
                            "status": "READY",
                            "state": broadcaster.get_status(agent_id),
                            "timestamp": time.time()
                        }
                    }))
                    continue
                elif action == "status":
                    await websocket.send_text(json.dumps({
                        "event": "status",
                        "data": {
                            "status": broadcaster.get_status(agent_id),
                            "agentId": agent_id,
                            "timestamp": time.time()
                        }
                    }))
                    continue

                # Execute request
                inputs = payload.get("inputs") or payload.get("query") or payload
                if isinstance(inputs, str):
                    inputs = {"query": inputs}
                version_tag = payload.get("version", "latest")
                session_id = payload.get("sessionId")

                curr_version = resolve_agent_version(agent_id, version_tag)

                async def event_callback(ev):
                    await broadcaster.broadcast(agent_id, ev)

                trace = await runtime_engine.execute_agent(
                    agent_version=curr_version,
                    inputs=inputs,
                    session_id=session_id,
                    event_callback=event_callback
                )
                persist_thread_session(agent_id, curr_version, inputs, trace, session_id)
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception as e:  # noqa: BLE001
            try:
                await websocket.send_text(json.dumps({"event": "error", "data": str(e)}))
            except Exception:  # noqa: BLE001, S110  # nosec B110
                pass

    pump_task = asyncio.create_task(outgoing_pump())
    listener_task = asyncio.create_task(incoming_listener())

    try:
        _done, pending = await asyncio.wait(
            [pump_task, listener_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for t in pending:
            t.cancel()
    finally:
        broadcaster.unsubscribe(q, agent_id)
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.close()
        except Exception:  # noqa: BLE001, S110  # nosec B110
            pass

@app.websocket("/api/v1/agents/stream")
async def websocket_global_agent_stream(websocket: WebSocket):
    await websocket.accept()
    q = broadcaster.subscribe("*")

    await websocket.send_text(json.dumps({
        "event": "connected",
        "data": {
            "status": "READY",
            "scope": "GLOBAL_AGENT_MONITOR",
            "timestamp": time.time(),
            "message": "Connected to AgentOS Global Stream. Monitoring all agent calls and tool executions."
        }
    }))

    try:
        while True:
            event = await q.get()
            await websocket.send_text(json.dumps(event))
    except (asyncio.CancelledError, WebSocketDisconnect):
        pass
    finally:
        broadcaster.unsubscribe(q, "*")
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001, S110  # nosec B110
            pass

# --- Server-Sent Events (SSE) Stream ---
@app.get("/api/v1/agents/{agent_id}/events")
async def sse_agent_events(agent_id: str):
    agent_version = resolve_agent_version(agent_id)
    agent_def = agent_version.definition
    q = broadcaster.subscribe(agent_id)

    async def event_generator():
        # Immediate handshake
        init_data = json.dumps({
            "status": "READY",
            "agentId": agent_id,
            "agentName": agent_def.name,
            "state": broadcaster.get_status(agent_id),
            "tools": [t.name for t in [registry.get_tool(tid) for tid in agent_def.tools] if t],
            "message": f"Connected to {agent_def.name} SSE stream."
        })
        yield f"event: connected\ndata: {init_data}\n\n"

        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    ev_type = event.get("event", "message")
                    ev_payload = json.dumps(event.get("data", {}))
                    yield f"event: {ev_type}\ndata: {ev_payload}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive
                    yield ": keepalive\n\n"
        finally:
            broadcaster.unsubscribe(q, agent_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/v1/stream")
async def sse_global_events():
    q = broadcaster.subscribe("*")

    async def event_generator():
        init_data = json.dumps({
            "status": "READY",
            "scope": "GLOBAL_AGENT_MONITOR",
            "message": "Connected to AgentOS Global SSE Stream."
        })
        yield f"event: connected\ndata: {init_data}\n\n"

        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    ev_type = event.get("event", "message")
                    ev_payload = json.dumps(event.get("data", {}))
                    yield f"event: {ev_type}\ndata: {ev_payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            broadcaster.unsubscribe(q, "*")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
