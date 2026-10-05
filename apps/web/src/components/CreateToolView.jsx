import React, { useState, useEffect } from 'react';

export default function CreateToolView({ onCancel, onToolCreated }) {
  // Form State
  const [toolName, setToolName] = useState('');
  const [slug, setSlug] = useState('');
  const [location, setLocation] = useState('Engineering Group / tools');
  const [description, setDescription] = useState('');
  const [toolType, setToolType] = useState('HTTP API'); // 'User Function' | 'HTTP API'
  
  // Toggles
  const [safeToRun, setSafeToRun] = useState(true);
  const [ticmaHttpOk, setTicmaHttpOk] = useState(false);
  const [skipTlsVerification, setSkipTlsVerification] = useState(false);
  
  // Requirement File (Optional requirements.txt)
  const [requirementFile, setRequirementFile] = useState('# Optional dependencies for this tool\nrequests>=2.31.0\npydantic>=2.0.0');

  // Tool-Scoped Variables (Strictly linked only to this new tool)
  const [toolVariables, setToolVariables] = useState([]);
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarDesc, setNewVarDesc] = useState('');
  const [newVarIsSecret, setNewVarIsSecret] = useState(true);
  const [revealSecrets, setRevealSecrets] = useState({});

  // HTTP API Specific Fields
  const [httpBaseUrl, setHttpBaseUrl] = useState('https://api.example.com');
  const [apiPath, setApiPath] = useState('/v1/resource');
  const [httpMethod, setHttpMethod] = useState('POST');
  const [authType, setAuthType] = useState('Bearer Token'); // 'None' | 'Bearer Token' | 'Basic Auth' | 'API Key Auth' | 'Client Credentials' | 'Custom'
  
  // Auth Credentials
  const [bearerToken, setBearerToken] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyPlacement, setApiKeyPlacement] = useState('Header');
  const [oauthTokenUrl, setOauthTokenUrl] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [customAuthHeader, setCustomAuthHeader] = useState('Authorization: CustomKey {{SECRET}}');

  // HTTP Headers list
  const [headers, setHeaders] = useState([
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' }
  ]);

  // User Function code
  const [functionCode, setFunctionCode] = useState(`def run(args: dict) -> dict:
    """
    User Function entrypoint.
    Receives arguments parsed by LLM and returns structured JSON.
    """
    query = args.get("query", "")
    return {
        "status": "success",
        "result": f"Processed query: {query}"
    }`);

  // Auto-generate slug from tool name
  useEffect(() => {
    if (toolName) {
      const generatedSlug = toolName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [toolName]);

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

  const handleAddToolVariable = (e) => {
    e.preventDefault();
    if (!newVarKey || !newVarValue) return;

    setToolVariables((prev) => [
      ...prev,
      { key: newVarKey.toUpperCase(), value: newVarValue, isSecret: newVarIsSecret, desc: newVarDesc || "Tool-specific credential" }
    ]);
    setNewVarKey('');
    setNewVarValue('');
    setNewVarDesc('');
    setShowAddVarModal(false);
  };

  const handleRemoveToolVariable = (index) => {
    setToolVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!toolName.trim()) {
      alert("Please enter a Tool Name.");
      return;
    }

    const payload = {
      toolId: `tool_${slug || Date.now()}`,
      name: toolName,
      slug: slug,
      location: location,
      description: description || "Custom registered tool capability.",
      toolType: toolType,
      safeToRun: safeToRun,
      ticmaHttpOk: ticmaHttpOk,
      skipTlsVerification: skipTlsVerification,
      requirementFile: requirementFile,
      variables: toolVariables, // Strictly only this tool's variables
      endpointUrl: toolType === 'HTTP API' ? `${httpBaseUrl.replace(/\/$/, '')}${apiPath}` : null,
      httpBaseUrl: toolType === 'HTTP API' ? httpBaseUrl : null,
      apiPath: toolType === 'HTTP API' ? apiPath : null,
      httpMethod: toolType === 'HTTP API' ? httpMethod : null,
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

    try {
      const res = await fetch('/api/v1/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        onToolCreated(payload);
      } else {
        onToolCreated(payload);
      }
    } catch (e) {
      console.error('Error saving tool:', e);
      onToolCreated(payload);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-container-padding mt-4 animate-fadeIn pb-20">
      {/* Top Creation Header & Action Row */}
      <div className="sticky top-0 bg-[#13131b]/95 backdrop-blur-md z-30 pb-4 mb-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-bright flex items-center justify-center text-primary border border-outline-variant">
            <span className="material-symbols-outlined text-2xl">construction</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-label font-bold uppercase tracking-wider">
                Tool Registry
              </span>
              <h1 className="text-xl font-bold text-on-surface tracking-tight">Create Tool</h1>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Define a new capability: User Function or HTTP API endpoint with scoped variables and security policies.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-mono-label transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,193,255,0.25)] flex items-center gap-1.5 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            Create Tool
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="space-y-6 text-xs">
        {/* Section 1: Tool Core Identity */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
          <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
            Tool Identity & Location
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface font-medium mb-1">
                Tool Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Stripe Refund API"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-body-md"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">
                Slug <span className="text-on-surface-variant font-normal">(Auto-generated lowercase)</span>
              </label>
              <input
                type="text"
                placeholder="stripe-refund-api"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-primary font-mono-code focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Location / Group Scope</label>
              <input
                type="text"
                placeholder="e.g. Engineering Group / tools"
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
                placeholder="Explain what this tool does, when the agent should call it, and what inputs it expects."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Scoped Variables for THIS Tool Only */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/40">
            <div>
              <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">key</span>
                Tool Variables & Secrets <span className="text-[11px] font-normal text-on-surface-variant">(Strictly linked to this tool)</span>
              </h2>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Define API keys, authorization tokens, or environment flags used exclusively by this tool.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddVarModal(true)}
              className="bg-primary text-on-primary hover:bg-primary-fixed px-3 py-1.5 rounded-lg text-xs font-mono-label font-semibold flex items-center gap-1 shadow"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              + Add Variable
            </button>
          </div>

          {toolVariables.length > 0 ? (
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/40 text-mono-label text-on-surface-variant text-[11px]">
                    <th className="px-3 py-2">Variable Key</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 text-xs">
                  {toolVariables.map((v, idx) => {
                    const isRevealed = revealSecrets[v.key];
                    return (
                      <tr key={idx} className="hover:bg-surface-container-high/40">
                        <td className="px-3 py-2 font-mono-code font-bold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">
                            {v.isSecret ? 'lock' : 'code'}
                          </span>
                          {v.key}
                        </td>
                        <td className="px-3 py-2 font-mono-code text-on-surface">
                          {v.isSecret ? (
                            <div className="flex items-center gap-2">
                              <span>{isRevealed ? v.value : '••••••••••••••••'}</span>
                              <button
                                type="button"
                                onClick={() => setRevealSecrets((prev) => ({ ...prev, [v.key]: !prev[v.key] }))}
                                className="text-on-surface-variant hover:text-on-surface"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isRevealed ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <span>{v.value}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant text-[11px]">{v.desc}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveToolVariable(idx)}
                            className="text-on-surface-variant hover:text-red-400 p-1"
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
            <div className="text-center py-4 bg-surface-container-lowest rounded-lg border border-dashed border-outline-variant/50 text-on-surface-variant text-xs">
              No variables added for this tool yet. Click "+ Add Variable" to bind API keys or secret tokens.
            </div>
          )}
        </section>

        {/* Section 3: Safety & TICMA Controls */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
          <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
            Safety, TICMA & SSL Verification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start gap-3">
              <input
                type="checkbox"
                id="safeToRunCheck"
                checked={safeToRun}
                onChange={(e) => setSafeToRun(e.target.checked)}
                className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
              />
              <label htmlFor="safeToRunCheck" className="cursor-pointer">
                <span className="font-bold text-on-surface block">Safe to Run</span>
                <span className="text-[11px] text-on-surface-variant">
                  Low-risk or read-only action. Executes without requiring explicit human approval.
                </span>
              </label>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-start gap-3">
              <input
                type="checkbox"
                id="ticmaCheck"
                checked={ticmaHttpOk}
                onChange={(e) => setTicmaHttpOk(e.target.checked)}
                className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
              />
              <label htmlFor="ticmaCheck" className="cursor-pointer">
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
                id="skipTlsCheck"
                checked={skipTlsVerification}
                onChange={(e) => setSkipTlsVerification(e.target.checked)}
                className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary"
              />
              <label htmlFor="skipTlsCheck" className="cursor-pointer">
                <span className="font-bold text-on-surface block">Skip TLS / SSL Verification</span>
                <span className="text-[11px] text-on-surface-variant">
                  Skips SSL certificate validation for self-signed development endpoints.
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Section 4: Type-Specific Settings */}
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
                  placeholder="https://api.stripe.com"
                  value={httpBaseUrl}
                  onChange={(e) => setHttpBaseUrl(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-on-surface font-medium mb-1">API Path</label>
                <input
                  type="text"
                  placeholder="/v1/refunds"
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
                {authType === 'None' && (
                  <p className="text-on-surface-variant text-[11px]">No authentication required.</p>
                )}

                {authType === 'Bearer Token' && (
                  <div>
                    <label className="block text-on-surface font-medium mb-1">Bearer Token / Variable Reference</label>
                    <input
                      type="password"
                      placeholder="e.g. {{STRIPE_SECRET_KEY}} or live bearer token"
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
                        placeholder="api_user"
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
                      <label className="block text-on-surface font-medium mb-1">Key Name</label>
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
                        placeholder="client_12345"
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
                    <label className="block text-on-surface font-medium mb-1">Custom Header String</label>
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
                <span>Python 3.11 MicroVM Sandbox</span>
              </div>
              <textarea
                rows={10}
                value={functionCode}
                onChange={(e) => setFunctionCode(e.target.value)}
                className="w-full bg-transparent border-none p-4 text-mono-code font-mono-code text-on-surface focus:ring-0 focus:outline-none text-xs leading-relaxed"
                spellCheck="false"
              />
            </div>
          </section>
        )}

        {/* Section 5: Requirement File */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[18px]">description</span>
              Requirement File (Optional requirements.txt content)
            </h2>
            <span className="text-[10px] font-mono-label text-on-surface-variant">
              Dependency manifest for testing & runtime
            </span>
          </div>

          <div className="relative rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden">
            <textarea
              rows={3}
              value={requirementFile}
              onChange={(e) => setRequirementFile(e.target.value)}
              placeholder="e.g. requests>=2.31.0&#10;pydantic>=2.0.0"
              className="w-full bg-transparent border-none p-3 text-mono-code font-mono-code text-on-surface focus:ring-0 focus:outline-none text-xs leading-relaxed resize-none"
              spellCheck="false"
            />
          </div>
        </section>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-mono-label transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-8 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,193,255,0.25)] flex items-center gap-2 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            Create Tool
          </button>
        </div>
      </div>

      {/* MODAL: ADD TOOL VARIABLE */}
      {showAddVarModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">key</span>
                Add Tool Variable
              </h3>
              <button onClick={() => setShowAddVarModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddToolVariable} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Key (Uppercase)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STRIPE_SECRET_KEY"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Value / Secret</label>
                <input
                  type={newVarIsSecret ? "password" : "text"}
                  required
                  placeholder="Secret key or token value"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Description / Usage</label>
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
                  className="px-4 py-2 rounded bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-primary text-on-primary font-semibold hover:bg-primary-fixed"
                >
                  Add Variable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
