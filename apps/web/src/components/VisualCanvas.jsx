import React, { useState } from 'react';
import { 
  Bot, 
  Wrench, 
  BookOpen, 
  Cpu, 
  GitBranch, 
  FileText, 
  Plus, 
  Trash2, 
  Layers, 
  ArrowRight,
  Shield,
  Clock,
  Sparkles
} from 'lucide-react';

export default function VisualCanvas({ agent, onUpdateAgent, availableTools, availableKbs, availableModels }) {
  const [selectedNode, setSelectedNode] = useState('agent_root');

  // Node Palette items
  const addToolToAgent = (toolId) => {
    if (!agent.tools.includes(toolId)) {
      onUpdateAgent({
        ...agent,
        tools: [...agent.tools, toolId]
      });
    }
  };

  const removeToolFromAgent = (toolId) => {
    onUpdateAgent({
      ...agent,
      tools: agent.tools.filter((t) => t !== toolId)
    });
  };

  const addKbToAgent = (kbId) => {
    if (!agent.knowledgeBases.includes(kbId)) {
      onUpdateAgent({
        ...agent,
        knowledgeBases: [...agent.knowledgeBases, kbId]
      });
    }
  };

  const removeKbFromAgent = (kbId) => {
    onUpdateAgent({
      ...agent,
      knowledgeBases: agent.knowledgeBases.filter((k) => k !== kbId)
    });
  };

  const addChildAgent = () => {
    const newChild = {
      childAgentId: `child_specialist_${Date.now().toString().slice(-4)}`,
      childVersion: "1.0.0",
      delegationTrigger: "Use when deep analysis or sub-task processing is needed.",
      inputMappingSchema: { "type": "object", "properties": { "subTask": { "type": "string" } } }
    };
    onUpdateAgent({
      ...agent,
      childAgents: [...(agent.childAgents || []), newChild]
    });
  };

  const removeChildAgent = (childId) => {
    onUpdateAgent({
      ...agent,
      childAgents: (agent.childAgents || []).filter((c) => c.childAgentId !== childId)
    });
  };

  return (
    <div className="flex h-[calc(100vh-62px)] overflow-hidden">
      {/* Left Node Library Palette */}
      <div className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-2">
            Node Library (Drag / Click to Add)
          </span>

          <div className="space-y-2">
            <div className="p-2.5 bg-slate-900/60 border border-[var(--border-subtle)] hover:border-indigo-500/40 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs text-slate-200 transition-all">
              <Bot className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="font-semibold block">Agent Node</span>
                <span className="text-[10px] text-[var(--text-dim)]">Autonomous ReAct Loop</span>
              </div>
            </div>

            <div 
              onClick={addChildAgent}
              className="p-2.5 bg-slate-900/60 border border-[var(--border-subtle)] hover:border-cyan-500/40 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs text-slate-200 transition-all"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="font-semibold block">+ Child Agent Node</span>
                <span className="text-[10px] text-[var(--text-dim)]">Hierarchical Delegate ($D_{`max`}=3$)</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 border border-[var(--border-subtle)] hover:border-amber-500/40 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs text-slate-200 transition-all">
              <Wrench className="w-4 h-4 text-amber-400" />
              <div>
                <span className="font-semibold block">Tool Node</span>
                <span className="text-[10px] text-[var(--text-dim)]">REST / Function Integration</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 border border-[var(--border-subtle)] hover:border-emerald-500/40 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs text-slate-200 transition-all">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-semibold block">Knowledge Node</span>
                <span className="text-[10px] text-[var(--text-dim)]">Bedrock Vector RAG</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 border border-[var(--border-subtle)] hover:border-purple-500/40 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs text-slate-200 transition-all">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <div>
                <span className="font-semibold block">Condition / Router</span>
                <span className="text-[10px] text-[var(--text-dim)]">Rule-Based Branching</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Attach Tools */}
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-2">
            Available Tools
          </span>
          <div className="space-y-1.5">
            {availableTools.map((t) => {
              const isAttached = agent.tools.includes(t.toolId);
              return (
                <div 
                  key={t.toolId}
                  className="flex items-center justify-between p-2 rounded bg-slate-950/40 text-xs border border-[var(--border-subtle)]"
                >
                  <span className="text-slate-300 truncate max-w-[130px]">{t.name}</span>
                  {isAttached ? (
                    <button 
                      onClick={() => removeToolFromAgent(t.toolId)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => addToolToAgent(t.toolId)}
                      className="text-indigo-400 hover:text-indigo-300 p-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Attach Knowledge Bases */}
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-2">
            Available Knowledge Bases
          </span>
          <div className="space-y-1.5">
            {availableKbs.map((kb) => {
              const isAttached = agent.knowledgeBases.includes(kb.kbId);
              return (
                <div 
                  key={kb.kbId}
                  className="flex items-center justify-between p-2 rounded bg-slate-950/40 text-xs border border-[var(--border-subtle)]"
                >
                  <span className="text-slate-300 truncate max-w-[130px]">{kb.name}</span>
                  {isAttached ? (
                    <button 
                      onClick={() => removeKbFromAgent(kb.kbId)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => addKbToAgent(kb.kbId)}
                      className="text-cyan-400 hover:text-cyan-300 p-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center Graph Canvas */}
      <div className="flex-1 canvas-grid relative bg-[#090D14] overflow-auto p-10 flex flex-col items-center">
        <div className="w-full max-w-3xl flex flex-col items-center gap-8">
          
          {/* Trigger / Input Node */}
          <div className="w-80 glass-panel p-3.5 border-emerald-500/40 shadow-lg text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 mb-1">
              <FileText className="w-4 h-4" />
              TRIGGER NODE (USER INPUT)
            </div>
            <p className="text-[11px] text-[var(--text-dim)] font-mono">Inbound schema: &#123; query: string &#125;</p>
          </div>

          <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500 to-indigo-500" />

          {/* Root Agent Node (Centerpiece) */}
          <div 
            onClick={() => setSelectedNode('agent_root')}
            className={`w-[420px] glass-panel p-5 border-2 cursor-pointer transition-all shadow-2xl ${
              selectedNode === 'agent_root'
                ? 'border-indigo-500 shadow-indigo-500/20'
                : 'border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{agent.name}</h3>
                  <span className="badge badge-free text-[9px]">Root ReAct Supervisor</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-dim)]">{agent.agentId}</span>
            </div>

            <p className="text-xs text-slate-300 mb-4 line-clamp-2">{agent.description}</p>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--border-subtle)] text-[11px]">
              <div>
                <span className="text-[var(--text-dim)] block">Model:</span>
                <span className="font-mono text-slate-200">{agent.model.modelId}</span>
              </div>
              <div>
                <span className="text-[var(--text-dim)] block">Context Compress:</span>
                <span className="font-semibold text-amber-400">At {agent.contextPolicy?.compressionThreshold * 100}% Capacity</span>
              </div>
            </div>
          </div>

          {/* Connected Child Agents & Tool Swarm */}
          {((agent.childAgents && agent.childAgents.length > 0) || agent.tools.length > 0 || agent.knowledgeBases.length > 0) && (
            <>
              <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-cyan-500" />

              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Child Agents Column */}
                {agent.childAgents && agent.childAgents.map((child, idx) => (
                  <div key={idx} className="glass-panel p-3.5 border-cyan-500/30 relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Child Agent
                      </div>
                      <button 
                        onClick={() => removeChildAgent(child.childAgentId)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-mono text-xs text-white block mb-1">{child.childAgentId}</span>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">{child.delegationTrigger}</p>
                  </div>
                ))}

                {/* Attached Tools */}
                {agent.tools.map((tid, idx) => {
                  const t = availableTools.find((x) => x.toolId === tid);
                  return (
                    <div key={idx} className="glass-panel p-3.5 border-amber-500/30 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <Wrench className="w-4 h-4 text-amber-400" />
                          Tool Node
                        </div>
                        <button 
                          onClick={() => removeToolFromAgent(tid)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-semibold text-xs text-white block mb-1">{t?.name || tid}</span>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">{t?.description}</p>
                    </div>
                  );
                })}

                {/* Attached Knowledge Bases */}
                {agent.knowledgeBases.map((kbid, idx) => {
                  const kb = availableKbs.find((x) => x.kbId === kbid);
                  return (
                    <div key={idx} className="glass-panel p-3.5 border-emerald-500/30 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                          <BookOpen className="w-4 h-4 text-emerald-400" />
                          Knowledge RAG
                        </div>
                        <button 
                          onClick={() => removeKbFromAgent(kbid)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-semibold text-xs text-white block mb-1">{kb?.name || kbid}</span>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">{kb?.description}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-500 to-indigo-500" />

          {/* Validated Output Node */}
          <div className="w-80 glass-panel p-3.5 border-indigo-500/40 shadow-lg text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 mb-1">
              <Sparkles className="w-4 h-4" />
              FINAL OUTPUT CONTRACT
            </div>
            <p className="text-[11px] text-[var(--text-dim)] font-mono">Outbound: &#123; response: string, confidence: float &#125;</p>
          </div>

        </div>
      </div>

      {/* Right Properties Inspector */}
      <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 overflow-y-auto">
        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Agent Node Inspector
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-[var(--text-dim)] font-semibold block mb-1">Agent Name</label>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => onUpdateAgent({ ...agent, name: e.target.value })}
              className="w-full bg-slate-950/60 border border-[var(--border-subtle)] rounded p-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[var(--text-dim)] font-semibold block mb-1">Foundation Model</label>
            <select
              value={agent.model.modelId}
              onChange={(e) => onUpdateAgent({ ...agent, model: { ...agent.model, modelId: e.target.value } })}
              className="w-full bg-slate-950/60 border border-[var(--border-subtle)] rounded p-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {availableModels.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[var(--text-dim)] font-semibold block mb-1">System Instructions</label>
            <textarea
              rows={6}
              value={agent.instructions}
              onChange={(e) => onUpdateAgent({ ...agent, instructions: e.target.value })}
              className="w-full bg-slate-950/60 border border-[var(--border-subtle)] rounded p-2 text-white font-mono text-[11px] focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[var(--text-dim)] font-semibold block mb-1">
              Context Compression Threshold ({agent.contextPolicy?.compressionThreshold * 100}%)
            </label>
            <input
              type="range"
              min="0.30"
              max="0.80"
              step="0.05"
              value={agent.contextPolicy?.compressionThreshold || 0.60}
              onChange={(e) => onUpdateAgent({
                ...agent,
                contextPolicy: { ...agent.contextPolicy, compressionThreshold: parseFloat(e.target.value) }
              })}
              className="w-full accent-indigo-500"
            />
            <span className="text-[10px] text-amber-400 block mt-1">
              Compresses older context and retains directives automatically at 60%.
            </span>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-dim)]">Max Steps Limit:</span>
              <span className="font-semibold text-white">{agent.runtime?.maxExecutionSteps || 15}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-dim)]">Max Hierarchy Depth:</span>
              <span className="font-semibold text-white">3 Tiers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
