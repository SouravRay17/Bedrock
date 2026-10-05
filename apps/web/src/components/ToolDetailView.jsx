import React, { useState } from 'react';

export default function ToolDetailView({ tool, onBack, onSaveTool }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'history' | 'variable' | 'access'

  // Editable Form State
  const [toolName, setToolName] = useState(tool?.name || '');
  const [slug, setSlug] = useState(tool?.slug || '');
  const [location, setLocation] = useState(tool?.location || 'Default Workspace / tools');
  const [description, setDescription] = useState(tool?.description || '');
  const [toolType, setToolType] = useState(tool?.toolType || 'HTTP API'); // 'User Function' | 'HTTP API'
  
  // Toggles
  const [safeToRun, setSafeToRun] = useState(tool?.safeToRun ?? true);
  const [ticmaHttpOk, setTicmaHttpOk] = useState(tool?.ticmaHttpOk ?? false);
  const [skipTlsVerification, setSkipTlsVerification] = useState(tool?.skipTlsVerification ?? false);
  
  // Requirement File
  const [requirementFile, setRequirementFile] = useState(tool?.requirementFile || '# Optional dependencies\nrequests>=2.31.0\npydantic>=2.0.0');

  // HTTP API Specific Fields
  const [httpBaseUrl, setHttpBaseUrl] = useState(tool?.httpBaseUrl || '');
  const [apiPath, setApiPath] = useState(tool?.apiPath || '');
  const [httpMethod, setHttpMethod] = useState(tool?.httpMethod || 'POST');
  const [authType, setAuthType] = useState(tool?.auth?.type || 'None');
  
  // Auth Credentials
  const [bearerToken, setBearerToken] = useState(tool?.auth?.bearerToken || '');
  const [basicUser, setBasicUser] = useState(tool?.auth?.basicUser || '');
  const [basicPass, setBasicPass] = useState(tool?.auth?.basicPass || '');
  const [apiKeyName, setApiKeyName] = useState(tool?.auth?.apiKeyName || 'X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState(tool?.auth?.apiKeyValue || '');
  const [apiKeyPlacement, setApiKeyPlacement] = useState(tool?.auth?.apiKeyPlacement || 'Header');
  const [oauthTokenUrl, setOauthTokenUrl] = useState(tool?.auth?.oauthTokenUrl || '');
  const [oauthClientId, setOauthClientId] = useState(tool?.auth?.oauthClientId || '');
  const [oauthClientSecret, setOauthClientSecret] = useState(tool?.auth?.oauthClientSecret || '');
  const [customAuthHeader, setCustomAuthHeader] = useState(tool?.auth?.customAuthHeader || '');

  // HTTP Headers
  const [headers, setHeaders] = useState(tool?.headers || [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' }
  ]);

  // User Function Code
  const [functionCode, setFunctionCode] = useState(tool?.code || `def run(args: dict) -> dict:
    """
    User Function entrypoint.
    Receives arguments parsed by LLM and returns structured JSON.
    """
    return {
        "status": "success",
        "result": args
    }`);

  // Test Runner State
  const [testInputJson, setTestInputJson] = useState(tool?.testInput || '{\n  "input": "example"\n}');
  const [testOutput, setTestOutput] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // History Log Data (Strictly filtered to this tool's executions)
  const [historyLogs] = useState(tool?.history || []);

  // Variables strictly linked ONLY to THIS tool
  const [toolVariables, setToolVariables] = useState(tool?.variables || []);

  const [revealSecrets, setRevealSecrets] = useState({});
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarDesc, setNewVarDesc] = useState('');
  const [newVarIsSecret, setNewVarIsSecret] = useState(true);

  // Access State
  const [allowedAgents, setAllowedAgents] = useState(tool?.allowedAgents || []);

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

  const handleSave = () => {
    const updatedTool = {
      ...tool,
      name: toolName,
      slug: slug,
      location: location,
      description: description,
      toolType: toolType,
      safeToRun: safeToRun,
      ticmaHttpOk: ticmaHttpOk,
      skipTlsVerification: skipTlsVerification,
      requirementFile: requirementFile,
      httpBaseUrl: httpBaseUrl,
      apiPath: apiPath,
      endpointUrl: toolType === 'HTTP API' ? `${httpBaseUrl.replace(/\/$/, '')}${apiPath}` : null,
      httpMethod: toolType === 'HTTP API' ? httpMethod : null,
      variables: toolVariables, // Strictly only this tool's variables
      auth: toolType === 'HTTP API' ? {
        type: authType,
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
      } : null,
      headers: toolType === 'HTTP API' ? headers : [],
      code: toolType === 'User Function' ? functionCode : null
    };

    onSaveTool(updatedTool);
    alert(`Tool "${toolName}" reconfigured and saved with ${toolVariables.length} tool-specific variables.`);
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestOutput(null);

    setTimeout(() => {
      try {
        const parsed = JSON.parse(testInputJson);
        setTestOutput({
          status: 200,
          statusText: "OK",
          latency: "284ms",
          headers: { "content-type": "application/json", "x-request-id": `req_${Date.now().toString().slice(-6)}` },
          data: {
            success: true,
            tool: toolName,
            inputs_received: parsed,
            variables_resolved: toolVariables.map(v => v.key),
            result: toolType === 'HTTP API' ? { status: "succeeded", processed_by: endpointUrlOrFallback() } : { status: "user_function_executed" }
          }
        });
      } catch (e) {
        setTestOutput({
          status: 400,
          error: "Invalid JSON input payload",
          details: e.message
        });
      } finally {
        setIsTesting(false);
      }
    }, 350);
  };

  const endpointUrlOrFallback = () => {
    return `${httpBaseUrl.replace(/\/$/, '')}${apiPath}`;
  };

  const handleAddVariable = (e) => {
    e.preventDefault();
    if (!newVarKey || !newVarValue) return;

    setToolVariables((prev) => [
      ...prev,
      { key: newVarKey.toUpperCase(), value: newVarValue, isSecret: newVarIsSecret, desc: newVarDesc || "Tool environment variable" }
    ]);
    setNewVarKey('');
    setNewVarValue('');
    setNewVarDesc('');
    setShowAddVarModal(false);
  };

  const handleRemoveVariable = (keyToRemove) => {
    setToolVariables((prev) => prev.filter((v) => v.key !== keyToRemove));
  };

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-4 animate-fadeIn pb-20">
      {/* Top Header & Breadcrumb */}
      <div className="sticky top-0 bg-[#13131b]/95 backdrop-blur-md z-30 pb-4 mb-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-surface-container border border-outline-variant hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            title="Back to Registry"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold uppercase tracking-wider">
                {toolType}
              </span>
              <h1 className="text-xl font-bold text-on-surface tracking-tight">{toolName}</h1>
              <span className="text-mono-label font-mono-label text-on-surface-variant text-[11px]">
                slug: /{slug}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-mono-label transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,193,255,0.25)] flex items-center gap-1.5 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Reconfiguration
          </button>
        </div>
      </div>

      {/* The 4 Tool Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6 pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Overview & Configuration
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'history'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          History & Execution Logs
          <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
            {historyLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('variable')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-mono-label text-xs font-bold transition-all border-b-2 ${
            activeTab === 'variable'
              ? 'border-primary text-primary bg-surface-container/60'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          Variables & Secrets (Linked to this Tool)
          <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-[10px] text-on-surface">
            {toolVariables.length}
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
          Access & Agents ({allowedAgents.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW & RECONFIGURATION TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          {/* Section A: Core Identity */}
          <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
              Tool Identity & Location
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-on-surface font-medium mb-1">Tool Name</label>
                <input
                  type="text"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-body-md"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-primary font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Location / Group Scope</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface font-medium mb-1">Tool Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setToolType('HTTP API')}
                    className={`py-2 px-3 rounded-lg border font-mono-label text-xs flex items-center justify-center gap-1.5 transition-all ${
                      toolType === 'HTTP API'
                        ? 'bg-primary/20 border-primary text-primary font-bold shadow'
                        : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">api</span>
                    HTTP API
                  </button>

                  <button
                    type="button"
                    onClick={() => setToolType('User Function')}
                    className={`py-2 px-3 rounded-lg border font-mono-label text-xs flex items-center justify-center gap-1.5 transition-all ${
                      toolType === 'User Function'
                        ? 'bg-primary/20 border-primary text-primary font-bold shadow'
                        : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">code</span>
                    User Function
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-on-surface font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </section>

          {/* Section B: Security & TICMA Controls */}
          <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
              Safety, TICMA & SSL Verification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reconfigSafe"
                  checked={safeToRun}
                  onChange={(e) => setSafeToRun(e.target.checked)}
                  className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
                />
                <label htmlFor="reconfigSafe" className="cursor-pointer">
                  <span className="font-bold text-on-surface block">Safe to Run</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Low-risk action. Executes without explicit human confirmation.
                  </span>
                </label>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reconfigTicma"
                  checked={ticmaHttpOk}
                  onChange={(e) => setTicmaHttpOk(e.target.checked)}
                  className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
                />
                <label htmlFor="reconfigTicma" className="cursor-pointer">
                  <span className="font-bold text-on-surface flex items-center gap-1.5">
                    TICMA
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono-label font-bold">
                      HTTP is OK
                    </span>
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Permits plain HTTP calls for private internal gateways.
                  </span>
                </label>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reconfigTls"
                  checked={skipTlsVerification}
                  onChange={(e) => setSkipTlsVerification(e.target.checked)}
                  className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
                />
                <label htmlFor="reconfigTls" className="cursor-pointer">
                  <span className="font-bold text-on-surface block">Skip TLS / SSL Verification</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Skips SSL certificate validation for self-signed development endpoints.
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Section C: Type-Specific Settings */}
          {toolType === 'HTTP API' ? (
            <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-5">
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-[18px]">http</span>
                HTTP API Endpoint Configuration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-on-surface font-medium mb-1">HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-primary font-mono-code font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-on-surface font-medium mb-1">HTTP Base URL</label>
                  <input
                    type="text"
                    value={httpBaseUrl}
                    onChange={(e) => setHttpBaseUrl(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-on-surface font-medium mb-1">API Path</label>
                  <input
                    type="text"
                    value={apiPath}
                    onChange={(e) => setApiPath(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* 6-Step Authentication System */}
              <div className="pt-2">
                <label className="block text-on-surface font-medium mb-2">Authentication Scheme</label>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                  {['None', 'Bearer Token', 'Basic Auth', 'API Key Auth', 'Client Credentials', 'Custom'].map((auth) => (
                    <button
                      key={auth}
                      type="button"
                      onClick={() => setAuthType(auth)}
                      className={`py-2 px-2 rounded-lg border font-mono-label text-[11px] text-center transition-all ${
                        authType === auth
                          ? 'bg-primary/20 border-primary text-primary font-bold shadow'
                          : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {auth}
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-surface-container-lowest border border-outline-variant/50">
                  {authType === 'Bearer Token' && (
                    <div>
                      <label className="block text-on-surface font-medium mb-1">Bearer Token / Variable Reference</label>
                      <input
                        type="password"
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
                          value={basicUser}
                          onChange={(e) => setBasicUser(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface font-medium mb-1">Password</label>
                        <input
                          type="password"
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
                        <label className="block text-on-surface font-medium mb-1">Key Name</label>
                        <input
                          type="text"
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
                          value={oauthTokenUrl}
                          onChange={(e) => setOauthTokenUrl(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface font-medium mb-1">Client ID</label>
                        <input
                          type="text"
                          value={oauthClientId}
                          onChange={(e) => setOauthClientId(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface font-medium mb-1">Client Secret</label>
                        <input
                          type="password"
                          value={oauthClientSecret}
                          onChange={(e) => setOauthClientSecret(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                        />
                      </div>
                    </div>
                  )}

                  {authType === 'Custom' && (
                    <div>
                      <label className="block text-on-surface font-medium mb-1">Custom Header String</label>
                      <input
                        type="text"
                        value={customAuthHeader}
                        onChange={(e) => setCustomAuthHeader(e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                      />
                    </div>
                  )}

                  {authType === 'None' && (
                    <p className="text-on-surface-variant text-[11px]">No authentication required.</p>
                  )}
                </div>
              </div>

              {/* Headers Editor */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-on-surface font-medium">HTTP Request Headers</label>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-primary hover:underline text-[11px] font-mono-label flex items-center gap-1"
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
                        placeholder="Header Name"
                        value={h.key}
                        onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                        className="w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={h.value}
                        onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                        className="w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(i)}
                        className="text-on-surface-variant hover:text-red-400 p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-[18px]">code</span>
                Python User Function Implementation
              </h2>
              <div className="relative rounded-lg border border-outline-variant bg-[#09090b] overflow-hidden">
                <div className="bg-surface-container-low px-4 py-1.5 border-b border-outline-variant flex items-center justify-between text-mono-label text-[11px] text-on-surface-variant">
                  <span>handler.py</span>
                  <span>Python 3.11 Sandbox</span>
                </div>
                <textarea
                  rows={8}
                  value={functionCode}
                  onChange={(e) => setFunctionCode(e.target.value)}
                  className="w-full bg-transparent border-none p-4 text-mono-code font-mono-code text-on-surface focus:ring-0 focus:outline-none text-xs leading-relaxed"
                  spellCheck="false"
                />
              </div>
            </section>
          )}

          {/* Section D: Test / Run Simulation Box */}
          <section className="bg-surface-container-low border border-primary/40 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">play_circle</span>
                <h3 className="text-title-sm font-title-sm text-on-surface font-bold text-sm">
                  Test & Validate Tool Endpoint
                </h3>
              </div>
              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting}
                className="px-4 py-1.5 bg-primary text-on-primary hover:bg-primary-fixed-dim rounded-lg font-mono-label text-xs font-bold flex items-center gap-1.5 shadow"
              >
                {isTesting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    Dispatching...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Run Live Test
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-on-surface-variant font-mono-label text-[11px] mb-1">
                  Input JSON Payload
                </label>
                <textarea
                  rows={5}
                  value={testInputJson}
                  onChange={(e) => setTestInputJson(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-mono-code font-mono-code text-on-surface text-xs focus:outline-none focus:border-primary"
                  spellCheck="false"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant font-mono-label text-[11px] mb-1">
                  Response Output
                </label>
                <div className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 text-mono-code font-mono-code text-xs min-h-[105px] overflow-auto">
                  {testOutput ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-emerald-400 font-bold">{testOutput.status} {testOutput.statusText}</span>
                        <span className="text-on-surface-variant">• {testOutput.latency}</span>
                      </div>
                      <pre className="text-on-surface text-[11px] whitespace-pre-wrap">
                        {JSON.stringify(testOutput.data || testOutput, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <span className="text-on-surface-variant/50">Click "Run Live Test" to simulate execution.</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HISTORY & EXECUTION LOGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">
                Execution History for {toolName}
              </h2>
              <p className="text-on-surface-variant text-xs mt-0.5">
                Audit trail of all invocations targeted specifically to this tool.
              </p>
            </div>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-mono-label font-mono-label text-on-surface-variant text-xs">
                  <th className="px-4 py-3 font-medium">Execution ID</th>
                  <th className="px-4 py-3 font-medium">Calling Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Payload Preview</th>
                  <th className="px-4 py-3 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 text-xs">
                {historyLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-highest transition-colors">
                    <td className="px-4 py-3 font-mono-code font-bold text-primary">{log.id}</td>
                    <td className="px-4 py-3 text-on-surface font-medium">{log.callingAgent}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono-label ${
                        log.status === 200
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {log.status} OK
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-code text-on-surface-variant">{log.duration}</td>
                    <td className="px-4 py-3 font-mono-code text-on-surface-variant text-[11px] truncate max-w-[200px]">
                      {log.input}
                    </td>
                    <td className="px-4 py-3 font-mono-code text-on-surface-variant text-right">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VARIABLES & SECRETS TAB (STRICTLY SCOPED TO THIS TOOL) */}
      {/* ========================================================================= */}
      {activeTab === 'variable' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">
                Variables & Secrets for {toolName}
              </h2>
              <p className="text-on-surface-variant text-xs mt-0.5">
                Variables and credentials bound strictly to this tool. No variables from other tools are displayed here.
              </p>
            </div>

            <button
              onClick={() => setShowAddVarModal(true)}
              className="bg-primary text-on-primary hover:bg-primary-fixed px-4 py-2 rounded-lg font-mono-label text-xs flex items-center gap-2 shadow-[0_0_12px_rgba(192,193,255,0.2)] font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              + Add Tool Variable
            </button>
          </div>

          {toolVariables.length > 0 ? (
            <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-mono-label font-mono-label text-on-surface-variant text-xs">
                    <th className="px-4 py-3 font-medium">Variable Key</th>
                    <th className="px-4 py-3 font-medium">Value / Secret</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-xs">
                  {toolVariables.map((v, idx) => {
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
                            <span className="text-on-surface-variant">{v.value}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-[11px]">{v.desc}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveVariable(v.key)}
                            className="text-on-surface-variant hover:text-red-400 p-1"
                            title="Delete tool variable"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface-container border border-dashed border-outline-variant/60 rounded-xl p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl mb-2 text-outline">vpn_key_off</span>
              <h3 className="font-bold text-sm text-on-surface">No Variables Bound to this Tool</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
                This tool currently has no dedicated variables. Click "+ Add Tool Variable" to create one.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ACCESS & AGENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">lock_person</span>
              Authorized Agents for {toolName}
            </h2>
            <p className="text-on-surface-variant text-xs mb-4">
              Autonomous agents within the workspace that have execution rights for this specific tool.
            </p>

            <div className="divide-y divide-outline-variant/40">
              {allowedAgents.map((ag, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-bright border border-outline-variant flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                    <div>
                      <div className="font-bold text-on-surface">{ag.name}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono-label">{ag.access}</div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-label font-bold">
                    {ag.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD TOOL VARIABLE */}
      {showAddVarModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">key</span>
                Add Variable to {toolName}
              </h3>
              <button onClick={() => setShowAddVarModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddVariable} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Key (Uppercase)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. API_SECRET"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Value</label>
                <input
                  type={newVarIsSecret ? "password" : "text"}
                  required
                  placeholder="Secret key or token string"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="What is this credential used for in this tool?"
                  value={newVarDesc}
                  onChange={(e) => setNewVarDesc(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1 text-on-surface">
                <input
                  type="checkbox"
                  checked={newVarIsSecret}
                  onChange={(e) => setNewVarIsSecret(e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container-lowest text-primary"
                />
                <span>Mask as Secret (Protected in UI and traces)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowAddVarModal(false)}
                  className="px-4 py-2 rounded bg-surface-container-highest text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-primary text-on-primary font-semibold hover:bg-primary-fixed"
                >
                  Save Tool Variable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
