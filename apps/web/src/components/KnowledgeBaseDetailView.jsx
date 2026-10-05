import React, { useState } from 'react';

export default function KnowledgeBaseDetailView({ kb, onBack, onSaveKb }) {
  const [activeTab, setActiveTab] = useState('documents'); // 'overview' | 'documents' | 'history' | 'variables' | 'access'
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [documents, setDocuments] = useState(kb?.documents || []);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddDataSourceModal, setShowAddDataSourceModal] = useState(false);
  const [newDataSourceType, setNewDataSourceType] = useState('S3 Bucket');
  const [newDataSourceUri, setNewDataSourceUri] = useState('');

  // Variables state
  const [showAddVariableModal, setShowAddVariableModal] = useState(false);
  const [variables, setVariables] = useState(kb?.variables || []);
  const [showInheritedVariables, setShowInheritedVariables] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  // Access State
  const [accessFilter, setAccessFilter] = useState('all'); // 'all' | 'people' | 'services' | 'resources'
  const [accessSearchQuery, setAccessSearchQuery] = useState('');
  const [showInheritedAccess, setShowInheritedAccess] = useState(false);
  const [policyEffect, setPolicyEffect] = useState('Permit');
  const [policyPrincipal, setPolicyPrincipal] = useState('User');
  const [policyPrincipalValue, setPolicyPrincipalValue] = useState('');
  const [policyAction, setPolicyAction] = useState('read');
  const [policyDescription, setPolicyDescription] = useState('');
  const [activePolicies, setActivePolicies] = useState(kb?.access?.policies || []);

  const kbData = {
    id: kb?.id || kb?.kbId || '',
    name: kb?.name || '',
    group: kb?.group || 'Default Workspace',
    subfolder: kb?.subfolder || 'knowledge',
    location: kb?.location || 'Default Workspace / knowledge',
    description: kb?.desc || kb?.description || '',
    embeddingModel: kb?.embeddingModel || 'amazon.titan-embed-text-v2:0 (1024d)',
    vectorStore: kb?.vectorStore || 'Amazon OpenSearch Serverless (AOSS)',
    chunkingStrategy: kb?.chunkingStrategy || 'Fixed (300 tokens, 20% overlap)',
    createdAt: kb?.createdAt || new Date().toISOString().split('T')[0],
    history: kb?.history || [],
    owner: kb?.access?.owner || { name: 'Admin User', email: 'admin@agentos.io', role: 'owner', avatar: 'AD' }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setTimeout(() => {
      const newDocs = files.map((f, i) => ({
        id: `doc_${Date.now()}_${i}`,
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
        status: 'Indexed',
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setDocuments(prev => [...newDocs, ...prev]);
      setIsUploading(false);
    }, 1000);
  };

  const handleAddDataSource = (e) => {
    e.preventDefault();
    if (!newDataSourceUri.trim()) return;
    const newDoc = {
      id: `ds_${Date.now()}`,
      name: `${newDataSourceType}: ${newDataSourceUri}`,
      size: 'Syncing...',
      status: 'Connected',
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setDocuments(prev => [newDoc, ...prev]);
    setShowAddDataSourceModal(false);
    setNewDataSourceUri('');
  };

  const handleAddVariable = (e) => {
    e.preventDefault();
    if (!newVarKey.trim()) return;
    setVariables(prev => [...prev, { key: newVarKey.toUpperCase(), value: newVarValue, desc: 'Knowledge Base scoped variable' }]);
    setNewVarKey('');
    setNewVarValue('');
    setShowAddVariableModal(false);
  };

  const handleCreatePolicy = (e) => {
    e.preventDefault();
    const newPolicy = {
      id: `pol_${Date.now()}`,
      effect: policyEffect,
      principal: policyPrincipalValue ? `${policyPrincipal}::"${policyPrincipalValue}"` : 'any',
      action: `Action::"${policyAction}"`,
      description: policyDescription || 'Fine-grained Cedar access rule',
      resource: kbData.name
    };
    setActivePolicies(prev => [newPolicy, ...prev]);
    setPolicyDescription('');
    setPolicyPrincipalValue('');
  };

  const filteredDocs = documents.filter(d => d.name.toLowerCase().includes(docSearchQuery.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-3 animate-fadeIn pb-24 text-on-surface">
      
      {/* Top Alpha Warning Banner matching screenshot */}
      <div className="bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] px-4 py-2 rounded-lg text-xs font-medium flex items-center justify-between mb-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>
            Welcome to the Technical Alpha! Some features are in active development and will be rolled out in the coming weeks. Reach out to us on Teams!
          </span>
        </div>
        <span className="text-[10px] font-mono-label bg-[#00f2fe]/20 px-2 py-0.5 rounded font-bold uppercase">
          Alpha v1.4
        </span>
      </div>

      {/* Top Breadcrumbs and Navigation */}
      <div className="flex items-center justify-between pb-3 mb-5 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-xs font-mono-code text-on-surface-variant">
          <button
            onClick={onBack}
            className="w-7 h-7 rounded bg-surface-container border border-outline-variant hover:bg-surface-container-highest flex items-center justify-center text-on-surface transition-colors mr-1"
            title="Back to Explorer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          
          <span className="text-on-surface-variant hover:text-on-surface cursor-pointer" onClick={onBack}>Explorer</span>
          <span>&gt;</span>
          <span className="text-on-surface-variant">{kbData.group}</span>
          <span>&gt;</span>
          <span className="text-on-surface-variant">{kbData.subfolder}</span>
          <span>&gt;</span>
          <span className="text-primary font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">auto_stories</span>
            {kbData.name}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(kbData.id)}
            className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
            title="Copy ID"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddDataSourceModal(true)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant text-xs font-mono-label text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_link</span>
            + Add Data Source
          </button>
        </div>
      </div>

      {/* The 5 Tabs matching user photos */}
      <div className="flex items-center gap-6 border-b border-outline-variant mb-6 text-xs font-mono-label font-bold">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'documents', label: 'Documents' },
          { id: 'history', label: 'History' },
          { id: 'variables', label: 'Variables' },
          { id: 'access', label: 'Access' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-2.5 transition-all border-b-2 ${
              activeTab === t.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW                                                            */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-title-sm font-title-sm text-on-surface font-semibold mb-4 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">auto_stories</span>
              Knowledge Base Metadata & Bedrock RAG Pipeline
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Knowledge Base Name</span>
                <p className="font-bold text-on-surface text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                  {kbData.name}
                </p>
              </div>

              <div>
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Bedrock Embedding Foundation Model</span>
                <p className="font-bold text-emerald-400 text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                  {kbData.embeddingModel}
                </p>
              </div>

              <div>
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Vector Storage Provider</span>
                <p className="font-bold text-primary text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                  {kbData.vectorStore}
                </p>
              </div>

              <div>
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Chunking & Overlap Configuration</span>
                <p className="text-on-surface text-sm bg-surface-container-lowest p-2.5 rounded border border-outline-variant/30 font-mono-code">
                  {kbData.chunkingStrategy}
                </p>
              </div>

              <div className="md:col-span-2">
                <span className="text-on-surface-variant text-[11px] font-mono-label uppercase block mb-1">Description</span>
                <p className="text-on-surface bg-surface-container-lowest p-3 rounded border border-outline-variant/30 leading-relaxed text-xs">
                  {kbData.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DOCUMENTS (Matches Screenshot 4)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-4 text-xs animate-fadeIn">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-on-surface">
                Documents <span className="text-on-surface-variant font-normal font-mono-code">{documents.filter(d => d.status === 'Indexed').length} of {documents.length} indexed</span>
              </span>
              <span className="text-[11px] text-on-surface-variant underline cursor-pointer hover:text-on-surface">
                Hiding indexed files
              </span>
            </div>

            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-on-surface-variant">search</span>
              <input
                type="text"
                placeholder="Search documents..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder-on-surface-variant/60"
              />
            </div>
          </div>

          {/* Local Uploads Collapsible Section */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-md">
            <div className="px-5 py-3.5 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-2 font-bold text-xs text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
                <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
                Local uploads <span className="text-on-surface-variant font-normal font-mono-code">({documents.length} files)</span>
              </div>

              <label className="cursor-pointer px-3 py-1 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded text-[11px] font-mono-label font-bold text-primary transition-colors">
                + Upload File
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="p-6 space-y-4">
              {filteredDocs.length === 0 ? (
                <div className="text-center text-on-surface-variant py-2">
                  No files uploaded yet. Drag and drop files below to upload.
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/30">
                  {filteredDocs.map((d) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-400 text-[18px]">description</span>
                        <div>
                          <div className="font-bold text-xs text-on-surface">{d.name}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono-code">{d.size} • Uploaded {d.uploadedAt}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-label font-bold">
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dashed Drag and Drop Dropzone matching photo */}
              <label className="border-2 border-dashed border-outline-variant/60 hover:border-primary/80 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group bg-surface-container-lowest/50 block">
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors mb-2">
                  <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                </div>
                <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                  {isUploading ? 'Uploading and vectorizing files...' : 'Click to upload'}
                </span>
                <span className="text-[10px] text-on-surface-variant mt-1">
                  Supports PDF, DOCX, TXT, Markdown, CSV (Amazon Titan embeddings will chunk and index automatically)
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORY (Matches Screenshot 3)                                     */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md">
            <h2 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
              History
            </h2>

            <div className="space-y-2">
              {kbData.history.map((h, i) => (
                <div key={i} className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40 flex items-center justify-between font-mono-code text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold text-[10px]">
                      {h.version}
                    </span>
                    <span className="text-on-surface">{h.note || 'Repository revision'}</span>
                  </div>
                  <span className="text-on-surface-variant text-[11px]">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VARIABLES (Matches Screenshot 2)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'variables' && (
        <div className="space-y-4 text-xs animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
            <div>
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="font-mono-code text-primary font-bold">{}</span>
                Variables
              </h2>
              <p className="text-[11px] text-on-surface-variant mt-1 font-mono-code">
                Key-value configuration for descendant resources. Referenced using the <code className="text-primary font-bold">$KEY</code> prefix.
              </p>
            </div>

            {variables.length === 0 ? (
              <div className="text-center text-on-surface-variant py-4">
                No variables defined. Add one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="p-2.5 bg-surface-container-lowest rounded border border-outline-variant/40 flex items-center justify-between font-mono-code">
                    <span className="text-primary font-bold">${v.key}</span>
                    <span className="text-on-surface">{v.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Inherited Variables Collapsible Accordion */}
            <div className="pt-2 border-t border-outline-variant/40">
              <button
                onClick={() => setShowInheritedVariables(!showInheritedVariables)}
                className="w-full flex items-center justify-between text-left py-2 font-mono-label text-xs text-on-surface hover:text-primary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">
                    {showInheritedVariables ? 'expand_less' : 'expand_more'}
                  </span>
                  Inherited variables
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    8
                  </span>
                </span>
              </button>

              {showInheritedVariables && (
                <div className="mt-2 space-y-1.5 pl-6 font-mono-code text-[11px] text-on-surface-variant">
                  <div className="flex justify-between py-1 border-b border-outline-variant/20">
                    <span>$AWS_REGION</span>
                    <span className="text-on-surface">us-east-1</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/20">
                    <span>$BEDROCK_EMBED_MODEL</span>
                    <span className="text-on-surface">amazon.titan-embed-text-v2:0</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/20">
                    <span>$DEFAULT_ORGANIZATION</span>
                    <span className="text-on-surface">engineering-org</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAddVariableModal(true)}
                className="px-3.5 py-1.5 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded-lg text-xs font-mono-label font-bold text-on-surface transition-colors flex items-center gap-1"
              >
                + Add variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ACCESS (Matches Screenshots 1 & 5)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6 text-xs animate-fadeIn">
          {/* Card 1: Access List */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-secondary">shield</span>
                  Access List
                </h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Manage who can access and interact with this knowledgebase
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-surface-container-highest border border-outline-variant text-[10px] font-mono-label text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  Private
                </span>
                <button className="px-3 py-1 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded-lg text-[11px] font-mono-label font-bold text-on-surface">
                  + Add
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { id: 'all', label: 'All', count: 17 },
                { id: 'people', label: 'People', count: 17 },
                { id: 'services', label: 'Services', count: 0 },
                { id: 'resources', label: 'Resources', count: 0 }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAccessFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-mono-label flex items-center gap-1.5 transition-colors ${
                    accessFilter === f.id
                      ? 'bg-primary/20 text-primary font-bold border border-primary/40'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:text-on-surface'
                  }`}
                >
                  {f.label}
                  <span className="px-1.5 py-0.2 rounded-full bg-surface-container-highest text-[9px]">
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-on-surface-variant">search</span>
              <input
                type="text"
                placeholder="Search by name, type, scope..."
                value={accessSearchQuery}
                onChange={(e) => setAccessSearchQuery(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            {/* User Row (Matches Screenshot 5) */}
            <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-xs text-primary">
                  {kbData.owner.avatar}
                </div>
                <div>
                  <div className="font-bold text-xs text-on-surface flex items-center gap-2">
                    {kbData.owner.name}
                    <span className="px-1.5 py-0.2 rounded bg-secondary/20 text-secondary text-[9px] font-mono-label uppercase font-bold">
                      {kbData.owner.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inherited Members Collapsible */}
            <div className="pt-2 border-t border-outline-variant/40">
              <button
                onClick={() => setShowInheritedAccess(!showInheritedAccess)}
                className="w-full flex items-center justify-between text-left py-1.5 font-mono-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">
                    {showInheritedAccess ? 'expand_less' : 'expand_more'}
                  </span>
                  Inherited (16)
                </span>
              </button>
            </div>
          </div>

          {/* Card 2: Advanced Access Policies (Cedar ABAC matching screenshots 1 & 5) */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-400">policy</span>
                Advanced: Access Policies
              </h2>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_less</span>
            </div>

            {/* Work in progress yellow alert box */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 space-y-1">
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Work in Progress
              </div>
              <p className="text-[11px] text-amber-200/90">
                This feature is under active development and may change or not function as expected.
              </p>
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Fine-grained, attribute-based access policies evaluated at runtime before actions are performed on this knowledgebase. These policies apply in addition to the default access control rules. Forbid policies override permit policies.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Active Policies List */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono-label text-on-surface-variant uppercase font-bold block">
                  Active Policies ({activePolicies.length})
                </span>
                
                {activePolicies.length === 0 ? (
                  <div className="p-8 border border-outline-variant/60 rounded-xl bg-surface-container-lowest text-center text-on-surface-variant">
                    No policies configured yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activePolicies.map((pol) => (
                      <div key={pol.id} className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 font-mono-code text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.2 rounded font-bold ${pol.effect === 'Permit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {pol.effect}
                          </span>
                          <span className="text-on-surface-variant">{pol.action}</span>
                        </div>
                        <div className="text-on-surface font-bold">{pol.principal}</div>
                        <p className="text-[10px] text-on-surface-variant">{pol.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New Policy Form (Cedar Engine) */}
              <form onSubmit={handleCreatePolicy} className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-3 font-body-sm">
                <span className="text-[11px] font-mono-label text-on-surface uppercase font-bold block">
                  New Policy
                </span>

                {/* Effect Toggle: Permit | Forbid */}
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-mono-label">Effect</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPolicyEffect('Permit')}
                      className={`py-1.5 rounded-lg border font-mono-label text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        policyEffect === 'Permit'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-surface-container border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Permit
                    </button>

                    <button
                      type="button"
                      onClick={() => setPolicyEffect('Forbid')}
                      className={`py-1.5 rounded-lg border font-mono-label text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        policyEffect === 'Forbid'
                          ? 'bg-red-500/20 border-red-500 text-red-400'
                          : 'bg-surface-container border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">cancel</span>
                      Forbid
                    </button>
                  </div>
                </div>

                {/* Principal */}
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-mono-label">Principal</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={policyPrincipal}
                      onChange={(e) => setPolicyPrincipal(e.target.value)}
                      className="bg-surface-container border border-outline-variant rounded p-1.5 text-on-surface text-xs font-mono-code"
                    >
                      <option value="User">User</option>
                      <option value="AgentRole">AgentRole</option>
                      <option value="Service">Service</option>
                    </select>

                    <input
                      type="text"
                      placeholder="any (leave empty for all)"
                      value={policyPrincipalValue}
                      onChange={(e) => setPolicyPrincipalValue(e.target.value)}
                      className="col-span-2 bg-surface-container border border-outline-variant rounded p-1.5 text-on-surface text-xs font-mono-code"
                    />
                  </div>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-mono-label">Action</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select className="bg-surface-container border border-outline-variant rounded p-1.5 text-on-surface text-xs font-mono-code">
                      <option value="Action">Action</option>
                    </select>

                    <select
                      value={policyAction}
                      onChange={(e) => setPolicyAction(e.target.value)}
                      className="col-span-2 bg-surface-container border border-outline-variant rounded p-1.5 text-on-surface text-xs font-mono-code"
                    >
                      <option value="read">read</option>
                      <option value="query_vector">query_vector</option>
                      <option value="write_document">write_document</option>
                      <option value="delete">delete</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-mono-label">Description</label>
                  <input
                    type="text"
                    placeholder="Optional description for maintainers"
                    value={policyDescription}
                    onChange={(e) => setPolicyDescription(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-on-surface text-xs"
                  />
                </div>

                {/* Resource */}
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-mono-label">Resource</label>
                  <div className="flex items-center justify-between p-2 bg-surface-container rounded border border-outline-variant/40 font-mono-code text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">auto_stories</span>
                      {kbData.name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">this knowledgebase</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono-code text-on-surface-variant/80">
                  Policies created here use Cedar resource id <span className="text-primary font-bold">01a05eb9-bfeb-7d1e-92c8</span>
                </p>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-on-primary font-bold rounded-lg font-mono-label text-xs shadow hover:bg-primary-fixed-dim transition-all"
                >
                  Create Policy
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DATA SOURCE */}
      {showAddDataSourceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">add_link</span>
                Connect Data Source
              </h3>
              <button onClick={() => setShowAddDataSourceModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDataSource} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface mb-1 font-medium">Connector Type</label>
                <select
                  value={newDataSourceType}
                  onChange={(e) => setNewDataSourceType(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono-code"
                >
                  <option value="S3 Bucket">AWS S3 Bucket (s3://...)</option>
                  <option value="Web Crawler">Web Crawler (https://...)</option>
                  <option value="Confluence">Confluence Cloud Space</option>
                  <option value="SharePoint">Microsoft SharePoint</option>
                </select>
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Source URI / Endpoint</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. s3://enterprise-docs-us-east-1/sops/"
                  value={newDataSourceUri}
                  onChange={(e) => setNewDataSourceUri(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowAddDataSourceModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold shadow hover:bg-primary-fixed-dim"
                >
                  Connect & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VARIABLE */}
      {showAddVariableModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="font-mono-code text-primary font-bold">{}</span>
                Add Knowledge Base Variable
              </h3>
              <button onClick={() => setShowAddVariableModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddVariable} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Key (Referenced via $KEY)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CONFLUENCE_SPACE_ID"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-medium">Variable Value</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENG_ARCH_2026"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface font-mono-code focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowAddVariableModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold shadow hover:bg-primary-fixed-dim"
                >
                  Save Variable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
