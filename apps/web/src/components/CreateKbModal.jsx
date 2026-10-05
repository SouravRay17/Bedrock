import React, { useState, useEffect } from 'react';

export default function CreateKbModal({
  isOpen,
  onClose,
  onKbCreated,
  existingGroups = [],
  defaultGroupId = null
}) {
  const [kbName, setKbName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupId || existingGroups[0]?.id || 'grp_engineering');
  const [description, setDescription] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('amazon.titan-embed-text-v2:0');
  const [vectorStore, setVectorStore] = useState('Amazon OpenSearch Serverless (AOSS)');
  const [chunkingStrategy, setChunkingStrategy] = useState('Fixed (300 tokens, 20% overlap)');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (defaultGroupId) {
      setSelectedGroup(defaultGroupId);
    }
  }, [defaultGroupId]);

  // Auto-slug generator
  const handleNameChange = (e) => {
    const val = e.target.value;
    setKbName(val);
    setSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  if (!isOpen) return null;

  const currentGroupObj = existingGroups.find(g => g.id === selectedGroup) || existingGroups[0];
  const groupLocationPath = currentGroupObj ? `${currentGroupObj.name} / knowledge` : 'Root / knowledge';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kbName.trim()) return;

    setIsCreating(true);

    const newKb = {
      id: `kb_${slug || Date.now().toString().slice(-4)}`,
      kbId: `kb_${slug || Date.now().toString().slice(-4)}`,
      name: kbName,
      slug: slug || kbName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      group: currentGroupObj?.name || 'Engineering Group',
      groupId: selectedGroup,
      location: groupLocationPath,
      desc: description || `Enterprise knowledge repository for ${kbName}`,
      description: description || `Enterprise knowledge repository for ${kbName}`,
      embeddingModel: embeddingModel,
      vectorStore: vectorStore,
      chunkingStrategy: chunkingStrategy,
      size: '0 MB',
      documentsCount: 0,
      indexedCount: 0,
      documents: [],
      history: [
        { version: 'v1', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'Created', note: 'Initial repository initialization' }
      ],
      variables: [],
      access: {
        owner: { name: 'Admin User', email: 'admin@agentos.io', role: 'owner', avatar: 'AD' },
        inheritedMembersCount: 16,
        policies: []
      },
      createdAt: new Date().toISOString()
    };

    try {
      await fetch('/api/v1/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKb)
      });
    } catch (err) {
      console.error('Failed to persist KB to API:', err);
    }

    if (onKbCreated) {
      onKbCreated(newKb);
    }

    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-surface-container border border-outline-variant rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-bright flex items-center justify-center text-emerald-400 border border-outline-variant">
              <span className="material-symbols-outlined text-xl">auto_stories</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Create Knowledge Base</h2>
              <p className="text-[11px] text-on-surface-variant">
                Configure Bedrock vector stores, embedding models, and data ingestion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
          {/* Name & Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-on-surface font-medium mb-1">
                Knowledge Base Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Enterprise Architecture Guidelines"
                value={kbName}
                onChange={handleNameChange}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-body-sm"
              />
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Slug Identifier</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-on-surface-variant font-mono-code text-[11px]">/</span>
                <input
                  type="text"
                  required
                  placeholder="enterprise-architecture-guidelines"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 pl-6 text-primary font-mono-code text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Group / Location Selector */}
          <div>
            <label className="block text-on-surface font-medium mb-1">Target Group Location</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono-code"
            >
              {existingGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (/{g.slug})
                </option>
              ))}
            </select>
            <span className="text-[10px] font-mono-label text-on-surface-variant mt-1 block">
              Scoped path: <strong className="text-on-surface">{groupLocationPath}</strong>
            </span>
          </div>

          {/* Description */}
          <div>
            <label className="block text-on-surface font-medium mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Describe the domain, documents, and purpose of this knowledge base..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none text-xs"
            />
          </div>

          {/* Embedding Model Selection */}
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-on-surface font-medium">Bedrock Embedding Foundation Model</label>
              <span className="text-[10px] font-mono-label text-emerald-400 font-bold">AWS Bedrock Supported</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { id: 'amazon.titan-embed-text-v2:0', name: 'Amazon Titan Embeddings v2', dims: '1024d / 512d', badge: 'Recommended' },
                { id: 'cohere.embed-english-v3', name: 'Cohere Embed English v3', dims: '1024d', badge: 'High Accuracy' },
                { id: 'amazon.titan-embed-text-v1', name: 'Amazon Titan Embeddings v1', dims: '1536d', badge: 'Standard' },
                { id: 'cohere.embed-multilingual-v3', name: 'Cohere Multilingual v3', dims: '1024d', badge: 'Multi-language' }
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setEmbeddingModel(m.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    embeddingModel === m.id
                      ? 'bg-primary/10 border-primary shadow'
                      : 'bg-surface-container border-outline-variant/50 hover:border-outline-variant'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-on-surface">{m.name}</div>
                    <div className="text-[10px] font-mono-code text-on-surface-variant">{m.dims}</div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-mono-label text-primary font-bold">
                    {m.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Vector Store & Chunking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-on-surface font-medium mb-1">Vector Storage Provider</label>
              <select
                value={vectorStore}
                onChange={(e) => setVectorStore(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface focus:outline-none focus:border-primary text-xs"
              >
                <option value="Amazon OpenSearch Serverless (AOSS)">Amazon OpenSearch Serverless (AOSS)</option>
                <option value="Pinecone Serverless (AWS us-east-1)">Pinecone Serverless</option>
                <option value="Amazon Aurora PostgreSQL pgvector">Amazon Aurora pgvector</option>
                <option value="In-Memory FAISS (Local Sandbox)">In-Memory FAISS</option>
              </select>
            </div>

            <div>
              <label className="block text-on-surface font-medium mb-1">Chunking Strategy</label>
              <select
                value={chunkingStrategy}
                onChange={(e) => setChunkingStrategy(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-on-surface focus:outline-none focus:border-primary text-xs"
              >
                <option value="Fixed (300 tokens, 20% overlap)">Fixed (300 tokens, 20% overlap)</option>
                <option value="Semantic Chunking (Sentence split)">Semantic Chunking</option>
                <option value="Hierarchical (Parent-child chunking)">Hierarchical (Parent-child)</option>
                <option value="No chunking (Raw document injection)">No chunking</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !kbName.trim()}
              className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-fixed-dim transition-all shadow flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">auto_stories</span>
              {isCreating ? 'Creating...' : 'Create Knowledge Base'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
