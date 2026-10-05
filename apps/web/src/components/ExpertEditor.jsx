import React, { useState } from 'react';
import { Code2, Check, AlertCircle, Save } from 'lucide-react';

export default function ExpertEditor({ agent, onUpdateAgent }) {
  const [jsonText, setJsonText] = useState(JSON.stringify(agent, null, 2));
  const [error, setError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      onUpdateAgent(parsed);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            Declarative Agent Definition (Canonical JSON Schema)
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Inspect and directly edit the immutable JSON specification executed by the AgentOS runtime.
          </p>
        </div>

        <button onClick={handleSave} className="btn-primary text-xs py-1.5 px-4">
          <Save className="w-3.5 h-3.5" />
          Apply & Validate Spec
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>JSON Syntax Error: {error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Agent Definition successfully validated and synchronized.</span>
        </div>
      )}

      <div className="glass-panel p-4">
        <textarea
          rows={26}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full bg-slate-950 text-xs font-mono text-emerald-300 p-4 rounded-lg border border-[var(--border-subtle)] focus:outline-none focus:border-indigo-500 leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
