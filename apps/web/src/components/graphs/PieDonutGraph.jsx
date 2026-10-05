import React, { useState, useMemo } from 'react';

const PALETTE = [
  '#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24',
  '#a78bfa', '#fb7185', '#2dd4bf', '#f97316', '#60a5fa'
];

export default function PieDonutGraph({ data = [], height = 340 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [mode, setMode] = useState('donut'); // 'donut' | 'pie'

  const parsedItems = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      if (typeof item === 'number') {
        return { label: `Segment ${idx + 1}`, value: Math.max(item, 0), color: PALETTE[idx % PALETTE.length] };
      }
      if (!item || typeof item !== 'object') {
        return { label: `Segment ${idx + 1}`, value: 0, color: PALETTE[idx % PALETTE.length] };
      }
      const labelKey = Object.keys(item).find(k => ['label', 'name', 'category', 'segment', 'type', 'key', 'quarter'].includes(k.toLowerCase())) || Object.keys(item)[0];
      const valKey = Object.keys(item).find(k => ['value', 'amount', 'share', 'count', 'total', 'metric'].includes(k.toLowerCase())) || Object.keys(item).find(k => typeof item[k] === 'number');

      const label = item[labelKey] !== undefined ? String(item[labelKey]) : `Segment ${idx + 1}`;
      const rawVal = valKey ? item[valKey] : 0;
      const value = Math.max(typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[$,%]/g, '')) || 0, 0);

      return { label, value, color: item.color || PALETTE[idx % PALETTE.length] };
    });
  }, [data]);

  const total = useMemo(() => {
    return parsedItems.reduce((sum, item) => sum + item.value, 0);
  }, [parsedItems]);

  if (parsedItems.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No proportional data available for Donut/Pie view.
      </div>
    );
  }

  const cx = 200;
  const cy = height / 2;
  const outerRadius = Math.min(cx, cy) - 20;
  const innerRadius = mode === 'donut' ? outerRadius * 0.58 : 0;

  // Compute slice angles
  let currentAngle = -Math.PI / 2;
  const slices = parsedItems.map((item, idx) => {
    const fraction = item.value / total;
    const angle = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const isHovered = hoveredIdx === idx;
    const rOffset = isHovered ? 6 : 0;
    const midAngle = (startAngle + endAngle) / 2;
    const offsetX = Math.cos(midAngle) * rOffset;
    const offsetY = Math.sin(midAngle) * rOffset;

    const x1 = cx + offsetX + (outerRadius + rOffset) * Math.cos(startAngle);
    const y1 = cy + offsetY + (outerRadius + rOffset) * Math.sin(startAngle);
    const x2 = cx + offsetX + (outerRadius + rOffset) * Math.cos(endAngle);
    const y2 = cy + offsetY + (outerRadius + rOffset) * Math.sin(endAngle);

    const x3 = cx + offsetX + innerRadius * Math.cos(endAngle);
    const y3 = cy + offsetY + innerRadius * Math.sin(endAngle);
    const x4 = cx + offsetX + innerRadius * Math.cos(startAngle);
    const y4 = cy + offsetY + innerRadius * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    let path = '';
    if (innerRadius === 0) {
      path = `M ${cx + offsetX} ${cy + offsetY} L ${x1} ${y1} A ${outerRadius + rOffset} ${outerRadius + rOffset} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    } else {
      path = `M ${x1} ${y1} A ${outerRadius + rOffset} ${outerRadius + rOffset} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    }

    return {
      ...item,
      path,
      fraction,
      percentage: (fraction * 100).toFixed(1),
      isHovered,
      midAngle
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span>Segments: <strong className="text-on-surface">{parsedItems.length}</strong></span>
          <span>Sum Total: <strong className="text-primary">{total.toLocaleString()}</strong></span>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-highest p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setMode('donut')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${mode === 'donut' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Donut
          </button>
          <button
            type="button"
            onClick={() => setMode('pie')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${mode === 'pie' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Solid Pie
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-3 shadow-inner">
        {/* SVG Arc View */}
        <div className="md:col-span-7 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${cx * 2} ${height}`}
            className="w-full max-w-[360px] h-auto select-none"
            style={{ maxHeight: `${height}px` }}
          >
            {slices.map((slice, idx) => (
              <path
                key={`slice-${idx}`}
                d={slice.path}
                fill={slice.color}
                opacity={hoveredIdx === null || hoveredIdx === idx ? 0.92 : 0.4}
                stroke="#0a0d14"
                strokeWidth="2"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-all duration-200"
              />
            ))}

            {/* Center Label for Donut */}
            {mode === 'donut' && (
              <g className="pointer-events-none">
                <text
                  x={cx}
                  y={cy - 6}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="500"
                >
                  {activeSlice ? activeSlice.label : 'TOTAL'}
                </text>
                <text
                  x={cx}
                  y={cy + 15}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="14"
                  fontWeight="bold"
                >
                  {activeSlice ? `${activeSlice.percentage}%` : total.toLocaleString()}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend List */}
        <div className="md:col-span-5 flex flex-col justify-center space-y-1.5 overflow-y-auto max-h-[300px] pr-2">
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={`leg-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-all ${isHovered ? 'bg-surface-container-highest border-primary/50 translate-x-1' : 'bg-surface-container/60 border-outline-variant/20 hover:bg-surface-container-high'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="text-xs text-on-surface truncate font-medium">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0 pl-2">
                  <span className="font-mono text-on-surface-variant">{slice.value.toLocaleString()}</span>
                  <span className="font-semibold text-primary">{slice.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
