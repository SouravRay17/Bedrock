import React, { useState, useRef, useEffect } from 'react';

// Lightweight Markdown & Thought Formatter Component
function FormattedMessageContent({ text }) {
  if (!text) return null;

  // Extract <thinking> tags if present from Bedrock Nova reasoning output
  let thinkingContent = null;
  let cleanText = text;
  const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkingMatch) {
    thinkingContent = thinkingMatch[1].trim();
    cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  }

  const [showThinking, setShowThinking] = useState(false);

  // Render paragraphs, lists, bold text, and code blocks
  const renderFormattedLines = (content) => {
    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeLanguage = '';

    lines.forEach((line, idx) => {
      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.trim().replace('```', '') || 'text';
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <div key={`code-${idx}`} className="my-2.5 rounded-lg overflow-hidden border border-outline-variant bg-[#0d1117] text-xs">
              {codeLanguage && (
                <div className="px-3 py-1 bg-surface-container border-b border-outline-variant text-[10px] font-mono-code text-on-surface-variant flex justify-between items-center">
                  <span>{codeLanguage}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(codeBlockContent.join('\n'))}
                    className="hover:text-primary transition-colors text-[10px]"
                  >
                    Copy
                  </button>
                </div>
              )}
              <pre className="p-3 text-[12px] font-mono-code text-emerald-300 overflow-x-auto">
                <code>{codeBlockContent.join('\n')}</code>
              </pre>
            </div>
          );
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${idx}`} className="text-sm font-bold text-on-surface mt-3 mb-1.5 flex items-center gap-1.5 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            {line.replace('### ', '')}
          </h4>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${idx}`} className="text-base font-bold text-on-surface mt-4 mb-2">
            {line.replace('## ', '')}
          </h3>
        );
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={`h2-${idx}`} className="text-lg font-bold text-on-surface mt-4 mb-2">
            {line.replace('# ', '')}
          </h2>
        );
        return;
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
        const bulletText = line.trim().replace(/^[-*•]\s+/, '');
        elements.push(
          <li key={`li-${idx}`} className="text-xs text-on-surface/90 ml-4 list-disc my-0.5 leading-relaxed">
            {formatInlineStyles(bulletText)}
          </li>
        );
        return;
      }

      // Numbered items
      if (/^\d+\.\s+/.test(line.trim())) {
        const numText = line.trim().replace(/^\d+\.\s+/, '');
        elements.push(
          <li key={`num-${idx}`} className="text-xs text-on-surface/90 ml-4 list-decimal my-0.5 leading-relaxed">
            {formatInlineStyles(numText)}
          </li>
        );
        return;
      }

      // Regular line / paragraph
      if (line.trim() === '') {
        elements.push(<div key={`space-${idx}`} className="h-1.5"></div>);
      } else {
        elements.push(
          <p key={`p-${idx}`} className="text-xs text-on-surface/90 leading-relaxed my-1">
            {formatInlineStyles(line)}
          </p>
        );
      }
    });

    return elements;
  };

  // Inline formatting for **bold**, `code`, and [links]
  const formatInlineStyles = (str) => {
    // Split by inline code first
    const parts = str.split(/(`[^`]+`)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={pIdx} className="px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline-variant text-[11px] font-mono-code text-secondary">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Split by **bold**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return (
            <strong key={`${pIdx}-${bIdx}`} className="font-bold text-on-surface">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        return bPart;
      });
    });
  };

  return (
    <div className="space-y-1">
      {thinkingContent && (
        <div className="mb-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest overflow-hidden">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono-label text-on-surface-variant hover:text-on-surface transition-colors bg-surface-container-low"
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-tertiary">psychology</span>
              <span>Model Reasoning Process</span>
            </span>
            <span className="material-symbols-outlined text-[16px]">
              {showThinking ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {showThinking && (
            <div className="p-3 text-[11px] font-mono-code text-on-surface-variant/80 border-t border-outline-variant/40 bg-[#0c0d12] whitespace-pre-wrap leading-relaxed">
              {thinkingContent}
            </div>
          )}
        </div>
      )}

      <div>{renderFormattedLines(cleanText)}</div>
    </div>
  );
}

export default function HomeView({ 
  onSelectAgent, 
  onSelectTool,
  onOpenPlaygroundWithPrompt 
}) {
  const [chatPrompt, setChatPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const chatBottomRef = useRef(null);

  const suggestedQuestions = [
    { label: "What can AgentOS do?", query: "What are the core capabilities and features of AgentOS?" },
    { label: "Which Bedrock models are free?", query: "Which Amazon Bedrock foundation models are zero-cost or free-tier eligible?" },
    { label: "How do MCP tools & Bearer auth work?", query: "How does AgentOS handle Model Context Protocol (MCP) servers and secure Bearer auth tokens without exposing secrets to the LLM?" },
    { label: "How does context compression work?", query: "How does adaptive context management and 60% compression threshold work in AgentOS?" },
    { label: "How do I build a multi-agent swarm?", query: "How do I create and connect hierarchical child agents with delegation contracts in AgentOS?" }
  ];

  // Dynamic Agents and Tools state
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);

  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch('/api/v1/agents'),
          fetch('/api/v1/tools')
        ]);
        if (aRes.ok) setAgents(await aRes.json());
        if (tRes.ok) setTools(await tRes.json());
      } catch (err) {
        console.error('Failed to load agents/tools in HomeView:', err);
      }
    };
    fetchEntities();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const executeConciergeQuery = async (queryText) => {
    if (!queryText.trim() || loading) return;

    const userText = queryText.trim();
    setChatPrompt('');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const startTime = performance.now();

    // Append user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userText, time: timeNow }
    ]);
    setLoading(true);

    try {
      const targetAgentId = agents[0]?.agentId || agents[0]?.id || 'agent_aa';
      const res = await fetch(`/api/v1/agents/${targetAgentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'latest',
          inputs: { query: userText }
        })
      });

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2) + 's';

      if (res.ok) {
        const trace = await res.json();
        const responseText = trace.outputs?.response || "I have analyzed your request regarding AgentOS capabilities.";
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: responseText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tokensUsed: trace.totalTokens || 120,
            latency: elapsedSec,
            model: 'Amazon Nova Micro (Free-Tier)',
            trace: trace
          }
        ]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `AgentOS Concierge encountered an error: ${errorData.detail || 'Unable to execute query with Bedrock runtime'}. Please ensure AWS credentials or local runtime is active.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: true,
            latency: elapsedSec
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Network error connecting to AgentOS runtime: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    executeConciergeQuery(chatPrompt);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="max-w-5xl mx-auto p-container-padding mt-4 animate-fadeIn pb-20">
      {/* Header Greeting */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono-label text-primary mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          AgentOS Live Concierge • Amazon Nova Micro (Free-Tier Eligible)
        </div>
        <h1 className="text-display-lg font-display-lg text-on-surface mb-2 tracking-tight">
          Good evening.
        </h1>
        <p className="text-headline-md font-headline-md text-on-surface-variant font-normal text-base max-w-xl mx-auto">
          Explore AgentOS multi-agent swarms, MCP servers, foundation models, and enterprise governance.
        </p>
      </div>

      {/* Main Interactive AI Concierge Chat Box & Conversation Feed */}
      <div className="mb-12 max-w-3xl mx-auto">
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] overflow-hidden">
          
          {/* Concierge Bar Header */}
          <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface">
                    {agents[0]?.name ? `Agent ${agents[0].name.toUpperCase()}` : 'Agent AA'}
                  </span>
                  <span className="text-[10px] font-mono-label px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active Agent
                  </span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-mono-label">
                  Connected to Yahoo Finance MCP Collection
                </div>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-xs font-mono-label text-on-surface-variant hover:text-error transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-highest"
                title="Clear conversation"
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                <span>Reset Chat</span>
              </button>
            )}
          </div>

          {/* Conversation History / Message List */}
          {messages.length > 0 && (
            <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto bg-[#0d0e14] border-b border-outline-variant/60 scroll-hidden">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[88%] p-3.5 rounded-xl ${
                    m.role === 'user'
                      ? 'bg-primary/15 border border-primary/30 text-on-surface rounded-tr-xs'
                      : m.isError
                        ? 'bg-error/10 border border-error/30 text-error rounded-tl-xs'
                        : 'bg-surface-container border border-outline-variant text-on-surface rounded-tl-xs shadow-md'
                  }`}>
                    {m.role === 'assistant' && (
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-outline-variant/40 text-[11px] font-mono-label text-on-surface-variant">
                        <div className="flex items-center gap-1.5 text-primary">
                          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                          <span className="font-bold">AgentOS Concierge</span>
                        </div>
                        {m.tokensUsed && (
                          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/80">
                            <span>{m.tokensUsed} tokens</span>
                            <span>•</span>
                            <span>{m.latency}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <FormattedMessageContent text={m.content} />

                    {m.role === 'assistant' && !m.isError && (
                      <div className="mt-2.5 pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] text-on-surface-variant font-mono-label">
                        <span className="text-secondary flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          Amazon Nova Micro
                        </span>
                        <button
                          onClick={() => onOpenPlaygroundWithPrompt(m.content)}
                          className="hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>Open in Playground</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono-label text-on-surface-variant/60 mt-1 px-1">
                    {m.role === 'user' ? 'You' : 'Concierge'} • {m.time}
                  </span>
                </div>
              ))}

              {loading && (
                <div className="flex flex-col items-start">
                  <div className="bg-surface-container border border-outline-variant rounded-xl p-3 text-xs text-on-surface-variant flex items-center gap-2.5 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span>
                    <span className="font-mono-label text-[11px]">
                      Querying Amazon Bedrock Nova Micro & formulating answer...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Prompt Suggestions (Shown when empty or available as chips) */}
          {messages.length === 0 && (
            <div className="p-4 bg-surface-container-lowest border-b border-outline-variant/40">
              <div className="text-[11px] font-mono-label text-on-surface-variant mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-primary">lightbulb</span>
                <span>Suggested topics to ask the free Concierge agent:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => executeConciergeQuery(q.query)}
                    className="text-xs text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg px-2.5 py-1.5 transition-all text-left flex items-center gap-1.5 hover:border-primary/50 group"
                  >
                    <span className="material-symbols-outlined text-[14px] text-primary group-hover:scale-110 transition-transform">
                      bolt
                    </span>
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Input Form */}
          <form
            onSubmit={handleSendChat}
            className="relative p-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-primary mt-1 border border-outline-variant flex-shrink-0">
                <span className="material-symbols-outlined text-[18px]">chat</span>
              </div>
              
              <textarea
                className="w-full bg-transparent border-none text-body-md text-on-surface focus:ring-0 focus:outline-none resize-none min-h-[56px] text-xs placeholder:text-on-surface-variant/40 pt-1 leading-relaxed"
                placeholder="Ask anything about AgentOS capabilities, Bedrock models, MCP servers, or multi-agent workflows..."
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat(e);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2 px-1 border-t border-outline-variant/30 mt-2 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-mono-label">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Bedrock Nova Micro Engine • Zero-Cost / Free</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!chatPrompt.trim() || loading}
                  className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-1.5 rounded-lg font-mono-label font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(192,193,255,0.2)] disabled:opacity-40 transition-all active:scale-[0.98]"
                >
                  <span>{loading ? 'Thinking...' : 'Ask Agent'}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {loading ? 'sync' : 'send'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION: YOUR REGISTERED AGENTS & TOOLS */}
      <div className="space-y-8 mb-12">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
              <h2 className="text-title-sm font-title-sm font-bold text-on-surface text-sm uppercase tracking-wider font-mono-label">
                Your Workspace Resources
              </h2>
            </div>
            <span className="text-xs font-mono-label text-on-surface-variant">
              {agents.length} Agent{agents.length !== 1 ? 's' : ''} • {tools.length} Tool{tools.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Real Agents List */}
            <div className="space-y-3">
              <span className="text-xs text-on-surface-variant font-mono-label uppercase tracking-wider block font-semibold">
                Agents ({agents.length})
              </span>
              <div className="space-y-2.5">
                {agents.length > 0 ? (
                  agents.map((ag, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectAgent(ag)}
                      className="p-3.5 rounded-xl bg-surface-container border border-outline-variant hover:border-primary transition-all cursor-pointer group flex items-start gap-3 hover:shadow-md"
                    >
                      <div className="w-9 h-9 rounded-lg bg-surface-bright flex items-center justify-center text-primary border border-outline-variant flex-shrink-0 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors truncate">
                            {ag.name}
                          </h3>
                          <span className="text-[10px] font-mono-label text-secondary bg-secondary/10 px-1.5 py-0.2 rounded border border-secondary/20">
                            {ag.status || 'Active'}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant line-clamp-1">
                          {ag.description || ag.desc || 'Custom autonomous AI agent'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-5 rounded-xl bg-surface-container border border-dashed border-outline-variant text-center space-y-2">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant">smart_toy</span>
                    <p className="text-xs text-on-surface-variant">No custom agents created yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Real Tools List */}
            <div className="space-y-3">
              <span className="text-xs text-on-surface-variant font-mono-label uppercase tracking-wider block font-semibold">
                Tools ({tools.length})
              </span>
              <div className="space-y-2.5">
                {tools.length > 0 ? (
                  tools.map((tl, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectTool(tl)}
                      className="p-3.5 rounded-xl bg-surface-container border border-outline-variant hover:border-amber-400 transition-all cursor-pointer group flex items-start gap-3 hover:shadow-md"
                    >
                      <div className="w-9 h-9 rounded-lg bg-surface-bright flex items-center justify-center text-amber-400 border border-outline-variant flex-shrink-0 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-[20px]">construction</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-bold text-xs text-on-surface group-hover:text-amber-400 transition-colors truncate">
                            {tl.name}
                          </h3>
                          <span className="text-[10px] font-mono-label text-on-surface-variant bg-surface-container-highest px-1.5 py-0.2 rounded border border-outline-variant">
                            {tl.toolType || tl.type || 'REST API'}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant line-clamp-1">
                          {tl.description || tl.desc || 'Custom tool capability'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-5 rounded-xl bg-surface-container border border-dashed border-outline-variant text-center space-y-2">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant">construction</span>
                    <p className="text-xs text-on-surface-variant">No custom tools created yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
