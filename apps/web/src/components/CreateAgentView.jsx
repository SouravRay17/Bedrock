import React, { useState } from 'react';

export default function CreateAgentView({ onConstructAgent, initialGroup = 'Engineering Group', availableModels = [], availableTools = [] }) {
  // Form State
  const [selectedModel, setSelectedModel] = useState('amazon.nova-micro-v1:0');
  const [modelType, setModelType] = useState('chat'); // 'chat' | 'synthesize' | 'autonomous' | 'routing'
  const [agentName, setAgentName] = useState('Custom AI Agent');
  const [agentDescription, setAgentDescription] = useState('Autonomous worker configured with selected model and capabilities.');
  const [assignedGroup, setAssignedGroup] = useState(initialGroup);
  const [selectedTools, setSelectedTools] = useState(['tool_web_search', 'tool_calculator']);
  const [selectedKbs, setSelectedKbs] = useState(['kb_sample_enterprise_docs']);

  // Model Catalog
  const modelOptions = [
    {
      id: 'amazon.nova-micro-v1:0',
      name: 'Amazon Nova Micro',
      provider: 'Amazon Bedrock',
      tier: 'FREE TIER ELIGIBLE',
      tierColor: 'emerald',
      context: '128k context window',
      desc: 'Ultra-fast, lightweight foundation model with native tool-calling and low inference overhead.',
      toolCalling: true
    },
    {
      id: 'amazon.titan-text-lite-v1',
      name: 'Amazon Titan Text Lite',
      provider: 'Amazon Bedrock',
      tier: 'FREE TIER ELIGIBLE',
      tierColor: 'emerald',
      context: '4k context window',
      desc: 'Cost-effective text model suitable for fast summarization, data extraction, and classification.',
      toolCalling: false
    },
    {
      id: 'anthropic.claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic / Bedrock',
      tier: 'PAID MODEL',
      tierColor: 'indigo',
      context: '200k context window',
      desc: 'State-of-the-art reasoning model for complex multi-step analysis and coding pipelines.',
      toolCalling: true
    },
    {
      id: 'openai.gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      tier: 'PAID MODEL',
      tierColor: 'indigo',
      context: '128k context window',
      desc: 'High-speed omni model with advanced multimodality and structured JSON schema output.',
      toolCalling: true
    }
  ];

  // Type of Model Archetypes
  const modelTypeOptions = [
    {
      id: 'chat',
      title: 'Chat & Dialogue Agent',
      icon: 'chat',
      desc: 'Conversational assistant designed for interactive turn-by-turn dialogue, question answering, and support.'
    },
    {
      id: 'synthesize',
      title: 'Synthesize & Summarization Agent',
      icon: 'auto_stories',
      desc: 'Optimized for batch document synthesis, deep research extraction, and structured executive reports.'
    },
    {
      id: 'autonomous',
      title: 'Autonomous Task Worker',
      icon: 'smart_toy',
      desc: 'Autonomous ReAct loop with multi-tool calling, external API dispatch, and child-agent delegation.'
    },
    {
      id: 'routing',
      title: 'Classification & Router',
      icon: 'alt_route',
      desc: 'Fast intent triage and conditional routing to downstream specialist agents and human approval points.'
    }
  ];

  const handleToggleTool = (toolId) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  };

  const handleConstruct = () => {
    // Synthesize initial instructions based on selected archetype
    let defaultInstructions = "You are a specialized AI agent.";
    if (modelType === 'chat') {
      defaultInstructions = `You are ${agentName}, an interactive conversational assistant. Answer user inquiries with clarity and cite relevant context when available.`;
    } else if (modelType === 'synthesize') {
      defaultInstructions = `You are ${agentName}, an executive synthesis specialist. Read all input documents, extract core insights, and compile concise summaries.`;
    } else if (modelType === 'autonomous') {
      defaultInstructions = `You are ${agentName}, an autonomous task executor. Reason through goals step-by-step, invoke attached tools to fetch real data, and delegate sub-tasks when needed.`;
    } else if (modelType === 'routing') {
      defaultInstructions = `You are ${agentName}, an intent classification and triage agent. Analyze user queries and route them to the appropriate department.`;
    }

    const constructedAgent = {
      agentId: `agent_${Date.now().toString().slice(-6)}`,
      projectId: "default_project",
      name: agentName,
      description: agentDescription,
      instructions: defaultInstructions,
      model: {
        provider: "bedrock",
        modelId: selectedModel,
        type: modelType
      },
      tools: selectedTools,
      knowledgeBases: selectedKbs,
      childAgents: [],
      group: assignedGroup,
      contextPolicy: {
        strategy: "adaptive",
        compressionThreshold: 0.60
      }
    };

    onConstructAgent(constructedAgent);
  };

  return (
    <div className="max-w-5xl mx-auto p-container-padding mt-4 animate-fadeIn pb-16">
      {/* Header */}
      <div className="mb-8 pb-4 border-b border-outline-variant flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">add_circle</span>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Create New Agent</h1>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant text-xs">
            Select your foundation model, define the model archetype (Chat vs Synthesize vs Autonomous), and bind capabilities.
          </p>
        </div>

        <button
          onClick={handleConstruct}
          className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-6 py-2.5 rounded-lg font-mono-label text-mono-label font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(192,193,255,0.2)] transition-all hover:scale-[1.02]"
        >
          <span className="material-symbols-outlined text-[18px]">build</span>
          Construct & Open Canvas
        </button>
      </div>

      <div className="space-y-8">
        {/* Step 1: Select Foundation Model */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono-label text-[10px]">1</span>
              Select Foundation Model
            </h2>
            <span className="text-mono-label font-mono-label text-[11px] text-emerald-400">
              Zero-cost eligible models available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {modelOptions.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-surface-container-high border-primary ring-1 ring-primary shadow-lg'
                      : 'bg-surface-container-low border-outline-variant hover:border-outline'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                          {m.name}
                          {isSelected && (
                            <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                          )}
                        </h3>
                        <span className="text-mono-label font-mono-label text-on-surface-variant text-[10px]">{m.provider}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono-label font-semibold ${
                        m.tierColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                      }`}>
                        {m.tier}
                      </span>
                    </div>

                    <p className="text-body-sm font-body-sm text-on-surface-variant text-xs mb-3 line-clamp-2">
                      {m.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30 text-mono-code text-[10px] text-on-surface-variant">
                    <span>{m.context}</span>
                    <span>•</span>
                    <span className={m.toolCalling ? 'text-emerald-400' : 'text-on-surface-variant'}>
                      {m.toolCalling ? 'Native Tool Calling' : 'Prompt Summarizer'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 2: Select Type of Model / Archetype */}
        <section>
          <div className="mb-3">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono-label text-[10px]">2</span>
              Model Archetype & Objective
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {modelTypeOptions.map((opt) => {
              const isSelected = modelType === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setModelType(opt.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-surface-container-high border-secondary ring-1 ring-secondary shadow-lg'
                      : 'bg-surface-container-low border-outline-variant hover:border-outline'
                  }`}
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-primary mb-2.5">
                      <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                    </div>
                    <h3 className="font-bold text-xs text-on-surface mb-1.5">{opt.title}</h3>
                    <p className="text-body-sm font-body-sm text-on-surface-variant text-[11px] leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 3: Identity & Group Assignment */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="text-title-sm font-title-sm text-on-surface font-semibold flex items-center gap-2 text-sm mb-4">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono-label text-[10px]">3</span>
            Identity & Group Assignment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-on-surface font-medium mb-1">Agent Name</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Sales Analyst Pro"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Assign to Group / Folder</label>
              <select
                value={assignedGroup}
                onChange={(e) => setAssignedGroup(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="Engineering Group">Engineering Group (3 members)</option>
                <option value="Finance & Compliance Group">Finance & Compliance Group (2 members)</option>
                <option value="Customer Success Group">Customer Success Group (3 members)</option>
                <option value="General Workspace">General Workspace (All)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-on-surface font-medium mb-1">Agent Description</label>
              <textarea
                rows={2}
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                placeholder="What is the primary role of this agent?"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </section>

        {/* Step 4: Attach Initial Tools & Capabilities */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="text-title-sm font-title-sm text-on-surface font-semibold flex items-center gap-2 text-sm mb-4">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono-label text-[10px]">4</span>
            Attach Initial Capabilities
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div
              onClick={() => handleToggleTool('tool_web_search')}
              className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${
                selectedTools.includes('tool_web_search')
                  ? 'bg-surface-container-high border-primary text-on-surface'
                  : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface-variant'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">search</span>
                <span>WebSearchTool</span>
              </div>
              <span className="material-symbols-outlined text-[16px]">
                {selectedTools.includes('tool_web_search') ? 'check_box' : 'check_box_outline_blank'}
              </span>
            </div>

            <div
              onClick={() => handleToggleTool('tool_calculator')}
              className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${
                selectedTools.includes('tool_calculator')
                  ? 'bg-surface-container-high border-primary text-on-surface'
                  : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface-variant'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-tertiary">calculate</span>
                <span>CalculatorTool</span>
              </div>
              <span className="material-symbols-outlined text-[16px]">
                {selectedTools.includes('tool_calculator') ? 'check_box' : 'check_box_outline_blank'}
              </span>
            </div>

            <div
              onClick={() => handleToggleTool('tool_http_requester')}
              className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${
                selectedTools.includes('tool_http_requester')
                  ? 'bg-surface-container-high border-primary text-on-surface'
                  : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface-variant'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">api</span>
                <span>HttpRequesterTool</span>
              </div>
              <span className="material-symbols-outlined text-[16px]">
                {selectedTools.includes('tool_http_requester') ? 'check_box' : 'check_box_outline_blank'}
              </span>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
          <button
            onClick={handleConstruct}
            className="bg-primary text-on-primary hover:bg-primary-fixed px-8 py-3 rounded-lg font-title-sm text-title-sm font-bold shadow-[0_0_20px_rgba(192,193,255,0.3)] flex items-center gap-2 text-xs transition-all hover:scale-[1.02]"
          >
            <span>Construct Agent & Open Canvas</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
