import React from 'react';
import { 
  Sparkles, 
  Workflow, 
  Code2, 
  Play, 
  Database, 
  Layers, 
  Cpu, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  activeAgent, 
  onPublish,
  isPublished 
}) {
  return (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--primary-glow)]">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              AgentOS
            </span>
            <span className="badge badge-free text-[10px]">Bedrock Native</span>
          </div>
          <p className="text-[11px] text-[var(--text-dim)]">The No-Code AI Multi-Agent Operating System</p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-subtle)]">
        <button
          onClick={() => setCurrentTab('simple')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'simple'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Simple (Natural Language)
        </button>

        <button
          onClick={() => setCurrentTab('advanced')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'advanced'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <Workflow className="w-3.5 h-3.5" />
          Advanced (Visual Canvas)
        </button>

        <button
          onClick={() => setCurrentTab('expert')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'expert'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Expert (JSON Spec)
        </button>

        <div className="w-[1px] h-4 bg-[var(--border-subtle)] mx-1" />

        <button
          onClick={() => setCurrentTab('registries')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'registries'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Registries
        </button>
      </div>

      {/* Action CTA */}
      <div className="flex items-center gap-3">
        {activeAgent && (
          <div className="text-right hidden md:block">
            <span className="text-xs font-medium text-white block">{activeAgent.name}</span>
            <span className="text-[10px] text-[var(--text-dim)] font-mono">
              ID: {activeAgent.agentId} • {isPublished ? 'v1.0.0 (Immutable)' : 'Draft'}
            </span>
          </div>
        )}

        <button
          onClick={() => setCurrentTab('playground')}
          className="btn-secondary text-xs py-1.5"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          Test in Playground
        </button>

        <button
          onClick={onPublish}
          disabled={isPublished}
          className={`text-xs py-1.5 ${isPublished ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 cursor-default' : 'btn-primary'}`}
        >
          {isPublished ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Published (v1.0.0)
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              Publish Version
            </>
          )}
        </button>
      </div>
    </header>
  );
}
