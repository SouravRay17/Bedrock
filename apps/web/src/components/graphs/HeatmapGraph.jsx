import React, { useState, useMemo } from 'react';

export default function HeatmapGraph({ data = [], height = 340 }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const { rows, cols, matrix, minVal, maxVal } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { rows: [], cols: [], matrix: [], minVal: 0, maxVal: 100 };
    }

    const first = data[0];
    const isObjectList = first && typeof first === 'object' && !Array.isArray(first);

    if (isObjectList) {
      const rowLabels = data.map((d, i) => d.row || d.label || d.name || `Row ${i + 1}`);
      const colLabels = Object.keys(first).filter(k => !['row', 'label', 'name', 'id'].includes(k.toLowerCase()) && typeof first[k] === 'number');

      const grid = data.map(d => colLabels.map(col => Number(d[col]) || 0));
      const flat = grid.flat();
      return {
        rows: rowLabels,
        cols: colLabels,
        matrix: grid,
        minVal: Math.min(...flat, 0),
        maxVal: Math.max(...flat, 1)
      };
    }

    return { rows: [], cols: [], matrix: [], minVal: 0, maxVal: 100 };
  }, [data]);

  if (matrix.length === 0 || cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No 2D matrix data available for Heatmap view.
      </div>
    );
  }

  const getColor = (val) => {
    const ratio = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
    if (ratio < 0.25) return '#0c4a6e'; // dark sky
    if (ratio < 0.5) return '#0284c7'; // blue
    if (ratio < 0.75) return '#0ea5e9'; // bright sky
    return '#38bdf8'; // vivid cyan
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1 text-on-surface-variant">
        <div className="flex items-center gap-3">
          <span>Grid: <strong className="text-on-surface">{rows.length} × {cols.length}</strong></span>
          <span>Range: <strong className="text-on-surface">{minVal.toFixed(1)} → {maxVal.toFixed(1)}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Low</span>
          <div className="flex h-2 w-20 rounded bg-gradient-to-r from-[#0c4a6e] via-[#0284c7] to-[#38bdf8]" />
          <span>High</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-3 shadow-inner">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[10px] text-on-surface-variant font-mono uppercase" />
              {cols.map((col, cIdx) => (
                <th key={`col-${cIdx}`} className="p-1.5 text-center text-[10px] text-on-surface font-semibold font-mono uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((rowVals, rIdx) => (
              <tr key={`row-${rIdx}`}>
                <td className="p-1.5 text-[10px] font-medium text-on-surface-variant whitespace-nowrap">
                  {rows[rIdx]}
                </td>
                {rowVals.map((val, cIdx) => {
                  const isHovered = hoveredCell && hoveredCell.r === rIdx && hoveredCell.c === cIdx;
                  return (
                    <td
                      key={`cell-${rIdx}-${cIdx}`}
                      onMouseEnter={() => setHoveredCell({ r: rIdx, c: cIdx, val, row: rows[rIdx], col: cols[cIdx] })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className="p-1 text-center cursor-pointer"
                    >
                      <div
                        className={`h-9 min-w-[48px] rounded flex items-center justify-center text-[10px] font-mono font-medium transition-all ${isHovered ? 'ring-2 ring-white scale-105 z-10 text-white font-bold' : 'text-slate-200'}`}
                        style={{ backgroundColor: getColor(val) }}
                      >
                        {val.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover Info Card */}
      {hoveredCell && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface">{hoveredCell.row}</span>
            <span className="text-on-surface-variant">×</span>
            <span className="font-semibold text-sky-400">{hoveredCell.col}</span>
          </div>
          <div className="text-on-surface-variant font-mono">
            Intensity Value: <strong className="text-white font-bold">{hoveredCell.val.toLocaleString()}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
