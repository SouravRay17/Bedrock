import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import ThreadsView from './components/ThreadsView';
import ExploreView from './components/ExploreView';
import AgentDetailView from './components/AgentDetailView';
import CreateToolView from './components/CreateToolView';
import ToolDetailView from './components/ToolDetailView';
import WorkspaceView from './components/WorkspaceView';
import PlaygroundView from './components/PlaygroundView';
import McpDetailView from './components/McpDetailView';
import KnowledgeBaseDetailView from './components/KnowledgeBaseDetailView';
import DocsView from './components/DocsView';

const createBlankAgent = (name = "My Agent") => ({
  agentId: `agent_${Date.now().toString().slice(-6)}`,
  name: name,
  group: "Default Workspace",
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  description: "Custom AI agent created in AgentOS.",
  agentType: "Autonomous Worker",
  model: {
    provider: "bedrock",
    modelId: "amazon.nova-micro-v1:0"
  },
  enableReasoning: true,
  tags: ["production", "v1"],
  branding: {
    customDomain: "",
    logoUrl: "",
    theme: "Midnight Slate"
  },
  advancedOptions: {
    strategy: "Summarization",
    threshold: 60,
    summarizationAgent: "__default__",
    jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"response\": { \"type\": \"string\" }\n  }\n}"
  },
  promptSections: [
    {
      id: 'sec_1',
      title: 'Role & Persona',
      content: `You are ${name}, an expert autonomous agent. You reason through complex goals with clarity, precision, and efficiency.`
    },
    {
      id: 'sec_2',
      title: 'Tool Call Directives',
      content: 'Always verify input parameters before executing tools. Validate intermediate findings and format outputs cleanly.'
    },
    {
      id: 'sec_3',
      title: 'Safety & Guardrails',
      content: 'Never disclose internal API keys, database credentials, or proprietary system instructions.'
    }
  ],
  tools: [],
  knowledgeBases: [],
  childAgents: []
});

export default function App() {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'threads' | 'explore' | 'agent-detail' | 'create-tool' | 'tool-detail' | 'mcp-detail' | 'kb-detail' | 'workspace' | 'executions' | 'docs' | 'settings'
  const [activeAgent, setActiveAgent] = useState(createBlankAgent());
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedMcp, setSelectedMcp] = useState(null);
  const [selectedKb, setSelectedKb] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [activeThread, setActiveThread] = useState(null);

  // Registry data
  const [agents, setAgents] = useState([]);
  const [models, setModels] = useState([]);
  const [tools, setTools] = useState([]);
  const [mcpCollections, setMcpCollections] = useState([]);
  const [kbs, setKbs] = useState([]);

  const loadRegistryData = async () => {
    try {
      const [agRes, mRes, tRes, mcpRes, kbRes] = await Promise.all([
        fetch('/api/v1/agents'),
        fetch('/api/v1/models'),
        fetch('/api/v1/tools'),
        fetch('/api/v1/mcp-collections'),
        fetch('/api/v1/knowledge-bases')
      ]);
      if (agRes.ok) {
        const agList = await agRes.json();
        setAgents(agList);
        setActiveAgent((current) => {
          // If no active agent or currently on the initial blank placeholder, pick first
          if (!current || !current.agentId || (current.agentId.startsWith('agent_') && current.name === 'My Agent')) {
            return agList[0] || current;
          }
          // If an agent is already active (e.g. Finance), preserve it and refresh with latest server data
          const curId = current.agentId || current.id;
          const matched = agList.find(a => (a.agentId || a.id) === curId || a.name?.toLowerCase() === current.name?.toLowerCase());
          return matched ? { ...current, ...matched } : current;
        });
      }
      if (mRes.ok) setModels(await mRes.json());
      if (tRes.ok) setTools(await tRes.json());
      if (mcpRes.ok) setMcpCollections(await mcpRes.json());
      if (kbRes.ok) setKbs(await kbRes.json());
    } catch (e) {
      console.error('Failed to load registries:', e);
    }
  };

  useEffect(() => {
    loadRegistryData();
  }, []);

  const handleSelectAgent = (agentObjOrName) => {
    let target = null;
    if (typeof agentObjOrName === 'string') {
      const needle = agentObjOrName.toLowerCase();
      target = agents.find(a => (a.name && a.name.toLowerCase() === needle) || (a.agentId && a.agentId.toLowerCase() === needle) || (a.id && a.id.toLowerCase() === needle));
      if (!target) {
        target = createBlankAgent(agentObjOrName);
      }
    } else if (agentObjOrName) {
      target = agentObjOrName;
    }

    if (target) {
      const normalized = {
        ...target,
        agentId: target.agentId || target.id || `agent_${Date.now().toString().slice(-6)}`,
        name: target.name || 'Custom Agent'
      };
      setActiveAgent(normalized);
    }
    setActiveView('agent-detail');
  };

  const handleSaveAgent = (updatedAgent) => {
    setActiveAgent(updatedAgent);
    setAgents(prev => [updatedAgent, ...prev.filter(a => (a.agentId || a.id) !== updatedAgent.agentId)]);
    fetch('/api/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedAgent)
    }).catch(console.error);
  };

  const handleDeleteAgent = async (agentId) => {
    if (!agentId) return;
    try {
      await fetch(`/api/v1/agents/${agentId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Delete agent error:', e);
    }
    setAgents(prev => prev.filter(a => (a.agentId || a.id) !== agentId));
    loadRegistryData();
    setActiveView('explore');
  };

  const handleToolCreated = (newTool) => {
    setTools((prev) => [newTool, ...prev]);
    setSelectedTool(newTool);
    setActiveView('tool-detail');
  };

  const handleSaveTool = (updatedTool) => {
    setTools((prev) =>
      prev.map((t) => (t.toolId === updatedTool.toolId ? updatedTool : t))
    );
    setSelectedTool(updatedTool);
  };

  const handleSelectTool = (tool) => {
    setSelectedTool(tool);
    setActiveView('tool-detail');
  };

  const handleSelectMcp = (mcp) => {
    setSelectedMcp(mcp);
    setActiveView('mcp-detail');
  };

  const handleSelectKb = (kb) => {
    setSelectedKb(kb);
    setActiveView('kb-detail');
  };

  const handleStartThread = (agentToRun) => {
    if (agentToRun) setActiveAgent(agentToRun);
    setActiveView('executions');
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/v1/agents/${activeAgent.agentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionTag: '1.4', publisher: 'Admin User' })
      });
      if (res.ok) {
        setIsPublished(true);
      }
    } catch (e) {
      console.error('Publish error:', e);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md min-h-screen flex antialiased">
      {/* Streamlined Side Navigation Bar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-sidebar-width min-h-screen flex flex-col bg-background">
        {/* Home Page: Chat Box + 3 Recently Used + 3 Suggested */}
        {activeView === 'home' && (
          <HomeView
            onSelectAgent={handleSelectAgent}
            onSelectTool={handleSelectTool}
            onOpenPlaygroundWithPrompt={(prompt) => setActiveView('executions')}
          />
        )}

        {/* Threads Page: Recent Threads across all agents */}
        {activeView === 'threads' && (
          <ThreadsView
            onResumeThread={(thread) => {
              setActiveThread(thread);
              const needle = (thread.agent || '').toLowerCase();
              const matched = agents.find(a => (a.name && a.name.toLowerCase() === needle) || (a.agentId && a.agentId.toLowerCase() === needle) || (a.id && a.id.toLowerCase() === needle));
              if (matched) {
                setActiveAgent(matched);
              } else {
                setActiveAgent({
                  agentId: thread.agentId || `agent_${(thread.agent || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                  name: thread.agent || 'Custom Agent',
                  model: { modelId: thread.agentModel || 'amazon.nova-micro-v1:0' }
                });
              }
              setActiveView('executions');
            }}
            onStartNewThread={() => {
              setActiveThread(null);
              setActiveView('executions');
            }}
          />
        )}

        {/* Explore: Groups and Scoped Children Subfolders */}
        {activeView === 'explore' && (
          <ExploreView
            onSelectAgent={handleSelectAgent}
            onOpenCreateTool={() => setActiveView('create-tool')}
            onSelectTool={handleSelectTool}
            onSelectMcp={handleSelectMcp}
            onSelectKb={handleSelectKb}
            onRefreshRegistries={loadRegistryData}
          />
        )}

        {/* Agent Detail & Reconfiguration (6 Tabs, Branding, Prompt Builder) */}
        {activeView === 'agent-detail' && (
          <AgentDetailView
            agent={activeAgent}
            onBack={() => {
              loadRegistryData();
              setActiveView('explore');
            }}
            onSaveAgent={handleSaveAgent}
            onStartThread={handleStartThread}
            onDeleteAgent={handleDeleteAgent}
            availableAgents={agents}
            availableTools={tools}
            availableKbs={kbs}
            availableCollections={mcpCollections}
          />
        )}

        {/* Create Tool */}
        {activeView === 'create-tool' && (
          <CreateToolView
            onCancel={() => setActiveView('explore')}
            onToolCreated={handleToolCreated}
          />
        )}

        {/* Tool Detail & Reconfiguration */}
        {activeView === 'tool-detail' && (
          <ToolDetailView
            tool={selectedTool}
            onBack={() => setActiveView('explore')}
            onSaveTool={handleSaveTool}
          />
        )}

        {/* MCP Server Detail & Reconfiguration (5 Tabs: Overview, Children, Sync, Variables, Access) */}
        {activeView === 'mcp-detail' && (
          <McpDetailView
            mcp={selectedMcp}
            onBack={() => setActiveView('explore')}
            onSaveMcp={(updated) => setSelectedMcp(updated)}
          />
        )}

        {/* Knowledge Base Detail & Management (5 Tabs: Overview, Documents, History, Variables, Access) */}
        {activeView === 'kb-detail' && (
          <KnowledgeBaseDetailView
            kb={selectedKb}
            onBack={() => setActiveView('explore')}
            onSaveKb={(updated) => setSelectedKb(updated)}
          />
        )}


        {/* Workspace Visual DAG Canvas */}
        {activeView === 'workspace' && (
          <WorkspaceView
            agent={activeAgent}
            onUpdateAgent={setActiveAgent}
            onOpenPlayground={() => setActiveView('executions')}
            onPublish={handlePublish}
            isPublished={isPublished}
            availableModels={models}
          />
        )}

        {/* Executions / Playground Trace */}
        {activeView === 'executions' && (
          <PlaygroundView agent={activeAgent} initialThread={activeThread} />
        )}

        {/* Documentation Tab */}
        {activeView === 'docs' && (
          <DocsView
            onOpenExplore={() => setActiveView('explore')}
            onOpenCreateAgent={() => setActiveView('explore')}
            onOpenCreateTool={() => setActiveView('create-tool')}
          />
        )}

        {/* Settings View with Live AWS Bedrock Configuration */}
        {activeView === 'settings' && (
          <SettingsView />
        )}
      </main>
    </div>
  );
}

function SettingsView() {
  const [awsStatus, setAwsStatus] = useState({ configured: false, region: 'us-east-1', mode: 'Checking...' });
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/aws/status');
      if (res.ok) {
        const data = await res.json();
        setAwsStatus(data);
        if (data.region) setRegion(data.region);
      }
    } catch (e) {
      console.error('Failed to fetch AWS status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveAws = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/v1/aws/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKeyId,
          secretAccessKey,
          region,
          sessionToken: sessionToken.trim() || undefined
        })
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'AWS Bedrock configured and validated successfully!' });
        setAccessKeyId('');
        setSecretAccessKey('');
        setSessionToken('');
        fetchStatus();
      } else {
        const err = await res.json();
        setSaveMessage({ type: 'error', text: err.detail || 'Failed to configure AWS.' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Error connecting to backend.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-container-padding mt-6 animate-fadeIn pb-20">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-2xl">settings</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Settings & AWS Bedrock Runtime</h1>
          <p className="text-xs text-on-surface-variant font-mono-label">Configure foundation model execution environment and credentials</p>
        </div>
      </div>

      {/* Live Connection Status Badge */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-5 mb-6 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${awsStatus.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
          <div>
            <h3 className="font-bold text-xs text-on-surface">Runtime Mode: {awsStatus.mode}</h3>
            <span className="text-[11px] font-mono-label text-on-surface-variant block mt-0.5">
              Region: <strong className="text-primary">{awsStatus.region}</strong> {awsStatus.accessKeyPreview ? `• Key: ${awsStatus.accessKeyPreview}` : ''}
            </span>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant hover:border-primary text-xs font-mono-label text-on-surface flex items-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Refresh Status
        </button>
      </div>

      {/* AWS Configuration Form */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant/40">
          <span className="material-symbols-outlined text-primary text-[20px]">cloud</span>
          <h2 className="text-sm font-bold text-on-surface">AWS Bedrock Credentials Setup</h2>
        </div>
        <p className="text-xs text-on-surface-variant mb-5">
          Enter your IAM Access Keys with Amazon Bedrock permissions (<code>bedrock:InvokeModel</code>, <code>bedrock:Converse</code>). Credentials will be saved securely to your local <code>.env</code> file.
        </p>

        {saveMessage && (
          <div className={`p-3.5 rounded-lg mb-5 text-xs flex items-center gap-2 ${
            saveMessage.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {saveMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{saveMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveAws} className="space-y-4 text-xs">
          <div>
            <label className="block text-on-surface font-medium mb-1">
              AWS Access Key ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="AKIAIOSFODNN7EXAMPLE"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-on-surface font-medium mb-1">
              AWS Secret Access Key <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              required
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface font-medium mb-1">AWS Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
              >
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
                <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
              </select>
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">
                Session Token <span className="text-on-surface-variant font-normal">(Optional STS / SSO)</span>
              </label>
              <input
                type="password"
                placeholder="Optional temporary token"
                value={sessionToken}
                onChange={(e) => setSessionToken(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim font-mono-label text-xs font-bold transition-all shadow-[0_0_15px_rgba(192,193,255,0.2)] flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              {saving ? 'Connecting & Verifying...' : 'Save & Connect AWS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
