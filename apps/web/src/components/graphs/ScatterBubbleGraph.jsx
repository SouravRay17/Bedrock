import React, { useState, useMemo } from 'react';

export default function ScatterBubbleGraph({ data = [], height = 340 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const parsedPoints = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      if (!item || typeof item !== 'object') {
        return { x: idx, y: typeof item === 'number' ? item : 0, r: 6, label: `Point ${idx + 1}` };
      }

      // X coordinate
      const xKey = Object.keys(item).find(k => ['x', 'xval', 'time', 'input', 'cost', 'latency'].includes(k.toLowerCase())) || Object.keys(item)[0];
      // Y coordinate
      const yKey = Object.keys(item).find(k => ['y', 'yval', 'value', 'revenue', 'output', 'accuracy', 'score', 'throughput'].includes(k.toLowerCase())) || Object.keys(item)[1] || Object.keys(item)[0];
      // Bubble Radius size (optional)
      const rKey = Object.keys(item).find(k => ['r', 'radius', 'size', 'weight', 'count', 'volume', 'z'].includes(k.toLowerCase()));

      const rawX = item[xKey];
      const rawY = item[yKey];
      const rawR = rKey ? item[rKey] : 8;

      const x = typeof rawX === 'number' ? rawX : parseFloat(String(rawX).replace(/[$,%]/g, '')) || idx;
      const y = typeof rawY === 'number' ? rawY : parseFloat(String(rawY).replace(/[$,%]/g, '')) || 0;
      const r = Math.max(Math.min(typeof rawR === 'number' ? rawR : parseFloat(String(rawR)) || 8, 28), 4);

      const label = item.label || item.name || item.title || `Point ${idx + 1}`;

      return { x, y, r, label, original: item };
    });
  }, [data]);

  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (parsedPoints.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    const xs = parsedPoints.map(p => p.x);
    const ys = parsedPoints.map(p => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }, [parsedPoints]);

  if (parsedPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No bivariate scatter data available.
      </div>
    );
  }

  const padding = { top: 30, right: 35, bottom: 45, left: 60 };
  const svgWidth = 720;
  const svgHeight = height;
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const coords = parsedPoints.map((pt, idx) => {
    const cx = padding.left + ((pt.x - minX) / rangeX) * plotWidth;
    const cy = padding.top + plotHeight - ((pt.y - minY) / rangeY) * plotHeight;
    return { ...pt, cx, cy, idx };
  });

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1 text-on-surface-variant">
        <div className="flex items-center gap-3">
          <span>Clusters: <strong className="text-on-surface">{parsedPoints.length}</strong></span>
          <span>X Range: <strong className="text-on-surface">{minX.toFixed(1)} → {maxX.toFixed(1)}</strong></span>
          <span>Y Range: <strong className="text-on-surface">{minY.toFixed(1)} → {maxY.toFixed(1)}</strong></span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          style={{ minHeight: `${height}px` }}
        >
          {/* Quadrant Divider Grid */}
          <line
            x1={padding.left + plotWidth / 2}
            y1={padding.top}
            x2={padding.left + plotWidth / 2}
            y2={padding.top + plotHeight}
            stroke="#1e293b"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotHeight / 2}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight / 2}
            stroke="#1e293b"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />

          {/* Points */}
          {coords.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={`scatter-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-all duration-150"
              >
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={isHovered ? pt.r + 3 : pt.r}
                  fill={isHovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.65)'}
                  stroke={isHovered ? '#ffffff' : '#0284c7'}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all"
                />

                {isHovered && (
                  <text
                    x={pt.cx}
                    y={pt.cy - pt.r - 6}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {pt.label} ({pt.x.toFixed(1)}, {pt.y.toFixed(1)})
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Info Card */}
      {hoveredIdx !== null && coords[hoveredIdx] && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="font-semibold text-on-surface">{coords[hoveredIdx].label}</span>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant font-mono">
            <span>X: <strong className="text-on-surface">{coords[hoveredIdx].x.toLocaleString()}</strong></span>
            <span>Y: <strong className="text-on-surface">{coords[hoveredIdx].y.toLocaleString()}</strong></span>
            <span>Weight: <strong className="text-sky-300">{coords[hoveredIdx].r.toFixed(0)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
