import React, { useState, useEffect } from 'react';

export default function CreateCollectionModal({
  isOpen,
  onClose,
  onCollectionCreated,
  existingGroups = [],
  defaultGroupId = null
}) {
  // Form State
  const [collectionName, setCollectionName] = useState('');
  const [slug, setSlug] = useState('');
  const [location, setLocation] = useState('Engineering Group / collections');
  const [description, setDescription] = useState('');
  const [collectionType, setCollectionType] = useState('OpenAPI Specification'); // 'MCP Server' | 'OpenAPI Specification'
  const [serverUrl, setServerUrl] = useState('');
  const [codePath, setCodePath] = useState('');
  const [rawSpecText, setRawSpecText] = useState('');
  const [showAdvancedInput, setShowAdvancedInput] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);

  // Authentication Type
  const [authType, setAuthType] = useState('None'); // 'None' | 'Bearer Token' | 'Basic Auth' | 'API Key Auth' | 'Client Credentials' | 'Custom'
  const [bearerToken, setBearerToken] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyPlacement, setApiKeyPlacement] = useState('Header');
  const [oauthTokenUrl, setOauthTokenUrl] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [customAuthHeader, setCustomAuthHeader] = useState('');

  // Headers (Dynamic Key-Value List)
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/json' }
  ]);

  // Inspection & Discovered Bedrock Tools State
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState('');
  const [discoveredTools, setDiscoveredTools] = useState([]);
  const [selectedToolNames, setSelectedToolNames] = useState([]);
  const [expandedToolSpec, setExpandedToolSpec] = useState({});

  // Manual Custom Tool Addition State
  const [showAddCustomToolModal, setShowAddCustomToolModal] = useState(false);
  const [customToolName, setCustomToolName] = useState('');
  const [customToolDesc, setCustomToolDesc] = useState('');
  const [customToolSchema, setCustomToolSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  }\n}');

  // Auto-generate slug from collection name
  useEffect(() => {
    if (collectionName) {
      const generatedSlug = collectionName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [collectionName]);

  // Prepopulate location if defaultGroupId is provided
  useEffect(() => {
    if (defaultGroupId && existingGroups.length > 0) {
      const grp = existingGroups.find(g => g.id === defaultGroupId);
      if (grp) {
        setLocation(`${grp.name} / collections`);
      }
    }
  }, [defaultGroupId, existingGroups]);

  // Local MCP Discovery State
  const [localMcps, setLocalMcps] = useState([]);
  const [loadingLocalMcps, setLoadingLocalMcps] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingLocalMcps(true);
      fetch('/api/v1/mcp/discover')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLocalMcps(data);
          }
        })
        .catch(err => console.error('Failed to discover local MCPs:', err))
        .finally(() => setLoadingLocalMcps(false));
    }
  }, [isOpen]);

  const handleSelectLocalMcp = (mcp) => {
    setCollectionName(mcp.name);
    setSlug(mcp.slug);
    setCollectionType('MCP Server');
    setCodePath(mcp.codePath || '');
    setServerUrl(`http://127.0.0.1:8000/api/v1/mcp/${mcp.slug}`);
    setDescription(`Auto-connected local MCP from ${mcp.codePath} (${mcp.toolsCount || mcp.tools?.length || 0} tools)`);
    if (mcp.tools && mcp.tools.length > 0) {
      setDiscoveredTools(mcp.tools);
      setSelectedToolNames(mcp.tools.map(t => t.name));
    }
  };

  if (!isOpen) return null;

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleHeaderChange = (index, field, value) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const handleRemoveHeader = (index) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleToggleToolSelection = (toolName) => {
    if (selectedToolNames.includes(toolName)) {
      setSelectedToolNames(selectedToolNames.filter(n => n !== toolName));
    } else {
      setSelectedToolNames([...selectedToolNames, toolName]);
    }
  };

  const handleSelectAllTools = () => {
    setSelectedToolNames(discoveredTools.map(t => t.name));
  };

  const handleDeselectAllTools = () => {
    setSelectedToolNames([]);
  };

  const handleToggleSpecViewer = (toolId) => {
    setExpandedToolSpec(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  };

  const handleAddCustomToolSubmit = (e) => {
    e?.preventDefault();
    if (!customToolName.trim()) return;

    let parsedSchema = { type: 'object', properties: {} };
    try {
      parsedSchema = JSON.parse(customToolSchema);
    } catch (err) {
      alert("Invalid JSON Schema format. Please provide valid JSON.");
      return;
    }

    const cleanName = customToolName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    const newTool = {
      toolId: `tool_${cleanName}`,
      name: cleanName,
      description: customToolDesc.trim() || `Executes ${cleanName}`,
      safeToRun: true,
      mcpMethod: 'tools/call',
      bedrockToolSpec: {
        toolSpec: {
          name: cleanName,
          description: customToolDesc.trim() || `Executes ${cleanName}`,
          inputSchema: {
            json: parsedSchema
          }
        }
      }
    };

    setDiscoveredTools(prev => [...prev.filter(t => t.name !== cleanName), newTool]);
    setSelectedToolNames(prev => [...prev.filter(n => n !== cleanName), cleanName]);
    setCustomToolName('');
    setCustomToolDesc('');
    setShowAddCustomToolModal(false);
  };

  const handleRemoveDiscoveredTool = (toolName) => {
    setDiscoveredTools(prev => prev.filter(t => t.name !== toolName));
    setSelectedToolNames(prev => prev.filter(n => n !== toolName));
  };

  // Inspect and Fetch Tools from AWS Bedrock / OpenAPI / MCP
  const handleInspectAndCreate = async (e) => {
    e?.preventDefault();
    let effectiveName = collectionName.trim();
    if (!effectiveName) {
      if (serverUrl.includes('ticket-realtor') || serverUrl.includes('yahoo') || serverUrl.includes('market') || serverUrl.includes('trycloudflare')) {
        effectiveName = 'Yahoo MCP';
      } else {
        effectiveName = 'MCP Tool Collection';
      }
      setCollectionName(effectiveName);
    }

    setIsInspecting(true);
    setInspectError('');

    const filteredHeaders = headers.filter(h => h.key.trim() && h.value.trim());

    let parsedRawSpec = null;
    if (rawSpecText.trim()) {
      try {
        parsedRawSpec = JSON.parse(rawSpecText.trim());
      } catch (err) {
        parsedRawSpec = rawSpecText.trim(); // send as raw string (may be Python code)
      }
    }

    let cleanedUrl = serverUrl.trim();
    if (cleanedUrl.endsWith('.jso')) {
      cleanedUrl += 'n';
      setServerUrl(cleanedUrl);
    } else if (cleanedUrl.endsWith('.js')) {
      cleanedUrl += 'on';
      setServerUrl(cleanedUrl);
    }

    const headersToSend = [...filteredHeaders];
    if (authType === 'Bearer Token' && bearerToken && !headersToSend.some(h => h.key.toLowerCase() === 'authorization')) {
      headersToSend.push({ key: 'Authorization', value: `Bearer ${bearerToken}` });
    }

    const inspectPayload = {
      name: collectionName,
      slug: slug || collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      location: location,
      description: description,
      collectionType: collectionType,
      serverUrl: cleanedUrl || undefined,
      codePath: codePath.trim() || undefined,
      rawSpec: parsedRawSpec,
      tools: discoveredTools.length > 0 ? discoveredTools : undefined,
      authType: authType,
      authConfig: {
        bearerToken,
        basicUser,
        basicPass,
        apiKeyName,
        apiKeyValue,
        apiKeyPlacement,
        oauthTokenUrl,
        oauthClientId,
        oauthClientSecret,
        customAuthHeader
      },
      timeoutSeconds: Number(timeoutSeconds) || 30,
      headers: headersToSend
    };

    try {
      const res = await fetch('/api/v1/collections/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inspectPayload)
      });

      if (res.ok) {
        const data = await res.json();
        const toolsList = data.tools || [];
        if (toolsList.length > 0) {
          setDiscoveredTools(toolsList);
          setSelectedToolNames(toolsList.map(t => t.name));
          setInspectError('');
        } else {
          setInspectError('No tools discovered at endpoint. Please verify that the server URL serves an OpenAPI specification or live MCP tools.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setInspectError(err.detail || 'Failed to inspect collection endpoint.');
      }
    } catch (err) {
      console.error('Inspection error:', err);
      setInspectError(`Inspection request failed: ${err.message}. Ensure backend API is active.`);
    } finally {
      setIsInspecting(false);
    }
  };

  // Final Save to Collection Registry & Group
  const handleFinalSave = async () => {
    const finalCollectionId = `col_${slug || Date.now().toString().slice(-4)}`;
    const filteredHeaders = headers.filter(h => h.key.trim() && h.value.trim());

    const collectionData = {
      collectionId: finalCollectionId,
      name: collectionName,
      slug: slug,
      location: location,
      description: description || `Collection of ${collectionType} tools from ${serverUrl || 'custom source'}`,
      collectionType: collectionType,
      serverUrl: serverUrl,
      codePath: codePath,
      authType: authType,
      authConfig: {
        bearerToken,
        basicUser,
        basicPass,
        apiKeyName,
        apiKeyValue,
        apiKeyPlacement,
        oauthTokenUrl,
        oauthClientId,
        oauthClientSecret,
        customAuthHeader
      },
      timeoutSeconds: Number(timeoutSeconds) || 30,
      headers: filteredHeaders,
      servers: serverUrl ? [serverUrl] : ['Custom MCP Collection'],
      discoveredTools: discoveredTools,
      whitelistedToolNames: selectedToolNames.length > 0 ? selectedToolNames : discoveredTools.map(t => t.name)
    };

    try {
      // 1. Save to backend collections registry
      await fetch('/api/v1/mcp-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionData)
      });

      // 2. Invoke callback to update local state / group hierarchy
      if (onCollectionCreated) {
        onCollectionCreated(collectionData);
      }

      onClose();
    } catch (e) {
      console.error('Failed to save collection:', e);
      if (onCollectionCreated) {
        onCollectionCreated(collectionData);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-surface-container border border-outline-variant rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-bright flex items-center justify-center text-primary border border-outline-variant">
              <span className="material-symbols-outlined text-xl">
                {collectionType === 'OpenAPI Specification' ? 'api' : 'hub'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface tracking-tight">Create Collection</h2>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold">
                  AWS Bedrock Converse Format
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Configure an MCP Server, OpenAPI spec, local code, or custom tool collection. Tools are transformed into native Bedrock toolSpecs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
          
          {/* Collection Type Selector */}
          <div>
            <label className="block text-on-surface font-medium mb-1.5">Collection Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCollectionType('OpenAPI Specification')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  collectionType === 'OpenAPI Specification'
                    ? 'bg-primary/15 border-primary text-primary shadow'
                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-primary border border-outline-variant">
                  <span className="material-symbols-outlined text-lg">api</span>
                </div>
                <div>
                  <span className="font-bold text-xs block text-on-surface">OpenAPI Specification</span>
                  <span className="text-[10px] text-on-surface-variant">REST Swagger / OpenAPI 3.0+ Spec URL or JSON</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCollectionType('MCP Server')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  collectionType === 'MCP Server'
                    ? 'bg-primary/15 border-primary text-primary shadow'
                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-secondary border border-outline-variant">
                  <span className="material-symbols-outlined text-lg">hub</span>
                </div>
                <div>
                  <span className="font-bold text-xs block text-on-surface">MCP Server & Code</span>
                  <span className="text-[10px] text-on-surface-variant">Model Context Protocol SSE, Python AST, or Custom Tools</span>
                </div>
              </button>
            </div>
          </div>

          {/* Discovered Local MCPs Quick Select */}
          {localMcps.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-base">hub</span>
                  Detected Local MCP Packages ({localMcps.length})
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono-code">D:\Projects & D:\Projects\MCPs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {localMcps.map((mcp) => (
                  <button
                    key={mcp.slug}
                    type="button"
                    onClick={() => handleSelectLocalMcp(mcp)}
                    className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                      slug === mcp.slug
                        ? 'bg-secondary/20 border-secondary text-secondary font-bold shadow-sm'
                        : 'bg-surface-container-highest/60 border-outline-variant text-on-surface hover:border-secondary/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] text-secondary">extension</span>
                    <span>{mcp.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-bright text-[10px] text-on-surface-variant font-mono-code">
                      {mcp.toolsCount || mcp.tools?.length || 0} tools
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Identity Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface font-medium mb-1">
                Collection Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Stripe Payment & Invoicing Spec"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-body-md"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">
                Slug <span className="text-on-surface-variant font-normal">(Auto-generated lowercase)</span>
              </label>
              <input
                type="text"
                placeholder="stripe-payment-invoicing-spec"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-primary font-mono-code focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Location / Group Scope</label>
              <input
                type="text"
                placeholder="e.g. Engineering Group / collections"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Tool Calling Timeout (Seconds)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
                <span className="text-on-surface-variant text-[11px] font-mono-label">sec</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-on-surface font-medium mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Describe what services, tools, or data operations are bundled in this collection..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          {/* Server URL / Spec Endpoint Field */}
          <div>
            <label className="block text-on-surface font-medium mb-1">
              Server URL / Spec Endpoint
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  collectionType === 'OpenAPI Specification'
                    ? 'https://api.stripe.com/v1/openapi.json or http://127.0.0.1:8000/openapi.json'
                    : 'http://127.0.0.1:8080/sse or local server endpoint'
                }
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleInspectAndCreate}
                disabled={isInspecting || (!serverUrl.trim() && !codePath.trim() && !rawSpecText.trim() && discoveredTools.length === 0)}
                className="px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 font-mono-label font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap shadow"
              >
                {isInspecting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Discovering...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    Inspect & Discover Tools
                  </>
                )}
              </button>
            </div>
            {inspectError && (
              <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {inspectError}
              </p>
            )}
          </div>

          {/* Advanced Input: Local Code Path or Raw Spec JSON */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedInput(!showAdvancedInput)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                <span className="font-bold text-xs text-on-surface font-mono-label">
                  Advanced: Local Code Path or Paste Raw Spec / Tools JSON
                </span>
              </div>
              <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${showAdvancedInput ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {showAdvancedInput && (
              <div className="p-4 border-t border-outline-variant/30 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-on-surface font-medium text-xs mb-1">Local Python Code / Server Path</label>
                  <input
                    type="text"
                    placeholder="e.g. D:\Projects\MyMCP\server.py or D:\Projects\MyAPI\openapi.json"
                    value={codePath}
                    onChange={(e) => setCodePath(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code text-xs"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-0.5">AST inspector scans decorated Python functions or OpenAPI JSON files on local disk.</p>
                </div>

                <div>
                  <label className="block text-on-surface font-medium text-xs mb-1">Paste OpenAPI Spec JSON or Python Code</label>
                  <textarea
                    rows={4}
                    placeholder="Paste full OpenAPI JSON/YAML or Python tool code snippet here..."
                    value={rawSpecText}
                    onChange={(e) => setRawSpecText(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-primary font-mono-code text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Authentication Type */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-on-surface font-medium">Authentication Type</label>
              <span className="text-[10px] font-mono-label text-on-surface-variant">Same secure credentials as Tools</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5">
              {['None', 'Bearer Token', 'Basic Auth', 'API Key Auth', 'Client Credentials', 'Custom'].map((auth) => (
                <button
                  key={auth}
                  type="button"
                  onClick={() => setAuthType(auth)}
                  className={`py-1.5 px-2 rounded-lg border font-mono-label text-[11px] text-center transition-all ${
                    authType === auth
                      ? 'bg-primary/20 border-primary text-primary font-bold shadow'
                      : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {auth}
                </button>
              ))}
            </div>

            {/* Auth Credential Details */}
            <div className="pt-2">
              {authType === 'None' && (
                <p className="text-on-surface-variant text-[11px] italic">No authentication credentials required for this endpoint.</p>
              )}

              {authType === 'Bearer Token' && (
                <div>
                  <label className="block text-on-surface font-medium mb-1">Bearer Token / Variable Reference</label>
                  <input
                    type="password"
                    placeholder="e.g. {{MCP_AUTH_TOKEN}} or live bearer token"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {authType === 'Basic Auth' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="api_username"
                      value={basicUser}
                      onChange={(e) => setBasicUser(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={basicPass}
                      onChange={(e) => setBasicPass(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                </div>
              )}

              {authType === 'API Key Auth' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Header / Param Name</label>
                    <input
                      type="text"
                      placeholder="X-API-Key"
                      value={apiKeyName}
                      onChange={(e) => setApiKeyName(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Placement</label>
                    <select
                      value={apiKeyPlacement}
                      onChange={(e) => setApiKeyPlacement(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    >
                      <option value="Header">Header</option>
                      <option value="Query Parameter">Query Parameter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Key Value</label>
                    <input
                      type="password"
                      placeholder="key_live_99812..."
                      value={apiKeyValue}
                      onChange={(e) => setApiKeyValue(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                </div>
              )}

              {authType === 'Client Credentials' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-on-surface font-medium mb-1">OAuth Token URL</label>
                    <input
                      type="text"
                      placeholder="https://auth.company.com/oauth/token"
                      value={oauthTokenUrl}
                      onChange={(e) => setOauthTokenUrl(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Client ID</label>
                    <input
                      type="text"
                      placeholder="client_id_123"
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Client Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                    />
                  </div>
                </div>
              )}

              {authType === 'Custom' && (
                <div>
                  <label className="block text-on-surface font-medium mb-1">Custom Authorization Header String</label>
                  <input
                    type="text"
                    placeholder="e.g. AWS4-HMAC-SHA256 Credential=... or Signature: {{SIG}}"
                    value={customAuthHeader}
                    onChange={(e) => setCustomAuthHeader(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Add Headers Section */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-on-surface font-medium">Request Headers</label>
                <p className="text-[10px] text-on-surface-variant">Inject custom HTTP headers into discovery and tool dispatch requests.</p>
              </div>
              <button
                type="button"
                onClick={handleAddHeader}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-2.5 py-1 rounded-lg text-[11px] font-mono-label font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add Header
              </button>
            </div>

            <div className="space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Header Key (e.g. X-Tenant-ID)"
                    value={h.key}
                    onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                    className="w-1/2 bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. org_production_01)"
                    value={h.value}
                    onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                    className="w-1/2 bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveHeader(i)}
                    className="text-on-surface-variant hover:text-red-400 p-1.5 transition-colors"
                    title="Remove Header"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Discovered Tools in AWS Bedrock Converse Format */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-primary/30 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <h3 className="font-bold text-xs text-on-surface">
                  Tools in Collection ({discoveredTools.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {discoveredTools.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAllTools}
                      className="text-[10px] font-mono-label text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-outline-variant">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllTools}
                      className="text-[10px] font-mono-label text-on-surface-variant hover:underline"
                    >
                      Deselect All
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddCustomToolModal(true)}
                  className="px-2.5 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[11px] font-mono-label font-bold flex items-center gap-1 transition-colors ml-2"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  + Add Custom Tool
                </button>
              </div>
            </div>

            {discoveredTools.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-outline-variant/60 text-center space-y-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-2xl opacity-60">construction</span>
                <p className="text-xs font-medium text-on-surface">No tools discovered yet.</p>
                <p className="text-[11px]">Click "Inspect & Discover Tools" above to scan your endpoint/code, or click "+ Add Custom Tool" to define tools manually.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {discoveredTools.map((t) => {
                  const isSelected = selectedToolNames.includes(t.name);
                  const isSpecOpen = expandedToolSpec[t.toolId || t.name];

                  return (
                    <div
                      key={t.toolId || t.name}
                      className={`p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-surface-container-high/60 border-primary/50'
                          : 'bg-surface-container-low border-outline-variant/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleToolSelection(t.name)}
                            className="mt-1 rounded border-outline-variant bg-surface-container text-primary cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-on-surface font-mono-code">{t.name}</h4>
                              {t.httpMethod && (
                                <span className="px-1.5 py-0.2 rounded bg-surface-container-highest border border-outline-variant text-[9px] font-mono-code text-primary font-bold">
                                  {t.httpMethod}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-label">
                                Bedrock toolSpec
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">{t.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleSpecViewer(t.toolId || t.name)}
                            className="px-2 py-1 rounded bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface text-[10px] font-mono-label flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">data_object</span>
                            {isSpecOpen ? 'Hide Spec' : 'View ToolSpec'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDiscoveredTool(t.name)}
                            className="p-1 rounded text-on-surface-variant hover:text-red-400 transition-colors"
                            title="Remove tool from collection"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable AWS Bedrock Converse toolSpec JSON view */}
                      {isSpecOpen && (
                        <div className="mt-2.5 p-2.5 bg-[#09090b] rounded border border-outline-variant/50 text-[10px] font-mono-code text-emerald-300 overflow-x-auto">
                          <div className="text-on-surface-variant text-[9px] uppercase tracking-wider mb-1">
                            AWS Bedrock Converse API format:
                          </div>
                          <pre>{JSON.stringify(t.bedrockToolSpec || t, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-mono-label transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFinalSave}
              disabled={!collectionName.trim() || discoveredTools.length === 0}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Confirm & Save Collection ({selectedToolNames.length} of {discoveredTools.length} Tools)
            </button>
          </div>
        </div>

      </div>

      {/* Modal to Add Custom Tool inside Collection */}
      {showAddCustomToolModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">construction</span>
                Add Custom Tool to Collection
              </h3>
              <button onClick={() => setShowAddCustomToolModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCustomToolSubmit} className="space-y-3">
              <div>
                <label className="block text-on-surface font-medium text-xs mb-1">Tool Name (alphanumeric)</label>
                <input
                  type="text"
                  placeholder="e.g. generate_monthly_report"
                  value={customToolName}
                  onChange={(e) => setCustomToolName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium text-xs mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Purpose of tool for LLM reasoning..."
                  value={customToolDesc}
                  onChange={(e) => setCustomToolDesc(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium text-xs mb-1">Parameters JSON Schema</label>
                <textarea
                  rows={4}
                  value={customToolSchema}
                  onChange={(e) => setCustomToolSchema(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-primary font-mono-code text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowAddCustomToolModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-mono-label"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs font-mono-label shadow"
                >
                  Add Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
