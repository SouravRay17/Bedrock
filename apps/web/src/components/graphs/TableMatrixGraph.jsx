import React, { useState, useMemo } from 'react';

export default function TableMatrixGraph({ data = [] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const { rows, columns } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return { rows: [], columns: [] };
    const cols = Array.from(new Set(data.flatMap(d => (d && typeof d === 'object' ? Object.keys(d) : []))));
    return { rows: data, columns: cols };
  }, [data]);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        Object.values(r || {}).some(v => String(v).toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return result;
  }, [rows, search, sortKey, sortDir]);

  const downloadCSV = () => {
    if (columns.length === 0 || rows.length === 0) return;
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_matrix_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  };

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No tabular data available.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Search & Export Toolbar */}
      <div className="flex items-center justify-between text-xs px-1 gap-2">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary"
          />
          <span className="material-symbols-outlined absolute left-2 top-2 text-[14px] text-on-surface-variant">
            search
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">
            Showing <strong className="text-on-surface">{filteredRows.length}</strong> of {rows.length} rows
          </span>
          <button
            type="button"
            onClick={downloadCSV}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Matrix View */}
      <div className="overflow-x-auto max-h-[380px] bg-[#0a0d14] rounded-xl border border-outline-variant/30 shadow-inner">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0f172a] z-10 border-b border-outline-variant/40">
            <tr>
              {columns.map((col, idx) => {
                const isSorted = sortKey === col;
                return (
                  <th
                    key={`th-${idx}`}
                    onClick={() => handleSort(col)}
                    className="p-2.5 text-[11px] font-semibold text-primary uppercase tracking-wider cursor-pointer hover:bg-white/5 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {isSorted && (
                        <span className="material-symbols-outlined text-[13px] text-sky-400">
                          {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15 text-xs font-mono">
            {filteredRows.map((row, rIdx) => (
              <tr key={`tr-${rIdx}`} className="hover:bg-surface-container/40 transition-colors">
                {columns.map((col, cIdx) => {
                  const val = row[col];
                  const isNum = typeof val === 'number';
                  return (
                    <td key={`td-${rIdx}-${cIdx}`} className="p-2.5 text-on-surface whitespace-nowrap">
                      {isNum ? val.toLocaleString() : String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
