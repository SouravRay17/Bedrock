import React, { useState } from 'react';

export default function RegistriesListView({ 
  viewType, 
  models = [], 
  tools = [], 
  mcpCollections = [], 
  kbs = [],
  onOpenCreateAgent,
  onOpenCreateTool,
  onSelectTool,
  onRefresh 
}) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-6 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant">
        <div>
          <h2 className="text-display-lg font-display-lg text-on-surface capitalize text-2xl font-bold tracking-tight">
            {viewType} Registry
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant text-xs mt-1">
            Manage, discover, and attach {viewType} capabilities across your AgentOS projects.
          </p>
        </div>

        {viewType === 'tools' ? (
          <button 
            onClick={onOpenCreateTool}
            className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-2 rounded-lg font-mono-label text-mono-label text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(192,193,255,0.2)] font-semibold transition-all hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Tool
          </button>
        ) : (
          <button 
            onClick={onOpenCreateAgent}
            className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-2 rounded-lg font-mono-label text-mono-label text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(192,193,255,0.2)] font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add to {viewType}
          </button>
        )}
      </div>

      {/* Models View */}
      {viewType === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((m) => (
            <div key={m.modelId} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-outline transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">redeem</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">{m.displayName}</h3>
                    <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{m.modelId}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-label">
                  {m.pricingTier}
                </span>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{m.description}</p>
              <div className="flex gap-2 pt-3 border-t border-outline-variant/40 text-mono-code text-[11px] text-on-surface-variant">
                <span>Context: <strong className="text-on-surface">{m.maxContextTokens.toLocaleString()} tokens</strong></span>
                <span>•</span>
                <span>Tool Calling: <strong className="text-emerald-400">Native</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tools View */}
      {viewType === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((t) => (
            <div 
              key={t.toolId} 
              onClick={() => onSelectTool && onSelectTool(t)}
              className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-primary transition-all cursor-pointer group flex flex-col justify-between hover:shadow-xl"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform border border-outline-variant">
                      <span className="material-symbols-outlined text-[18px]">construction</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{t.name}</h3>
                      <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{t.slug || t.toolId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.safeToRun && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-label">
                        Safe
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-surface-container-highest border border-outline-variant text-[10px] font-mono-label text-primary font-bold">
                      {t.toolType || 'HTTP API'}
                    </span>
                  </div>
                </div>
                <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{t.description}</p>
                {t.endpointUrl && (
                  <div className="p-2 bg-surface-container-lowest rounded border border-outline-variant/30 font-mono-code text-[11px] text-on-surface-variant truncate mb-3">
                    <span className="text-primary font-bold">{t.httpMethod || 'POST'}</span> {t.endpointUrl}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono-label text-on-surface-variant">
                <span>Location: {t.location || 'Engineering Group / tools'}</span>
                <span className="text-primary font-bold group-hover:underline flex items-center gap-0.5">
                  Configure & Test <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MCP & Collections View */}
      {viewType === 'mcp' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mcpCollections.map((col) => (
            <div key={col.collectionId} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-outline transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">
                      {col.collectionType === 'OpenAPI Specification' ? 'api' : 'hub'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">{col.name}</h3>
                    <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{col.slug || col.collectionId}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-mono-label font-bold">
                  {col.collectionType || 'MCP Server'}
                </span>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{col.description}</p>
              {col.serverUrl && (
                <div className="p-2 bg-surface-container-lowest rounded border border-outline-variant/30 font-mono-code text-[10px] text-on-surface-variant truncate mb-3">
                  <span className="text-primary font-bold">Endpoint:</span> {col.serverUrl}
                </div>
              )}
              <div className="pt-3 border-t border-outline-variant/40">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-mono-label text-on-surface-variant uppercase">AWS Bedrock ToolSpecs:</span>
                  <span className="text-[10px] font-mono-label text-emerald-400 font-bold">
                    {(col.discoveredTools?.length || col.whitelistedToolNames?.length || 0)} Tools
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(col.whitelistedToolNames || col.servers || []).map((name, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-mono-code text-on-surface">
                      {typeof name === 'string' ? name : name.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Knowledge View */}
      {viewType === 'knowledge' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kbs.map((kb) => (
            <div key={kb.kbId} className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-outline transition-colors">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded bg-surface-bright flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">{kb.name}</h3>
                  <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{kb.kbId}</span>
                </div>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3">{kb.description}</p>
              <div className="flex gap-3 pt-3 border-t border-outline-variant/40 text-mono-code text-[11px] text-on-surface-variant">
                <span>Embedding: <strong className="text-on-surface">{kb.embeddingModel}</strong></span>
                <span>•</span>
                <span>Top-K: <strong className="text-on-surface">{kb.topK}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Executions / Agents / Settings fallback */}
      {['executions', 'agents', 'settings'].includes(viewType) && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">construction</span>
          <h3 className="text-title-sm font-title-sm text-on-surface font-semibold capitalize mb-1">{viewType} Management</h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant text-xs max-w-md mx-auto">
            Configured within the active Project scope. Use the top navigation to test active executions in the Playground.
          </p>
        </div>
      )}
    </div>
  );
}
