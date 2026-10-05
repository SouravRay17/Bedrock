import React, { useState } from 'react';
import { 
  Play, 
  Send, 
  RefreshCw, 
  Bot, 
  User, 
  Cpu, 
  Wrench, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Flame,
  Activity
} from 'lucide-react';

export default function Playground({ agent }) {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am ${agent.name}. Ready to execute goals using my model (${agent.model.modelId}) and attached capabilities.`
    }
  ]);
  const [activeTrace, setActiveTrace] = useState(null);

  const handleExecute = async () => {
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery;
    setInputQuery('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/agents/${agent.agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'latest',
          inputs: { query: userText }
        })
      });

      if (res.ok) {
        const trace = await res.json();
        setActiveTrace(trace);
        const responseText = trace.outputs?.response || "Task executed.";
        setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
      }
    } catch (e) {
      console.error('Execution error:', e);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Execution error occurred.' }]);
    } finally {
      setLoading(false);
    }
  };

  const contextPercent = activeTrace ? activeTrace.contextUsagePercent : 15.0;
  const isCompressed = activeTrace && activeTrace.contextCompressedCount > 0;

  return (
    <div className="flex h-[calc(100vh-62px)]">
      {/* Left Chat Interactive Panel */}
      <div className="flex-1 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-main)]">
        {/* Playground Subheader & Context Gauge */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white">Live Playground Session</span>
            <span className="badge badge-primary text-[10px]">{agent.name}</span>
          </div>

          {/* 60% Dynamic Context Window Gauge */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-dim)] block">Context Capacity</span>
              <span className={`text-xs font-mono font-bold ${contextPercent >= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {contextPercent}% utilized
              </span>
            </div>
            <div className="w-28 h-2 bg-slate-900 rounded-full overflow-hidden border border-[var(--border-subtle)]">
              <div 
                className={`h-full transition-all duration-500 ${
                  contextPercent >= 60 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, contextPercent)}%` }}
              />
            </div>
            {isCompressed && (
              <span className="badge badge-warning text-[9px] flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                60% Auto-Compressed
              </span>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-2xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-[var(--border-subtle)] text-indigo-400'
              }`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'glass-panel text-slate-200 rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-2xl">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-[var(--border-subtle)] flex items-center justify-center text-indigo-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="glass-panel p-3 rounded-xl text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span>Executing ReAct reasoning & delegation loop...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecute();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={`Ask ${agent.name} or provide a task payload...`}
              className="flex-1 bg-slate-950/60 border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="btn-primary text-xs py-2.5 px-4 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Execution Trace Inspector */}
      <div className="w-96 border-l border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Execution Trace Tree
          </h3>
          {activeTrace && (
            <span className="badge badge-free text-[9px]">{activeTrace.status}</span>
          )}
        </div>

        {activeTrace ? (
          <div className="space-y-3">
            <div className="p-2.5 bg-slate-950/40 rounded border border-[var(--border-subtle)] text-[11px] space-y-1">
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Execution ID:</span>
                <span className="font-mono text-slate-200">{activeTrace.executionId}</span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Total Tokens:</span>
                <span className="font-semibold text-indigo-300">{activeTrace.totalTokens} tokens</span>
              </div>
            </div>

            {/* Steps Timeline */}
            <div className="space-y-2.5">
              {activeTrace.steps.map((step, idx) => (
                <div key={idx} className="p-3 bg-slate-900/60 border border-[var(--border-subtle)] rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="badge bg-slate-800 text-indigo-300 text-[9px]">
                      Step {step.stepIndex} • {step.stepType}
                    </span>
                    {step.durationMs > 0 && (
                      <span className="text-[10px] text-[var(--text-dim)]">{step.durationMs}ms</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-200 mb-1">{step.title}</h4>
                  
                  {step.outputPayload && (
                    <div className="mt-1.5 p-2 bg-slate-950 rounded font-mono text-[10px] text-slate-300 overflow-x-auto max-h-28">
                      {typeof step.outputPayload === 'object' 
                        ? JSON.stringify(step.outputPayload, null, 2)
                        : String(step.outputPayload)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-[var(--text-dim)] text-xs">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Send a query in the playground to view live ReAct steps, tool calls, and context compression traces.
          </div>
        )}
      </div>
    </div>
  );
}
