import React, { useState, useEffect } from 'react';
import CreateAgentModal from './CreateAgentModal';
import CreateCollectionModal from './CreateCollectionModal';
import CreateKbModal from './CreateKbModal';

export default function ExploreView({ 
  onSelectAgent, 
  onOpenCreateTool,
  onSelectTool,
  onSelectMcp,
  onSelectKb,
  onRefreshRegistries
}) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [overviewComponentFilter, setOverviewComponentFilter] = useState('all');
  const [childrenFilter, setChildrenFilter] = useState('all');
  const [componentSearch, setComponentSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  // Modals & Menus
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showGroupCreateMenu, setShowGroupCreateMenu] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateKbModal, setShowCreateKbModal] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [showAddVariableModal, setShowAddVariableModal] = useState(false);
  const [selectedCollectionForSpec, setSelectedCollectionForSpec] = useState(null);
  const [revealSecrets, setRevealSecrets] = useState({});

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Variable Form State
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarDesc, setNewVarDesc] = useState('');
  const [newVarIsSecret, setNewVarIsSecret] = useState(true);

  // Clean initial default groups fallback
  const initialDefaultGroups = [
    {
      id: 'grp_default',
      name: 'Default Workspace',
      type: 'Group',
      slug: 'default-workspace',
      description: 'Primary workspace for managing custom agents, tools, MCP collections, and knowledge bases.',
      createdAt: new Date().toISOString().split('T')[0],
      owner: { name: 'Admin User', email: 'admin@agentos.io', role: 'Owner', avatar: 'AD' },
      maintainers: [],
      members: [
        { name: 'Admin User', email: 'admin@agentos.io', role: 'Owner', avatar: 'AD' }
      ],
      variables: [],
      children: {
        agents: [],
        models: [],
        tools: [],
        mcps: [],
        collections: [],
        knowledge: []
      },
      services: [
        { name: 'Amazon Bedrock Runtime', identifier: 'amazon.nova-micro-v1:0', status: 'Active (Free-Tier Eligible)' }
      ],
      policies: []
    }
  ];

  // Groups Data with API Backend Persistence
  const [groups, setGroups] = useState(initialDefaultGroups);
  const [loading, setLoading] = useState(false);

  // Load groups from backend API on mount
  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/groups');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setGroups(data);
        }
      }
    } catch (err) {
      console.error('Failed to load groups from API:', err);
    } finally {
      setLoading(false);
    }
  };

  const [connectingMcps, setConnectingMcps] = useState(false);
  const [connectFeedback, setConnectFeedback] = useState(null);

  // Auto-connect all local MCP servers from D:\Projects\MCPs and D:\Projects
  const handleConnectAllLocalMcps = async () => {
    setConnectingMcps(true);
    setConnectFeedback(null);
    try {
      const res = await fetch('/api/v1/mcp/connect-all', { method: 'POST' });
      if (res.ok) {
        const connectedList = await res.json();
        const count = Array.isArray(connectedList) ? connectedList.length : 0;
        setConnectFeedback(`Connected ${count} local MCP package(s) with full tool specifications!`);
        setTimeout(() => setConnectFeedback(null), 6000);
        await loadGroups();
        if (onRefreshRegistries) {
          onRefreshRegistries();
        }
      } else {
        setConnectFeedback('Failed to connect local MCPs. Check backend logs.');
        setTimeout(() => setConnectFeedback(null), 5000);
      }
    } catch (err) {
      console.error('Failed to connect all local MCPs:', err);
      setConnectFeedback('Network error while discovering local MCPs.');
      setTimeout(() => setConnectFeedback(null), 5000);
    } finally {
      setConnectingMcps(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const activeGroupData = groups.find((g) => g.id === selectedGroup) || groups[0];

  // Helper to persist group to backend
  const persistGroup = async (groupObj) => {
    try {
      await fetch('/api/v1/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupObj)
      });
    } catch (err) {
      console.error('Failed to persist group to backend:', err);
    }
  };

  // --- Handlers for Agent, KB, Collection, Tool, Group Creation ---
  const handleCreateAgentFromModal = async (newAgent) => {
    const targetGroupId = selectedGroup || groups[0]?.id;
    const updatedGroups = groups.map((g) => {
      if (g.id === targetGroupId || g.name === newAgent.group) {
        return {
          ...g,
          children: {
            ...g.children,
            agents: [newAgent, ...(g.children?.agents || []).filter(a => (a.agentId || a.id) !== newAgent.agentId)]
          }
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    setShowCreateAgentModal(false);

    // 1. Save agent to backend agent registry
    try {
      await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      if (onRefreshRegistries) {
        onRefreshRegistries();
      }
    } catch (err) {
      console.error('Failed to persist agent to agent registry:', err);
    }

    // 2. Persist updated group
    const targetGroup = updatedGroups.find(g => g.id === targetGroupId || g.name === newAgent.group);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }

    // 3. Directly open the created agent in AgentDetailView
    onSelectAgent(newAgent);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const slug = newGroupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newGrp = {
      id: `grp_${Date.now().toString().slice(-4)}`,
      name: newGroupName.trim(),
      type: 'Group',
      slug: slug,
      description: newGroupDesc || 'Custom workspace group for scoped agents, tools, and MCP collections.',
      createdAt: new Date().toISOString().split('T')[0],
      owner: { name: 'Admin User', email: 'admin@agentos.io', role: 'Owner', avatar: 'AD' },
      maintainers: [],
      members: [{ name: 'Admin User', email: 'admin@agentos.io', role: 'Owner', avatar: 'AD' }],
      variables: [],
      children: {
        agents: [],
        models: [],
        tools: [],
        mcps: [],
        collections: [],
        knowledge: []
      },
      services: [{ name: 'Amazon Bedrock Runtime', identifier: 'amazon.nova-micro-v1:0', status: 'Active (Free-Tier Eligible)' }],
      policies: []
    };

    const updated = [newGrp, ...groups];
    setGroups(updated);
    setNewGroupName('');
    setNewGroupDesc('');
    setShowCreateGroupModal(false);
    setSelectedGroup(newGrp.id);

    await persistGroup(newGrp);
  };

  const handleDeleteGroup = async (groupId, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await fetch(`/api/v1/groups/${groupId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete group on backend:', err);
    }

    const remaining = groups.filter(g => g.id !== groupId);
    setGroups(remaining.length > 0 ? remaining : initialDefaultGroups);
    if (selectedGroup === groupId) {
      setSelectedGroup(null);
    }
  };

  const handleKbCreatedFromModal = async (newKbObj) => {
    const targetGroupId = selectedGroup || groups[0]?.id;
    const updatedGroups = groups.map((g) => {
      if (g.id === targetGroupId || g.name === newKbObj.group) {
        return {
          ...g,
          children: {
            ...g.children,
            knowledge: [newKbObj, ...(g.children?.knowledge || []).filter(k => (k.kbId || k.id) !== (newKbObj.kbId || newKbObj.id))]
          }
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    setShowCreateKbModal(false);

    // 1. Save KB to knowledge base registry
    try {
      await fetch('/api/v1/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKbObj)
      });
      if (onRefreshRegistries) {
        onRefreshRegistries();
      }
    } catch (err) {
      console.error('Failed to persist KB:', err);
    }

    // 2. Persist updated group
    const targetGroup = updatedGroups.find(g => g.id === targetGroupId || g.name === newKbObj.group);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }

    if (onSelectKb) {
      onSelectKb(newKbObj);
    }
  };

  const handleCreateCollectionFromModal = async (newCol) => {
    const targetGroupId = selectedGroup || groups[0]?.id;
    const colCardObj = {
      id: newCol.collectionId,
      collectionId: newCol.collectionId,
      name: newCol.name,
      slug: newCol.slug,
      collectionType: newCol.collectionType,
      serverUrl: newCol.serverUrl,
      servers: newCol.servers || [newCol.serverUrl],
      authType: newCol.authType,
      timeoutSeconds: newCol.timeoutSeconds,
      headers: newCol.headers,
      desc: newCol.description,
      discoveredTools: newCol.discoveredTools || [],
      whitelistedToolNames: newCol.whitelistedToolNames || []
    };

    const updatedGroups = groups.map((g) => {
      if (g.id === targetGroupId) {
        return {
          ...g,
          children: {
            ...g.children,
            collections: [colCardObj, ...(g.children?.collections || []).filter(c => (c.collectionId || c.id) !== colCardObj.id)]
          }
        };
      }
      return g;
    });

    setGroups(updatedGroups);

    // 1. Save to backend collections registry
    try {
      await fetch('/api/v1/mcp-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCol)
      });
      if (onRefreshRegistries) {
        onRefreshRegistries();
      }
    } catch (err) {
      console.error('Failed to persist collection:', err);
    }

    // 2. Persist updated group
    const targetGroup = updatedGroups.find(g => g.id === targetGroupId);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }
  };

  const handleAddVariable = async (e) => {
    e.preventDefault();
    if (!newVarKey || !newVarValue || !selectedGroup) return;

    const newVarObj = {
      key: newVarKey.toUpperCase(),
      value: newVarValue,
      isSecret: newVarIsSecret,
      desc: newVarDesc || "Group environment variable"
    };

    const updatedGroups = groups.map((g) => {
      if (g.id === selectedGroup) {
        return {
          ...g,
          variables: [...g.variables.filter(v => v.key !== newVarObj.key), newVarObj]
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    setNewVarKey('');
    setNewVarValue('');
    setNewVarDesc('');
    setShowAddVariableModal(false);

    const targetGroup = updatedGroups.find(g => g.id === selectedGroup);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }
  };

  const handleRemoveVariable = async (keyToRemove) => {
    const updatedGroups = groups.map((g) => {
      if (g.id === selectedGroup) {
        return {
          ...g,
          variables: g.variables.filter(v => v.key !== keyToRemove)
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    const targetGroup = updatedGroups.find(g => g.id === selectedGroup);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }
  };

  // Generic component deletion from active group
  const handleDeleteComponent = async (category, item, e) => {
    if (e) e.stopPropagation();
    const itemId = item.agentId || item.kbId || item.collectionId || item.toolId || item.id || item.name;
    const itemName = item.name || itemId;

    if (!confirm(`Are you sure you want to delete ${itemName} (${category})?`)) return;

    // 1. Call Backend Delete Endpoint
    try {
      if (category === 'agent') {
        await fetch(`/api/v1/agents/${itemId}`, { method: 'DELETE' });
      } else if (category === 'tool') {
        await fetch(`/api/v1/tools/${itemId}`, { method: 'DELETE' });
      } else if (category === 'knowledge') {
        await fetch(`/api/v1/knowledge-bases/${itemId}`, { method: 'DELETE' });
      } else if (category === 'collection') {
        await fetch(`/api/v1/mcp-collections/${itemId}`, { method: 'DELETE' });
      } else if (category === 'mcp') {
        await fetch(`/api/v1/mcp-servers/${itemId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error(`Failed to delete ${category} on API:`, err);
    }

    // 2. Remove from active group children
    const targetGroupId = selectedGroup || groups[0]?.id;
    const updatedGroups = groups.map((g) => {
      if (g.id === targetGroupId) {
        const ch = { ...g.children };
        if (category === 'agent') {
          ch.agents = (ch.agents || []).filter(a => (a.agentId || a.id || a.name) !== itemId);
        } else if (category === 'tool') {
          ch.tools = (ch.tools || []).filter(t => (t.toolId || t.id || t.name) !== itemId);
        } else if (category === 'knowledge') {
          ch.knowledge = (ch.knowledge || []).filter(k => (k.kbId || k.id || k.name) !== itemId);
        } else if (category === 'collection') {
          ch.collections = (ch.collections || []).filter(c => (c.collectionId || c.id || c.name) !== itemId);
        } else if (category === 'mcp') {
          ch.mcps = (ch.mcps || []).filter(m => (m.serverId || m.id || m.name) !== itemId);
        } else if (category === 'model') {
          ch.models = (ch.models || []).filter(m => m.id !== itemId);
        }
        return { ...g, children: ch };
      }
      return g;
    });

    setGroups(updatedGroups);

    // 3. Persist group state
    const targetGroup = updatedGroups.find(g => g.id === targetGroupId);
    if (targetGroup) {
      await persistGroup(targetGroup);
    }

    if (onRefreshRegistries) {
      onRefreshRegistries();
    }
  };

  // Compile all components for the active group into a unified list
  const getGroupComponentsList = (group) => {
    if (!group || !group.children) return [];
    const list = [];

    // Agents
    (group.children.agents || []).forEach((ag) => {
      list.push({
        id: ag.agentId || ag.id,
        name: ag.name,
        category: 'agent',
        categoryLabel: 'Agent',
        icon: 'smart_toy',
        iconColor: 'text-primary',
        badgeBg: 'bg-primary/10 text-primary border-primary/20',
        slug: ag.slug || ag.name?.toLowerCase().replace(/\s+/g, '-'),
        description: ag.desc || ag.description || 'Autonomous AI Worker',
        metadata: ag.model?.modelId || ag.model || 'Amazon Nova Micro',
        metadataLabel: 'Model',
        status: ag.status || 'Active',
        raw: ag
      });
    });

    // Knowledge Bases
    (group.children.knowledge || []).forEach((kb) => {
      list.push({
        id: kb.kbId || kb.id,
        name: kb.name,
        category: 'knowledge',
        categoryLabel: 'Knowledge Base',
        icon: 'auto_stories',
        iconColor: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        slug: kb.slug || kb.name?.toLowerCase().replace(/\s+/g, '-'),
        description: kb.desc || kb.description || 'Bedrock RAG Vector Store',
        metadata: kb.embeddingModel || 'Amazon Titan v2',
        metadataLabel: 'Embedding',
        status: `${kb.documentsCount || kb.documents?.length || 0} docs`,
        raw: kb
      });
    });

    // Tools
    (group.children.tools || []).forEach((t) => {
      list.push({
        id: t.toolId || t.id,
        name: t.name,
        category: 'tool',
        categoryLabel: 'Tool',
        icon: 'construction',
        iconColor: 'text-amber-400',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        slug: t.slug || t.name?.toLowerCase().replace(/\s+/g, '-'),
        description: t.desc || t.description || 'Custom Function / HTTP API',
        metadata: t.toolType || t.type || 'REST API',
        metadataLabel: 'Type',
        status: t.safeToRun !== false ? 'Safe' : 'Privileged',
        raw: t
      });
    });

    // MCP Collections
    (group.children.collections || []).forEach((col) => {
      list.push({
        id: col.collectionId || col.id,
        name: col.name,
        category: 'collection',
        categoryLabel: 'MCP Collection',
        icon: 'layers',
        iconColor: 'text-secondary',
        badgeBg: 'bg-secondary/10 text-secondary border-secondary/20',
        slug: col.slug || col.name?.toLowerCase().replace(/\s+/g, '-'),
        description: col.desc || col.description || 'Model Context Protocol Server Collection',
        metadata: `${col.servers?.length || 1} Server(s)`,
        metadataLabel: 'Scope',
        status: col.collectionType || 'MCP Stream',
        raw: col
      });
    });

    // Models
    (group.children.models || []).forEach((m) => {
      list.push({
        id: m.id,
        name: m.name,
        category: 'model',
        categoryLabel: 'Model',
        icon: 'redeem',
        iconColor: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        slug: m.id,
        description: m.desc || 'Amazon Bedrock Foundation Model',
        metadata: m.context || '128k',
        metadataLabel: 'Context',
        status: m.tier || 'Available',
        raw: m
      });
    });

    return list;
  };

  const allGroupComponents = getGroupComponentsList(activeGroupData);
  const filteredGroupComponents = allGroupComponents.filter((comp) => {
    const matchesCategory = overviewComponentFilter === 'all' || comp.category === overviewComponentFilter;
    const matchesSearch = !componentSearch.trim() || 
      comp.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
      comp.description.toLowerCase().includes(componentSearch.toLowerCase()) ||
      comp.categoryLabel.toLowerCase().includes(componentSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredGroups = groups.filter((g) => 
    !groupSearch.trim() ||
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    g.description.toLowerCase().includes(groupSearch.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-4 animate-fadeIn pb-20">
      
      {/* ========================================================================= */}
      {/* TOP-LEVEL EXPLORE: GROUPS DIRECTORY & OVERVIEW                            */}
      {/* ========================================================================= */}
      {!selectedGroup ? (
        <div className="space-y-6">
          {/* Header & Primary Creation Menu */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-2xl">explore</span>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">Groups & Workspaces Overview</h1>
              </div>
              <p className="text-xs text-on-surface-variant">
                Manage your workspace groups, autonomous agents, foundation models, tools, MCP collections, and knowledge bases.
              </p>
            </div>

            {/* Creation Dropdown */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleConnectAllLocalMcps}
                disabled={connectingMcps}
                title="Scan and connect all local MCP servers from D:\Projects\MCPs and D:\Projects"
                className="bg-secondary/15 text-secondary hover:bg-secondary/25 border border-secondary/30 px-3.5 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${connectingMcps ? 'animate-spin' : ''}`}>
                  {connectingMcps ? 'sync' : 'hub'}
                </span>
                {connectingMcps ? 'Connecting MCPs...' : 'Connect Local MCPs'}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-5 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(192,193,255,0.25)] transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  + Create
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>

                {showCreateMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-outline-variant rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-fadeIn">
                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowCreateAgentModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
                      Create Agent
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        onOpenCreateTool();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-400">construction</span>
                      Create Tool
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowCreateKbModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">auto_stories</span>
                      Create Knowledge Base
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowCreateCollectionModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">layers</span>
                      Create Collection
                    </button>

                    <div className="h-px bg-outline-variant/50 my-1"></div>

                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowCreateGroupModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-primary font-bold hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                      + Create Group
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {connectFeedback && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/15 border border-secondary/30 text-secondary text-xs font-medium animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{connectFeedback}</span>
              </div>
              <button onClick={() => setConnectFeedback(null)} className="text-secondary/70 hover:text-secondary">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search groups by name or description..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
              />
            </div>
            <div className="text-xs font-mono-label text-on-surface-variant">
              {filteredGroups.length} Group{filteredGroups.length !== 1 ? 's' : ''} available
            </div>
          </div>

          {/* GROUPS LIST VIEW */}
          <div className="space-y-3">
            {filteredGroups.map((grp) => {
              const agentsCount = grp.children?.agents?.length || 0;
              const kbCount = grp.children?.knowledge?.length || 0;
              const toolsCount = grp.children?.tools?.length || 0;
              const colCount = grp.children?.collections?.length || 0;
              const totalComponents = agentsCount + kbCount + toolsCount + colCount;

              return (
                <div
                  key={grp.id}
                  onClick={() => setSelectedGroup(grp.id)}
                  className="bg-surface-container border border-outline-variant hover:border-primary rounded-xl p-5 transition-all cursor-pointer group hover:shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-surface-bright flex items-center justify-center text-primary border border-outline-variant group-hover:scale-105 transition-transform flex-shrink-0">
                      <span className="material-symbols-outlined text-2xl">folder</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                          {grp.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                          Type: {grp.type || 'Group'}
                        </span>
                        <span className="text-mono-label font-mono-code text-on-surface-variant text-[11px]">
                          /{grp.slug}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                        {grp.description}
                      </p>

                      {/* Components Count Chips */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px] font-mono-label">
                        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-primary border border-outline-variant/50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                          {agentsCount} Agent{agentsCount !== 1 ? 's' : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-emerald-400 border border-outline-variant/50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">auto_stories</span>
                          {kbCount} Knowledge Base{kbCount !== 1 ? 's' : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-amber-400 border border-outline-variant/50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">construction</span>
                          {toolsCount} Tool{toolsCount !== 1 ? 's' : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary border border-outline-variant/50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">layers</span>
                          {colCount} Collection{colCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className="text-xs font-mono-label text-primary font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Open Group Overview
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </span>
                    {groups.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteGroup(grp.id, e)}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-surface-container-highest transition-colors"
                        title="Delete Group"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* DETAILED GROUP WORKSPACE & COMPONENT LIST OVERVIEW                        */
        /* ========================================================================= */
        <div className="space-y-6 animate-fadeIn">
          {/* Breadcrumb & Group Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGroup(null)}
                className="w-9 h-9 rounded-lg bg-surface-container border border-outline-variant hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                title="Back to all Groups"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-on-surface tracking-tight">{activeGroupData.name}</h1>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                    Type: {activeGroupData.type || 'Group'}
                  </span>
                  <span className="text-mono-label font-mono-code text-on-surface-variant text-[11px]">
                    slug: /{activeGroupData.slug}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">{activeGroupData.description}</p>
              </div>
            </div>

            {/* In-Group Unified Creation Dropdown */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleConnectAllLocalMcps}
                disabled={connectingMcps}
                title="Scan and connect all local MCP servers from D:\Projects\MCPs and D:\Projects"
                className="bg-secondary/15 text-secondary hover:bg-secondary/25 border border-secondary/30 px-3.5 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${connectingMcps ? 'animate-spin' : ''}`}>
                  {connectingMcps ? 'sync' : 'hub'}
                </span>
                {connectingMcps ? 'Connecting MCPs...' : 'Connect Local MCPs'}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowGroupCreateMenu(!showGroupCreateMenu)}
                  className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-2 shadow transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  + Create
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>

                {showGroupCreateMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-outline-variant rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-fadeIn">
                    <button
                      onClick={() => {
                        setShowGroupCreateMenu(false);
                        setShowCreateAgentModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
                      Create Agent
                    </button>

                    <button
                      onClick={() => {
                        setShowGroupCreateMenu(false);
                        onOpenCreateTool();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-400">construction</span>
                      Create Tool
                    </button>

                    <button
                      onClick={() => {
                        setShowGroupCreateMenu(false);
                        setShowCreateKbModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">auto_stories</span>
                      Create Knowledge Base
                    </button>

                    <button
                      onClick={() => {
                        setShowGroupCreateMenu(false);
                        setShowCreateCollectionModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">layers</span>
                      Create Collection
                    </button>

                    <div className="h-px bg-outline-variant/50 my-1"></div>

                    <button
                      onClick={() => {
                        setShowGroupCreateMenu(false);
                        setShowCreateGroupModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-primary font-bold hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                      + Create Group
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {connectFeedback && (
            <div className="flex items-center justify-between p-3 mb-4 rounded-xl bg-secondary/15 border border-secondary/30 text-secondary text-xs font-medium animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{connectFeedback}</span>
              </div>
              <button onClick={() => setConnectFeedback(null)} className="text-secondary/70 hover:text-secondary">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* The 4 Group Tabs */}
          <div className="flex items-center gap-2 border-b border-outline-variant mb-6 pb-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-primary text-primary bg-surface-container/60'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">info</span>
              Overview & Component List
              <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
                {allGroupComponents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('children')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'children'
                  ? 'border-primary text-primary bg-surface-container/60'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
              Children (Subfolders)
              <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
                {allGroupComponents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('variables')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'variables'
                  ? 'border-primary text-primary bg-surface-container/60'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              Variables & Secrets
              <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
                {activeGroupData.variables?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('access')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'access'
                  ? 'border-primary text-primary bg-surface-container/60'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">shield</span>
              Access & Policies
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW WITH COMPLETE COMPONENT LIST                              */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-xs animate-fadeIn">
              {/* Group Metadata Summary */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
                <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">folder</span>
                    Group Metadata & Overview
                  </span>
                  <span className="text-[11px] font-mono-label text-on-surface-variant">
                    Created: {activeGroupData.createdAt || 'Recent'}
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Group Name</span>
                    <p className="font-bold text-on-surface text-xs bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                      {activeGroupData.name}
                    </p>
                  </div>

                  <div>
                    <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Group Slug</span>
                    <p className="font-bold text-primary text-xs bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                      /{activeGroupData.slug}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Description</span>
                    <p className="text-on-surface bg-surface-container-lowest p-3 rounded border border-outline-variant/30 leading-relaxed text-xs">
                      {activeGroupData.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* ALL COMPONENTS LIST SECTION INSIDE GROUPS OVERVIEW */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/50">
                  <div>
                    <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">view_list</span>
                      All Group Components (List Overview)
                    </h2>
                    <p className="text-[11px] text-on-surface-variant font-mono-label mt-0.5">
                      Showing all agents, knowledge bases, tools, collections, and models registered in this group
                    </p>
                  </div>

                  {/* Quick Creation Short-Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setShowCreateAgentModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-primary text-[11px] font-mono-label text-primary font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Agent
                    </button>
                    <button
                      onClick={() => setShowCreateKbModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-emerald-400 text-[11px] font-mono-label text-emerald-400 font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Knowledge Base
                    </button>
                    <button
                      onClick={onOpenCreateTool}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-amber-400 text-[11px] font-mono-label text-amber-400 font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Tool
                    </button>
                    <button
                      onClick={() => setShowCreateCollectionModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-secondary text-[11px] font-mono-label text-secondary font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Collection
                    </button>
                  </div>
                </div>

                {/* Filters & Search for Components List */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      { id: 'all', label: 'All Components', icon: 'apps', count: allGroupComponents.length },
                      { id: 'agent', label: 'Agents', icon: 'smart_toy', count: allGroupComponents.filter(c => c.category === 'agent').length },
                      { id: 'knowledge', label: 'Knowledge Bases', icon: 'auto_stories', count: allGroupComponents.filter(c => c.category === 'knowledge').length },
                      { id: 'tool', label: 'Tools', icon: 'construction', count: allGroupComponents.filter(c => c.category === 'tool').length },
                      { id: 'collection', label: 'Collections', icon: 'layers', count: allGroupComponents.filter(c => c.category === 'collection').length },
                      { id: 'model', label: 'Models', icon: 'redeem', count: allGroupComponents.filter(c => c.category === 'model').length }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setOverviewComponentFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono-label flex items-center gap-1.5 transition-colors border whitespace-nowrap ${
                          overviewComponentFilter === tab.id
                            ? 'bg-surface-container-high border-primary text-primary font-bold'
                            : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                        {tab.label}
                        <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px]">
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-[16px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Filter components..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
                    />
                  </div>
                </div>

                {/* THE UNIFIED COMPONENT LIST */}
                {filteredGroupComponents.length > 0 ? (
                  <div className="divide-y divide-outline-variant/40 border border-outline-variant/60 rounded-xl overflow-hidden bg-surface-container-lowest">
                    {filteredGroupComponents.map((comp) => (
                      <div
                        key={`${comp.category}_${comp.id}`}
                        onClick={() => {
                          if (comp.category === 'agent') onSelectAgent(comp.raw);
                          else if (comp.category === 'knowledge' && onSelectKb) onSelectKb(comp.raw);
                          else if (comp.category === 'tool' && onSelectTool) onSelectTool(comp.raw);
                          else if (comp.category === 'collection' && onSelectMcp) onSelectMcp(comp.raw);
                        }}
                        className="p-3.5 hover:bg-surface-container/70 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group"
                      >
                        {/* Leading info: Icon + Name + Category + Description */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center ${comp.iconColor} border border-outline-variant/60 flex-shrink-0 group-hover:scale-105 transition-transform`}>
                            <span className="material-symbols-outlined text-[20px]">{comp.icon}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                                {comp.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-mono-label font-bold ${comp.badgeBg}`}>
                                {comp.categoryLabel}
                              </span>
                              <span className="text-[10px] font-mono-code text-on-surface-variant">
                                /{comp.slug}
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant mt-0.5 truncate max-w-xl">
                              {comp.description}
                            </p>
                          </div>
                        </div>

                        {/* Metadata & Actions */}
                        <div className="flex items-center gap-4 flex-shrink-0 self-end sm:self-center">
                          <div className="text-right text-[11px] font-mono-label hidden md:block">
                            <span className="text-on-surface-variant block text-[10px] uppercase">{comp.metadataLabel}</span>
                            <strong className="text-on-surface font-mono-code">{comp.metadata}</strong>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (comp.category === 'agent') onSelectAgent(comp.raw);
                                else if (comp.category === 'knowledge' && onSelectKb) onSelectKb(comp.raw);
                                else if (comp.category === 'tool' && onSelectTool) onSelectTool(comp.raw);
                                else if (comp.category === 'collection' && onSelectMcp) onSelectMcp(comp.raw);
                              }}
                              className="px-2.5 py-1.5 rounded bg-surface-container border border-outline-variant hover:border-primary text-xs font-mono-label text-primary flex items-center gap-1 transition-colors"
                            >
                              <span>Configure</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>

                            {comp.category !== 'model' && (
                              <button
                                onClick={(e) => handleDeleteComponent(comp.category, comp.raw, e)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 transition-colors"
                                title="Delete Component"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Empty state list view */
                  <div className="text-center py-10 px-4 bg-surface-container-lowest border border-dashed border-outline-variant/60 rounded-xl space-y-3">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mx-auto">
                      <span className="material-symbols-outlined text-2xl">inbox</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-on-surface">No components found in this category</h3>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Get started by creating a new Agent, Tool, Knowledge Base, or MCP Collection.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                      <button
                        onClick={() => setShowCreateAgentModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-mono-label text-xs font-bold flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                        + Create Agent
                      </button>
                      <button
                        onClick={() => setShowCreateKbModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-emerald-400 text-emerald-400 font-mono-label text-xs font-bold flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">auto_stories</span>
                        + Knowledge Base
                      </button>
                      <button
                        onClick={onOpenCreateTool}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-amber-400 text-amber-400 font-mono-label text-xs font-bold flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">construction</span>
                        + Create Tool
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CHILDREN SUBFOLDERS (CATEGORIZED LIST VIEW)                         */}
          {/* ========================================================================= */}
          {activeTab === 'children' && (
            <div className="space-y-6 text-xs animate-fadeIn">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'All Subfolders', icon: 'folder' },
                    { id: 'agents', label: 'Agents', icon: 'smart_toy' },
                    { id: 'knowledge', label: 'Knowledge Bases', icon: 'auto_stories' },
                    { id: 'tools', label: 'Tools', icon: 'construction' },
                    { id: 'collections', label: 'MCP Collections', icon: 'layers' },
                    { id: 'models', label: 'Models', icon: 'redeem' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setChildrenFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-label flex items-center gap-1.5 transition-colors border ${
                        childrenFilter === cat.id
                          ? 'bg-surface-container-high border-primary text-primary font-bold'
                          : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded ${viewMode === 'list' ? 'bg-surface-container text-primary' : 'text-on-surface-variant'}`}
                    title="List View"
                  >
                    <span className="material-symbols-outlined text-[18px]">view_list</span>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded ${viewMode === 'grid' ? 'bg-surface-container text-primary' : 'text-on-surface-variant'}`}
                    title="Grid View"
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                  </button>
                </div>
              </div>

              {/* Categorized List of Subfolder Items */}
              <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
                {/* 1. Agents Subfolder */}
                {(childrenFilter === 'all' || childrenFilter === 'agents') && activeGroupData.children?.agents?.map((ag) => (
                  <div
                    key={ag.agentId || ag.id || ag.name}
                    onClick={() => onSelectAgent(ag)}
                    className="bg-surface-container border border-outline-variant rounded-xl p-4 hover:border-primary transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-primary border border-outline-variant">
                          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">{ag.name}</h3>
                          <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Folder: /agents</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                          {ag.status || 'Active'}
                        </span>
                        <button
                          onClick={(e) => handleDeleteComponent('agent', ag, e)}
                          className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-on-surface-variant text-[11px] mb-3">{ag.desc || ag.description || 'Custom autonomous agent'}</p>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                      <span>Model: <strong className="text-on-surface">{ag.model?.modelId || ag.model || 'Amazon Nova Micro'}</strong></span>
                      <span className="text-primary font-bold">Configure Agent →</span>
                    </div>
                  </div>
                ))}

                {/* 2. Knowledge Bases Subfolder */}
                {(childrenFilter === 'all' || childrenFilter === 'knowledge') && activeGroupData.children?.knowledge?.map((kb) => (
                  <div
                    key={kb.kbId || kb.id || kb.name}
                    onClick={() => onSelectKb && onSelectKb(kb)}
                    className="bg-surface-container border border-outline-variant rounded-xl p-4 hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-emerald-400 border border-outline-variant">
                          <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-emerald-400 transition-colors">{kb.name}</h3>
                          <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Folder: /knowledge</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteComponent('knowledge', kb, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                    <p className="text-on-surface-variant text-[11px] mb-3">{kb.desc || kb.description || 'Bedrock RAG Vector Store'}</p>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                      <span>Embedding: <strong className="text-on-surface">{kb.embeddingModel || 'Amazon Titan v2'}</strong></span>
                      <span className="text-emerald-400 font-bold">Manage Docs →</span>
                    </div>
                  </div>
                ))}

                {/* 3. Tools Subfolder */}
                {(childrenFilter === 'all' || childrenFilter === 'tools') && activeGroupData.children?.tools?.map((tool) => (
                  <div
                    key={tool.toolId || tool.id || tool.name}
                    onClick={() => onSelectTool && onSelectTool(tool)}
                    className="bg-surface-container border border-outline-variant rounded-xl p-4 hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-amber-400 border border-outline-variant">
                          <span className="material-symbols-outlined text-[18px]">construction</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-amber-400 transition-colors">{tool.name}</h3>
                          <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Folder: /tools</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteComponent('tool', tool, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                    <p className="text-on-surface-variant text-[11px] mb-3">{tool.desc || tool.description}</p>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                      <span>Type: <strong className="text-on-surface">{tool.toolType || tool.type || 'REST API'}</strong></span>
                      <span className="text-amber-400 font-bold">Configure Tool →</span>
                    </div>
                  </div>
                ))}

                {/* 4. MCP Collections Subfolder */}
                {(childrenFilter === 'all' || childrenFilter === 'collections') && activeGroupData.children?.collections?.map((col) => (
                  <div
                    key={col.collectionId || col.id || col.name}
                    onClick={() => onSelectMcp && onSelectMcp(col)}
                    className="bg-surface-container border border-outline-variant rounded-xl p-4 hover:border-secondary transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-secondary border border-outline-variant">
                          <span className="material-symbols-outlined text-[18px]">layers</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-secondary transition-colors">{col.name}</h3>
                          <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Folder: /collections</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteComponent('collection', col, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                    <p className="text-on-surface-variant text-[11px] mb-3">{col.desc || col.description}</p>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                      <span>Scope: <strong className="text-on-surface">{col.servers?.length || 1} Server(s)</strong></span>
                      <span className="text-secondary font-bold">Inspect Collection →</span>
                    </div>
                  </div>
                ))}

                {/* 5. Models Subfolder */}
                {(childrenFilter === 'all' || childrenFilter === 'models') && activeGroupData.children?.models?.map((m) => (
                  <div key={m.id} className="bg-surface-container border border-outline-variant rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-cyan-400 border border-outline-variant">
                          <span className="material-symbols-outlined text-[18px]">redeem</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-on-surface">{m.name}</h3>
                          <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Folder: /models</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono-label font-bold">
                        {m.tier}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-[11px] mb-3">{m.desc}</p>
                    <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant">
                      <span>Context Window: <strong className="text-on-surface">{m.context}</strong></span>
                      <span className="text-on-surface-variant">Available for Agents</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: VARIABLES & SECRETS                                                */}
          {/* ========================================================================= */}
          {activeTab === 'variables' && (
            <div className="space-y-6 text-xs animate-fadeIn">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant/40">
                  <div>
                    <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">key</span>
                      Group Scoped Variables & Secret Vault
                    </h2>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Secure variables resolved securely at runtime without leaking to LLMs.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddVariableModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-mono-label text-xs font-bold flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    + Add Variable
                  </button>
                </div>

                {activeGroupData.variables && activeGroupData.variables.length > 0 ? (
                  <div className="space-y-3">
                    {activeGroupData.variables.map((v) => (
                      <div key={v.key} className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-code font-bold text-primary text-xs">{v.key}</span>
                            {v.isSecret && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono-label font-bold">
                                SECRET
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">{v.desc}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono-code text-xs text-on-surface bg-surface-container px-2 py-1 rounded">
                            {v.isSecret && !revealSecrets[v.key] ? '••••••••••••••••' : v.value}
                          </span>
                          {v.isSecret && (
                            <button
                              onClick={() => setRevealSecrets(prev => ({ ...prev, [v.key]: !prev[v.key] }))}
                              className="p-1 rounded hover:bg-surface-container text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {revealSecrets[v.key] ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveVariable(v.key)}
                            className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl mb-1 block">lock_open</span>
                    No group variables configured yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ACCESS & POLICIES                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'access' && (
            <div className="space-y-6 text-xs animate-fadeIn">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
                <h2 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">shield</span>
                  Governance & Access Control
                </h2>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-on-surface block">{activeGroupData.owner?.name || 'Admin User'}</span>
                      <span className="text-[11px] text-on-surface-variant font-mono-code">{activeGroupData.owner?.email || 'admin@agentos.io'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                      {activeGroupData.owner?.role || 'Owner'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <CreateAgentModal
        isOpen={showCreateAgentModal}
        onClose={() => setShowCreateAgentModal(false)}
        onCreateAgent={handleCreateAgentFromModal}
        existingGroups={groups}
      />

      <CreateKbModal
        isOpen={showCreateKbModal}
        onClose={() => setShowCreateKbModal(false)}
        onKbCreated={handleKbCreatedFromModal}
        existingGroups={groups}
        defaultGroupId={selectedGroup}
      />

      <CreateCollectionModal
        isOpen={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
        onCollectionCreated={handleCreateCollectionFromModal}
      />

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">create_new_folder</span>
                Create New Workspace Group
              </h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
              <div>
                <label className="block text-on-surface font-medium mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales & Marketing Swarm"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the scope and objective of this group..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-primary-fixed-dim transition-all"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Variable Modal */}
      {showAddVariableModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">key</span>
                Add Group Variable
              </h3>
              <button onClick={() => setShowAddVariableModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddVariable} className="space-y-3 text-xs">
              <div>
                <label className="block text-on-surface font-medium mb-1">Variable Key *</label>
                <input
                  type="text"
                  required
                  placeholder="API_KEY_NAME"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code uppercase"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Variable Value *</label>
                <input
                  type="password"
                  required
                  placeholder="Secret value"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono-code"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief description of variable"
                  value={newVarDesc}
                  onChange={(e) => setNewVarDesc(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="secretCheckbox"
                  checked={newVarIsSecret}
                  onChange={(e) => setNewVarIsSecret(e.target.checked)}
                  className="rounded border-outline-variant text-primary"
                />
                <label htmlFor="secretCheckbox" className="text-xs text-on-surface font-mono-label">
                  Mark as Secret (Mask in UI)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowAddVariableModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-primary-fixed-dim transition-all"
                >
                  Save Variable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
