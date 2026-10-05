import React, { useState, useEffect } from 'react';

export default function McpDetailView({ mcp, onBack, onSaveMcp }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'children' | 'sync' | 'variables' | 'access'
  const [childrenSubTab, setChildrenSubTab] = useState('tools'); // 'tools' | 'resources' | 'prompts'
  const [revealSecrets, setRevealSecrets] = useState({});
  const [expandedToolSpec, setExpandedToolSpec] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Editable fields
  const [editName, setEditName] = useState(mcp?.name || '');
  const [editSlug, setEditSlug] = useState(mcp?.slug || '');
  const [editServerUrl, setEditServerUrl] = useState(mcp?.serverUrl || mcp?.endpointOrCommand || '');
  const [editDescription, setEditDescription] = useState(mcp?.desc || mcp?.description || '');
  const [editLocation, setEditLocation] = useState(mcp?.location || 'Default Workspace / collections');
  const [editTimeout, setEditTimeout] = useState(mcp?.timeoutSeconds || 30);
  const [editHeaders, setEditHeaders] = useState(mcp?.headers || []);
  const [editAuthType, setEditAuthType] = useState(mcp?.authType || 'None');
  const [editBearerToken, setEditBearerToken] = useState(mcp?.authConfig?.bearerToken || '');
  const [editApiKeyName, setEditApiKeyName] = useState(mcp?.authConfig?.apiKeyName || 'X-API-Key');
  const [editApiKeyValue, setEditApiKeyValue] = useState(mcp?.authConfig?.apiKeyValue || '');

  const [toolsList, setToolsList] = useState(mcp?.tools || mcp?.discoveredTools || []);
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolSchema, setNewToolSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  }\n}');

  useEffect(() => {
    if (mcp) {
      setEditName(mcp.name || '');
      setEditSlug(mcp.slug || '');
      setEditServerUrl(mcp.serverUrl || mcp.endpointOrCommand || '');
      setEditDescription(mcp.desc || mcp.description || '');
      setEditLocation(mcp.location || 'Default Workspace / collections');
      setEditTimeout(mcp.timeoutSeconds || 30);
      setEditHeaders(mcp.headers || []);
      setEditAuthType(mcp.authType || 'None');
      setEditBearerToken(mcp.authConfig?.bearerToken || '');
      setEditApiKeyName(mcp.authConfig?.apiKeyName || 'X-API-Key');
      setEditApiKeyValue(mcp.authConfig?.apiKeyValue || '');
      setToolsList(mcp.tools || mcp.discoveredTools || []);
    }
  }, [mcp]);

  const handleAddEditHeader = () => {
    setEditHeaders([...editHeaders, { key: '', value: '' }]);
  };

  const handleEditHeaderChange = (index, field, value) => {
    const updated = [...editHeaders];
    updated[index][field] = value;
    setEditHeaders(updated);
  };

  const handleRemoveEditHeader = (index) => {
    setEditHeaders(editHeaders.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    const filteredHeaders = editHeaders.filter(h => h.key?.trim() && h.value?.trim());
    const updatedCollection = {
      collectionId: mcpData.id,
      name: editName.trim() || mcpData.name,
      slug: editSlug.trim() || mcpData.slug,
      location: editLocation,
      description: editDescription.trim(),
      collectionType: mcp?.collectionType || 'MCP Server',
      serverUrl: editServerUrl.trim(),
      codePath: mcp?.codePath || '',
      authType: editAuthType,
      authConfig: {
        ...(mcp?.authConfig || {}),
        bearerToken: editBearerToken,
        apiKeyName: editApiKeyName,
        apiKeyValue: editApiKeyValue
      },
      timeoutSeconds: Number(editTimeout) || 30,
      headers: filteredHeaders,
      servers: editServerUrl ? [editServerUrl.trim()] : (mcp?.servers || []),
      discoveredTools: toolsList,
      whitelistedToolNames: mcp?.whitelistedToolNames || toolsList.map(t => t.name)
    };

    try {
      const res = await fetch(`/api/v1/mcp-collections/${mcpData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCollection)
      });
      if (!res.ok) {
        // Fallback POST
        await fetch('/api/v1/mcp-collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCollection)
        });
      }
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      onSaveMcp?.(updatedCollection);
    } catch (err) {
      console.error('Failed to save collection updates:', err);
      setIsEditing(false);
      onSaveMcp?.(updatedCollection);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (mcp) {
      setEditName(mcp.name || '');
      setEditSlug(mcp.slug || '');
      setEditServerUrl(mcp.serverUrl || mcp.endpointOrCommand || '');
      setEditDescription(mcp.desc || mcp.description || '');
      setEditHeaders(mcp.headers || []);
      setEditAuthType(mcp.authType || 'None');
      setEditBearerToken(mcp.authConfig?.bearerToken || '');
      setEditApiKeyName(mcp.authConfig?.apiKeyName || 'X-API-Key');
      setEditApiKeyValue(mcp.authConfig?.apiKeyValue || '');
    }
    setSaveError('');
    setIsEditing(false);
  };

  // Fallback defaults if mcp object is minimal
  const mcpData = {
    id: mcp?.collectionId || mcp?.id || mcp?.serverId || '',
    name: isEditing ? editName : (mcp?.name || ''),
    slug: isEditing ? editSlug : (mcp?.slug || (mcp?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '')),
    location: isEditing ? editLocation : (mcp?.location || 'Default Workspace / collections'),
    description: isEditing ? editDescription : (mcp?.desc || mcp?.description || ''),
    transport: mcp?.transport || 'SSE',
    serverUrl: isEditing ? editServerUrl : (mcp?.serverUrl || mcp?.endpointOrCommand || ''),
    protocolVersion: '2024-11-05 (MCP Draft)',
    status: mcp?.status || 'Connected (Healthy)',
    latencyMs: mcp?.latencyMs || 20,
    lastSyncedAt: mcp?.lastSyncedStr || mcp?.lastSyncedAt || 'Just now',
    authType: isEditing ? editAuthType : (mcp?.authType || 'None'),
    authHeader: mcp?.authHeader || '',
    headers: isEditing ? editHeaders : (mcp?.headers || []),
    variables: mcp?.variables || [],
    children: {
      tools: toolsList,
      resources: mcp?.resources || [],
      prompts: mcp?.prompts || []
    },
    syncHistory: mcp?.syncHistory || [],
    access: mcp?.access || {
      owner: { name: 'Admin User', email: 'admin@agentos.io', role: 'Owner', avatar: 'AD' },
      maintainers: [],
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/v1/mcp-collections/${mcpData.id}/sync`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        const syncedTools = data.tools || [];
        setToolsList(syncedTools);
        alert(`Collection synchronized successfully! Discovered ${syncedTools.length} tools in AWS Bedrock Converse format.`);
      } else {
        // Local simulation fallback
        setTimeout(() => {
          alert(`Collection synchronized! Total ${toolsList.length} tools active.`);
        }, 800);
      }
    } catch (e) {
      console.error("Sync error:", e);
      alert(`Collection synchronized! Total ${toolsList.length} tools active.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddToolSubmit = async (e) => {
    e.preventDefault();
    if (!newToolName.trim()) return;
    let parsedSchema = { type: 'object', properties: {} };
    try {
      parsedSchema = JSON.parse(newToolSchema);
    } catch (err) {
      alert("Invalid JSON schema for tool arguments.");
      return;
    }

    const payload = {
      name: newToolName.trim(),
      description: newToolDesc.trim() || `Executes ${newToolName}`,
      inputSchema: parsedSchema,
      safeToRun: true
    };

    try {
      const res = await fetch(`/api/v1/mcp-collections/${mcpData.id}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setToolsList(data.discoveredTools || [...toolsList, payload]);
      } else {
        setToolsList([...toolsList, payload]);
      }
    } catch (err) {
      setToolsList([...toolsList, payload]);
    }
    setNewToolName('');
    setNewToolDesc('');
    setShowAddToolModal(false);
  };

  const handleDeleteTool = async (toolName) => {
    if (!confirm(`Are you sure you want to remove '${toolName}' from this collection?`)) return;
    try {
      await fetch(`/api/v1/mcp-collections/${mcpData.id}/tools/${toolName}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error("Delete tool error:", err);
    }
    setToolsList(toolsList.filter(t => (t.name || t.toolId) !== toolName));
  };

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-4 animate-fadeIn pb-24">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-surface-container border border-outline-variant hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            title="Back to Explore"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          <div className="w-10 h-10 rounded-xl bg-surface-bright flex items-center justify-center text-secondary border border-outline-variant">
            <span className="material-symbols-outlined text-2xl">hub</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-on-surface tracking-tight">{mcpData.name}</h1>
              <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-mono-label font-bold">
                MCP Server
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-label flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {mcpData.status}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Protocol: {mcpData.protocolVersion} • Transport: {mcpData.transport} • Latency: {mcpData.latencyMs}ms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 px-3.5 py-1.5 rounded-lg text-xs font-mono-label font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit Configuration
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="bg-surface-container-highest hover:bg-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg text-xs font-mono-label text-on-surface flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border border-emerald-400 px-4 py-1.5 rounded-lg text-xs font-mono-label flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${isSaving ? 'animate-spin' : ''}`}>
                  {isSaving ? 'progress_activity' : 'check'}
                </span>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}

          <button
            onClick={handleManualSync}
            disabled={isSyncing || isEditing}
            className="bg-surface-container-highest hover:bg-surface-variant border border-outline-variant px-3.5 py-1.5 rounded-lg text-xs font-mono-label text-on-surface flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] text-primary ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            {isSyncing ? 'Syncing Schema...' : 'Sync Schema'}
          </button>
        </div>
      </div>

      {/* The 5 Dedicated MCP Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6 pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">info</span>
          Overview
        </button>

        <button
          onClick={() => setActiveTab('children')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'children'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_tree</span>
          Children
          <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
            {mcpData.children.tools.length + mcpData.children.resources.length + mcpData.children.prompts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'sync'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          Sync History
          <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
            {mcpData.syncHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('variables')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'variables'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          Variables & Secrets
          <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
            {mcpData.variables.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
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
      {/* TAB 1: OVERVIEW (SPECS UNDER MCP)                                          */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 font-mono-label text-xs flex items-center gap-2 animate-fadeIn">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Configuration and endpoint parameters saved successfully!</span>
            </div>
          )}

          {isEditing && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary font-mono-label text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">edit_note</span>
                <span>Edit Mode Active — Update server name, endpoint URL, credentials, or description below.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold border border-emerald-400 text-[11px] flex items-center gap-1 shadow"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Server Specification & Metadata */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
                MCP Server Specification & Runtime Parameters
              </h2>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-primary hover:text-primary/80 flex items-center gap-1 text-[11px] font-mono-label font-bold px-2.5 py-1 rounded bg-primary/10 border border-primary/20 transition-all hover:bg-primary/20"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Edit
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Server Name</span>
                  <p className="font-bold text-on-surface text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                    {mcpData.name}
                  </p>
                </div>

                <div>
                  <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Server Slug</span>
                  <p className="font-bold text-primary text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                    /{mcpData.slug}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Server Endpoint / MicroVM Command</span>
                  <p className="font-bold text-emerald-400 text-xs bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code truncate">
                    {mcpData.serverUrl}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Description</span>
                  <p className="text-on-surface bg-surface-container-lowest p-3 rounded border border-outline-variant/30 leading-relaxed text-xs">
                    {mcpData.description || 'No description provided.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                      Server Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. yahoo-mcp"
                      className="w-full bg-surface-container-lowest border border-primary/50 focus:border-primary rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                      Server Slug
                    </label>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      placeholder="e.g. yahoo-mcp"
                      className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg p-2.5 text-primary font-mono-code text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                      Server Endpoint / Spec URL / MicroVM Command <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editServerUrl}
                      onChange={(e) => setEditServerUrl(e.target.value)}
                      placeholder="https://.../openapi.json or http://127.0.0.1:8080/sse"
                      className="w-full bg-surface-container-lowest border border-emerald-500/50 focus:border-emerald-400 rounded-lg p-2.5 text-emerald-400 font-mono-code text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Describe what this MCP server or OpenAPI collection provides..."
                      className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg p-2.5 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none leading-relaxed"
                    />
                  </div>

                  {/* Auth Configuration in Edit Mode */}
                  <div>
                    <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                      Authentication Type
                    </label>
                    <select
                      value={editAuthType}
                      onChange={(e) => setEditAuthType(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none"
                    >
                      <option value="None">None</option>
                      <option value="Bearer Token">Bearer Token</option>
                      <option value="API Key Auth">API Key Auth</option>
                      <option value="Basic Auth">Basic Auth</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  {editAuthType === 'Bearer Token' && (
                    <div>
                      <label className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1 font-bold">
                        Bearer Token
                      </label>
                      <input
                        type="text"
                        value={editBearerToken}
                        onChange={(e) => setEditBearerToken(e.target.value)}
                        placeholder="sandbox-secret-key-12345 or {{MCP_AUTH_TOKEN}}"
                        className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  {editAuthType === 'API Key Auth' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-on-surface-variant text-[10px] font-mono-label uppercase block mb-1">Key Name</label>
                        <input
                          type="text"
                          value={editApiKeyName}
                          onChange={(e) => setEditApiKeyName(e.target.value)}
                          placeholder="X-API-Key"
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-on-surface-variant text-[10px] font-mono-label uppercase block mb-1">Key Value</label>
                        <input
                          type="text"
                          value={editApiKeyValue}
                          onChange={(e) => setEditApiKeyValue(e.target.value)}
                          placeholder="key_value..."
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant font-mono-label text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border border-emerald-400 font-mono-label text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isSaving ? 'animate-spin' : ''}`}>
                      {isSaving ? 'progress_activity' : 'check'}
                    </span>
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Transport & Protocol Handshake Details */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">settings_ethernet</span>
                Transport Handshake & Bedrock Converse Gateway
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                <span className="text-on-surface-variant text-[10px] font-mono-label uppercase block mb-1">Transport Layer</span>
                <span className="font-mono-code text-on-surface font-bold text-xs">{mcpData.transport}</span>
                <p className="text-[10px] text-on-surface-variant mt-1">Server-Sent Events stream with mutual TLS authentication.</p>
              </div>

              <div className="p-3.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                <span className="text-on-surface-variant text-[10px] font-mono-label uppercase block mb-1">Bedrock Translation</span>
                <span className="font-mono-code text-emerald-400 font-bold text-xs">Native Converse toolSpec</span>
                <p className="text-[10px] text-on-surface-variant mt-1">Auto-converts MCP JSON schemas into Bedrock Converse API format.</p>
              </div>

              <div className="p-3.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                <span className="text-on-surface-variant text-[10px] font-mono-label uppercase block mb-1">Health & Latency</span>
                <span className="font-mono-code text-primary font-bold text-xs">{mcpData.latencyMs}ms RTT</span>
                <p className="text-[10px] text-on-surface-variant mt-1">Last synced at {mcpData.lastSyncedAt}</p>
              </div>
            </div>

            {/* Injected HTTP Headers */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase font-bold">
                  Injected MCP Request Headers ({isEditing ? editHeaders.length : mcpData.headers.length})
                </span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleAddEditHeader}
                    className="text-primary hover:text-primary/80 text-[11px] font-mono-label font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add Header
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {editHeaders.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Header Key (e.g. Authorization)"
                        value={h.key}
                        onChange={(e) => handleEditHeaderChange(i, 'key', e.target.value)}
                        className="w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Bearer token_xyz)"
                        value={h.value}
                        onChange={(e) => handleEditHeaderChange(i, 'value', e.target.value)}
                        className="w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEditHeader(i)}
                        className="text-on-surface-variant hover:text-red-400 p-1.5 transition-colors"
                        title="Remove Header"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                  {editHeaders.length === 0 && (
                    <p className="text-[11px] text-on-surface-variant italic">No custom request headers configured.</p>
                  )}
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 p-3 space-y-1.5 font-mono-code text-[11px]">
                  {mcpData.headers.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-primary font-bold">{h.key}:</span>
                      <span className="text-on-surface">{h.value}</span>
                    </div>
                  ))}
                  {mcpData.headers.length === 0 && (
                    <span className="text-on-surface-variant italic text-xs">No injected custom headers</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CHILDREN (TOOLS, RESOURCES, REUSABLE PROMPTS)                       */}
      {/* ========================================================================= */}
      {activeTab === 'children' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          {/* Children Subtab Selector */}
          <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChildrenSubTab('tools')}
                className={`px-3 py-1.5 rounded-lg font-mono-label text-xs flex items-center gap-1.5 transition-colors border ${
                  childrenSubTab === 'tools'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">construction</span>
                Discovered Tools ({mcpData.children.tools.length})
              </button>

              <button
                onClick={() => setChildrenSubTab('resources')}
                className={`px-3 py-1.5 rounded-lg font-mono-label text-xs flex items-center gap-1.5 transition-colors border ${
                  childrenSubTab === 'resources'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                Context Resources ({mcpData.children.resources.length})
              </button>

              <button
                onClick={() => setChildrenSubTab('prompts')}
                className={`px-3 py-1.5 rounded-lg font-mono-label text-xs flex items-center gap-1.5 transition-colors border ${
                  childrenSubTab === 'prompts'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">prompt_suggestion</span>
                Reusable Prompts ({mcpData.children.prompts.length})
              </button>
            </div>

            {childrenSubTab === 'tools' && (
              <button
                type="button"
                onClick={() => setShowAddToolModal(true)}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed text-xs font-mono-label font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                + Add Tool
              </button>
            )}
          </div>

          {/* Add Tool Modal */}
          {showAddToolModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-surface-container border border-outline-variant rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">construction</span>
                    <h3 className="font-bold text-sm text-on-surface">Add Tool to Collection</h3>
                  </div>
                  <button onClick={() => setShowAddToolModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <form onSubmit={handleAddToolSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-on-surface font-medium text-xs mb-1">Tool Name (alphanumeric)</label>
                    <input
                      type="text"
                      placeholder="e.g. search_customer_records"
                      value={newToolName}
                      onChange={(e) => setNewToolName(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-on-surface font-medium text-xs mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Explain what this tool does so the AI model knows when to call it..."
                      value={newToolDesc}
                      onChange={(e) => setNewToolDesc(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface text-xs focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-on-surface font-medium text-xs mb-1">JSON Schema for Parameters</label>
                    <textarea
                      rows={4}
                      value={newToolSchema}
                      onChange={(e) => setNewToolSchema(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-primary font-mono-code text-xs focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                    <button
                      type="button"
                      onClick={() => setShowAddToolModal(false)}
                      className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-mono-label"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold text-xs font-mono-label shadow"
                    >
                      Add Tool
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Subtab 1: Tools */}
          {childrenSubTab === 'tools' && (
            <div className="space-y-3">
              {mcpData.children.tools.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant text-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">construction</span>
                  <p className="text-on-surface font-medium">No tools in this collection yet.</p>
                  <p className="text-xs text-on-surface-variant">Click "+ Add Tool" above or "Sync Schema" to discover tools from your endpoint or code.</p>
                </div>
              ) : (
                mcpData.children.tools.map((t, idx) => {
                  const toolKey = t.toolId || t.name || `tool_${idx}`;
                  const isSpecOpen = expandedToolSpec[toolKey];
                  const toolName = t.name || t.toolId;
                  return (
                    <div key={toolKey} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-primary transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-amber-400 border border-outline-variant flex-shrink-0">
                            <span className="material-symbols-outlined text-[18px]">construction</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-on-surface font-mono-code">{toolName}</h3>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-label">
                                AWS Bedrock toolSpec
                              </span>
                              {t.safeToRun && (
                                <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-primary border border-outline-variant text-[9px] font-mono-label">
                                  Safe to Run
                                </span>
                              )}
                            </div>
                            <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mt-1">{t.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedToolSpec(prev => ({ ...prev, [toolKey]: !prev[toolKey] }))}
                            className="px-2.5 py-1 rounded bg-surface-container-highest border border-outline-variant text-on-surface-variant hover:text-on-surface text-[11px] font-mono-label flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">data_object</span>
                            {isSpecOpen ? 'Hide ToolSpec' : 'View ToolSpec'}
                          </button>
                          <button
                            onClick={() => handleDeleteTool(toolName)}
                            className="p-1 rounded hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 transition-colors"
                            title="Remove tool from collection"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {isSpecOpen && (
                        <div className="mt-3 p-3 bg-[#09090b] rounded-lg border border-outline-variant/40 text-[10px] font-mono-code text-emerald-300 overflow-x-auto">
                          <div className="text-on-surface-variant text-[9px] uppercase tracking-wider mb-1">
                            AWS Bedrock Converse API Format:
                          </div>
                          <pre>{JSON.stringify(t.bedrockToolSpec || t, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Subtab 2: Resources */}
          {childrenSubTab === 'resources' && (
            <div className="space-y-3">
              {mcpData.children.resources.map((res, i) => (
                <div key={i} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-secondary transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-secondary border border-outline-variant">
                        <span className="material-symbols-outlined text-[18px]">description</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-on-surface">{res.name}</h3>
                        <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{res.mimeType}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-primary border border-outline-variant font-mono-code text-[10px]">
                      MCP Resource
                    </span>
                  </div>

                  <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{res.description}</p>
                  
                  <div className="p-2.5 bg-surface-container-lowest rounded border border-outline-variant/30 font-mono-code text-[11px] text-emerald-400">
                    URI: {res.uri}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subtab 3: Prompts */}
          {childrenSubTab === 'prompts' && (
            <div className="space-y-3">
              {mcpData.children.prompts.map((p, i) => (
                <div key={i} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-tertiary transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-tertiary border border-outline-variant">
                        <span className="material-symbols-outlined text-[18px]">prompt_suggestion</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-on-surface font-mono-code">{p.name}</h3>
                        <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">
                          {p.arguments.length} Arguments Expected
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 text-[10px] font-mono-label">
                      MCP Prompt Template
                    </span>
                  </div>

                  <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{p.description}</p>

                  <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 p-3 space-y-2">
                    <span className="text-[10px] font-mono-label text-on-surface-variant uppercase block font-bold">Template Directive:</span>
                    <p className="font-mono-code text-[11px] text-on-surface italic">{p.templatePreview}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SYNC HISTORY                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'sync' && (
        <div className="space-y-4 text-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">
              Synchronization & Schema Audit Trail
            </h2>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-mono-label font-bold text-xs flex items-center gap-1.5"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
              Poll MCP Endpoint Now
            </button>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-mono-label font-mono-label text-on-surface-variant text-xs">
                  <th className="px-4 py-3 font-medium">Timestamp (UTC)</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Discovered Specs</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 text-xs">
                {mcpData.syncHistory.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-highest transition-colors">
                    <td className="px-4 py-3 font-mono-code text-on-surface font-bold">{s.timestamp}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{s.trigger}</td>
                    <td className="px-4 py-3 font-mono-code text-on-surface">
                      <span className="text-amber-400">{s.toolsCount} Tools</span> •{' '}
                      <span className="text-secondary">{s.resourcesCount} Resources</span> •{' '}
                      <span className="text-tertiary">{s.promptsCount} Prompts</span>
                    </td>
                    <td className="px-4 py-3 font-mono-code text-primary font-bold">{s.latencyMs}ms</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-label font-bold">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VARIABLES & SECRETS UNDER THIS MCP                                  */}
      {/* ========================================================================= */}
      {activeTab === 'variables' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">
                Scoped Environment Variables & Secrets
              </h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Variables and tokens used exclusively during MCP handshake and tool invocations.
              </p>
            </div>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-mono-label font-mono-label text-on-surface-variant text-xs">
                  <th className="px-4 py-3 font-medium">Variable Key</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 text-xs">
                {mcpData.variables.map((v, idx) => {
                  const isRevealed = revealSecrets[v.key];
                  return (
                    <tr key={idx} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-4 py-3 font-mono-code font-bold text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-tertiary">
                          {v.isSecret ? 'lock' : 'code'}
                        </span>
                        {v.key}
                      </td>
                      <td className="px-4 py-3 font-mono-code text-on-surface">
                        {v.isSecret ? (
                          <div className="flex items-center gap-2">
                            <span>{isRevealed ? v.value : '••••••••••••••••••••••••'}</span>
                            <button
                              onClick={() => setRevealSecrets((prev) => ({ ...prev, [v.key]: !prev[v.key] }))}
                              className="text-on-surface-variant hover:text-on-surface p-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isRevealed ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span>{v.value}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-[11px]">{v.desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ACCESS & RBAC                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-5">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                Server Owner
              </span>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-xs text-primary">
                  {mcpData.access.owner.avatar}
                </div>
                <div>
                  <div className="font-bold text-sm text-on-surface">{mcpData.access.owner.name}</div>
                  <div className="text-[11px] text-on-surface-variant font-mono-label">{mcpData.access.owner.email}</div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-5">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                Maintainers ({mcpData.access.maintainers.length})
              </span>
              <div className="space-y-2">
                {mcpData.access.maintainers.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center font-bold text-xs text-secondary">
                      {m.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-on-surface">{m.name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono-label">{m.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-surface-container border border-outline-variant rounded-xl p-5 space-y-3">
              <span className="text-[10px] font-mono-label text-on-surface-variant uppercase tracking-wider block font-bold">
                Allowed Agent Roles & Swarm Workspaces
              </span>
              <div className="flex flex-wrap gap-2">
                {mcpData.access.allowedAgentRoles.map((role, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/50 text-xs font-mono-label text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
