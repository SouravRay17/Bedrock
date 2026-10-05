import hashlib
import time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Enums & Literals ---
ModelPricingTier = Literal["FREE_TIER_ELIGIBLE", "LOW_COST", "PAID"]
AgentStatus = Literal["DRAFT", "PUBLISHED", "ARCHIVED"]
ToolType = Literal["REST_API", "LAMBDA_FUNCTION", "MCP_TOOL", "CUSTOM_FUNCTION"]
MCPTransport = Literal["SSE", "STDIO", "STREAM"]
ExecutionStatus = Literal["PENDING", "RUNNING", "COMPLETED", "FAILED", "SUSPENDED_FOR_APPROVAL"]
StepType = Literal["THOUGHT", "TOOL_CALL", "MCP_CALL", "KB_RETRIEVAL", "CHILD_DELEGATION", "CONTEXT_COMPRESSION", "FINAL_OUTPUT", "ERROR"]

# --- Model Registry Entity ---
class ModelDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    modelId: str = Field(..., description="Unique Model identifier (e.g. amazon.nova-micro-v1:0)")
    provider: str = Field(default="bedrock", description="Model provider (bedrock, openai, anthropic)")
    displayName: str
    description: str
    maxContextTokens: int = Field(..., description="Total model context window capacity")
    pricingTier: ModelPricingTier = Field(default="FREE_TIER_ELIGIBLE")
    supportsToolCalling: bool = True
    supportsVision: bool = False
    defaultInferenceParams: dict[str, Any] = Field(default_factory=lambda: {
        "temperature": 0.1,
        "topP": 0.9,
        "maxTokens": 2048
    })

# --- Tool Registry Entities ---
class ToolAuthentication(BaseModel):
    model_config = ConfigDict(extra="allow")
    authType: str = "NONE"
    secretRef: str | None = Field(None, description="AWS Secrets Manager ARN or key reference")
    headerName: str | None = "Authorization"
    headerPrefix: str | None = "Bearer "

class ToolDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    toolId: str
    version: str = "1.0.0"
    name: str
    description: str = ""
    toolType: str = "REST_API"
    endpointUrl: str | None = None
    httpMethod: str | None = "POST"
    auth: Any | None = None
    inputSchema: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    outputSchema: dict[str, Any] | None = None
    timeoutSeconds: int = 15
    maxRetries: int = 2
    isSsrfProtected: bool = True

# --- MCP Registry Entities ---
class MCPCapability(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str
    description: str | None = None
    inputSchema: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

class MCPServerDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    serverId: str
    name: str
    description: str = ""
    transport: str = "SSE"
    endpointOrCommand: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    secretRef: str | None = None
    discoveredTools: list[MCPCapability] = Field(default_factory=list)
    securityStatus: str = "VERIFIED"

class MCPCollection(BaseModel):
    model_config = ConfigDict(extra="allow")
    collectionId: str
    name: str
    slug: str | None = None
    location: str | None = None
    description: str | None = ""
    collectionType: str = Field(default="MCP Server", description="'MCP Server' | 'OpenAPI Specification'")
    serverUrl: str | None = None
    authType: str = Field(default="None", description="Authentication type: 'None' | 'Bearer Token' | 'Basic Auth' | 'API Key Auth' | 'Client Credentials' | 'Custom'")
    authConfig: dict[str, Any] = Field(default_factory=dict)
    timeoutSeconds: int = 30
    headers: list[dict[str, str]] = Field(default_factory=list)
    servers: list[str] = Field(default_factory=list, description="List of MCPServer IDs or server names")
    discoveredTools: list[dict[str, Any]] = Field(default_factory=list, description="Tools formatted as AWS Bedrock Converse toolSpec")
    whitelistedToolNames: list[str] = Field(default_factory=list)
    codePath: str | None = Field(None, description="Local source code path or repository folder")
    lastSyncedAt: float | None = Field(None, description="Timestamp of last synchronization")
    lastSyncedStr: str | None = Field(None, description="Human readable last sync timestamp")
    syncHistory: list[dict[str, Any]] = Field(default_factory=list, description="History log of synchronizations")
    createdAt: float = Field(default_factory=time.time)

# --- Group & Scoped Workspace Entities ---
class VariableDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    key: str
    value: str
    isSecret: bool = True
    desc: str | None = ""

class GroupChildren(BaseModel):
    model_config = ConfigDict(extra="allow")
    agents: list[dict[str, Any]] = Field(default_factory=list)
    models: list[dict[str, Any]] = Field(default_factory=list)
    tools: list[dict[str, Any]] = Field(default_factory=list)
    mcps: list[dict[str, Any]] = Field(default_factory=list)
    collections: list[dict[str, Any]] = Field(default_factory=list)
    knowledge: list[dict[str, Any]] = Field(default_factory=list)

class GroupDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    type: str = "Group"
    slug: str
    description: str = ""
    createdAt: str = ""
    owner: dict[str, Any] = Field(default_factory=lambda: {"name": "Admin User", "email": "admin@agentos.io", "role": "Owner", "avatar": "AD"})
    maintainers: list[dict[str, Any]] = Field(default_factory=list)
    members: list[dict[str, Any]] = Field(default_factory=list)
    variables: list[VariableDefinition] = Field(default_factory=list)
    children: GroupChildren = Field(default_factory=GroupChildren)
    services: list[dict[str, Any]] = Field(default_factory=list)
    policies: list[dict[str, Any]] = Field(default_factory=list)

# --- Knowledge Base Entity ---
class KnowledgeBaseDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    kbId: str
    name: str
    description: str = ""
    bedrockKbId: str | None = None
    s3BucketUri: str | None = None
    embeddingModel: str = "amazon.titan-embed-text-v2:0"
    chunkingStrategy: str = "SEMANTIC"
    chunkMaxTokens: int = 512
    chunkOverlapTokens: int = 100
    topK: int = 4
    scoreThreshold: float = 0.70

# --- Child Agent Delegation Contract ---
class ChildAgentContract(BaseModel):
    childAgentId: str
    childVersion: str = "latest"
    delegationTrigger: str = Field(..., description="Natural language instructions guiding when to delegate")
    inputMappingSchema: dict[str, Any] = Field(default_factory=dict)
    outputValidationSchema: dict[str, Any] | None = None
    timeoutSeconds: int = 60
    maxRetries: int = 1

# --- Context Management Policy ---
class ContextPolicy(BaseModel):
    strategy: Literal["adaptive", "sliding_summary", "fifo"] = "adaptive"
    compressionThreshold: float = Field(default=0.60, description="Trigger summarization at 60% of model limit")
    preserveDirectives: bool = True
    preserveStateVariables: bool = True
    retainedRecentTurns: int = 2

# --- Memory Configuration ---
class MemoryConfig(BaseModel):
    type: Literal["BUFFER_WINDOW", "SUMMARY_STATE", "PERSISTENT_KV"] = "SUMMARY_STATE"
    sessionTtlSeconds: int = 86400
    persistState: bool = True

# --- Guardrail Configuration ---
class GuardrailConfig(BaseModel):
    guardrailId: str | None = None
    guardrailVersion: str | None = "DRAFT"
    maskPii: bool = True
    blockPromptInjection: bool = True

# --- Runtime Limits ---
class RuntimeLimits(BaseModel):
    maxExecutionSteps: int = 15
    timeoutSeconds: int = 300
    budgetLimitTokens: int = 50000
    maxHierarchyDepth: int = 3

# --- Canonical Agent Definition ---
class AgentDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")
    agentId: str
    projectId: str = "default_project"
    orgId: str = "default_org"
    name: str
    group: str | None = "Default Workspace"
    slug: str | None = None
    description: str = "Custom AI agent created in AgentOS."
    instructions: str = "You are a helpful and intelligent AI agent. Follow instructions carefully and accomplish the requested goals with precision."
    model: dict[str, Any] = Field(default_factory=lambda: {
        "provider": "bedrock",
        "modelId": "amazon.nova-micro-v1:0"
    })
    inputs: dict[str, Any] = Field(default_factory=lambda: {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "User request or task objective"}
        },
        "required": ["query"]
    })
    outputs: dict[str, Any] = Field(default_factory=lambda: {
        "type": "object",
        "properties": {
            "response": {"type": "string"}
        }
    })
    tools: list[str] = Field(default_factory=list, description="Tool IDs")
    mcpCollections: list[str] = Field(default_factory=list, description="MCP Collection IDs")
    knowledgeBases: list[str] = Field(default_factory=list, description="Knowledge Base IDs")
    childAgents: list[ChildAgentContract] = Field(default_factory=list)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    contextPolicy: ContextPolicy = Field(default_factory=ContextPolicy)
    guardrails: GuardrailConfig = Field(default_factory=GuardrailConfig)
    runtime: RuntimeLimits = Field(default_factory=RuntimeLimits)

    def compute_digest(self) -> str:
        """Compute SHA-256 digest of normalized JSON content for immutability check."""
        serialized = self.model_dump_json(exclude={"agentId", "projectId", "orgId"})
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

# --- Immutable Agent Version ---
class AgentVersion(BaseModel):
    model_config = ConfigDict(extra="allow")
    agentId: str
    version: str  # e.g. "1.0.0"
    digestSha256: str
    definition: AgentDefinition
    createdAt: float = Field(default_factory=time.time)
    publishedBy: str = "user_system"
    status: AgentStatus = "PUBLISHED"

# --- Execution & Tracing Models ---
class ExecutionStep(BaseModel):
    model_config = ConfigDict(extra="allow")
    stepIndex: int
    stepType: StepType
    title: str
    inputPayload: Any | None = None
    outputPayload: Any | None = None
    tokensUsed: int = 0
    durationMs: int = 0
    timestamp: float = Field(default_factory=time.time)

class ExecutionTrace(BaseModel):
    model_config = ConfigDict(extra="allow")
    executionId: str
    agentId: str
    version: str
    sessionId: str
    status: ExecutionStatus = "PENDING"
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] | None = None
    steps: list[ExecutionStep] = Field(default_factory=list)
    totalTokens: int = 0
    contextUsagePercent: float = 0.0
    contextCompressedCount: int = 0
    startedAt: float = Field(default_factory=time.time)
    completedAt: float | None = None
    error: str | None = None

# --- Thread & Session Persistence Models ---
class ThreadMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    role: str # "user" | "assistant" | "system" | "tool"
    content: str
    time: str | None = None
    citations: list[str] | None = Field(default_factory=list)

class ThreadMetrics(BaseModel):
    model_config = ConfigDict(extra="allow")
    totalTokens: int = 0
    promptTokens: int = 0
    completionTokens: int = 0
    costIncurred: float = 0.0
    latency: str = "0.00s"
    status: str = "Completed"

class ThreadSession(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    title: str
    agentId: str | None = None
    agent: str = "Agent"
    agentModel: str = "Amazon Nova Micro"
    agentIcon: str = "forum"
    lastMessage: str = ""
    timestamp: str = ""
    tokens: str = "0"
    duration: str = "0.00s"
    status: str = "Completed"
    citations: list[str] = Field(default_factory=list)
    messages: list[ThreadMessage] = Field(default_factory=list)
    metrics: ThreadMetrics | None = None
    activeTrace: ExecutionTrace | None = None
    createdAt: float = Field(default_factory=time.time)
    updatedAt: float = Field(default_factory=time.time)

