import React, { useState } from 'react';

export default function DocsView({ onOpenExplore, onOpenCreateAgent, onOpenCreateTool }) {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', title: '1. Getting Started with AgentOS', icon: 'rocket_launch' },
    { id: 'explore-groups', title: '2. Explore & Workspace Groups', icon: 'folder' },
    { id: 'building-agents', title: '3. Building Custom AI Agents', icon: 'smart_toy' },
    { id: 'tools-apis', title: '4. Creating & Reconfiguring Tools', icon: 'construction' },
    { id: 'mcp-collections', title: '5. Model Context Protocol (MCP)', icon: 'hub' },
    { id: 'workspace-playground', title: '6. Workspace Canvas & Playground', icon: 'terminal' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-4 animate-fadeIn pb-24">
      {/* Docs Header */}
      <div className="mb-8 pb-4 border-b border-outline-variant flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Documentation & User Guide</h1>
          </div>
          <p className="text-xs text-on-surface-variant">
            Master the AgentOS no-code AI creation platform powered by Amazon Bedrock.
          </p>
        </div>

        <button
          onClick={onOpenExplore}
          className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-1.5 shadow"
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          Open Explore
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Navigation Submenu */}
        <aside className="md:col-span-4 bg-surface-container-low border border-outline-variant rounded-xl p-3 h-fit space-y-1">
          <span className="px-3 py-2 text-[10px] font-mono-label uppercase tracking-wider text-on-surface-variant block font-bold">
            Table of Contents
          </span>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                activeSection === sec.id
                  ? 'bg-primary/10 border-l-2 border-primary text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${activeSection === sec.id ? 'text-primary' : ''}`}>
                {sec.icon}
              </span>
              <span>{sec.title}</span>
            </button>
          ))}
        </aside>

        {/* Right Content Area */}
        <div className="md:col-span-8 bg-surface-container border border-outline-variant rounded-xl p-8 shadow-md text-xs space-y-6 leading-relaxed">
          
          {/* Section 1: Getting Started */}
          {activeSection === 'getting-started' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">rocket_launch</span>
                <h2 className="text-lg font-bold text-on-surface">1. Getting Started with AgentOS</h2>
              </div>
              <p className="text-on-surface">
                <strong>AgentOS</strong> is an extensible, no-code AI Agent Development Environment ("Canva/Figma for AI Agents") designed to build, test, and orchestrate complex autonomous agents without writing code.
              </p>
              <div className="p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/40 space-y-2">
                <h3 className="font-bold text-primary text-xs">Core Concepts</h3>
                <ul className="list-disc pl-4 space-y-1 text-on-surface-variant text-[11px]">
                  <li><strong>Explore & Groups:</strong> All resources (Agents, Models, Tools, MCPs, Knowledge Bases) are structured inside shared Group Folders with granular role-based access.</li>
                  <li><strong>Amazon Bedrock Orchestration:</strong> Native tool-calling ReAct loops powered by Amazon Nova Micro, Amazon Titan, Claude 3.5 Sonnet, and GPT-4o.</li>
                  <li><strong>Variables & Secrets:</strong> Securely inject API keys and bearer tokens with zero leaks between tools.</li>
                </ul>
              </div>
            </article>
          )}

          {/* Section 2: Explore & Groups */}
          {activeSection === 'explore-groups' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">folder</span>
                <h2 className="text-lg font-bold text-on-surface">2. Explore & Workspace Groups</h2>
              </div>
              <p className="text-on-surface">
                Under the <strong>Explore</strong> tab, all projects are organized into <strong>Groups</strong>. When you open a group, you will find 4 comprehensive tabs:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">1. Overview</h4>
                  <p className="text-[11px] text-on-surface-variant">Displays group name, slug (e.g. <code>/engineering-group</code>), description, and resource summary metrics.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">2. Children (Subfolders)</h4>
                  <p className="text-[11px] text-on-surface-variant">Categorized subfolders for <code>/agents</code>, <code>/models</code>, <code>/tools</code>, <code>/mcps</code>, <code>/collections</code>, and <code>/knowledge</code>.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">3. Variables</h4>
                  <p className="text-[11px] text-on-surface-variant">Group-scoped API endpoints and masked secrets shared across team agents.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">4. Access & Policies</h4>
                  <p className="text-[11px] text-on-surface-variant">Manage members (Owner, Maintainer, Builder, Viewer) and view protected AWS IAM service bindings.</p>
                </div>
              </div>
            </article>
          )}

          {/* Section 3: Building Agents */}
          {activeSection === 'building-agents' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">smart_toy</span>
                <h2 className="text-lg font-bold text-on-surface">3. Building Custom AI Agents</h2>
              </div>
              <p className="text-on-surface">
                To create a new agent, click <strong>+ Create → Create Agent</strong> from Explore. The 4-step wizard configures:
              </p>
              <div className="space-y-2">
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <strong className="text-primary">Step 1: Foundation Model</strong> — Select between Amazon Nova Micro (Zero-Cost / Free-Tier), Titan Text Lite, Claude 3.5 Sonnet, or GPT-4o.
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <strong className="text-secondary">Step 2: Model Archetype</strong> — Select from <em>Chat & Dialogue</em>, <em>Synthesize & Summarization</em>, <em>Autonomous Task Worker</em>, or <em>Classification Router</em>.
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <strong className="text-tertiary">Step 3: Identity & Group</strong> — Provide Name, Description, and assign to a specific Group Folder.
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <strong className="text-emerald-400">Step 4: Attach Capabilities</strong> — Bind WebSearchTool, CalculatorTool, or custom HTTP endpoints.
                </div>
              </div>
            </article>
          )}

          {/* Section 4: Tools & APIs */}
          {activeSection === 'tools-apis' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">construction</span>
                <h2 className="text-lg font-bold text-on-surface">4. Creating & Reconfiguring Tools</h2>
              </div>
              <p className="text-on-surface">
                Tools extend an agent's capability to read live data and trigger real-world actions.
              </p>
              <div className="p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/40 space-y-3">
                <h4 className="font-bold text-primary">Tool Types & Security Controls:</h4>
                <ul className="list-disc pl-4 space-y-1.5 text-on-surface-variant text-[11px]">
                  <li><strong>HTTP API:</strong> Base URL, API Path, HTTP Method (GET, POST, etc.), and 6 Authentication schemes (None, Bearer Token, Basic Auth, API Key, Client Credentials, Custom).</li>
                  <li><strong>User Function:</strong> Python 3.11 MicroVM code execution sandbox with <code>handler.py</code>.</li>
                  <li><strong>Safe to Run:</strong> Toggle for read-only actions that bypass human approval.</li>
                  <li><strong>TICMA (HTTP is OK):</strong> Permits plain HTTP calls for private internal gateways.</li>
                  <li><strong>Skip TLS / SSL Verification:</strong> Bypass certificate validation for self-signed development endpoints.</li>
                  <li><strong>Tool-Scoped Variables:</strong> Variables defined under a tool belong <em>strictly</em> to that tool and never cross-contaminate.</li>
                </ul>
              </div>
            </article>
          )}

          {/* Section 5: MCP Collections */}
          {activeSection === 'mcp-collections' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">hub</span>
                <h2 className="text-lg font-bold text-on-surface">5. Model Context Protocol (MCP) Collections</h2>
              </div>
              <p className="text-on-surface">
                AgentOS natively supports the open <strong>Model Context Protocol (MCP)</strong> standard, allowing agents to seamlessly discover and execute tools across heterogeneous servers.
              </p>
              <div className="p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/40 space-y-2">
                <h4 className="font-bold text-primary">MCP Capabilities:</h4>
                <p className="text-on-surface-variant text-[11px]">
                  Bundle multiple servers (e.g. GitHub MCP + Jira Service Desk MCP) into a single <strong>MCP Collection</strong> and attach it to any agent with one click.
                </p>
              </div>
            </article>
          )}

          {/* Section 6: Workspace & Playground */}
          {activeSection === 'workspace-playground' && (
            <article className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
                <h2 className="text-lg font-bold text-on-surface">6. Workspace Canvas & Playground</h2>
              </div>
              <p className="text-on-surface">
                Visually inspect agent DAG connections and test execution flows in real time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">Visual DAG Workspace</h4>
                  <p className="text-[11px] text-on-surface-variant">Inspect animated node links, pulse states, attached tools, and the Inspector panel.</p>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                  <h4 className="font-bold text-primary mb-1">Playground & Trace</h4>
                  <p className="text-[11px] text-on-surface-variant">Chat with your agent and inspect the step-by-step reasoning timeline with latency, token count, and cost metrics.</p>
                </div>
              </div>
            </article>
          )}

        </div>
      </div>
    </div>
  );
}
