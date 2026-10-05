import React, { useState, useMemo, useEffect } from 'react';

export default function AgentDetailView({ 
  agent, 
  onBack, 
  onSaveAgent, 
  onStartThread, 
  onDeleteAgent,
  availableAgents = [],
  availableTools = [],
  availableKbs = [],
  availableCollections = []
}) {
  const [activeTab, setActiveTab] = useState('connections'); // 'overview' | 'connections' | 'variables' | 'access' | 'usage' | 'history'

  // Header State
  const [isPinned, setIsPinned] = useState(false);
  const [showThreeDots, setShowThreeDots] = useState(false);

  // Form State - Left Column (Overview)
  const [name, setName] = useState(agent?.name || '');
  const [group, setGroup] = useState(agent?.group || 'Default Workspace');
  const [slug, setSlug] = useState(agent?.slug || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [tags, setTags] = useState(agent?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [agentType, setAgentType] = useState(agent?.agentType || 'Autonomous Worker');
  const [modelId, setModelId] = useState(agent?.model?.modelId || 'amazon.nova-micro-v1:0');
  const [enableReasoning, setEnableReasoning] = useState(agent?.enableReasoning ?? true);

  // Branding Accordion State (Open/Close)
  const [isBrandingOpen, setIsBrandingOpen] = useState(true);
  const [customDomain, setCustomDomain] = useState(agent?.branding?.customDomain || '');
  const [selectedTheme, setSelectedTheme] = useState(agent?.branding?.theme || 'Midnight Slate');
  const [logoPreview, setLogoPreview] = useState(agent?.branding?.logoUrl || '');

  // Advanced Options Accordion State (Open/Close)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [strategy, setStrategy] = useState(agent?.advancedOptions?.strategy || 'Summarization');
  const [threshold, setThreshold] = useState(agent?.advancedOptions?.threshold ?? 60);
  const [summarizationAgent, setSummarizationAgent] = useState(agent?.advancedOptions?.summarizationAgent || '__default__');
  const [jsonSchema, setJsonSchema] = useState(agent?.advancedOptions?.jsonSchema || '{\n  "type": "object",\n  "properties": {\n    "response": { "type": "string" }\n  }\n}');
  const [showJsonSchemaModal, setShowJsonSchemaModal] = useState(false);

  // Prompt Builder - Right Column
  const [promptSections, setPromptSections] = useState(agent?.promptSections || []);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState('');
  const [newSecContent, setNewSecContent] = useState('');

  // =========================================================================
  // CONNECTIONS TAB STATE (Clean/blank by default for new agents)
  // =========================================================================
  const [connectedTools, setConnectedTools] = useState(agent?.connectedTools || []);
  const [connectedKnowledgeBases, setConnectedKnowledgeBases] = useState(agent?.connectedKnowledgeBases || []);
  const [connectedAgents, setConnectedAgents] = useState(agent?.connectedAgents || []);
  const [connectedCollections, setConnectedCollections] = useState(agent?.connectedCollections || []);

  // Internal fetched registries fallback to ensure fresh data even if newly created
  const [internalCollections, setInternalCollections] = useState(availableCollections || []);
  const [internalAgents, setInternalAgents] = useState(availableAgents || []);
  const [internalTools, setInternalTools] = useState(availableTools || []);
  const [internalKbs, setInternalKbs] = useState(availableKbs || []);
  const [isRefreshingResources, setIsRefreshingResources] = useState(false);

  const fetchLatestResources = async () => {
    setIsRefreshingResources(true);
    try {
      const [colRes, toolRes, kbRes, agRes] = await Promise.all([
        fetch('/api/v1/mcp-collections'),
        fetch('/api/v1/tools'),
        fetch('/api/v1/knowledge-bases'),
        fetch('/api/v1/agents')
      ]);
      if (colRes.ok) {
        const cols = await colRes.json();
        setInternalCollections(cols);
      }
      if (toolRes.ok) {
        const tls = await toolRes.json();
        setInternalTools(tls);
      }
      if (kbRes.ok) {
        const k = await kbRes.json();
        setInternalKbs(k);
      }
      if (agRes.ok) {
        const ags = await agRes.json();
        setInternalAgents(ags);
      }
    } catch (e) {
      console.error('Failed to fetch latest resources:', e);
    } finally {
      setIsRefreshingResources(false);
    }
  };

  useEffect(() => {
    fetchLatestResources();
  }, []);

  useEffect(() => {
    if (availableCollections && availableCollections.length > 0) {
      setInternalCollections(availableCollections);
    }
  }, [availableCollections]);

  useEffect(() => {
    if (availableAgents && availableAgents.length > 0) {
      setInternalAgents(availableAgents);
    }
  }, [availableAgents]);

  useEffect(() => {
    if (availableTools && availableTools.length > 0) {
      setInternalTools(availableTools);
    }
  }, [availableTools]);

  useEffect(() => {
    if (availableKbs && availableKbs.length > 0) {
      setInternalKbs(availableKbs);
    }
  }, [availableKbs]);

  const effectiveCollections = useMemo(() => {
    return internalCollections.length > 0 ? internalCollections : (availableCollections || []);
  }, [internalCollections, availableCollections]);

  const effectiveAgents = useMemo(() => {
    return internalAgents.length > 0 ? internalAgents : (availableAgents || []);
  }, [internalAgents, availableAgents]);

  const effectiveTools = useMemo(() => {
    return internalTools.length > 0 ? internalTools : (availableTools || []);
  }, [internalTools, availableTools]);

  const effectiveKbs = useMemo(() => {
    return internalKbs.length > 0 ? internalKbs : (availableKbs || []);
  }, [internalKbs, availableKbs]);

  // Sync state whenever active agent prop changes or effective resources change
  useEffect(() => {
    if (agent) {
      setName(agent.name || '');
      setGroup(agent.group || 'Default Workspace');
      setSlug(agent.slug || '');
      setDescription(agent.description || '');
      setTags(agent.tags || []);
      setAgentType(agent.agentType || 'Autonomous Worker');
      setModelId(agent.model?.modelId || 'amazon.nova-micro-v1:0');
      setEnableReasoning(agent.enableReasoning ?? true);
      setCustomDomain(agent.branding?.customDomain || '');
      setSelectedTheme(agent.branding?.theme || 'Midnight Slate');
      setLogoPreview(agent.branding?.logoUrl || '');
      setPromptSections(agent.promptSections || []);

      // Hydrate connected tools
      if (agent.connectedTools && agent.connectedTools.length > 0) {
        setConnectedTools(agent.connectedTools);
      } else if (agent.tools && agent.tools.length > 0) {
        const hydratedTools = agent.tools.map((id) => {
          const found = effectiveTools.find((t) => (t.toolId || t.id) === id);
          return {
            id,
            name: found?.name || id,
            folderName: found?.location || found?.group || 'Default Workspace / tools',
            tokens: 450,
            type: found?.toolType || 'REST API',
            safeToRun: true
          };
        });
        setConnectedTools(hydratedTools);
      } else {
        setConnectedTools([]);
      }

      // Hydrate connected knowledge bases
      if (agent.connectedKnowledgeBases && agent.connectedKnowledgeBases.length > 0) {
        setConnectedKnowledgeBases(agent.connectedKnowledgeBases);
      } else if (agent.knowledgeBases && agent.knowledgeBases.length > 0) {
        const hydratedKbs = agent.knowledgeBases.map((id) => {
          const found = effectiveKbs.find((k) => (k.kbId || k.id) === id);
          return {
            id,
            name: found?.name || id,
            folderName: `${found?.group || 'Default Workspace'} / knowledge`,
            tokens: 600,
            version: 'latest',
            queryMode: 'Automatic',
            queryType: 'Hybrid (Semantic + BM25)'
          };
        });
        setConnectedKnowledgeBases(hydratedKbs);
      } else {
        setConnectedKnowledgeBases([]);
      }

      // Hydrate connected agents
      if (agent.connectedAgents && agent.connectedAgents.length > 0) {
        setConnectedAgents(agent.connectedAgents);
      } else if (agent.childAgents && agent.childAgents.length > 0) {
        const hydratedAgents = agent.childAgents.map((child) => {
          const childId = typeof child === 'string' ? child : (child.agentId || child.id);
          const found = effectiveAgents.find((a) => (a.agentId || a.id) === childId);
          return {
            id: childId,
            name: found?.name || child.name || childId,
            folderName: `${found?.group || 'Default Workspace'} / agents`,
            tokens: 500,
            version: child.version || 'latest',
            contextMode: child.contextMode || 'Forward',
            responseMode: child.responseMode || 'Synthesize'
          };
        });
        setConnectedAgents(hydratedAgents);
      } else {
        setConnectedAgents([]);
      }

      // Hydrate connected collections
      if (agent.connectedCollections && agent.connectedCollections.length > 0) {
        setConnectedCollections(agent.connectedCollections);
      } else if ((agent.mcpCollections && agent.mcpCollections.length > 0) || (agent.collections && agent.collections.length > 0)) {
        const colIds = agent.mcpCollections || agent.collections || [];
        const hydrated = colIds.map((id) => {
          const found = effectiveCollections.find((c) => (c.collectionId || c.id) === id);
          return {
            id,
            name: found?.name || id,
            folderName: found?.location || (found?.group ? `${found.group} / collections` : 'Default Workspace / collections'),
            tokens: 500,
            servers: found?.servers || (found?.serverUrl ? [found.serverUrl] : ['Custom MCP Server'])
          };
        });
        setConnectedCollections(hydrated);
      } else {
        setConnectedCollections([]);
      }
    }
  }, [agent?.agentId, agent?.id, agent?.name, effectiveCollections, effectiveTools, effectiveKbs, effectiveAgents]);

  // Add Connection Right-Side Panel State
  const [addConnType, setAddConnType] = useState('Agent'); // 'Agent' | 'Tool' | 'Knowledge Base' | 'Rule' | 'Skill' | 'Collection'
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');

  // Dynamic Add Connection Config Fields
  const [addConnVersion, setAddConnVersion] = useState('latest');
  const [addConnContextMode, setAddConnContextMode] = useState('Forward');
  const [addConnResponseMode, setAddConnResponseMode] = useState('Synthesize');
  const [addConnQueryMode, setAddConnQueryMode] = useState('Automatic');
  const [addConnQueryType, setAddConnQueryType] = useState('Hybrid (Semantic + BM25)');

  // Available Resources Catalog derived strictly from created entities
  const availableResourcesCatalog = useMemo(() => ({
    Agent: effectiveAgents
      .filter((a) => (a.agentId || a.id) !== (agent?.agentId || agent?.id))
      .map((a) => ({
        id: a.agentId || a.id,
        name: a.name || a.agentId || a.id || 'Unnamed Agent',
        folder: `${a.group || 'Default Workspace'} / agents`,
        tokens: 500
      })),
    Tool: effectiveTools.map((t) => ({
      id: t.toolId || t.id,
      name: t.name || t.toolId || t.id || 'Unnamed Tool',
      folder: `${t.location || t.group || 'Default Workspace / tools'}`,
      tokens: 450,
      type: t.toolType || 'REST API'
    })),
    'Knowledge Base': effectiveKbs.map((k) => ({
      id: k.kbId || k.id,
      name: k.name || k.kbId || k.id || 'Unnamed Knowledge Base',
      folder: `${k.group || 'Default Workspace'} / knowledge`,
      tokens: 600
    })),
    Collection: effectiveCollections.map((c) => ({
      id: c.collectionId || c.id,
      name: c.name || c.collectionId || c.id || 'Unnamed Collection',
      folder: c.location || (c.group ? `${c.group} / collections` : 'Default Workspace / collections'),
      tokens: 500,
      servers: c.servers || (c.serverUrl ? [c.serverUrl] : [])
    })),
    Rule: [],
    Skill: []
  }), [effectiveAgents, effectiveTools, effectiveKbs, effectiveCollections, agent?.agentId, agent?.id]);

  const selectedResource = useMemo(() => {
    const catalog = availableResourcesCatalog[addConnType] || [];
    return catalog.find((r) => r.id === selectedResourceId);
  }, [availableResourcesCatalog, addConnType, selectedResourceId]);

  // Context Calculations
  const maxContextWindow = 128000; // Amazon Nova Micro 128k
  const instructionTokens = useMemo(() => {
    return promptSections.reduce((acc, s) => acc + Math.max(1, Math.ceil((s.content?.length || 0) / 4)), 0);
  }, [promptSections]);

  const toolTokens = connectedTools.reduce((acc, t) => acc + (t.tokens || 0), 0);
  const kbTokens = connectedKnowledgeBases.reduce((acc, k) => acc + (k.tokens || 0), 0);
  const agentTokens = connectedAgents.reduce((acc, a) => acc + (a.tokens || 0), 0);
  const collectionTokens = connectedCollections.reduce((acc, c) => acc + (c.tokens || 0), 0);

  const totalStandingTokens = instructionTokens + toolTokens + kbTokens + agentTokens + collectionTokens;
  const freeContextTokens = Math.max(0, maxContextWindow - totalStandingTokens);

  // Percentage Calculations for Context Bar
  const instPct = ((instructionTokens / maxContextWindow) * 100).toFixed(1);
  const toolPct = ((toolTokens / maxContextWindow) * 100).toFixed(1);
  const kbPct = ((kbTokens / maxContextWindow) * 100).toFixed(1);
  const agentPct = (((agentTokens + collectionTokens) / maxContextWindow) * 100).toFixed(1);

  // Variables Tab State
  const [variables, setVariables] = useState([
    { key: 'AGENT_ENV', value: 'production', isSecret: false, desc: 'Target deployment tier' },
    { key: 'ANALYTICS_KEY', value: 'ana_sec_991823901a', isSecret: true, desc: 'Telemetry streaming secret' }
  ]);
  const [revealSecrets, setRevealSecrets] = useState({});

  const handleCopyPath = () => {
    const path = `Explore > ${group} > ${name}`;
    navigator.clipboard.writeText(path);
    alert(`Copied path to clipboard: ${path}`);
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(newTagInput.trim())) {
        setTags([...tags, newTagInput.trim()]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddPromptSection = (e) => {
    e.preventDefault();
    if (!newSecTitle.trim()) return;

    setPromptSections((prev) => [
      ...prev,
      {
        id: `sec_${Date.now()}`,
        title: newSecTitle.trim(),
        content: newSecContent.trim() || 'Provide section directives...'
      }
    ]);
    setNewSecTitle('');
    setNewSecContent('');
    setShowAddSectionModal(false);
  };

  const handleUpdatePromptSection = (id, field, value) => {
    setPromptSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleDeletePromptSection = (id) => {
    setPromptSections((prev) => prev.filter((s) => s.id !== id));
  };

  // Add Connection Handler
  const handleAddConnectionSubmit = (e) => {
    e.preventDefault();
    const catalog = availableResourcesCatalog[addConnType] || [];
    const resource = catalog.find((r) => r.id === selectedResourceId) || (selectedResourceId ? null : catalog[0]);
    if (!resource) {
      alert(`Please select a ${addConnType} resource from the list to connect.`);
      return;
    }

    if (addConnType === 'Agent') {
      if (connectedAgents.some((a) => a.id === resource.id)) {
        alert(`Agent "${resource.name}" is already connected.`);
        return;
      }
      const newAgentConn = {
        id: resource.id,
        name: resource.name,
        folderName: resource.folder,
        tokens: resource.tokens || 500,
        version: addConnVersion || 'latest',
        contextMode: addConnContextMode || 'Forward',
        responseMode: addConnResponseMode || 'Synthesize'
      };
      setConnectedAgents((prev) => [...prev, newAgentConn]);
    } else if (addConnType === 'Knowledge Base') {
      if (connectedKnowledgeBases.some((k) => k.id === resource.id)) {
        alert(`Knowledge Base "${resource.name}" is already connected.`);
        return;
      }
      const newKbConn = {
        id: resource.id,
        name: resource.name,
        folderName: resource.folder,
        tokens: resource.tokens || 600,
        version: addConnVersion || 'latest',
        queryMode: addConnQueryMode || 'Automatic',
        queryType: addConnQueryType || 'Hybrid (Semantic + BM25)'
      };
      setConnectedKnowledgeBases((prev) => [...prev, newKbConn]);
    } else if (addConnType === 'Tool') {
      if (connectedTools.some((t) => t.id === resource.id)) {
        alert(`Tool "${resource.name}" is already connected.`);
        return;
      }
      const newToolConn = {
        id: resource.id,
        name: resource.name,
        folderName: resource.folder,
        tokens: resource.tokens || 450,
        type: resource.type || 'REST API',
        safeToRun: true
      };
      setConnectedTools((prev) => [...prev, newToolConn]);
    } else if (addConnType === 'Collection') {
      if (connectedCollections.some((c) => c.id === resource.id)) {
        alert(`MCP Collection "${resource.name}" is already connected.`);
        return;
      }
      const newColConn = {
        id: resource.id,
        name: resource.name,
        folderName: resource.folder,
        tokens: resource.tokens || 500,
        servers: resource.servers || ['Custom MCP Server']
      };
      setConnectedCollections((prev) => [...prev, newColConn]);
    } else {
      alert(`Connected ${resource.name} (${addConnType}) successfully!`);
    }

    setSelectedResourceId('');
  };

  const handleSave = () => {
    const updated = {
      ...agent,
      name,
      group,
      slug,
      description,
      tags,
      agentType,
      model: {
        provider: 'bedrock',
        modelId
      },
      enableReasoning,
      branding: {
        customDomain,
        logoUrl: logoPreview,
        theme: selectedTheme
      },
      advancedOptions: {
        strategy,
        threshold,
        summarizationAgent,
        jsonSchema
      },
      promptSections,
      tools: connectedTools.map((t) => t.id),
      mcpCollections: connectedCollections.map((c) => c.id),
      collections: connectedCollections.map((c) => c.id),
      knowledgeBases: connectedKnowledgeBases.map((k) => k.id),
      childAgents: connectedAgents.map((a) => a.id),
      connectedTools,
      connectedKnowledgeBases,
      connectedAgents,
      connectedCollections
    };

    onSaveAgent(updated);
    alert(`Agent "${name}" updated successfully!`);
  };

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-3 animate-fadeIn pb-24">
      {/* Top Header Bar */}
      <div className="sticky top-0 bg-[#13131b]/95 backdrop-blur-md z-30 pb-3 mb-5 border-b border-outline-variant flex items-center justify-between">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            title="Back"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono-label text-on-surface">
            <span className="text-on-surface-variant">Explore</span>
            <span className="text-outline-variant">&gt;</span>
            <span className="text-on-surface-variant font-medium">{group}</span>
            <span className="text-outline-variant">&gt;</span>
            <span className="text-primary font-bold">{name}</span>
          </div>

          {/* Action Icons Next to Breadcrumb */}
          <div className="flex items-center gap-1 pl-2 border-l border-outline-variant/40">
            {/* Copy Path Icon */}
            <button
              onClick={handleCopyPath}
              className="p-1.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
              title="Copy folder path"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>

            {/* Pin Icon */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`p-1.5 rounded transition-colors ${
                isPinned ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title={isPinned ? 'Unpin Agent' : 'Pin Agent'}
            >
              <span className="material-symbols-outlined text-[16px]">push_pin</span>
            </button>

            {/* 3 Dots Menu */}
            <div className="relative">
              <button
                onClick={() => setShowThreeDots(!showThreeDots)}
                className="p-1.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                title="More actions"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>

              {showThreeDots && (
                <div className="absolute left-0 mt-1 w-44 bg-surface-container border border-outline-variant rounded-xl shadow-2xl z-50 p-1.5 space-y-1 text-xs font-mono-label animate-fadeIn">
                  <button
                    onClick={() => {
                      setShowThreeDots(false);
                      onStartThread(agent);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-container-highest text-on-surface text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">chat</span>
                    Start Thread
                  </button>

                  <button
                    onClick={() => {
                      setShowThreeDots(false);
                      alert(`Duplicated ${name} as draft.`);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-container-highest text-on-surface text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
                    Duplicate
                  </button>

                  <button
                    onClick={() => {
                      setShowThreeDots(false);
                      const target = prompt("Move to which group?", "Customer Success Group");
                      if (target) setGroup(target);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-container-highest text-on-surface text-left"
                  >
                    <span className="material-symbols-outlined text-[16px] text-tertiary">drive_file_move</span>
                    Move
                  </button>

                  <button
                    onClick={() => {
                      setShowThreeDots(false);
                      navigator.clipboard.writeText(agent?.agentId || 'agent_id_sample');
                      alert("Copied Agent ID!");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-container-highest text-on-surface text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                    Copy ID
                  </button>

                  <div className="h-px bg-outline-variant/40 my-1"></div>

                  <button
                    onClick={() => {
                      setShowThreeDots(false);
                      if (confirm(`Are you sure you want to delete ${name}?`)) {
                        onDeleteAgent && onDeleteAgent(agent?.agentId);
                        onBack();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-red-500/10 text-red-400 text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Right Save & Test Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartThread(agent)}
            className="px-3.5 py-1.5 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded-lg text-xs font-mono-label text-on-surface flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-400">play_arrow</span>
            Test Thread
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-1.5 bg-primary text-on-primary hover:bg-primary-fixed-dim rounded-lg text-xs font-mono-label font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(192,193,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Agent
          </button>
        </div>
      </div>

      {/* The 6 Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6 pb-1">
        {[
          { id: 'overview', label: 'Overview', icon: 'info' },
          { id: 'connections', label: 'Connections', icon: 'hub' },
          { id: 'variables', label: 'Variables', icon: 'key' },
          { id: 'access', label: 'Access', icon: 'shield' },
          { id: 'usage', label: 'Usage', icon: 'analytics' },
          { id: 'history', label: 'History', icon: 'history' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-surface-container/60'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          {/* Top Identifier Summary */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider block">Agent Identifier</span>
              <h2 className="text-base font-bold text-on-surface">{name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant text-[11px] font-mono-code text-primary">
                {group} / {slug}
              </span>
            </div>
          </div>

          {/* 2-Column Split: Left Side (Configurations) + Right Side (Prompt Builder) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* ---------------- LEFT SIDE ---------------- */}
            <div className="md:col-span-6 space-y-5">
              
              {/* Core Attributes Card */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5 font-mono-label pb-2 border-b border-outline-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-primary">settings_suggest</span>
                  Agent Parameters
                </h3>

                {/* Description */}
                <div>
                  <label className="block text-on-surface font-medium mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-on-surface font-medium mb-1">Tags</label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-container-lowest border border-outline-variant rounded-lg">
                    {tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-mono-label text-primary flex items-center gap-1 border border-outline-variant">
                        #{t}
                        <button type="button" onClick={() => handleRemoveTag(t)} className="text-on-surface-variant hover:text-red-400">
                          <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="Add tag and hit Enter..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="bg-transparent border-none text-[11px] text-on-surface focus:outline-none focus:ring-0 p-0.5 min-w-[120px]"
                    />
                  </div>
                </div>

                {/* Agent Type & Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Agent Type</label>
                    <select
                      value={agentType}
                      onChange={(e) => setAgentType(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="Autonomous Worker">Autonomous Worker</option>
                      <option value="Chat Assistant">Chat Assistant</option>
                      <option value="Synthesizer">Synthesizer</option>
                      <option value="Router">Classification Router</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-on-surface font-medium mb-1">Foundation Model</label>
                    <select
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-primary font-mono-code text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="amazon.nova-micro-v1:0">Amazon Nova Micro (Free-Tier)</option>
                      <option value="amazon.titan-text-lite-v1">Amazon Titan Text Lite</option>
                      <option value="anthropic.claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="openai.gpt-4o">GPT-4o</option>
                    </select>
                  </div>
                </div>

                {/* Enable Reasoning Toggle */}
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[16px]">psychology</span>
                      Enable Reasoning
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Allows the model to think through complex problems step by step before responding.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={enableReasoning}
                      onChange={(e) => setEnableReasoning(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Branding Section (Collapsible Accordion) */}
              <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsBrandingOpen(!isBrandingOpen)}
                  className="w-full p-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary">palette</span>
                    <span className="font-bold text-xs text-on-surface font-mono-label uppercase">Branding & White-Label</span>
                  </div>
                  <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transform transition-transform ${isBrandingOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {isBrandingOpen && (
                  <div className="p-5 border-t border-outline-variant/30 space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-on-surface font-medium mb-1">Custom Domain</label>
                      <input
                        type="text"
                        placeholder="e.g. analyst.company.com"
                        value={customDomain}
                        onChange={(e) => setCustomDomain(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-on-surface font-medium mb-1">Agent Logo</label>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-primary font-bold">
                          {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-lg" /> : 'LOGO'}
                        </div>
                        <label className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-highest hover:bg-surface-variant text-on-surface cursor-pointer text-xs font-mono-label">
                          <span>Upload Logo</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setLogoPreview(URL.createObjectURL(e.target.files[0]));
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-on-surface font-medium mb-2">Branding Theme (4 Choices)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: 'Midnight Slate', desc: 'Dark theme with indigo & violet accents' },
                          { name: 'Cyber Neon', desc: 'High-contrast cyan and purple matrix' },
                          { name: 'Steel Minimalist', desc: 'Clean slate monochromatic styling' },
                          { name: 'Warm Amber', desc: 'Executive gold and amber glows' }
                        ].map((th) => (
                          <div
                            key={th.name}
                            onClick={() => setSelectedTheme(th.name)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedTheme === th.name
                                ? 'bg-surface-container-highest border-primary ring-1 ring-primary'
                                : 'bg-surface-container-lowest border-outline-variant hover:border-outline'
                            }`}
                          >
                            <div className="font-bold text-on-surface text-xs flex items-center justify-between">
                              {th.name}
                              {selectedTheme === th.name && <span className="material-symbols-outlined text-[14px] text-primary">check</span>}
                            </div>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">{th.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Options Section (Collapsible Accordion) */}
              <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full p-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-tertiary">tune</span>
                    <span className="font-bold text-xs text-on-surface font-mono-label uppercase">Advanced Options & Context Policy</span>
                  </div>
                  <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transform transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {isAdvancedOpen && (
                  <div className="p-5 border-t border-outline-variant/30 space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-on-surface font-medium mb-1">Context Management Strategy</label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface text-xs focus:outline-none focus:border-primary"
                      >
                        <option value="Summarization">Summarization</option>
                        <option value="Sliding Window">Sliding Window</option>
                        <option value="Truncate">Truncate</option>
                        <option value="Adaptive Vector Compression">Adaptive Vector Compression</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-on-surface font-medium">Compression Threshold ({threshold}%)</label>
                        <span className="text-mono-code text-primary font-bold">{threshold}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        step="5"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                      <p className="text-[10px] text-on-surface-variant mt-1">
                        Summarization triggers when remaining context drops below this percentage.
                      </p>
                    </div>

                    <div>
                      <label className="block text-on-surface font-medium mb-1">Summarization Agent</label>
                      <select
                        value={summarizationAgent}
                        onChange={(e) => setSummarizationAgent(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-primary font-mono-code text-xs focus:outline-none focus:border-primary"
                      >
                        <option value="__default__">__default__ (Amazon Nova Micro Fast Summarizer)</option>
                        <option value="agent_titan_summarizer">agent_titan_summarizer</option>
                        <option value="agent_custom_refiner">agent_custom_refiner</option>
                      </select>
                    </div>

                    <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-on-surface block">JSON Output Schema</span>
                        <span className="text-[10px] text-on-surface-variant">Enforce structured JSON output validation.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowJsonSchemaModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs font-mono-label flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">data_object</span>
                        Edit Schema
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ---------------- RIGHT SIDE: PROMPT BUILDER ---------------- */}
            <div className="md:col-span-6 space-y-4">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5 font-mono-label">
                      <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                      Instructions & Prompt Builder
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Modular prompt sections compiled dynamically into the system context.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddSectionModal(true)}
                    className="bg-primary text-on-primary hover:bg-primary-fixed px-3 py-1.5 rounded-lg text-xs font-mono-label font-bold flex items-center gap-1 shadow"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    + Add Section
                  </button>
                </div>

                <div className="space-y-3.5">
                  {promptSections.map((sec, idx) => (
                    <div key={sec.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-2 relative group hover:border-outline transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-[10px] font-mono-label text-primary font-bold">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleUpdatePromptSection(sec.id, 'title', e.target.value)}
                            className="bg-transparent font-bold text-xs text-on-surface focus:outline-none border-b border-transparent focus:border-primary font-body-md"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeletePromptSection(sec.id)}
                          className="text-on-surface-variant hover:text-red-400 p-1 rounded hover:bg-surface-container transition-colors"
                          title="Delete prompt section"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={sec.content}
                        onChange={(e) => handleUpdatePromptSection(sec.id, 'content', e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant/50 rounded p-2 text-on-surface text-xs font-mono-code focus:outline-none focus:border-primary leading-relaxed"
                        placeholder="Section instructions..."
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONNECTIONS TAB (COMPREHENSIVE 2-COLUMN WITH CONTEXT BREAKDOWN)       */}
      {/* ========================================================================= */}
      {activeTab === 'connections' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          
          {/* Top Summary: Total Counters & Model Max Context */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-outline-variant/40">
              <div>
                <span className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider block">
                  Active Connections & Standing Context
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-lg font-bold text-on-surface">
                    {totalStandingTokens.toLocaleString()} / {maxContextWindow.toLocaleString()} tokens
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                    {((totalStandingTokens / maxContextWindow) * 100).toFixed(2)}% Occupied
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-label text-on-surface-variant">Model:</span>
                <span className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant text-[11px] font-mono-code text-primary font-bold">
                  {modelId} (128k max)
                </span>
              </div>
            </div>

            {/* Context Breakdown Horizontal Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                <span>Standing Context Allocation</span>
                <span className="text-emerald-400 font-bold">{freeContextTokens.toLocaleString()} tokens free for conversation</span>
              </div>

              {/* Stacked Colored Bar */}
              <div className="h-4 w-full bg-surface-container-lowest rounded-full overflow-hidden flex border border-outline-variant/40 shadow-inner">
                {/* Instructions */}
                <div 
                  style={{ width: `${Math.max(instPct, 1)}%` }} 
                  className="bg-primary h-full transition-all duration-300 relative group"
                  title={`Instructions: ${instructionTokens} tokens`}
                ></div>
                {/* Tools */}
                <div 
                  style={{ width: `${Math.max(toolPct, 1.5)}%` }} 
                  className="bg-amber-400 h-full transition-all duration-300 relative group"
                  title={`Tools: ${toolTokens} tokens`}
                ></div>
                {/* Knowledge Base */}
                <div 
                  style={{ width: `${Math.max(kbPct, 1.5)}%` }} 
                  className="bg-emerald-400 h-full transition-all duration-300 relative group"
                  title={`Knowledge Bases: ${kbTokens} tokens`}
                ></div>
                {/* Agents & Collections */}
                <div 
                  style={{ width: `${Math.max(agentPct, 1.5)}%` }} 
                  className="bg-secondary h-full transition-all duration-300 relative group"
                  title={`Agents & Collections: ${agentTokens + collectionTokens} tokens`}
                ></div>
                {/* Free Context */}
                <div className="flex-1 bg-surface-container-highest/40 h-full"></div>
              </div>

              {/* Breakdown Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-[10px] font-mono-label">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-primary"></span>
                  <span className="text-on-surface">Instructions ({instructionTokens} tok)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400"></span>
                  <span className="text-on-surface">Tools ({toolTokens} tok)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400"></span>
                  <span className="text-on-surface">Knowledge Bases ({kbTokens} tok)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-secondary"></span>
                  <span className="text-on-surface">Agents & Collections ({agentTokens + collectionTokens} tok)</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded bg-surface-container-highest border border-outline-variant"></span>
                  <span>Free for Conversation ({freeContextTokens.toLocaleString()} tok)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Left (Current Connected Resources by Section) + Right (Add Connection Panel) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* ---------------- LEFT SIDE: CONNECTED RESOURCES ---------------- */}
            <div className="md:col-span-7 space-y-6">
              
              {/* 1. TOOLS SECTION */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">construction</span>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface font-mono-label">
                      Connected Tools ({connectedTools.length})
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {connectedTools.length === 0 ? (
                    <div className="p-4 rounded-lg bg-surface-container-lowest/50 border border-dashed border-outline-variant/60 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg mb-1 block opacity-60">construction</span>
                      <p className="text-[11px]">No tools connected. Select a tool from the catalog on the right to attach.</p>
                    </div>
                  ) : (
                    connectedTools.map((tl) => (
                      <div key={tl.id} className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-amber-400 border border-outline-variant flex-shrink-0">
                            <span className="material-symbols-outlined text-[18px]">build</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-on-surface">{tl.name}</h4>
                            <span className="text-[10px] font-mono-label text-on-surface-variant block">
                              Folder: {tl.folderName} • {tl.type}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono-code text-on-surface-variant">~{tl.tokens} tok</span>
                          <button
                            onClick={() => setConnectedTools(connectedTools.filter(t => t.id !== tl.id))}
                            className="text-on-surface-variant hover:text-red-400 p-1 rounded hover:bg-surface-container transition-colors"
                            title="Disconnect Tool"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. KNOWLEDGE BASES SECTION */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">auto_stories</span>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface font-mono-label">
                      Connected Knowledge Bases ({connectedKnowledgeBases.length})
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {connectedKnowledgeBases.length === 0 ? (
                    <div className="p-4 rounded-lg bg-surface-container-lowest/50 border border-dashed border-outline-variant/60 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg mb-1 block opacity-60">auto_stories</span>
                      <p className="text-[11px]">No knowledge bases connected. Select a KB from the catalog on the right to attach.</p>
                    </div>
                  ) : (
                    connectedKnowledgeBases.map((kb) => (
                      <div key={kb.id} className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-emerald-400 border border-outline-variant flex-shrink-0">
                              <span className="material-symbols-outlined text-[18px]">description</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-on-surface">{kb.name}</h4>
                              <span className="text-[10px] font-mono-label text-on-surface-variant block">
                                Folder: {kb.folderName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono-code text-on-surface-variant">~{kb.tokens} tok</span>
                            <button
                              onClick={() => setConnectedKnowledgeBases(connectedKnowledgeBases.filter(k => k.id !== kb.id))}
                              className="text-on-surface-variant hover:text-red-400 p-1 rounded hover:bg-surface-container transition-colors"
                              title="Disconnect Knowledge Base"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>

                        {/* Dropdown Options: Version, Query Mode, Query Type */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/30 text-[11px]">
                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Version</label>
                            <select
                              value={kb.version}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedKnowledgeBases(connectedKnowledgeBases.map(k => k.id === kb.id ? { ...k, version: v } : k));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
                            >
                              <option value="latest">latest (v2.1)</option>
                              <option value="v2.0">v2.0</option>
                              <option value="v1.0">v1.0</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Query Mode</label>
                            <select
                              value={kb.queryMode}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedKnowledgeBases(connectedKnowledgeBases.map(k => k.id === kb.id ? { ...k, queryMode: v } : k));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                            >
                              <option value="Automatic">Automatic (Prompt)</option>
                              <option value="On-Demand">On-Demand Only</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Query Type</label>
                            <select
                              value={kb.queryType}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedKnowledgeBases(connectedKnowledgeBases.map(k => k.id === kb.id ? { ...k, queryType: v } : k));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                            >
                              <option value="Hybrid (Semantic + BM25)">Hybrid (Vector + BM25)</option>
                              <option value="Vector Dense">Vector Dense Semantic</option>
                              <option value="Keyword Sparse">Keyword Sparse (BM25)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. AGENTS SECTION */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface font-mono-label">
                      Connected Agents ({connectedAgents.length})
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {connectedAgents.length === 0 ? (
                    <div className="p-4 rounded-lg bg-surface-container-lowest/50 border border-dashed border-outline-variant/60 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg mb-1 block opacity-60">smart_toy</span>
                      <p className="text-[11px]">No sub-agents connected. Select an agent from the catalog on the right to attach.</p>
                    </div>
                  ) : (
                    connectedAgents.map((ag) => (
                      <div key={ag.id} className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary border border-outline-variant flex-shrink-0">
                              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-on-surface">{ag.name}</h4>
                              <span className="text-[10px] font-mono-label text-on-surface-variant block">
                                Folder: {ag.folderName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono-code text-on-surface-variant">~{ag.tokens} tok</span>
                            <button
                              onClick={() => setConnectedAgents(connectedAgents.filter(a => a.id !== ag.id))}
                              className="text-on-surface-variant hover:text-red-400 p-1 rounded hover:bg-surface-container transition-colors"
                              title="Disconnect Agent"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>

                        {/* Dropdown Options: Version, Context Mode (Default Forward), Response Mode (Default Synthesize) */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/30 text-[11px]">
                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Version</label>
                            <select
                              value={ag.version}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedAgents(connectedAgents.map(a => a.id === ag.id ? { ...a, version: v } : a));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
                            >
                              <option value="latest">latest (v1.4)</option>
                              <option value="v1.3">v1.3</option>
                              <option value="v1.0">v1.0</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Context Mode</label>
                            <select
                              value={ag.contextMode}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedAgents(connectedAgents.map(a => a.id === ag.id ? { ...a, contextMode: v } : a));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                            >
                              <option value="Forward">Forward (Default)</option>
                              <option value="Isolate">Isolate</option>
                              <option value="Summarized Only">Summarized Only</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Response Mode</label>
                            <select
                              value={ag.responseMode}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConnectedAgents(connectedAgents.map(a => a.id === ag.id ? { ...a, responseMode: v } : a));
                              }}
                              className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                            >
                              <option value="Synthesize">Synthesize (Default)</option>
                              <option value="Pass-Through Raw">Pass-Through Raw</option>
                              <option value="Structured Append">Structured Append</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. MCP COLLECTIONS SECTION */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">layers</span>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface font-mono-label">
                      Connected MCP Collections ({connectedCollections.length})
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {connectedCollections.length === 0 ? (
                    <div className="p-4 rounded-lg bg-surface-container-lowest/50 border border-dashed border-outline-variant/60 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg mb-1 block opacity-60">layers</span>
                      <p className="text-[11px]">No MCP collections connected. Select a collection from the catalog on the right to attach.</p>
                    </div>
                  ) : (
                    connectedCollections.map((col) => {
                      const fullCol = effectiveCollections.find(c => (c.collectionId || c.id) === col.id);
                      const colTools = fullCol?.discoveredTools || [];

                      return (
                        <div key={col.id} className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-secondary border border-outline-variant flex-shrink-0">
                                <span className="material-symbols-outlined text-[18px]">hub</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-on-surface">{col.name}</h4>
                                <span className="text-[10px] font-mono-label text-on-surface-variant block">
                                  Folder: {col.folderName} • Servers: {col.servers?.join(', ') || 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20 text-[10px] font-mono-label font-bold">
                                {colTools.length > 0 ? `${colTools.length} Tools Active` : `~${col.tokens} tok`}
                              </span>
                              <button
                                onClick={() => setConnectedCollections(connectedCollections.filter(c => c.id !== col.id))}
                                className="text-on-surface-variant hover:text-red-400 p-1 rounded hover:bg-surface-container transition-colors"
                                title="Disconnect Collection"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          </div>

                          {/* List of tools inherited from this collection */}
                          {colTools.length > 0 && (
                            <div className="pt-2 border-t border-outline-variant/30">
                              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block mb-1">
                                Inherited Tools ({colTools.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {colTools.map((t, tidx) => (
                                  <span
                                    key={tidx}
                                    className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-[10px] font-mono-code text-primary flex items-center gap-1"
                                    title={t.description || t.name}
                                  >
                                    <span className="material-symbols-outlined text-[11px] text-amber-400">build</span>
                                    {t.name || t.toolId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ---------------- RIGHT SIDE: ADD CONNECTIONS DIALOG BOX ---------------- */}
            <div className="md:col-span-5">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-lg space-y-4 sticky top-20">
                <div className="pb-3 border-b border-outline-variant/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">add_link</span>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface font-mono-label">
                      Add Connection
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Attach tools, knowledge, agents, rules, skills, or collections.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddConnectionSubmit} className="space-y-4">
                  {/* Type Selector Dropdown */}
                  <div>
                    <label className="block text-on-surface font-medium mb-1 font-mono-label text-xs">
                      Connection Type
                    </label>
                    <select
                      value={addConnType}
                      onChange={(e) => {
                        setAddConnType(e.target.value);
                        setSelectedResourceId('');
                      }}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                    >
                      <option value="Agent">Agent</option>
                      <option value="Tool">Tool</option>
                      <option value="Knowledge Base">Knowledge Base</option>
                      <option value="Rule">Rule</option>
                      <option value="Skill">Skill</option>
                      <option value="Collection">Collection</option>
                    </select>
                  </div>

                  {/* Resource Search Bar */}
                  <div>
                    <label className="block text-on-surface font-medium mb-1 font-mono-label text-xs">
                      Search Resource by Name
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-on-surface-variant text-[16px]">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder={`Search ${addConnType} by name...`}
                        value={resourceSearchQuery}
                        onChange={(e) => setResourceSearchQuery(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md"
                      />
                    </div>
                  </div>

                  {/* Resource Selector Dropdown / List */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-on-surface font-medium font-mono-label text-xs">
                        Select {addConnType} Resource
                      </label>
                      <button
                        type="button"
                        onClick={fetchLatestResources}
                        disabled={isRefreshingResources}
                        className="text-[10px] text-primary hover:text-primary-fixed-dim flex items-center gap-1 font-mono-label transition-colors disabled:opacity-50"
                        title="Refresh resources from registry"
                      >
                        <span className={`material-symbols-outlined text-[13px] ${isRefreshingResources ? 'animate-spin' : ''}`}>
                          sync
                        </span>
                        {isRefreshingResources ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    <select
                      value={selectedResourceId}
                      onChange={(e) => setSelectedResourceId(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-primary font-bold focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Choose {addConnType} --</option>
                      {(availableResourcesCatalog[addConnType] || [])
                        .filter(r => (r.name || '').toLowerCase().includes(resourceSearchQuery.toLowerCase()))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.folder})
                          </option>
                        ))}
                    </select>
                    {(availableResourcesCatalog[addConnType] || []).length === 0 && (
                      <div className="mt-2 p-2.5 rounded bg-surface-container-lowest border border-amber-500/30 text-amber-400 text-[11px] flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[15px] flex-shrink-0 mt-0.5">info</span>
                        <span>
                          No {addConnType}s found in registry. Create one in <strong>Explore</strong> or click <strong>Refresh</strong> above.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Configurations for Selected Type */}
                  
                  {/* If Agent is selected */}
                  {addConnType === 'Agent' && (
                    <div className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg space-y-3 animate-fadeIn">
                      <span className="text-[10px] font-mono-label text-primary uppercase font-bold block">
                        Agent Attachment Parameters
                      </span>

                      <div>
                        <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Version</label>
                        <select
                          value={addConnVersion}
                          onChange={(e) => setAddConnVersion(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface font-mono-code focus:outline-none focus:border-primary"
                        >
                          <option value="latest">latest (default)</option>
                          <option value="v1.4">v1.4</option>
                          <option value="v1.0">v1.0</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Context Mode</label>
                          <select
                            value={addConnContextMode}
                            onChange={(e) => setAddConnContextMode(e.target.value)}
                            className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          >
                            <option value="Forward">Forward (default)</option>
                            <option value="Isolate">Isolate</option>
                            <option value="Summarized Only">Summarized Only</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Response Mode</label>
                          <select
                            value={addConnResponseMode}
                            onChange={(e) => setAddConnResponseMode(e.target.value)}
                            className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          >
                            <option value="Synthesize">Synthesize (default)</option>
                            <option value="Pass-Through Raw">Pass-Through Raw</option>
                            <option value="Structured Append">Structured Append</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If Knowledge Base is selected */}
                  {addConnType === 'Knowledge Base' && (
                    <div className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg space-y-3 animate-fadeIn">
                      <span className="text-[10px] font-mono-label text-emerald-400 uppercase font-bold block">
                        Knowledge Base Query Parameters
                      </span>

                      <div>
                        <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Version</label>
                        <select
                          value={addConnVersion}
                          onChange={(e) => setAddConnVersion(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface font-mono-code focus:outline-none focus:border-primary"
                        >
                          <option value="latest">latest (default)</option>
                          <option value="v2.1">v2.1</option>
                          <option value="v1.0">v1.0</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Query Mode</label>
                          <select
                            value={addConnQueryMode}
                            onChange={(e) => setAddConnQueryMode(e.target.value)}
                            className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          >
                            <option value="Automatic">Automatic (default)</option>
                            <option value="On-Demand">On-Demand Only</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono-label text-on-surface-variant mb-0.5">Query Type</label>
                          <select
                            value={addConnQueryType}
                            onChange={(e) => setAddConnQueryType(e.target.value)}
                            className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          >
                            <option value="Hybrid (Semantic + BM25)">Hybrid (default)</option>
                            <option value="Vector Dense">Vector Dense</option>
                            <option value="Keyword Sparse">Keyword BM25</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If Collection is selected */}
                  {addConnType === 'Collection' && (
                    <div className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg space-y-3 animate-fadeIn">
                      <span className="text-[10px] font-mono-label text-secondary uppercase font-bold block flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">layers</span>
                        MCP Collection Info
                      </span>
                      {selectedResource ? (
                        <div className="space-y-2 text-on-surface-variant">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-on-surface-variant">Name:</span>
                            <span className="text-on-surface font-semibold">{selectedResource.name}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-on-surface-variant">Folder:</span>
                            <span className="font-mono-code text-[10px]">{selectedResource.folder}</span>
                          </div>
                          {selectedResource.servers && selectedResource.servers.length > 0 && (
                            <div className="text-[11px] pt-1 border-t border-outline-variant/30">
                              <span className="text-on-surface-variant block mb-1">Server Endpoint:</span>
                              <div className="space-y-1">
                                {selectedResource.servers.map((srv, idx) => (
                                  <div key={idx} className="bg-surface-container p-1.5 rounded font-mono-code text-[10px] text-primary truncate">
                                    {srv}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-[10px] text-on-surface-variant/80 mt-1">
                            Attaching this MCP collection provides this agent direct runtime access to its discovered tools and protocol endpoints.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-on-surface-variant">
                          Select an MCP collection from the dropdown above to view details and attach it.
                        </p>
                      )}
                    </div>
                  )}

                  {/* If Tool is selected */}
                  {addConnType === 'Tool' && selectedResource && (
                    <div className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg space-y-2 animate-fadeIn">
                      <span className="text-[10px] font-mono-label text-amber-400 uppercase font-bold block">
                        Tool Info
                      </span>
                      <div className="flex justify-between text-[11px] text-on-surface-variant">
                        <span>Type:</span>
                        <span className="text-on-surface font-semibold">{selectedResource.type || 'REST API'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-on-surface-variant">
                        <span>Folder:</span>
                        <span className="font-mono-code text-[10px]">{selectedResource.folder}</span>
                      </div>
                    </div>
                  )}

                  {/* Add Connection Action Button */}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary text-on-primary hover:bg-primary-fixed-dim rounded-lg font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,193,255,0.25)] flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    + Add Connection
                  </button>
                </form>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VARIABLES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'variables' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">key</span>
              Agent Scoped Variables
            </h2>
            <div className="divide-y divide-outline-variant/30">
              {variables.map((v, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div className="font-mono-code font-bold text-primary">{v.key}</div>
                  <div className="font-mono-code text-on-surface">
                    {v.isSecret ? (revealSecrets[v.key] ? v.value : '••••••••••••••••') : v.value}
                  </div>
                  <button
                    onClick={() => setRevealSecrets((prev) => ({ ...prev, [v.key]: !prev[v.key] }))}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">{revealSecrets[v.key] ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ACCESS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">shield</span>
              Access & Governance
            </h2>
            <p className="text-on-surface-variant">Owner: <strong>admin@agentos.io</strong> (Full Authority)</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. USAGE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'usage' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block mb-1">Total Requests</span>
              <span className="text-xl font-bold text-on-surface font-mono-code">1,240</span>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block mb-1">Tokens Processed</span>
              <span className="text-xl font-bold text-primary font-mono-code">48.2k</span>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block mb-1">Avg Latency</span>
              <span className="text-xl font-bold text-on-surface font-mono-code">1.82s</span>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block mb-1">Estimated Cost</span>
              <span className="text-xl font-bold text-emerald-400 font-mono-code">$0.000 (Free-Tier)</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. HISTORY TAB */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">history</span>
              Revision & Execution History
            </h2>
            <div className="space-y-2">
              <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center">
                <span>Version 1.4 — Updated Tool Call Directives</span>
                <span className="text-mono-code text-on-surface-variant">Just now</span>
              </div>
              <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/30 flex justify-between items-center">
                <span>Version 1.3 — Enabled Extended Reasoning Mode</span>
                <span className="text-mono-code text-on-surface-variant">1d ago</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PROMPT SECTION */}
      {/* ========================================================================= */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">add_circle</span>
                Add Prompt Section
              </h3>
              <button onClick={() => setShowAddSectionModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddPromptSection} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface mb-1 font-medium">Section Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tone of Voice or Escalation Policy"
                  value={newSecTitle}
                  onChange={(e) => setNewSecTitle(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2.5 text-on-surface focus:outline-none focus:border-primary font-body-md"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Section Description / Directives</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the instructions and rules for this section..."
                  value={newSecContent}
                  onChange={(e) => setNewSecContent(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="px-4 py-2 rounded bg-surface-container-highest text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-primary text-on-primary font-semibold hover:bg-primary-fixed"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: JSON SCHEMA EDITOR */}
      {/* ========================================================================= */}
      {showJsonSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-lg w-full shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">data_object</span>
                JSON Output Schema
              </h3>
              <button onClick={() => setShowJsonSchemaModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-on-surface-variant text-[11px]">
                Define JSON schema constraints that the model output will be structured against.
              </p>
              <textarea
                rows={10}
                value={jsonSchema}
                onChange={(e) => setJsonSchema(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-mono-code font-mono-code text-primary text-xs focus:outline-none focus:border-primary"
                spellCheck="false"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowJsonSchemaModal(false)}
                  className="px-5 py-2 rounded bg-primary text-on-primary font-semibold hover:bg-primary-fixed"
                >
                  Apply Schema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
