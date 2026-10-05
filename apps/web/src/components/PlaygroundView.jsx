import React, { useState, useEffect, useRef } from 'react';
import CandlestickChart from './CandlestickChart';

export default function PlaygroundView({ agent = {}, initialThread = null }) {
  const [activeThreadId, setActiveThreadId] = useState(initialThread?.id || `th_${Date.now()}`);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [liveSteps, setLiveSteps] = useState([]);
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [agentState, setAgentState] = useState('IDLE'); // 'IDLE' | 'PROCESSING'
  const [activeTrace, setActiveTrace] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});

  const [threadMetrics, setThreadMetrics] = useState({
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    costIncurred: 0.0,
    latency: '0.00s',
    status: 'Ready'
  });

  const wsRef = useRef(null);
  const agentId = agent.agentId || agent.id || (agent.name ? `agent_${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'agent_default');
  const chatBottomRef = useRef(null);

  // --- Establish Real-Time WebSocket Connection ---
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/agents/${agentId}/stream`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            handleIncomingStreamEvent(msg);
          } catch (e) {
            console.error('Error parsing stream event:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsConnected(false);
          // Try reconnecting after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setWsConnected(false);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [agentId]);

  // --- Load Initial Thread If Navigated From Recent Threads ---
  useEffect(() => {
    if (initialThread) {
      setActiveThreadId(initialThread.id || `th_${Date.now()}`);
      if (initialThread.messages && Array.isArray(initialThread.messages) && initialThread.messages.length > 0) {
        setMessages(initialThread.messages);
      } else if (initialThread.lastMessage) {
        setMessages([
          { role: 'user', content: initialThread.title || 'Initial prompt', time: 'Started' },
          { role: 'assistant', content: initialThread.lastMessage, time: initialThread.timestamp || 'Recent' }
        ]);
      }
      if (initialThread.activeTrace) {
        setActiveTrace(initialThread.activeTrace);
        if (initialThread.activeTrace.steps) {
          setLiveSteps(initialThread.activeTrace.steps);
        }
      }
      const tokVal = parseInt(initialThread.tokens, 10) || 0;
      setThreadMetrics({
        totalTokens: tokVal,
        promptTokens: Math.ceil(tokVal * 0.7),
        completionTokens: Math.floor(tokVal * 0.3),
        costIncurred: (tokVal * 0.00007) / 1000,
        latency: initialThread.duration || '0.00s',
        status: initialThread.status || 'Completed'
      });
    } else {
      setActiveThreadId(`th_${Date.now()}`);
    }
  }, [initialThread]);

  const saveThreadToRegistry = async (threadId, currentMsgs, totalToks, latencyStr, traceObj) => {
    try {
      const firstUserMsg = currentMsgs.find((m) => m.role === 'user');
      const lastMsg = currentMsgs[currentMsgs.length - 1];
      const title = firstUserMsg ? (firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')) : 'Thread Session';

      const citations = [];
      if (traceObj?.steps) {
        traceObj.steps.forEach((s) => {
          if (s.stepType === 'MCP_CALL' || s.stepType === 'TOOL_CALL') {
            const clean = s.title.replace('Executed MCP Tool via Gateway: ', '').split(' (')[0];
            if (!citations.includes(clean)) citations.push(clean);
          }
        });
      }

      const payload = {
        id: threadId,
        title: title,
        agentId: agent.agentId || agent.id || 'agent_aa',
        agent: agent.name || 'aa',
        agentModel: agent.model?.modelId || 'amazon.nova-micro-v1:0',
        agentIcon: 'smart_toy',
        lastMessage: lastMsg?.content || '',
        timestamp: 'Just now',
        tokens: String(totalToks || 150),
        duration: latencyStr || '1.20s',
        status: 'Completed',
        citations: citations,
        messages: currentMsgs,
        activeTrace: traceObj,
        updatedAt: Date.now() / 1000
      };

      await fetch('/api/v1/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error('Error auto-saving thread:', e);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeToolCall, loading]);

  // Toggle step JSON payload viewer
  const toggleStepExpand = (stepIdx) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepIdx]: !prev[stepIdx]
    }));
  };

  // Process live stream events
  const handleIncomingStreamEvent = (msg) => {
    const { event, data } = msg;

    if (event === 'connected') {
      setWsConnected(true);
      if (data?.state) {
        setAgentState(data.state);
      }
    } else if (event === 'status') {
      const st = data?.status || 'IDLE';
      setAgentState(st);
      if (st === 'PROCESSING') {
        setLoading(true);
        setThreadMetrics((prev) => ({ ...prev, status: 'Executing' }));
      } else if (st === 'IDLE') {
        setLoading(false);
        setActiveToolCall(null);
        setThreadMetrics((prev) => ({ ...prev, status: 'Completed' }));
      }
    } else if (event === 'thought') {
      // Append or update thought step in trace
      const thoughtPayload = data?.thought;
      if (thoughtPayload) {
        setLiveSteps((prev) => {
          const existingIdx = prev.findIndex((s) => s.stepType === 'THOUGHT' && s.stepIndex === data.stepIndex);
          const newStep = {
            stepIndex: data.stepIndex || prev.length + 1,
            stepType: 'THOUGHT',
            title: `Model Reasoning (${data.model || 'Bedrock'})`,
            outputPayload: thoughtPayload,
            tokensUsed: data.tokens || 0,
            durationMs: data.durationMs || 150
          };
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = newStep;
            return updated;
          }
          return [...prev, newStep];
        });
      }
    } else if (event === 'tool_calling') {
      // Tool execution started!
      setActiveToolCall({
        tool: data.tool,
        input: data.input,
        toolUseId: data.toolUseId,
        timestamp: Date.now()
      });

      // Add placeholder step in trace
      setLiveSteps((prev) => [
        ...prev,
        {
          stepIndex: data.stepIndex || prev.length + 1,
          stepType: 'TOOL_CALL',
          title: `Executing Tool: ${data.tool}`,
          inputPayload: data.input,
          outputPayload: null,
          status: 'RUNNING',
          durationMs: 0
        }
      ]);
    } else if (event === 'tool_completed') {
      // Tool execution finished!
      setActiveToolCall(null);
      setLiveSteps((prev) => {
        return prev.map((s) => {
          if (s.title.includes(data.tool) && s.status === 'RUNNING') {
            return {
              ...s,
              title: `Executed Tool: ${data.tool}`,
              outputPayload: data.output,
              durationMs: data.durationMs || 0,
              status: data.status || 'SUCCESS'
            };
          }
          return s;
        });
      });
    } else if (event === 'step') {
      // Official ExecutionStep object
      const stepObj = data;
      setLiveSteps((prev) => {
        const existingIdx = prev.findIndex((s) => s.stepIndex === stepObj.stepIndex);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = stepObj;
          return updated;
        }
        return [...prev, stepObj];
      });
    } else if (event === 'final_output') {
      const resp = data?.response;
      if (resp) {
        setMessages((prev) => {
          // Avoid duplicate messages
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.content === resp) {
            return prev;
          }
          const updated = [
            ...prev,
            {
              role: 'assistant',
              content: resp,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];
          saveThreadToRegistry(activeThreadId, updated, threadMetrics.totalTokens, threadMetrics.latency, activeTrace);
          return updated;
        });
      }
      setLoading(false);
      setActiveToolCall(null);
    } else if (event === 'complete') {
      const trace = data;
      setActiveTrace(trace);
      if (trace.totalTokens) {
        const inTok = Math.ceil(trace.totalTokens * 0.7);
        const outTok = trace.totalTokens - inTok;
        const cost = (inTok * 0.000035 / 1000) + (outTok * 0.000140 / 1000);
        const elapsed = trace.completedAt && trace.startedAt 
          ? (trace.completedAt - trace.startedAt).toFixed(2) + 's' 
          : '1.20s';

        setThreadMetrics((prev) => ({
          totalTokens: prev.totalTokens + trace.totalTokens,
          promptTokens: prev.promptTokens + inTok,
          completionTokens: prev.completionTokens + outTok,
          costIncurred: prev.costIncurred + cost,
          latency: elapsed,
          status: 'Completed'
        }));
      }
    }
  };

  const handleResetThread = () => {
    setActiveThreadId(`th_${Date.now()}`);
    setMessages([]);
    setLiveSteps([]);
    setActiveTrace(null);
    setActiveToolCall(null);
    setThreadMetrics({
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      costIncurred: 0.0,
      latency: '0.00s',
      status: 'Ready'
    });
  };

  // --- Markdown (.md) Export & Rendering Utilities ---
  const downloadMarkdownFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.md') ? filename : `${filename}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportThreadMarkdown = () => {
    if (messages.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    let md = `# AgentOS Execution Thread: ${agent.name || 'Agent'}\n\n`;
    md += `- **Date**: ${dateStr}\n`;
    md += `- **Agent ID**: \`${agent.agentId || agent.id || 'agent_default'}\`\n`;
    md += `- **Model**: \`${agent.model?.modelId || 'amazon.nova-micro-v1:0'}\`\n`;
    md += `- **Total Tokens**: ${threadMetrics.totalTokens}\n`;
    md += `- **Cost**: $${threadMetrics.costIncurred.toFixed(5)}\n\n`;
    md += `---\n\n`;

    messages.forEach((m) => {
      const author = m.role === 'user' ? 'User' : (agent.name || 'Assistant');
      md += `### ${author} (${m.time || 'Timestamp'})\n\n${m.content}\n\n---\n\n`;
    });

    const safeName = (agent.name || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadMarkdownFile(`${safeName}_session_${dateStr}.md`, md);
  };

  // --- High-Finesse Financial Table Component ---
  const FinesseTable = ({ lines = [], symbol = '' }) => {
    const [showChart, setShowChart] = useState(false);

    const parsedRows = lines.map((l) =>
      l
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    );

    if (!parsedRows.length) return null;

    const headerRow = parsedRows[0] || [];
    const isSeparator = (row) => row.every((c) => /^[-:\s]+$/.test(c));
    const dataRows = parsedRows.slice(1).filter((row) => !isSeparator(row));

    // Detect OHLC columns for Candlestick visualization
    const openIdx = headerRow.findIndex((h) => /open/i.test(h));
    const highIdx = headerRow.findIndex((h) => /high/i.test(h));
    const lowIdx = headerRow.findIndex((h) => /low/i.test(h));
    const closeIdx = headerRow.findIndex((h) => /close/i.test(h));
    const dateIdx = headerRow.findIndex((h) => /date|time|timestamp/i.test(h));
    const volIdx = headerRow.findIndex((h) => /vol/i.test(h));

    const isOhlc = openIdx !== -1 && closeIdx !== -1;

    const candleData = isOhlc
      ? dataRows.map((r, idx) => ({
          date: dateIdx !== -1 ? r[dateIdx] : `Bar ${idx + 1}`,
          open: r[openIdx],
          high: highIdx !== -1 ? r[highIdx] : r[openIdx],
          low: lowIdx !== -1 ? r[lowIdx] : r[closeIdx],
          close: r[closeIdx],
          volume: volIdx !== -1 ? r[volIdx] : 0,
        }))
      : [];

    if (isOhlc && showChart && candleData.length > 0) {
      return (
        <div className="my-3 space-y-2">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowChart(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-xs font-medium text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">table_rows</span>
              <span>Switch to Table View</span>
            </button>
          </div>
          <CandlestickChart data={candleData} symbol={symbol} title="Historical Price Action" />
        </div>
      );
    }

    const renderCellContent = (text, isHeader, colIdx) => {
      if (isHeader) {
        return (
          <span className="font-bold text-[11px] text-primary uppercase tracking-wider">
            {text.replace(/\*\*/g, '')}
          </span>
        );
      }

      const cleanText = text.replace(/\*\*/g, '');

      // Check for positive change (+...%) or (+$...)
      const isPositive = /\+[0-9]/.test(cleanText) || (cleanText.includes('+') && cleanText.includes('%'));
      // Check for negative change (-...%) or (-$...)
      const isNegative = /-[0-9]/.test(cleanText) || (cleanText.includes('-') && cleanText.includes('%'));

      if (isPositive) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span>▲</span>
            <span>{cleanText}</span>
          </span>
        );
      }

      if (isNegative) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span>▼</span>
            <span>{cleanText}</span>
          </span>
        );
      }

      // Dollar Price
      if (cleanText.startsWith('$') && colIdx > 0) {
        return (
          <span className="font-mono-code font-bold text-emerald-300 text-xs tracking-tight">
            {cleanText}
          </span>
        );
      }

      // Col 0: Metric Name
      if (colIdx === 0) {
        return (
          <span className="font-medium text-on-surface text-xs">
            {cleanText}
          </span>
        );
      }

      // Numbers / Standard Value
      return (
        <span className="font-mono-code text-on-surface-variant text-xs">
          {cleanText}
        </span>
      );
    };

    return (
      <div className="my-3 overflow-hidden rounded-xl border border-outline-variant/60 bg-[#0d1219]/90 shadow-xl backdrop-blur-md">
        {/* Header bar / Title */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-high/60 border-b border-outline-variant/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">query_stats</span>
            <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
              {headerRow[0]?.replace(/\*\*/g, '') || 'Market Metrics'}
            </span>
          </div>
          {isOhlc && (
            <button
              type="button"
              onClick={() => setShowChart(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-[11px] font-semibold text-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">candlestick_chart</span>
              <span>View Candlestick Chart</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-high/30 border-b border-outline-variant/30">
              <tr>
                {headerRow.map((h, idx) => (
                  <th key={idx} className="px-4 py-2 text-xs font-semibold">
                    {renderCellContent(h, true, idx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {dataRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-surface-container-high/30 odd:bg-surface-container-low/25 transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-xs">
                      {renderCellContent(cell, false, cIdx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFormattedInline = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-on-surface">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-surface-container-highest font-mono-code text-[11px] text-emerald-300 border border-outline-variant/30"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    // Strip raw HTML tags to guarantee pure Markdown representation
    const clean = text.replace(/<[^>]+>/g, '');
    const lines = clean.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeTag = '';

    // Detect ticker symbol from text (e.g. ARE&M.NS, AAPL, MSFT, RELIANCE.NS)
    const tickerMatch = text.match(/\(([A-Z0-9&]{2,10}(?:\.[A-Z]{2,4})?)\)/) || text.match(/\b([A-Z0-9&]{2,10}\.(?:NS|BO))\b/);
    const contextSymbol = tickerMatch ? tickerMatch[1] : '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          const rawCode = codeBuffer.join('\n');
          let parsedCandles = null;
          let parsedSymbol = contextSymbol || 'STK';
          let parsedTitle = 'Market Candlesticks';

          try {
            const parsed = JSON.parse(rawCode);
            if (Array.isArray(parsed) && parsed.length > 0 && ('open' in parsed[0] || 'Open' in parsed[0])) {
              parsedCandles = parsed;
            } else if (parsed && typeof parsed === 'object') {
              parsedCandles = parsed.candles || parsed.data || parsed.historical || parsed.bars;
              if (parsed.symbol) parsedSymbol = parsed.symbol;
              if (parsed.title) parsedTitle = parsed.title;
            }
          } catch {
            // Not JSON
          }

          if (parsedCandles && Array.isArray(parsedCandles) && parsedCandles.length > 0) {
            elements.push(
              <CandlestickChart
                key={`candle-chart-${i}`}
                data={parsedCandles}
                symbol={parsedSymbol}
                title={parsedTitle}
              />
            );
          } else {
            elements.push(
              <pre
                key={`code-${i}`}
                className="bg-[#0f1117] border border-outline-variant/60 rounded-lg p-3 my-2 text-[11px] font-mono-code text-emerald-300 overflow-x-auto shadow-inner"
              >
                <code>{rawCode}</code>
              </pre>
            );
          }
          codeBuffer = [];
          codeTag = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeTag = line.trim().slice(3).trim().toLowerCase();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Detect full markdown table block with finesse
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        i--; // compensate for outer loop increment
        elements.push(<FinesseTable key={`tbl-${i}`} lines={tableLines} symbol={contextSymbol} />);
        continue;
      }

      const trimmed = line.trim();

      // Section Headings & Key Takeaways with visual icons
      if (trimmed === 'Key Takeaways' || trimmed === 'Highlights' || trimmed === 'Summary' || trimmed === 'Next Steps') {
        const isNextSteps = trimmed === 'Next Steps';
        elements.push(
          <div key={i} className="flex items-center gap-2 mt-4 mb-2 pt-2 border-t border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[18px]">
              {isNextSteps ? 'trending_up' : 'lightbulb'}
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              {trimmed}
            </h3>
          </div>
        );
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-xs font-bold text-on-surface mt-2.5 mb-1">{renderFormattedInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-sm font-bold text-on-surface mt-3 mb-1.5 border-b border-outline-variant/40 pb-1">{renderFormattedInline(line.slice(3))}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-base font-extrabold text-on-surface mt-3.5 mb-2">{renderFormattedInline(line.slice(2))}</h1>);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('•')) {
        const bulletText = trimmed.replace(/^[-*•]\s*/, '');
        elements.push(
          <div key={i} className="flex items-start gap-2.5 my-1 text-xs text-on-surface pl-1">
            <span className="text-primary mt-1 text-[8px] flex-shrink-0">●</span>
            <div className="leading-relaxed">{renderFormattedInline(bulletText)}</div>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+\.)\s(.*)$/);
        elements.push(
          <div key={i} className="flex items-start gap-2 my-1 text-xs text-on-surface pl-1">
            <span className="text-primary font-mono-code text-[11px] font-semibold">{match ? match[1] : '1.'}</span>
            <div className="leading-relaxed">{renderFormattedInline(match ? match[2] : line)}</div>
          </div>
        );
      } else if (trimmed === '---') {
        elements.push(<hr key={i} className="my-2.5 border-outline-variant/40" />);
      } else if (trimmed) {
        elements.push(
          <p key={i} className="my-1.5 text-xs leading-relaxed text-on-surface">
            {renderFormattedInline(line)}
          </p>
        );
      }
    }

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <pre key="code-end" className="bg-[#0f1117] border border-outline-variant/60 rounded-lg p-3 my-2 text-[11px] font-mono-code text-emerald-300 overflow-x-auto shadow-inner">
          <code>{codeBuffer.join('\n')}</code>
        </pre>
      );
    }

    return <div className="space-y-0.5">{elements}</div>;
  };

  const handleSend = async () => {
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery.trim();
    setInputQuery('');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const startTime = performance.now();

    const updatedMessagesWithUser = [...messages, { role: 'user', content: userText, time: timeNow }];
    setMessages(updatedMessagesWithUser);
    setLoading(true);
    setAgentState('PROCESSING');
    setThreadMetrics((prev) => ({ ...prev, status: 'Executing' }));

    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        inputs: { query: userText, history: updatedMessagesWithUser },
        version: 'latest',
        sessionId: activeThreadId
      }));
    } else {
      // Fallback to HTTP POST /execute (which also broadcasts events over the stream bus!)
      try {
        const res = await fetch(`/api/v1/agents/${agentId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: 'latest',
            sessionId: activeThreadId,
            inputs: { query: userText, history: updatedMessagesWithUser }
          })
        });

        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2) + 's';

        if (res.ok) {
          const trace = await res.json();
          setActiveTrace(trace);
          if (trace.steps && trace.steps.length > 0) {
            setLiveSteps(trace.steps);
          }
          const responseText = trace.outputs?.response || "Task executed successfully according to directives.";
          
          const inTok = Math.ceil(userText.length / 3.5) + (agent.tools?.length || 1) * 120 + 80;
          const outTok = Math.ceil(responseText.length / 3.5);
          const addedTokens = trace.totalTokens || (inTok + outTok);
          const addedCost = (inTok * 0.000035 / 1000) + (outTok * 0.000140 / 1000);

          setThreadMetrics((prev) => ({
            totalTokens: prev.totalTokens + addedTokens,
            promptTokens: prev.promptTokens + inTok,
            completionTokens: prev.completionTokens + outTok,
            costIncurred: prev.costIncurred + addedCost,
            latency: elapsedSec,
            status: 'Completed'
          }));

          const finalMsgs = [
            ...updatedMessagesWithUser,
            { 
              role: 'assistant', 
              content: responseText, 
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];
          setMessages(finalMsgs);
          saveThreadToRegistry(activeThreadId, finalMsgs, addedTokens, elapsedSec, trace);
        }
      } catch (err) {
        console.error('Execution error:', err);
      } finally {
        setLoading(false);
        setAgentState('IDLE');
      }
    }
  };

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-[#13131b]">
      {/* Left Pane: Agent Playground */}
      <section className="flex-1 flex flex-col border-r border-outline-variant relative bg-[#13131b]">
        {/* Top Header */}
        <div className="h-12 border-b border-outline-variant flex items-center justify-between px-gutter bg-surface-container-low/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">forum</span>
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">Thread Session</h2>
            <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-mono-label font-bold tracking-wider uppercase">
              Agent: {agent.name || "Autonomous Agent"}
            </span>
            
            {/* Live Stream Status Indicator */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono-label font-bold border ${
              wsConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {wsConnected ? 'Live Stream Connected' : 'Connecting Stream...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportThreadMarkdown}
              disabled={messages.length === 0}
              className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant hover:border-primary text-on-surface hover:text-primary transition-all text-xs font-mono-label flex items-center gap-1.5 disabled:opacity-40"
              title="Download entire conversation thread as a .md file"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">download</span>
              <span>Export .md</span>
            </button>
            <button 
              onClick={handleResetThread} 
              className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant hover:border-primary text-on-surface-variant hover:text-on-surface transition-all text-xs font-mono-label flex items-center gap-1.5" 
              title="Start a fresh thread session"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>New Thread</span>
            </button>
            <button 
              onClick={() => {
                setMessages([]);
                setLiveSteps([]);
              }} 
              className="text-on-surface-variant hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-surface-container" 
              title="Clear Messages"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* TOP TELEMETRY RIBBON: Live Tokens Used, Cost Incurred & Agent State */}
        <div className="bg-[#18181f] border-b border-outline-variant px-5 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-6 text-xs">
            {/* Tokens Used */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[15px]">token</span>
              </div>
              <div>
                <span className="text-[10px] font-mono-label text-on-surface-variant block uppercase tracking-wider">Tokens Used</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-code font-bold text-on-surface text-xs">
                    {threadMetrics.totalTokens.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono-label text-on-surface-variant">
                    (In: {threadMetrics.promptTokens} | Out: {threadMetrics.completionTokens})
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Incurred */}
            <div className="flex items-center gap-2 border-l border-outline-variant/50 pl-5">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-[15px]">attach_money</span>
              </div>
              <div>
                <span className="text-[10px] font-mono-label text-on-surface-variant block uppercase tracking-wider">Cost Incurred</span>
                <span className="font-mono-code font-bold text-emerald-400 text-xs">
                  ${threadMetrics.costIncurred.toFixed(5)}
                </span>
              </div>
            </div>

            {/* Execution Latency */}
            <div className="hidden sm:flex items-center gap-2 border-l border-outline-variant/50 pl-5">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-[15px]">timer</span>
              </div>
              <div>
                <span className="text-[10px] font-mono-label text-on-surface-variant block uppercase tracking-wider">Latency</span>
                <span className="font-mono-code font-bold text-on-surface text-xs">
                  {threadMetrics.latency}
                </span>
              </div>
            </div>
          </div>

          {/* Model & Processing Status Badges */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-[10px] font-mono-code text-on-surface-variant">
              {agent.model?.modelId || 'amazon.nova-micro-v1:0'}
            </span>
            <span className={`px-2.5 py-1 rounded text-[10px] font-mono-label font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
              loading || agentState === 'PROCESSING'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 animate-pulse' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${loading || agentState === 'PROCESSING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
              {loading || agentState === 'PROCESSING' ? 'PROCESSING TOOL LOOP' : 'IDLE / READY'}
            </span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-container-padding scroll-hidden space-y-6 bg-[#09090b]">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-on-surface-variant">
              <div className="w-14 h-14 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center text-primary mb-3 shadow-lg">
                <span className="material-symbols-outlined text-[28px]">smart_toy</span>
              </div>
              <h3 className="text-sm font-bold text-on-surface mb-1">Agent Stream Ready</h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                Send a prompt to start execution. Real-time tool invocations, reasoning thoughts, and processing states will stream directly into both panes.
              </p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-4 ${
                m.role === 'user'
                  ? 'bg-surface-container border border-outline-variant rounded-xl rounded-tr-sm text-on-surface'
                  : 'bg-[#18181b] border border-outline-variant rounded-xl rounded-tl-sm text-on-surface shadow-[0_12px_24px_-4px_rgba(0,0,0,0.2)]'
              }`}>
                {m.role === 'assistant' && (
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-outline-variant/40">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-mono-label font-mono-label text-on-surface-variant text-[11px]">
                        {agent.name || "Autonomous Agent"}
                      </span>
                    </div>
                    <button
                      onClick={() => downloadMarkdownFile(`${(agent.name || 'agent').toLowerCase().replace(/\s+/g, '_')}_response_${idx + 1}.md`, m.content)}
                      className="text-[10px] font-mono-label text-on-surface-variant hover:text-primary flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-container transition-colors border border-outline-variant/30"
                      title="Download this response as a .md file"
                    >
                      <span className="material-symbols-outlined text-[12px] text-primary">download</span>
                      <span>.md</span>
                    </button>
                  </div>
                )}

                {m.role === 'assistant' ? (
                  renderMarkdown(m.content)
                ) : (
                  <p className="text-body-md font-body-md text-on-surface leading-relaxed text-xs whitespace-pre-wrap">
                    {m.content}
                  </p>
                )}
              </div>
              <span className="text-mono-label font-mono-label text-on-surface-variant mt-1.5 text-[10px]">
                {m.role === 'user' ? 'You' : (agent.name || 'AgentOS')} • {m.time || 'Just now'}
              </span>
            </div>
          ))}

          {/* Real-time Tool Calling Banner */}
          {activeToolCall && (
            <div className="flex flex-col items-start animate-fadeIn">
              <div className="bg-[#1b1c24] border border-amber-500/40 rounded-xl p-3.5 text-xs text-amber-300 flex items-center gap-3 shadow-lg">
                <span className="material-symbols-outlined text-[18px] animate-spin text-amber-400">construction</span>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Calling Tool:</span>
                    <span className="font-mono-code text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                      {activeToolCall.tool}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono-code mt-0.5">
                    Parameters: {JSON.stringify(activeToolCall.input)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Processing Spinner */}
          {loading && !activeToolCall && (
            <div className="flex flex-col items-start animate-fadeIn">
              <div className="bg-[#18181b] border border-outline-variant rounded-xl p-3.5 text-xs text-on-surface-variant flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px] animate-spin text-primary">sync</span>
                <span className="font-mono-label text-xs text-on-surface">
                  Model is reasoning & orchestrating tool loop...
                </span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-end bg-[#18181b] border border-outline-variant rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
          >
            <textarea
              className="w-full bg-transparent border-none text-body-md font-body-md text-on-surface focus:ring-0 resize-none py-3 pl-4 pr-12 min-h-[44px] text-xs focus:outline-none"
              placeholder={`Ask ${agent.name || 'the agent'} to calculate, search, or analyze...`}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="absolute right-2 bottom-2 p-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary-fixed-dim transition-colors flex items-center justify-center disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
        </div>
      </section>

      {/* Right Pane: Real-Time Execution Trace */}
      <section className="w-[38%] min-w-[340px] max-w-[520px] flex flex-col bg-[#09090b] border-l border-outline-variant">
        {/* Header */}
        <div className="h-12 border-b border-outline-variant flex items-center justify-between px-gutter bg-surface-container-low/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold text-sm">Execution Trace</h2>
            <span className="text-[10px] font-mono-label text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded border border-outline-variant">
              {liveSteps.length} Step{liveSteps.length !== 1 ? 's' : ''}
            </span>
          </div>

          <span className={`px-2 py-0.5 rounded text-[10px] font-mono-label font-bold tracking-wider uppercase flex items-center gap-1 border ${
            loading || agentState === 'PROCESSING'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${loading || agentState === 'PROCESSING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
            {loading || agentState === 'PROCESSING' ? 'Processing' : 'Completed'}
          </span>
        </div>

        {/* Trace Timeline */}
        <div className="flex-1 overflow-y-auto p-4 scroll-hidden">
          {liveSteps.length === 0 && !activeToolCall ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl mb-2 text-outline">pending_actions</span>
              <p className="text-xs text-on-surface font-medium">Awaiting Execution</p>
              <p className="text-[11px] text-on-surface-variant max-w-xs mt-1">
                Call the agent to watch live reasoning, tool calling, and input/output payloads populate here in real-time.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-outline-variant/30">
              {liveSteps.map((step, idx) => {
                const isExpanded = !!expandedSteps[idx];
                const isRunning = step.status === 'RUNNING';

                return (
                  <div key={idx} className="relative animate-fadeIn">
                    {/* Timeline Node Dot */}
                    <div className={`absolute -left-[27px] top-1 w-5 h-5 rounded-full bg-surface-container border flex items-center justify-center z-10 ${
                      isRunning 
                        ? 'border-amber-400 bg-amber-500/20 animate-pulse' 
                        : 'border-emerald-500/50'
                    }`}>
                      {isRunning ? (
                        <span className="material-symbols-outlined text-[10px] text-amber-400 animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-[12px] text-emerald-400">check</span>
                      )}
                    </div>

                    {/* Step Card */}
                    <div className={`bg-[#18181b] border rounded-lg p-3 transition-colors ${
                      isRunning 
                        ? 'border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.1)]' 
                        : 'border-outline-variant hover:border-outline'
                    }`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono-label uppercase px-1.5 py-0.2 rounded font-bold border ${
                            step.stepType === 'TOOL_CALL' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : step.stepType === 'THOUGHT'
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : step.stepType === 'FINAL_OUTPUT'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-surface-container text-on-surface-variant border-outline-variant'
                          }`}>
                            {step.stepType}
                          </span>
                          <h3 className="text-mono-label font-mono-label font-bold text-on-surface text-xs truncate max-w-[200px]">
                            {step.title}
                          </h3>
                        </div>

                        <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">
                          +{step.durationMs || 0}ms
                        </span>
                      </div>

                      {/* Tool Call Input Preview */}
                      {step.inputPayload && (
                        <div className="mt-2 p-2 bg-surface-container-lowest rounded border border-outline-variant/30 font-mono-code text-[11px]">
                          <div className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Input</div>
                          <div className="text-on-surface truncate">
                            {JSON.stringify(step.inputPayload)}
                          </div>
                        </div>
                      )}

                      {/* Tool Call Output Preview */}
                      {step.outputPayload && (
                        <div className="mt-2 p-2 bg-surface-container-lowest rounded border border-outline-variant/30 font-mono-code text-[11px]">
                          <div className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Output</div>
                          <div className="text-emerald-400 max-h-24 overflow-y-auto whitespace-pre-wrap scroll-hidden">
                            {typeof step.outputPayload === 'object' ? JSON.stringify(step.outputPayload, null, 2) : String(step.outputPayload)}
                          </div>
                        </div>
                      )}

                      {/* Expandable JSON Inspector */}
                      {(step.inputPayload || step.outputPayload) && (
                        <button
                          onClick={() => toggleStepExpand(idx)}
                          className="mt-2 text-[10px] font-mono-label text-primary hover:underline flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Hide Raw JSON' : 'Inspect Raw JSON'}</span>
                          <span className="material-symbols-outlined text-[12px]">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}

                      {isExpanded && (
                        <pre className="mt-2 p-2 bg-[#09090c] rounded border border-outline-variant text-[10px] font-mono-code text-secondary overflow-x-auto max-h-40">
                          {JSON.stringify(step, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Active Running Tool Item at Bottom of Timeline */}
              {activeToolCall && (
                <div className="relative animate-fadeIn">
                  <div className="absolute -left-[27px] top-1 w-5 h-5 rounded-full bg-surface-container border border-amber-400 flex items-center justify-center z-10 animate-pulse">
                    <span className="material-symbols-outlined text-[12px] text-amber-400 animate-spin">sync</span>
                  </div>
                  <div className="bg-[#1f1d24] border border-amber-500/50 rounded-lg p-3 shadow-lg animate-pulse">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono-label uppercase px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          TOOL CALLING
                        </span>
                        <h3 className="text-mono-label font-mono-label font-bold text-amber-300 text-xs">
                          {activeToolCall.tool}
                        </h3>
                      </div>
                      <span className="text-mono-label font-mono-label text-amber-400 text-[10px]">Calling...</span>
                    </div>
                    <div className="mt-2 p-2 bg-black/40 rounded border border-amber-500/30 font-mono-code text-[11px] text-amber-200">
                      {JSON.stringify(activeToolCall.input)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metrics Footer */}
        <div className="border-t border-outline-variant bg-[#18181b] p-4 shrink-0">
          <div className="grid grid-cols-3 gap-2 divide-x divide-outline-variant/50">
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px] uppercase tracking-wider mb-1">Latency</span>
              <span className="text-title-sm font-title-sm font-bold text-on-surface text-sm">
                {threadMetrics.latency}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px] uppercase tracking-wider mb-1">Tokens</span>
              <span className="text-title-sm font-title-sm font-bold text-on-surface text-sm">
                {threadMetrics.totalTokens > 0 ? (threadMetrics.totalTokens > 1000 ? `${(threadMetrics.totalTokens / 1000).toFixed(1)}k` : threadMetrics.totalTokens) : '0'}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px] uppercase tracking-wider mb-1">Cost</span>
              <span className="text-title-sm font-title-sm font-bold text-emerald-400 text-sm">
                ${threadMetrics.costIncurred.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
