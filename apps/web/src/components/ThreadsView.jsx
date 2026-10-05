import React, { useState, useEffect } from 'react';

export default function ThreadsView({ onResumeThread, onStartNewThread }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/threads');
      if (res.ok) {
        const data = await res.json();
        setThreads(data || []);
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const handleDeleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;
    setDeletingId(threadId);
    try {
      const res = await fetch(`/api/v1/threads/${threadId}`, { method: 'DELETE' });
      if (res.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Show all threads by default, with search matching title, snippet, or agent name
  const filteredThreads = threads.filter((th) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (th.title && th.title.toLowerCase().includes(q)) ||
      (th.lastMessage && th.lastMessage.toLowerCase().includes(q)) ||
      (th.agent && th.agent.toLowerCase().includes(q)) ||
      (th.agentModel && th.agentModel.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-container-padding mt-4 animate-fadeIn pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">forum</span>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Recent Threads</h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono-label font-bold text-primary">
              {threads.length} {threads.length === 1 ? 'Session' : 'Sessions'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            All recent agent execution threads and conversation traces across your projects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchThreads}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-surface-container border border-outline-variant text-on-surface hover:text-primary hover:border-primary text-xs font-mono-label flex items-center gap-1.5 transition-all"
            title="Refresh threads"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={onStartNewThread}
            className="bg-primary text-on-primary hover:bg-primary-fixed-dim px-4 py-2 rounded-lg font-mono-label text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(192,193,255,0.2)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_comment</span>
            + New Thread
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search all threads by keyword, question, or agent name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-body-md transition-colors"
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs font-mono-label text-on-surface-variant hover:text-on-surface"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Threads List */}
      <div className="space-y-3.5">
        {filteredThreads.length > 0 ? (
          filteredThreads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => onResumeThread(thread)}
              className="bg-surface-container border border-outline-variant rounded-xl p-5 hover:border-primary transition-all cursor-pointer group hover:shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Column: Thread Content & Snippet */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-surface-bright border border-outline-variant flex items-center justify-center text-primary group-hover:scale-105 transition-transform flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">{thread.agentIcon || 'chat'}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                        {thread.title || 'Conversation Session'}
                      </h2>
                    </div>

                    <p className="text-body-sm text-on-surface-variant text-xs line-clamp-2 leading-relaxed">
                      "{thread.lastMessage || 'Execution completed without output text.'}"
                    </p>
                  </div>
                </div>

                {/* Citations & Metadata Bar */}
                <div className="flex flex-wrap items-center gap-3 pl-12 pt-2 border-t border-outline-variant/30 text-[11px] font-mono-label text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-on-surface-variant/70">schedule</span>
                    {thread.timestamp || 'Recent'}
                  </span>
                  <span>•</span>
                  <span>{thread.tokens || 0} tokens</span>
                  <span>•</span>
                  <span>{thread.duration || '0.0s'}</span>

                  {thread.citations && thread.citations.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">dataset</span>
                        {thread.citations.join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Prominent Agent Name & Status on the Side */}
              <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-outline-variant/30 shrink-0 md:min-w-[240px] md:pl-4 md:border-l md:border-outline-variant/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono-label text-on-surface-variant tracking-wider">Agent:</span>
                      <span className="text-xs font-bold text-primary font-mono-label">
                        {thread.agent || 'aa'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono-label text-on-surface-variant/80 block">
                      {thread.agentModel || 'Amazon Nova Micro'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono-label text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {thread.status || 'Active'}
                  </span>

                  <button
                    onClick={(e) => handleDeleteThread(e, thread.id)}
                    disabled={deletingId === thread.id}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                    title="Delete thread"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {deletingId === thread.id ? 'progress_activity' : 'delete'}
                    </span>
                  </button>

                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all text-[20px]">
                    chevron_right
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 rounded-2xl bg-surface-container border border-dashed border-outline-variant text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mx-auto">
              <span className="material-symbols-outlined text-2xl text-primary">forum</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-on-surface">No conversation threads found</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? `No threads matched "${searchTerm}". Try another search term or start a new thread.`
                  : 'Start a thread with Agent AA in the Playground to generate interactive sessions.'}
              </p>
            </div>
            <button
              onClick={onStartNewThread}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-mono-label text-xs font-bold inline-flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-[16px]">add_comment</span>
              + Start First Thread
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
