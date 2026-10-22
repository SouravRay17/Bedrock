import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plug, RefreshCw, CheckCircle2, Box, ShieldCheck, 
  ExternalLink, Copy, Check, Terminal, FileCode, Trash2
} from 'lucide-react';

export default function IntegrationDetailView({ integration, onBack, onRefresh }) {
  const [tools, setTools] = useState(integration?.discoveredTools || []);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  const fetchToolsAndHealth = async () => {
    if (!integration?.id) return;
    try {
      setLoading(true);
      const [toolsRes, healthRes] = await Promise.all([
        fetch(`/api/v1/integrations/${integration.id}/tools`),
        fetch(`/api/v1/integrations/${integration.id}/health`)
      ]);
      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTools(data.tools || []);
      }
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthStatus(hData);
      }
    } catch (e) {
      console.error('Error fetching detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsAndHealth();
  }, [integration?.id]);

  const handleDiscover = async () => {
    if (!integration?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/integrations/${integration.id}/discover`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error('Discovery error:', e);
    } finally {
      setLoading(false);
    }
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(integration.endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-8">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Integrations Catalog
      </button>

      {/* Hero Header */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-xl">
              {integration.name?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{integration.name}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded font-mono bg-slate-800 text-slate-300">{integration.id}</span>
                <span className="text-xs px-2.5 py-0.5 rounded uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {integration.environment || 'sandbox'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{integration.description || 'Model Context Protocol Integration'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleDiscover}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh / Discover Tools
            </button>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Endpoint Location</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-slate-200 truncate">{integration.endpoint}</span>
              <button onClick={copyEndpoint} className="text-slate-500 hover:text-slate-300">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Credential Reference</span>
            <span className="text-xs font-mono text-amber-400 mt-1 block">
              {integration.credential_ref ? `Bearer {{${integration.credential_ref}}}` : 'None (Public)'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Live Probe Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${healthStatus?.status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-slate-300">{healthStatus?.status || 'Online (Ready)'}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Total Tools Exposed</span>
            <span className="text-xs font-bold text-white mt-1 block">{tools.length} Reusable Tools</span>
          </div>
        </div>
      </div>

      {/* Discovered Tools List */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Box className="w-5 h-5 text-amber-400" />
          Discovered Tools Catalog ({tools.length})
        </h2>

        {tools.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500">No tools discovered yet. Click "Refresh / Discover Tools" above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map((tool, idx) => {
              const tName = typeof tool === 'string' ? tool : tool.name;
              const tDesc = tool.description || 'Tool schema synthesized from MCP endpoint';
              const params = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [];

              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-amber-400 font-mono">{tName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {integration.id}.{tName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">{tDesc}</p>
                  </div>

                  {params.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/60">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5 font-semibold">Inputs / Parameters</span>
                      <div className="flex flex-wrap gap-1">
                        {params.map((p, pIdx) => (
                          <span key={pIdx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
