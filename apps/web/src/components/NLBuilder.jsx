import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Bot, 
  Wrench, 
  BookOpen, 
  Cpu, 
  CheckCircle, 
  RefreshCw,
  Lightbulb
} from 'lucide-react';

export default function NLBuilder({ onAgentCreated, models, tools, kbs }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState(null);

  const samplePrompts = [
    "Build a Financial Invoice Auditor that calculates tax percentages with CalculatorTool, verifies company SLA policies, and drafts audit summaries.",
    "Create a DevOps Incident Assistant that searches GitHub commits, checks infrastructure SOPs, and alerts on anomalies.",
    "Build a Research & Synthesis Agent that browses the web for the latest tech news and generates executive bullet points.",
    "Create a Customer Support Agent that references our enterprise policy knowledge base and formats structured refund requests."
  ];

  const handleSynthesize = async (textToUse) => {
    const query = textToUse || prompt;
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/v1/nl-builder/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: query })
      });
      if (res.ok) {
        const data = await res.json();
        setProposal(data);
      }
    } catch (e) {
      console.error('Failed to generate proposal:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    if (proposal && proposal.proposedAgent) {
      onAgentCreated(proposal.proposedAgent);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-glow)] border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Natural-Language Agent Architect Assistant
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
          Describe the agent you want to build
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl mx-auto">
          AgentOS will automatically analyze your intent, select zero-cost Bedrock models, wire required tools & knowledge bases, and construct a production-ready declarative blueprint.
        </p>
      </div>

      {/* Input Box */}
      <div className="glass-panel p-4 mb-6 shadow-2xl">
        <div className="relative">
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Create an agent that inspects incoming receipts, calculates currency conversions, cross-references our corporate travel policy, and prepares an expense report..."
            className="w-full bg-slate-950/60 text-sm text-slate-100 placeholder-slate-500 border border-[var(--border-subtle)] rounded-lg p-3.5 focus:outline-none focus:border-indigo-500 transition-all resize-none"
          />
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>Click any prompt below for instant synthesis:</span>
          </div>

          <button
            onClick={() => handleSynthesize(prompt)}
            disabled={loading || !prompt.trim()}
            className="btn-primary text-xs py-2 px-4 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Synthesizing Blueprint...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Agent Blueprint
              </>
            )}
          </button>
        </div>

        {/* Quick Sample Prompts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(sample);
                handleSynthesize(sample);
              }}
              className="text-left text-xs bg-slate-900/60 hover:bg-slate-800/80 border border-[var(--border-subtle)] hover:border-indigo-500/40 p-2.5 rounded-lg text-slate-300 transition-all"
            >
              "{sample}"
            </button>
          ))}
        </div>
      </div>

      {/* Proposal Review Section */}
      {proposal && (
        <div className="glass-panel p-6 border-indigo-500/40 animate-fadeIn">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-subtle)]">
            <div>
              <span className="badge badge-primary text-[10px] mb-1 inline-block">Architecture Proposal Ready</span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                {proposal.proposedAgent.name}
              </h2>
            </div>
            <button
              onClick={handleApprove}
              className="btn-primary text-xs py-2 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              Accept & Load into Canvas
            </button>
          </div>

          {/* Rationale Banner */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 mb-5 text-xs text-indigo-200">
            <strong>Assistant Rationale:</strong> {proposal.rationale.reasoning}
          </div>

          {/* Component Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {/* Model Card */}
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Foundation Model
              </div>
              <p className="text-xs font-mono text-white mb-1">
                {proposal.proposedAgent.model.modelId}
              </p>
              <span className="badge badge-free text-[9px]">Zero-Cost / Free-Tier</span>
            </div>

            {/* Attached Tools Card */}
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                Wired Tools ({proposal.proposedAgent.tools.length})
              </div>
              {proposal.proposedAgent.tools.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {proposal.proposedAgent.tools.map((t, idx) => (
                    <span key={idx} className="badge bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[var(--text-dim)]">No external tools required</span>
              )}
            </div>

            {/* Attached Knowledge Bases */}
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Knowledge Bases ({proposal.proposedAgent.knowledgeBases.length})
              </div>
              {proposal.proposedAgent.knowledgeBases.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {proposal.proposedAgent.knowledgeBases.map((kb, idx) => (
                    <span key={idx} className="badge bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]">
                      {kb}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[var(--text-dim)]">Direct reasoning without RAG</span>
              )}
            </div>
          </div>

          {/* Generated System Instructions */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Compiled System Prompt & Directives
            </label>
            <div className="bg-slate-950/70 p-3 rounded-lg border border-[var(--border-subtle)] text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {proposal.proposedAgent.instructions}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
