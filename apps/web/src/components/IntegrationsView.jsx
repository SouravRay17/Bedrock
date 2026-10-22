import React, { useState, useEffect } from 'react';
import { 
  Plug, Plus, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, Search, Trash2, ArrowRight, ShieldCheck, Box, Activity
} from 'lucide-react';

export default function IntegrationsView({ onSelectIntegration }) {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [discoveringId, setDiscoveringId] = useState(null);

  const [newIntegration, setNewIntegration] = useState({
    id: '',
    name: '',
    type: 'mcp',
    endpoint: 'http://localhost:8001/sse',
    environment: 'sandbox',
    version: '1.0.0',
    credential_ref: 'market-intel-token',
    description: ''
  });

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (e) {
      console.error('Failed to fetch integrations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleDiscover = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      setDiscoveringId(id);
      const res = await fetch(`/api/v1/integrations/${id}/discover`, { method: 'POST' });
      if (res.ok) {
        await fetchIntegrations();
      }
    } catch (err) {
      console.error('Discovery failed:', err);
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newIntegration,
        id: newIntegration.id || newIntegration.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      };
      const res = await fetch('/api/v1/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        await fetchIntegrations();
      }
    } catch (err) {
      console.error('Failed to create integration:', err);
    }
  };

  const filteredIntegrations = integrations.filter(i => 
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.endpoint?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">MCP Integrations</h1>
              <p className="text-sm text-slate-400">First-class, reusable Model Context Protocol servers connected across all agents</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchIntegrations}
            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Refresh Integrations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Register Integration
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search integrations by name, ID, or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
          <span className="text-xs text-slate-400">Active Integrations</span>
          <span className="text-base font-bold text-amber-400">{integrations.length}</span>
        </div>
        <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg flex items-center justify-between">
          <span className="text-xs text-slate-400">Discovered Tools</span>
          <span className="text-base font-bold text-emerald-400">
            {integrations.reduce((acc, curr) => acc + (curr.discoveredTools?.length || curr.whitelistedToolNames?.length || 0), 0)}
          </span>
        </div>
      </div>

      {/* Integrations Grid */}
      {filteredIntegrations.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 my-8">
          <Plug className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-300">No Integrations Registered</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Connect an MCP server (e.g. Market Intelligence, Customer Data) to discover tools and attach them to any AgentOS agent.
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Register First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredIntegrations.map((integ) => {
            const toolCount = integ.discoveredTools?.length || integ.whitelistedToolNames?.length || 0;
            const isReady = integ.status === 'ready';

            return (
              <div 
                key={integ.id}
                onClick={() => onSelectIntegration ? onSelectIntegration(integ) : null}
                className="group p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono">
                        {integ.name?.substring(0, 2).toUpperCase() || 'MC'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition">{integ.name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">{integ.id}</span>
                        </div>
                        <span className="text-xs text-slate-400">{integ.description || 'Custom Model Context Protocol service'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="capitalize">{integ.status || 'Ready'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-300 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{integ.endpoint}</span>
                    </div>
                    <span className="text-[10px] text-amber-400 shrink-0 uppercase px-1.5 py-0.5 rounded bg-amber-500/10 font-sans font-bold">
                      {integ.environment || 'sandbox'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(integ.discoveredTools || integ.whitelistedToolNames || []).slice(0, 5).map((tool, idx) => {
                      const tName = typeof tool === 'string' ? tool : (tool.name || tool.id);
                      return (
                        <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono">
                          {tName}
                        </span>
                      );
                    })}
                    {toolCount > 5 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/40 text-slate-500 font-mono">
                        +{toolCount - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Box className="w-3.5 h-3.5 text-slate-500" />
                      <strong className="text-white">{toolCount}</strong> tools
                    </span>
                    <span>v{integ.version || '1.0.0'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDiscover(integ.id, e)}
                      disabled={discoveringId === integ.id}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3 h-3 ${discoveringId === integ.id ? 'animate-spin text-amber-400' : ''}`} />
                      Discover
                    </button>
                    <span className="text-amber-400 font-medium group-hover:translate-x-0.5 transition flex items-center gap-1">
                      Inspect <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Register New MCP Integration</h2>
            <p className="text-xs text-slate-400 mb-5">Attach any external MCP server or endpoint to make its tools universally available.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Integration Identity (ID)</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. market-intel, customer-data"
                  value={newIntegration.id}
                  onChange={(e) => setNewIntegration({...newIntegration, id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Market Intelligence"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({...newIntegration, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Endpoint URL</label>
                <input 
                  type="url" 
                  required
                  placeholder="e.g. http://localhost:8001/sse or https://sandbox.internal:8000"
                  value={newIntegration.endpoint}
                  onChange={(e) => setNewIntegration({...newIntegration, endpoint: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Environment</label>
                  <select 
                    value={newIntegration.environment}
                    onChange={(e) => setNewIntegration({...newIntegration, environment: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Credential Reference</label>
                  <input 
                    type="text" 
                    placeholder="e.g. market-intel-token"
                    value={newIntegration.credential_ref}
                    onChange={(e) => setNewIntegration({...newIntegration, credential_ref: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/10"
                >
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
