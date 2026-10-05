import json
import os
import time

from packages.agent_spec.models import (
    AgentDefinition,
    AgentVersion,
    GroupChildren,
    GroupDefinition,
    KnowledgeBaseDefinition,
    MCPCollection,
    MCPServerDefinition,
    ModelDefinition,
    ThreadSession,
    ToolDefinition,
)

# In-memory + persistent JSON file-backed registry store for MVP (DynamoDB compatible schema)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "registry")
os.makedirs(DATA_DIR, exist_ok=True)

class RegistryService:
    def __init__(self):
        self._models: dict[str, ModelDefinition] = {}
        self._tools: dict[str, ToolDefinition] = {}
        self._mcp_servers: dict[str, MCPServerDefinition] = {}
        self._mcp_collections: dict[str, MCPCollection] = {}
        self._knowledge_bases: dict[str, KnowledgeBaseDefinition] = {}
        self._agents: dict[str, AgentDefinition] = {}
        self._agent_versions: dict[str, list[AgentVersion]] = {} # agentId -> list of versions
        self._groups: dict[str, GroupDefinition] = {}
        self._threads: dict[str, ThreadSession] = {}
        self._load_from_disk()
        if not self._groups:
            self._init_default_catalogs()
        self._init_default_tools_and_agents()


    def _init_default_catalogs(self):
        # 1. Zero-Cost & Enterprise Foundation Models
        self.register_model(ModelDefinition(
            modelId="amazon.nova-micro-v1:0",
            provider="bedrock",
            displayName="Amazon Nova Micro (Zero-Cost / Free-Tier Eligible)",
            description="Ultra-fast, lightweight foundation model with native tool-calling and low inference overhead.",
            maxContextTokens=128000,
            pricingTier="FREE_TIER_ELIGIBLE",
            supportsToolCalling=True,
            defaultInferenceParams={"temperature": 0.1, "topP": 0.9, "maxTokens": 2048}
        ))
        self.register_model(ModelDefinition(
            modelId="amazon.nova-lite-v1:0",
            provider="bedrock",
            displayName="Amazon Nova Lite (High Speed & Multimodal)",
            description="Cost-effective high-speed multimodal model with rich tool-calling and reasoning.",
            maxContextTokens=300000,
            pricingTier="FREE_TIER_ELIGIBLE",
            supportsToolCalling=True,
            defaultInferenceParams={"temperature": 0.1, "topP": 0.9, "maxTokens": 4096}
        ))
        self.register_model(ModelDefinition(
            modelId="amazon.nova-pro-v1:0",
            provider="bedrock",
            displayName="Amazon Nova Pro (Complex Reasoning & Coding)",
            description="Flagship multimodal foundation model optimized for multi-step reasoning, agents, and coding.",
            maxContextTokens=300000,
            pricingTier="LOW_COST",
            supportsToolCalling=True,
            defaultInferenceParams={"temperature": 0.1, "topP": 0.9, "maxTokens": 4096}
        ))
        self.register_model(ModelDefinition(
            modelId="amazon.titan-text-lite-v1",
            provider="bedrock",
            displayName="Amazon Titan Text Lite (Free-Tier Eligible)",
            description="Cost-effective text model suitable for summarization and lightweight classification tasks.",
            maxContextTokens=4096,
            pricingTier="FREE_TIER_ELIGIBLE",
            supportsToolCalling=False,
            defaultInferenceParams={"temperature": 0.2, "topP": 0.9, "maxTokens": 1024}
        ))
        self.register_model(ModelDefinition(
            modelId="anthropic.claude-3-5-sonnet",
            provider="bedrock",
            displayName="Claude 3.5 Sonnet (State-of-the-art)",
            description="Industry-leading intelligence for coding, complex multi-agent workflows, and analysis.",
            maxContextTokens=200000,
            pricingTier="PAID",
            supportsToolCalling=True,
            defaultInferenceParams={"temperature": 0.1, "topP": 0.9, "maxTokens": 4096}
        ))

        # 2. Clean Default Workspace Group (only if missing)
        if "grp_default" not in self._groups:
            self._groups["grp_default"] = GroupDefinition(
                id="grp_default",
                name="Default Workspace",
                type="Group",
                slug="default-workspace",
                description="Primary workspace for managing custom agents, tools, MCP collections, and knowledge bases.",
                createdAt=time.strftime("%Y-%m-%d"),
                owner={"name": "Admin User", "email": "admin@agentos.io", "role": "Owner", "avatar": "AD"},
                maintainers=[],
                members=[
                    {"name": "Admin User", "email": "admin@agentos.io", "role": "Owner", "avatar": "AD"}
                ],
                variables=[],
                children=GroupChildren(
                    agents=[a.model_dump() for a in self._agents.values()],
                    models=[],
                    tools=[t.model_dump() for t in self._tools.values()],
                    mcps=[],
                    collections=[c.model_dump() for c in self._mcp_collections.values()],
                    knowledge=[k.model_dump() for k in self._knowledge_bases.values()]
                ),
                services=[
                    {"name": "Amazon Bedrock Runtime", "identifier": "amazon.nova-micro-v1:0", "status": "Active (Free-Tier Eligible)"}
                ],
                policies=[]
            )
            self._save_to_disk()

    def _init_default_tools_and_agents(self):
        """Hook for default tools and agents."""
        if "tool_calculator" not in self._tools:
            self.register_tool(ToolDefinition(
                toolId="tool_calculator",
                name="calculator",
                toolType="CUSTOM_FUNCTION",
                description="Performs arithmetic operations and financial calculations.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "Mathematical expression"}
                    },
                    "required": ["expression"]
                }
            ))

        if "agent_sales_analyst" not in self._agents:
            ag = AgentDefinition(
                agentId="agent_sales_analyst",
                name="Sales Analyst",
                group="Default Workspace",
                slug="agent_sales_analyst",
                description="Analyzes sales figures and calculations.",
                instructions="You are Sales Analyst. Use the calculator tool to compute calculations.",
                tools=["tool_calculator"],
                model={"provider": "bedrock", "modelId": "amazon.nova-micro-v1:0"}
            )
            self.save_agent_draft(ag)
            self.publish_agent_version("agent_sales_analyst", "1.0.0", "system")
        else:
            ag = self._agents["agent_sales_analyst"]
            if "tool_calculator" not in ag.tools:
                ag.tools.append("tool_calculator")
                self.save_agent_draft(ag)
            if "agent_sales_analyst" in self._agent_versions:
                for ver in self._agent_versions["agent_sales_analyst"]:
                    if "tool_calculator" not in ver.definition.tools:
                        ver.definition.tools.append("tool_calculator")

    # --- Storage Persistence Helpers ---
    def _save_to_disk(self):
        try:
            state = {
                "models": {k: v.model_dump() for k, v in self._models.items()},
                "tools": {k: v.model_dump() for k, v in self._tools.items()},
                "mcp_servers": {k: v.model_dump() for k, v in self._mcp_servers.items()},
                "mcp_collections": {k: v.model_dump() for k, v in self._mcp_collections.items()},
                "knowledge_bases": {k: v.model_dump() for k, v in self._knowledge_bases.items()},
                "agents": {k: v.model_dump() for k, v in self._agents.items()},
                "agent_versions": {k: [ver.model_dump() for ver in vers] for k, vers in self._agent_versions.items()},
                "groups": {k: v.model_dump() for k, v in self._groups.items()},
                "threads": {k: v.model_dump() for k, v in self._threads.items()}
            }
            # 1. Primary persistence state
            primary_path = os.path.join(DATA_DIR, "registry_state.json")
            with open(primary_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)

            # 2. Mirror Backup Persistence
            backup_path = os.path.join(DATA_DIR, "registry_state.backup.json")
            with open(backup_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)

            # 3. Snapshot backup directory
            backup_dir = os.path.join(DATA_DIR, "backups")
            os.makedirs(backup_dir, exist_ok=True)
            daily_path = os.path.join(backup_dir, f"registry_state_{time.strftime('%Y%m%d')}.json")
            with open(daily_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
        except (OSError, json.JSONDecodeError, TypeError, ValueError, KeyError) as e:
            print(f"[RegistryService] Failed to save state: {e}")

    def _load_from_disk(self):
        filepath = os.path.join(DATA_DIR, "registry_state.json")
        backup_path = os.path.join(DATA_DIR, "registry_state.backup.json")
        target_path = filepath if os.path.exists(filepath) else (backup_path if os.path.exists(backup_path) else None)
        if not target_path:
            return
        try:
            with open(target_path, encoding="utf-8") as f:
                state = json.load(f)
            for k, v in state.get("models", {}).items():
                self._models[k] = ModelDefinition(**v)
            for k, v in state.get("tools", {}).items():
                self._tools[k] = ToolDefinition(**v)
            for k, v in state.get("mcp_servers", {}).items():
                self._mcp_servers[k] = MCPServerDefinition(**v)
            for k, v in state.get("mcp_collections", {}).items():
                self._mcp_collections[k] = MCPCollection(**v)
            for k, v in state.get("knowledge_bases", {}).items():
                self._knowledge_bases[k] = KnowledgeBaseDefinition(**v)
            for k, v in state.get("agents", {}).items():
                self._agents[k] = AgentDefinition(**v)
            for k, vers in state.get("agent_versions", {}).items():
                self._agent_versions[k] = [AgentVersion(**ver) for ver in vers]
            for k, v in state.get("groups", {}).items():
                self._groups[k] = GroupDefinition(**v)
            for k, v in state.get("threads", {}).items():
                self._threads[k] = ThreadSession(**v)

            # If no groups exist, ensure default group
            if not self._groups:
                self._init_default_catalogs()
            # Ensure default tools and agents are always populated if missing
            self._init_default_tools_and_agents()
        except (OSError, json.JSONDecodeError, TypeError, ValueError, KeyError) as e:
            print(f"[RegistryService] Failed to load state: {e}")


    # --- Model Registry ---
    def register_model(self, model: ModelDefinition) -> ModelDefinition:
        self._models[model.modelId] = model
        self._save_to_disk()
        return model

    def delete_model(self, model_id: str) -> bool:
        if model_id in self._models:
            del self._models[model_id]
            self._save_to_disk()
            return True
        return False

    def list_models(self, free_tier_only: bool = False) -> list[ModelDefinition]:
        models = list(self._models.values())
        if free_tier_only:
            return [m for m in models if m.pricingTier == "FREE_TIER_ELIGIBLE"]
        return models

    def get_model(self, model_id: str) -> ModelDefinition | None:
        return self._models.get(model_id)

    # --- Thread Registry ---
    def save_thread(self, thread: ThreadSession) -> ThreadSession:
        thread.updatedAt = time.time()
        if not thread.timestamp:
            thread.timestamp = "Just now"
        self._threads[thread.id] = thread
        self._save_to_disk()
        return thread

    def get_thread(self, thread_id: str) -> ThreadSession | None:
        return self._threads.get(thread_id)

    def list_threads(self, agent_filter: str | None = None, search: str | None = None) -> list[ThreadSession]:
        threads = list(self._threads.values())
        threads.sort(key=lambda t: t.updatedAt, reverse=True)
        if agent_filter and agent_filter != "All":
            threads = [t for t in threads if (t.agent and t.agent.lower() == agent_filter.lower()) or t.agentId == agent_filter]
        if search and search.strip():
            s = search.strip().lower()
            threads = [t for t in threads if s in t.title.lower() or s in t.lastMessage.lower() or s in t.agent.lower()]
        return threads

    def delete_thread(self, thread_id: str) -> bool:
        if thread_id in self._threads:
            del self._threads[thread_id]
            self._save_to_disk()
            return True
        return False

    # --- Tool Registry ---
    def register_tool(self, tool: ToolDefinition) -> ToolDefinition:
        self._tools[tool.toolId] = tool
        tool_data = tool.model_dump()
        target_group = tool_data.get("group") or "Default Workspace"
        matched = None
        for g in self._groups.values():
            if g.name == target_group or g.id == target_group:
                matched = g
                break
        if not matched and self._groups:
            matched = next(iter(self._groups.values()))
        if matched:
            if matched.children is None:
                matched.children = GroupChildren()
            matched.children.tools = [
                t for t in matched.children.tools
                if t.get("toolId") != tool.toolId and t.get("id") != tool.toolId
            ]
            matched.children.tools.insert(0, tool_data)
        self._save_to_disk()
        return tool

    def list_tools(self) -> list[ToolDefinition]:
        return list(self._tools.values())

    def get_tool(self, tool_id: str) -> ToolDefinition | None:
        return self._tools.get(tool_id)

    def delete_tool(self, tool_id: str) -> bool:
        deleted = False
        if tool_id in self._tools:
            del self._tools[tool_id]
            deleted = True
        # Also clean up from group children
        for g in self._groups.values():
            if g.children and g.children.tools:
                g.children.tools = [t for t in g.children.tools if (t.get("toolId") != tool_id and t.get("id") != tool_id and t.get("name") != tool_id)]
        if deleted:
            self._save_to_disk()
        return deleted

    # --- MCP Registry ---
    def register_mcp_server(self, server: MCPServerDefinition) -> MCPServerDefinition:
        self._mcp_servers[server.serverId] = server
        self._save_to_disk()
        return server

    def list_mcp_servers(self) -> list[MCPServerDefinition]:
        return list(self._mcp_servers.values())

    def get_mcp_server(self, server_id: str) -> MCPServerDefinition | None:
        if server_id in self._mcp_servers:
            return self._mcp_servers[server_id]
        for s in self._mcp_servers.values():
            if s.serverId == server_id or s.serverUrl == server_id or s.name == server_id:
                return s
        return None

    def delete_mcp_server(self, server_id: str) -> bool:
        deleted = False
        if server_id in self._mcp_servers:
            del self._mcp_servers[server_id]
            deleted = True
        for g in self._groups.values():
            if g.children and g.children.mcps:
                g.children.mcps = [m for m in g.children.mcps if (m.get("serverId") != server_id and m.get("id") != server_id and m.get("name") != server_id)]
        if deleted:
            self._save_to_disk()
        return deleted

    def register_mcp_collection(self, col: MCPCollection) -> MCPCollection:
        self._mcp_collections[col.collectionId] = col
        col_data = col.model_dump()
        target_group = col_data.get("group") or col_data.get("groupId") or "Default Workspace"
        matched = None
        for g in self._groups.values():
            if g.name == target_group or g.id == target_group:
                matched = g
                break
        if not matched and self._groups:
            matched = next(iter(self._groups.values()))
        if matched:
            if matched.children is None:
                matched.children = GroupChildren()
            matched.children.collections = [
                c for c in matched.children.collections
                if c.get("collectionId") != col.collectionId and c.get("id") != col.collectionId
            ]
            matched.children.collections.insert(0, col_data)
        self._save_to_disk()
        return col

    def list_mcp_collections(self) -> list[MCPCollection]:
        return list(self._mcp_collections.values())

    def get_mcp_collection(self, col_id: str) -> MCPCollection | None:
        return self._mcp_collections.get(col_id)

    def add_tool_to_mcp_collection(self, col_id: str, tool_data: dict) -> MCPCollection | None:
        col = self.get_mcp_collection(col_id)
        if not col:
            return None
        from services.control_plane.mcp_code_inspector import MCPCodeInspector
        normalized = MCPCodeInspector.normalize_tool_spec(tool_data)

        # Remove existing tool with same name
        col.discoveredTools = [t for t in col.discoveredTools if (t.get("name") if isinstance(t, dict) else t) != normalized["name"]]
        col.discoveredTools.append(normalized)
        if normalized["name"] not in col.whitelistedToolNames:
            col.whitelistedToolNames.append(normalized["name"])
        self.register_mcp_collection(col)
        return col

    def remove_tool_from_mcp_collection(self, col_id: str, tool_name: str) -> MCPCollection | None:
        col = self.get_mcp_collection(col_id)
        if not col:
            return None
        col.discoveredTools = [t for t in col.discoveredTools if (t.get("name") if isinstance(t, dict) else t) != tool_name]
        col.whitelistedToolNames = [n for n in col.whitelistedToolNames if n != tool_name]
        self.register_mcp_collection(col)
        return col

    def update_mcp_collection_tools(self, col_id: str, tools: list[dict]) -> MCPCollection | None:
        col = self.get_mcp_collection(col_id)
        if not col:
            return None
        from services.control_plane.mcp_code_inspector import MCPCodeInspector
        normalized = [MCPCodeInspector.normalize_tool_spec(t) for t in tools]
        col.discoveredTools = normalized
        col.whitelistedToolNames = [t["name"] for t in normalized]
        col.lastSyncedAt = time.time()
        col.lastSyncedStr = time.strftime("%Y-%m-%d %H:%M:%S")
        self.register_mcp_collection(col)
        return col

    def delete_mcp_collection(self, col_id: str) -> bool:
        deleted = False
        if col_id in self._mcp_collections:
            del self._mcp_collections[col_id]
            deleted = True
        for g in self._groups.values():
            if g.children and g.children.collections:
                g.children.collections = [c for c in g.children.collections if (c.get("collectionId") != col_id and c.get("id") != col_id and c.get("name") != col_id)]
        if deleted:
            self._save_to_disk()
        return deleted

    # --- Knowledge Registry ---
    def register_knowledge_base(self, kb: KnowledgeBaseDefinition) -> KnowledgeBaseDefinition:
        self._knowledge_bases[kb.kbId] = kb
        kb_data = kb.model_dump()
        target_group = kb_data.get("group") or kb_data.get("groupId") or "Default Workspace"
        matched = None
        for g in self._groups.values():
            if g.name == target_group or g.id == target_group:
                matched = g
                break
        if not matched and self._groups:
            matched = next(iter(self._groups.values()))
        if matched:
            if matched.children is None:
                matched.children = GroupChildren()
            matched.children.knowledge = [
                k for k in matched.children.knowledge
                if k.get("kbId") != kb.kbId and k.get("id") != kb.kbId
            ]
            matched.children.knowledge.insert(0, kb_data)
        self._save_to_disk()
        return kb

    def list_knowledge_bases(self) -> list[KnowledgeBaseDefinition]:
        return list(self._knowledge_bases.values())

    def get_knowledge_base(self, kb_id: str) -> KnowledgeBaseDefinition | None:
        return self._knowledge_bases.get(kb_id)

    def delete_knowledge_base(self, kb_id: str) -> bool:
        deleted = False
        if kb_id in self._knowledge_bases:
            del self._knowledge_bases[kb_id]
            deleted = True
        for g in self._groups.values():
            if g.children and g.children.knowledge:
                g.children.knowledge = [k for k in g.children.knowledge if (k.get("kbId") != kb_id and k.get("id") != kb_id and k.get("name") != kb_id)]
        if deleted:
            self._save_to_disk()
        return deleted

    # --- Agent Registry (Drafts & Published Immutable Versions) ---
    def save_agent_draft(self, agent: AgentDefinition) -> AgentDefinition:
        self._agents[agent.agentId] = agent
        agent_data = agent.model_dump()
        target_group = agent_data.get("group") or "Default Workspace"
        matched = None
        for g in self._groups.values():
            if g.name == target_group or g.id == target_group or g.slug == target_group:
                matched = g
                break
        if not matched and self._groups:
            matched = next(iter(self._groups.values()))
        if matched:
            if matched.children is None:
                matched.children = GroupChildren()
            matched.children.agents = [
                a for a in matched.children.agents
                if a.get("agentId") != agent.agentId and a.get("id") != agent.agentId
            ]
            matched.children.agents.insert(0, agent_data)
        self._save_to_disk()
        return agent

    def get_agent(self, agent_id: str) -> AgentDefinition | None:
        return self._agents.get(agent_id)

    def list_agents(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def delete_agent(self, agent_id: str) -> bool:
        deleted = False
        if agent_id in self._agents:
            del self._agents[agent_id]
            deleted = True
        if agent_id in self._agent_versions:
            del self._agent_versions[agent_id]
            deleted = True
        for g in self._groups.values():
            if g.children and g.children.agents:
                g.children.agents = [a for a in g.children.agents if (a.get("agentId") != agent_id and a.get("id") != agent_id and a.get("name") != agent_id)]
        if deleted:
            self._save_to_disk()
        return deleted

    def publish_agent_version(self, agent_id: str, version_tag: str, publisher: str = "admin") -> AgentVersion:
        agent = self.get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' does not exist.")

        digest = agent.compute_digest()
        agent_version = AgentVersion(
            agentId=agent_id,
            version=version_tag,
            digestSha256=digest,
            definition=agent,
            publishedBy=publisher,
            status="PUBLISHED"
        )

        if agent_id not in self._agent_versions:
            self._agent_versions[agent_id] = []

        # Overwrite or append
        self._agent_versions[agent_id] = [v for v in self._agent_versions[agent_id] if v.version != version_tag]
        self._agent_versions[agent_id].append(agent_version)
        self._save_to_disk()
        return agent_version

    def get_agent_version(self, agent_id: str, version_tag: str = "latest") -> AgentVersion | None:
        versions = self._agent_versions.get(agent_id, [])
        if not versions:
            # Fallback to current draft wrapped as version if no published version yet
            draft = self.get_agent(agent_id)
            if draft:
                return AgentVersion(
                    agentId=agent_id,
                    version="draft",
                    digestSha256=draft.compute_digest(),
                    definition=draft,
                    status="DRAFT"
                )
            return None
        if version_tag == "latest":
            return versions[-1]
        for v in versions:
            if v.version == version_tag:
                return v
        return None

    def get_or_create_agent_version(self, agent_id: str, version_tag: str = "latest") -> AgentVersion:
        """Returns existing version or synthesizes a dynamic runtime agent worker with default tools."""
        ver = self.get_agent_version(agent_id, version_tag)
        if ver:
            return ver

        # Attach default tools if available
        tools = [t.toolId for t in self.list_tools()]
        formatted_name = agent_id.replace("agent_", "").replace("_", " ").title() or "Autonomous Assistant"
        def_obj = AgentDefinition(
            agentId=agent_id,
            name=formatted_name,
            group="Default Workspace",
            slug=agent_id,
            description=f"Dynamic runtime worker: {formatted_name}",
            instructions=f"You are {formatted_name}. Reason step-by-step and execute available tools to complete tasks accurately.",
            model={"provider": "bedrock", "modelId": "amazon.nova-micro-v1:0"},
            tools=tools,
            enableReasoning=True
        )
        self.save_agent_draft(def_obj)
        return self.publish_agent_version(agent_id, version_tag or "1.0.0", "system")

    def list_agent_versions(self, agent_id: str) -> list[AgentVersion]:
        return self._agent_versions.get(agent_id, [])

    # --- Group & Scoped Workspaces Registry ---
    def list_groups(self) -> list[GroupDefinition]:
        # Always synchronize group children with live registered collections and agents
        for g in self._groups.values():
            if g.children is None:
                g.children = GroupChildren()

            # Synchronize collections
            existing_col_ids = {c.get("collectionId") or c.get("id") for c in g.children.collections if isinstance(c, dict)}
            for col_id, col in self._mcp_collections.items():
                if col_id not in existing_col_ids:
                    g.children.collections.append(col.model_dump())
                    existing_col_ids.add(col_id)

            # Synchronize agents
            existing_ag_ids = {a.get("agentId") or a.get("id") for a in g.children.agents if isinstance(a, dict)}
            for ag_id, ag in self._agents.items():
                if ag_id not in existing_ag_ids:
                    g.children.agents.append(ag.model_dump())
                    existing_ag_ids.add(ag_id)

            # Synchronize tools
            existing_t_ids = {t.get("toolId") or t.get("id") for t in g.children.tools if isinstance(t, dict)}
            for t_id, tool in self._tools.items():
                if t_id not in existing_t_ids:
                    g.children.tools.append(tool.model_dump())
                    existing_t_ids.add(t_id)

        return list(self._groups.values())

    def get_group(self, group_id: str) -> GroupDefinition | None:
        self.list_groups()  # Ensure sync before lookup
        return self._groups.get(group_id)

    def save_group(self, group: GroupDefinition) -> GroupDefinition:
        if group.id in self._groups:
            existing = self._groups[group.id]
            # Merge children collections and agents so nothing gets dropped
            if existing.children and group.children:
                curr_cols = {c.get("collectionId") or c.get("id"): c for c in group.children.collections if isinstance(c, dict)}
                for c in existing.children.collections:
                    if isinstance(c, dict):
                        cid = c.get("collectionId") or c.get("id")
                        if cid and cid not in curr_cols:
                            group.children.collections.append(c)

                curr_ags = {a.get("agentId") or a.get("id"): a for a in group.children.agents if isinstance(a, dict)}
                for a in existing.children.agents:
                    if isinstance(a, dict):
                        aid = a.get("agentId") or a.get("id")
                        if aid and aid not in curr_ags:
                            group.children.agents.append(a)

        self._groups[group.id] = group
        self._save_to_disk()
        return group

    def delete_group(self, group_id: str) -> bool:
        if group_id in self._groups:
            del self._groups[group_id]
            self._save_to_disk()
            return True
        return False

# Singleton instance
registry = RegistryService()

