import React, { useState } from 'react';
import { 
  Database, 
  Cpu, 
  Wrench, 
  Layers, 
  BookOpen, 
  ShieldCheck, 
  Plus, 
  Search, 
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export default function RegistriesView({ models, tools, mcpCollections, kbs, onRefresh }) {
  const [activeSubTab, setActiveSubTab] = useState('models');
  const [filterFreeOnly, setFilterFreeOnly] = useState(true);

  // New Tool Form State
  const [newToolName, setNewToolName] = useState('');
  const [newToolEndpoint, setNewToolEndpoint] = useState('');
  const [newToolMethod, setNewToolMethod] = useState('GET');
  const [newToolDesc, setNewToolDesc] = useState('');

  const handleCreateTool = async (e) => {
    e.preventDefault();
    if (!newToolName || !newToolEndpoint) return;

    try {
      const res = await fetch('/api/v1/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: `tool_${Date.now().toString().slice(-4)}`,
          name: newToolName,
          description: newToolDesc || "Custom user-defined REST API tool",
          toolType: "REST_API",
          endpointUrl: newToolEndpoint,
          httpMethod: newToolMethod,
          inputSchema: { "type": "object", "properties": { "query": { "type": "string" } } }
        })
      });
      if (res.ok) {
        setNewToolName('');
        setNewToolEndpoint('');
        setNewToolDesc('');
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to create tool:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            Platform Capabilities & Registries
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Universal source of truth for Models, Tools, MCP Collections, and Bedrock Knowledge Bases.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveSubTab('models')}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === 'models' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Models ({models.length})
          </button>
          <button
            onClick={() => setActiveSubTab('tools')}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === 'tools' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tools ({tools.length})
          </button>
          <button
            onClick={() => setActiveSubTab('mcp')}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === 'mcp' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            MCP Collections ({mcpCollections.length})
          </button>
          <button
            onClick={() => setActiveSubTab('kb')}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${activeSubTab === 'kb' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Knowledge Bases ({kbs.length})
          </button>
        </div>
      </div>

      {/* Models Tab */}
      {activeSubTab === 'models' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-950/50 p-3 rounded-lg border border-[var(--border-subtle)]">
            <span className="text-xs text-slate-300">
              Showing foundation models with explicit pricing and tool-calling capacity.
            </span>
            <label className="flex items-center gap-2 text-xs text-emerald-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterFreeOnly}
                onChange={(e) => setFilterFreeOnly(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              Show Only Zero-Cost / Free-Tier Eligible Models
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models
              .filter((m) => !filterFreeOnly || m.pricingTier === 'FREE_TIER_ELIGIBLE')
              .map((m) => (
                <div key={m.modelId} className="glass-panel p-5 border-indigo-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-sm text-white">{m.displayName}</h3>
                    </div>
                    <span className="badge badge-free text-[9px]">{m.pricingTier}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3">{m.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-[var(--border-subtle)] text-slate-400">
                    <div>
                      <span>Max Context:</span>
                      <strong className="text-white ml-1 font-mono">{m.maxContextTokens.toLocaleString()} tokens</strong>
                    </div>
                    <div>
                      <span>Tool Calling:</span>
                      <strong className="text-emerald-400 ml-1">{m.supportsToolCalling ? 'Native Supported' : 'Prompt Based'}</strong>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {activeSubTab === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tool List */}
          <div className="md:col-span-2 space-y-3">
            {tools.map((t) => (
              <div key={t.toolId} className="glass-panel p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">{t.name}</h3>
                  </div>
                  <span className="badge bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px]">
                    {t.toolType}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-2">{t.description}</p>
                {t.endpointUrl && (
                  <div className="p-1.5 bg-slate-950 rounded font-mono text-[10px] text-slate-400 truncate">
                    {t.httpMethod} {t.endpointUrl}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Create Tool Form */}
          <div className="glass-panel p-5 border-amber-500/30 h-fit">
            <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Register New Tool
            </h3>
            <form onSubmit={handleCreateTool} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Tool Name</label>
                <input
                  type="text"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  placeholder="e.g. StripeRefundTool"
                  className="w-full bg-slate-950 border border-[var(--border-subtle)] rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">HTTP Method & Endpoint</label>
                <div className="flex gap-2">
                  <select
                    value={newToolMethod}
                    onChange={(e) => setNewToolMethod(e.target.value)}
                    className="bg-slate-950 border border-[var(--border-subtle)] rounded p-2 text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <input
                    type="text"
                    value={newToolEndpoint}
                    onChange={(e) => setNewToolEndpoint(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="flex-1 bg-slate-950 border border-[var(--border-subtle)] rounded p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newToolDesc}
                  onChange={(e) => setNewToolDesc(e.target.value)}
                  placeholder="What does this tool do?"
                  className="w-full bg-slate-950 border border-[var(--border-subtle)] rounded p-2 text-white resize-none"
                />
              </div>
              <button type="submit" className="btn-primary w-full text-xs py-2">
                Register Tool
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MCP Collections Tab */}
      {activeSubTab === 'mcp' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcpCollections.map((col) => (
              <div key={col.collectionId} className="glass-panel p-5 border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold text-sm text-white">{col.name}</h3>
                  </div>
                  <span className="badge bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px]">
                    MCP Collection
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3">{col.description}</p>
                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[11px] text-[var(--text-dim)] block mb-1">Whitelisted Capabilities:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {col.whitelistedToolNames.map((name, idx) => (
                      <span key={idx} className="badge bg-slate-900 text-cyan-200 text-[10px]">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Bases Tab */}
      {activeSubTab === 'kb' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kbs.map((kb) => (
              <div key={kb.kbId} className="glass-panel p-5 border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">{kb.name}</h3>
                  </div>
                  <span className="badge badge-free text-[9px]">Bedrock KB</span>
                </div>
                <p className="text-xs text-slate-300 mb-3">{kb.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-[var(--border-subtle)] text-slate-400">
                  <div>
                    <span>Embedding Model:</span>
                    <strong className="text-white ml-1 font-mono">{kb.embeddingModel}</strong>
                  </div>
                  <div>
                    <span>Top-K Chunks:</span>
                    <strong className="text-white ml-1">{kb.topK} (Score &gt;= {kb.scoreThreshold})</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
