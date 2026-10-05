import React from 'react';

export default function Sidebar({ activeView, setActiveView }) {
  const menuItems = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'threads', label: 'Threads', icon: 'forum' },
    { id: 'explore', label: 'Explore', icon: 'explore' },
    { id: 'workspace', label: 'Workspace', icon: 'work' },
    { id: 'executions', label: 'Executions', icon: 'receipt_long' },
  ];

  return (
    <nav className="hidden md:flex fixed left-0 top-0 h-screen w-sidebar-width z-50 border-r border-outline-variant bg-surface-container-low flex-col py-4 px-2 select-none">
      {/* Brand Header */}
      <div 
        onClick={() => setActiveView('home')}
        className="flex items-center gap-3 px-4 py-4 mb-4 cursor-pointer"
      >
        <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(192,193,255,0.3)]">
          A
        </div>
        <div>
          <h1 className="text-title-sm font-title-sm font-bold text-on-surface">AgentOS</h1>
          <p className="text-mono-label font-mono-label text-on-surface-variant text-[11px]">Autonomous Clarity</p>
        </div>
      </div>

      {/* Navigation Links (Create button removed) */}
      <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left ${
                isActive
                  ? 'text-on-surface border-l-2 border-primary font-bold bg-surface-container scale-[0.98]'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-primary' : ''}`}>
                {item.icon}
              </span>
              <span className="text-body-md font-body-md text-[13px]">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer: Docs (Above Settings) & Settings & User Profile */}
      <div className="mt-auto px-1 pb-2 space-y-1">
        {/* Docs Tab */}
        <button 
          onClick={() => setActiveView('docs')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            activeView === 'docs' 
              ? 'text-on-surface bg-surface-container font-bold border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${activeView === 'docs' ? 'text-primary' : ''}`}>
            menu_book
          </span>
          <span className="text-body-md font-body-md text-[13px]">Docs</span>
        </button>

        {/* Settings */}
        <button 
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            activeView === 'settings' 
              ? 'text-on-surface bg-surface-container font-bold border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container-highest'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-body-md font-body-md text-[13px]">Settings</span>
        </button>

        {/* User Profile */}
        <div className="mt-2 flex items-center gap-3 px-3 py-2 border-t border-outline-variant pt-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-xs text-primary">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-body-sm truncate text-on-surface font-medium text-xs">Admin User</p>
            <p className="text-mono-label font-mono-label truncate text-on-surface-variant text-[10px]">admin@agentos.io</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
