import React, { useState, useMemo } from 'react';

export default function BarGraph({ data = [], title = 'Categorical Distribution', height = 340 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [orientation, setOrientation] = useState('vertical'); // 'vertical' | 'horizontal'

  const parsedItems = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      if (typeof item === 'number') {
        return { label: `Item ${idx + 1}`, value: item };
      }
      if (!item || typeof item !== 'object') {
        return { label: `Item ${idx + 1}`, value: 0 };
      }
      // Infer label
      const labelKey = Object.keys(item).find(k => ['label', 'name', 'category', 'item', 'key', 'quarter', 'month', 'date', 'symbol', 'entity', 'group'].includes(k.toLowerCase())) || Object.keys(item)[0];
      const valKey = Object.keys(item).find(k => ['value', 'amount', 'total', 'count', 'revenue', 'price', 'metric', 'score', 'close', 'y'].includes(k.toLowerCase())) || Object.keys(item).find(k => typeof item[k] === 'number');

      const label = item[labelKey] !== undefined ? String(item[labelKey]) : `Item ${idx + 1}`;
      const rawVal = valKey ? item[valKey] : 0;
      const value = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[$,%]/g, '')) || 0;

      return { label, value, original: item };
    });
  }, [data]);

  const { maxVal, minVal, sumVal, avgVal } = useMemo(() => {
    if (parsedItems.length === 0) return { maxVal: 100, minVal: 0, sumVal: 0, avgVal: 0 };
    const vals = parsedItems.map(p => p.value);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    return { maxVal: max, minVal: min, sumVal: sum, avgVal: sum / vals.length };
  }, [parsedItems]);

  if (parsedItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No bar chart data records available.
      </div>
    );
  }

  const padding = { top: 25, right: 30, bottom: 50, left: 60 };
  const svgWidth = 720;
  const svgHeight = height;
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Generate 4 Y-ticks
  const yTicks = [0, 0.33, 0.66, 1].map(r => minVal + r * (maxVal - minVal));

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span>Items: <strong className="text-on-surface">{parsedItems.length}</strong></span>
          <span>Max: <strong className="text-primary">{maxVal.toLocaleString()}</strong></span>
          <span>Average: <strong className="text-amber-400">{avgVal.toFixed(1)}</strong></span>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-highest p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setOrientation('vertical')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${orientation === 'vertical' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Vertical
          </button>
          <button
            type="button"
            onClick={() => setOrientation('horizontal')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${orientation === 'horizontal' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Horizontal
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none font-sans"
          style={{ minHeight: `${height}px` }}
        >
          <defs>
            <linearGradient id="barGradientPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="barGradientHoriz" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {orientation === 'vertical' ? (
            yTicks.map((val, idx) => {
              const y = padding.top + plotHeight - ((val - minVal) / (maxVal - minVal || 1)) * plotHeight;
              return (
                <g key={`ytick-${idx}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })
          ) : null}

          {/* Average Benchmark Line */}
          {orientation === 'vertical' && avgVal > minVal && (
            <g>
              {(() => {
                const avgY = padding.top + plotHeight - ((avgVal - minVal) / (maxVal - minVal || 1)) * plotHeight;
                return (
                  <>
                    <line
                      x1={padding.left}
                      y1={avgY}
                      x2={svgWidth - padding.right}
                      y2={avgY}
                      stroke="#fbbf24"
                      strokeDasharray="4 4"
                      strokeWidth="1.2"
                      opacity="0.8"
                    />
                    <text
                      x={svgWidth - padding.right}
                      y={avgY - 4}
                      textAnchor="end"
                      fill="#fbbf24"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      AVG ({avgVal.toFixed(1)})
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Vertical Bars */}
          {orientation === 'vertical' &&
            parsedItems.map((item, idx) => {
              const count = parsedItems.length;
              const slotWidth = plotWidth / count;
              const barWidth = Math.min(Math.max(slotWidth * 0.65, 12), 48);
              const x = padding.left + idx * slotWidth + (slotWidth - barWidth) / 2;

              const valRatio = (item.value - minVal) / (maxVal - minVal || 1);
              const barHeight = Math.max(valRatio * plotHeight, 4);
              const y = padding.top + plotHeight - barHeight;
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={`bar-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-150"
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradientPrimary)'}
                    filter={isHovered ? 'drop-shadow(0 0 8px rgba(99,102,241,0.6))' : 'none'}
                  />

                  {/* Value tag on hover or top bar */}
                  {isHovered && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {item.value.toLocaleString()}
                    </text>
                  )}

                  {/* X Axis Label */}
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + plotHeight + 16}
                    textAnchor="middle"
                    fill={isHovered ? '#f1f5f9' : '#94a3b8'}
                    fontSize={count > 12 ? '9' : '10'}
                    fontWeight={isHovered ? '600' : '400'}
                    transform={count > 8 ? `rotate(-28, ${x + barWidth / 2}, ${padding.top + plotHeight + 16})` : undefined}
                  >
                    {item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label}
                  </text>
                </g>
              );
            })}

          {/* Horizontal Bars */}
          {orientation === 'horizontal' &&
            parsedItems.map((item, idx) => {
              const count = parsedItems.length;
              const slotHeight = plotHeight / count;
              const barHeight = Math.min(Math.max(slotHeight * 0.65, 10), 32);
              const y = padding.top + idx * slotHeight + (slotHeight - barHeight) / 2;

              const valRatio = (item.value - minVal) / (maxVal - minVal || 1);
              const barWidth = Math.max(valRatio * plotWidth, 6);
              const x = padding.left;
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={`hbar-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <text
                    x={padding.left - 8}
                    y={y + barHeight / 2 + 3}
                    textAnchor="end"
                    fill={isHovered ? '#f8fafc' : '#94a3b8'}
                    fontSize="10"
                  >
                    {item.label.length > 8 ? `${item.label.slice(0, 7)}…` : item.label}
                  </text>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradientHoriz)'}
                  />
                  <text
                    x={x + barWidth + 6}
                    y={y + barHeight / 2 + 3}
                    fill={isHovered ? '#38bdf8' : '#64748b'}
                    fontSize="10"
                    fontWeight="500"
                  >
                    {item.value.toLocaleString()}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* Hover Info Card */}
      {hoveredIdx !== null && parsedItems[hoveredIdx] && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
            <span className="font-semibold text-on-surface">{parsedItems[hoveredIdx].label}</span>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant">
            <span>Value: <strong className="text-sky-300">{parsedItems[hoveredIdx].value.toLocaleString()}</strong></span>
            <span>Share of Total: <strong className="text-emerald-400">{sumVal > 0 ? ((parsedItems[hoveredIdx].value / sumVal) * 100).toFixed(1) : 0}%</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
