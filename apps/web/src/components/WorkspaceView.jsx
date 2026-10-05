import React, { useState } from 'react';

export default function WorkspaceView({ 
  agent, 
  onUpdateAgent, 
  onOpenPlayground, 
  onPublish, 
  isPublished,
  availableModels = []
}) {
  const [selectedNode, setSelectedNode] = useState('agent');
  const [zoomLevel, setZoomLevel] = useState(1);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#09090b]">
      {/* TopNavBar */}
      <header className="border-b border-outline-variant bg-surface-container-low flex justify-between items-center h-14 px-container-padding flex-shrink-0 z-40">
        <div className="flex items-center gap-4">
          <div className="text-title-sm font-title-sm font-black text-on-surface">AgentOS</div>
          <div className="h-4 w-px bg-outline-variant mx-2"></div>
          <div className="flex flex-col">
            <span className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">{agent.name || "Autonomous Agent"}</span>
            <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">
              {isPublished ? "Published v1.0" : "Draft v1.4"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPlayground}
            className="h-8 px-3 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2 border border-outline-variant text-body-sm font-body-sm text-xs"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-400">play_arrow</span>
            Test in Playground
          </button>

          <button
            onClick={onPublish}
            disabled={isPublished}
            className={`h-8 px-4 rounded font-medium text-xs transition-colors flex items-center gap-1.5 ${
              isPublished 
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' 
                : 'bg-primary text-on-primary hover:bg-primary-fixed'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isPublished ? 'check_circle' : 'publish'}
            </span>
            {isPublished ? 'Published' : 'Publish'}
          </button>

          <div className="h-4 w-px bg-outline-variant mx-1"></div>

          <button className="text-on-surface-variant hover:text-primary transition-colors rounded p-1">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors rounded p-1">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>
      </header>

      {/* Main Split Layout: Center Visual Canvas + Right Inspector */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Center Panel: Visual Workspace Canvas */}
        <section className="flex-1 bg-[#09090b] relative overflow-hidden select-none">
          {/* Radial Dot Grid Background */}
          <div 
            className="absolute inset-0 opacity-[0.04]" 
            style={{ 
              backgroundImage: 'radial-gradient(circle at 1px 1px, #e4e1ed 1px, transparent 0)', 
              backgroundSize: '24px 24px' 
            }}
          />

          {/* SVG Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <path className="node-link" d="M 280 200 C 380 200, 420 350, 520 350" fill="none" stroke="#464554" strokeWidth="2"></path>
            <path className="node-link" d="M 520 350 C 620 350, 660 250, 740 250" fill="none" stroke="#c0c1ff" strokeWidth="2" style={{ strokeDasharray: 6, animationDuration: '10s', opacity: 0.8 }}></path>
            <path className="node-link" d="M 520 350 C 620 350, 660 450, 740 450" fill="none" stroke="#464554" strokeWidth="2"></path>
          </svg>

          {/* Canvas Nodes Layer */}
          <div className="absolute inset-0 z-10 p-8 transform origin-top-left transition-transform duration-200" style={{ transform: `scale(${zoomLevel})` }}>
            
            {/* Node 1: Input/Trigger */}
            <div 
              onClick={() => setSelectedNode('input')}
              className={`absolute top-[160px] left-[90px] w-48 bg-[#18181b] border rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer transition-colors ${
                selectedNode === 'input' ? 'border-primary ring-1 ring-primary' : 'border-[#3f3f46] hover:border-outline'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">bolt</span>
                </div>
                <span className="text-title-sm font-title-sm text-on-surface font-semibold text-xs">Data Ingestion</span>
              </div>
              <div className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Webhook / Query Trigger</div>
            </div>

            {/* Node 2: Selected Agent (Research Agent / Active Agent) */}
            <div 
              onClick={() => setSelectedNode('agent')}
              className={`absolute top-[280px] left-[420px] w-64 bg-[#27272a] border rounded-xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer z-20 transition-all ${
                selectedNode === 'agent' 
                  ? 'border-primary ring-1 ring-primary ring-offset-2 ring-offset-[#09090b]' 
                  : 'border-[#3f3f46]'
              }`}
            >
              {/* Pulse Indicator */}
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-secondary-container">
                <div className="absolute inset-0 rounded-full bg-secondary node-pulse"></div>
                <div className="absolute inset-0.5 rounded-full bg-secondary"></div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                </div>
                <div>
                  <div className="text-title-sm font-title-sm text-on-surface font-bold text-xs">{agent.name || "Research Agent"}</div>
                  <div className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{agent.model?.modelId || "amazon.nova-micro-v1:0"}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-mono-label font-mono-label text-on-surface-variant text-[10px]">
                  Web Search
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-mono-label font-mono-label text-on-surface-variant text-[10px]">
                  Calculator
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-mono-label font-mono-label text-on-surface-variant text-[10px]">
                  Bedrock RAG
                </span>
              </div>
            </div>

            {/* Node 3: Output/Action 1 (Report Gen) */}
            <div 
              onClick={() => setSelectedNode('report')}
              className={`absolute top-[200px] left-[740px] w-48 bg-[#18181b] border rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer transition-colors ${
                selectedNode === 'report' ? 'border-primary ring-1 ring-primary' : 'border-[#3f3f46] hover:border-outline'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">edit_document</span>
                </div>
                <span className="text-title-sm font-title-sm text-on-surface font-semibold text-xs">Report Gen</span>
              </div>
              <div className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Format & Save Output</div>
            </div>

            {/* Node 4: Output/Action 2 (Notify Team) */}
            <div 
              onClick={() => setSelectedNode('notify')}
              className={`absolute top-[400px] left-[740px] w-48 bg-[#18181b] border rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer transition-colors ${
                selectedNode === 'notify' ? 'border-primary ring-1 ring-primary' : 'border-[#3f3f46] hover:border-outline'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">send</span>
                </div>
                <span className="text-title-sm font-title-sm text-on-surface font-semibold text-xs">Notify Team</span>
              </div>
              <div className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">Slack / Webhook Dispatch</div>
            </div>

          </div>

          {/* Controls overlay (Bottom Left) */}
          <div className="absolute bottom-6 left-6 flex gap-1.5 bg-[#18181b] border border-[#3f3f46] rounded-lg p-1 z-30">
            <button 
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">zoom_in</span>
            </button>
            <button 
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">zoom_out</span>
            </button>
            <div className="w-px h-6 bg-[#3f3f46] self-center mx-1"></div>
            <button 
              onClick={() => setZoomLevel(1)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">fit_screen</span>
            </button>
          </div>
        </section>

        {/* Right Inspector Panel */}
        <aside className="w-[330px] h-full bg-[#18181b] border-l border-[#3f3f46] flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Inspector Header */}
          <div className="p-4 border-b border-[#3f3f46] flex items-center justify-between sticky top-0 bg-[#18181b] z-10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
              <span className="text-title-sm font-title-sm font-semibold text-sm text-on-surface">Inspector</span>
            </div>
            <span className="text-mono-label font-mono-label text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              Agent Node
            </span>
          </div>

          <div className="p-4 flex flex-col gap-5">
            {/* Identity Section */}
            <section>
              <h3 className="text-mono-label font-mono-label text-on-surface-variant uppercase text-[11px] mb-2 font-semibold tracking-wider">
                Identity
              </h3>
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-body-sm font-body-sm text-on-surface mb-1 text-xs">Name</label>
                  <input
                    className="w-full bg-[#13131b] border border-[#3f3f46] rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
                    type="text"
                    value={agent.name || ''}
                    onChange={(e) => onUpdateAgent({ ...agent, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-body-sm text-on-surface mb-1 text-xs">Description</label>
                  <textarea
                    className="w-full bg-[#13131b] border border-[#3f3f46] rounded px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[50px] resize-none"
                    value={agent.description || ''}
                    onChange={(e) => onUpdateAgent({ ...agent, description: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <hr className="border-[#3f3f46]" />

            {/* Model Configuration */}
            <section>
              <h3 className="text-mono-label font-mono-label text-on-surface-variant uppercase text-[11px] mb-2 font-semibold tracking-wider">
                Model Configuration
              </h3>
              <div className="flex flex-col gap-2.5">
                <div>
                  <select
                    className="w-full bg-[#13131b] border border-[#3f3f46] rounded px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
                    value={agent.model?.modelId || 'amazon.nova-micro-v1:0'}
                    onChange={(e) => onUpdateAgent({ ...agent, model: { ...agent.model, modelId: e.target.value } })}
                  >
                    <option value="amazon.nova-micro-v1:0">Amazon Nova Micro (Free-Tier Eligible)</option>
                    <option value="amazon.titan-text-lite-v1">Amazon Titan Text Lite</option>
                    <option value="anthropic.claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="openai.gpt-4o">GPT-4o</option>
                  </select>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <label className="text-xs text-on-surface">Temperature (0.2)</label>
                  <input className="w-24 accent-primary" max="1" min="0" step="0.1" type="range" defaultValue="0.2" />
                </div>
              </div>
            </section>

            <hr className="border-[#3f3f46]" />

            {/* Instructions Editor with Line Numbers */}
            <section className="flex flex-col">
              <h3 className="text-mono-label font-mono-label text-on-surface-variant uppercase text-[11px] mb-2 font-semibold tracking-wider">
                System Instructions
              </h3>
              <div className="relative rounded border border-[#3f3f46] bg-[#13131b] overflow-hidden min-h-[160px]">
                <div className="absolute top-0 left-0 w-7 h-full bg-[#18181b] border-r border-[#3f3f46] flex flex-col items-center py-2 text-mono-label font-mono-label text-outline-variant text-[11px] select-none">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
                <textarea
                  className="w-full h-full bg-transparent border-none pl-9 py-2 pr-2 text-mono-code font-mono-code text-on-surface focus:ring-0 focus:outline-none text-[11px] resize-none leading-relaxed"
                  spellCheck="false"
                  rows={6}
                  value={agent.instructions || ''}
                  onChange={(e) => onUpdateAgent({ ...agent, instructions: e.target.value })}
                />
              </div>
            </section>

            <hr className="border-[#3f3f46]" />

            {/* Safety Guardrails */}
            <section>
              <h3 className="text-mono-label font-mono-label text-on-surface-variant uppercase text-[11px] mb-2 font-semibold tracking-wider">
                Guardrails & Safety
              </h3>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-on-surface">
                  <input defaultChecked className="rounded border-[#3f3f46] bg-[#13131b] text-primary focus:ring-primary" type="checkbox" />
                  <span>Block PII extraction</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-on-surface">
                  <input className="rounded border-[#3f3f46] bg-[#13131b] text-primary focus:ring-primary" type="checkbox" />
                  <span>Require Human-in-the-Loop</span>
                </label>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
