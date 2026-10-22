import React, { useState, useMemo } from 'react';

export default function LineAreaGraph({ data = [], isArea = true, height = 340 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [showAreaFill, setShowAreaFill] = useState(isArea);

  const parsedPoints = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      if (typeof item === 'number') {
        return { label: `${idx + 1}`, value: item };
      }
      if (!item || typeof item !== 'object') {
        return { label: `${idx + 1}`, value: 0 };
      }
      const labelKey = Object.keys(item).find(k => ['date', 'time', 'timestamp', 'label', 'x', 'period', 'year', 'month'].includes(k.toLowerCase())) || Object.keys(item)[0];
      const valKey = Object.keys(item).find(k => ['value', 'y', 'price', 'close', 'amount', 'total', 'metric'].includes(k.toLowerCase())) || Object.keys(item).find(k => typeof item[k] === 'number');

      const label = item[labelKey] !== undefined ? String(item[labelKey]) : `${idx + 1}`;
      const rawVal = valKey ? item[valKey] : 0;
      const value = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[$,%]/g, '')) || 0;

      return { label, value, original: item };
    });
  }, [data]);

  const { maxVal, minVal, trendChange } = useMemo(() => {
    if (parsedPoints.length === 0) return { maxVal: 100, minVal: 0, trendChange: 0 };
    const vals = parsedPoints.map(p => p.value);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const first = vals[0] || 0;
    const last = vals[vals.length - 1] || 0;
    const diff = last - first;
    const pct = first !== 0 ? (diff / Math.abs(first)) * 100 : 0;
    return { maxVal: max, minVal: min, trendChange: pct };
  }, [parsedPoints]);

  if (parsedPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        No time-series or line data records available.
      </div>
    );
  }

  const padding = { top: 30, right: 35, bottom: 45, left: 60 };
  const svgWidth = 720;
  const svgHeight = height;
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Build SVG path
  const coords = parsedPoints.map((pt, idx) => {
    const x = padding.left + (idx / Math.max(parsedPoints.length - 1, 1)) * plotWidth;
    const valRatio = (pt.value - minVal) / (maxVal - minVal || 1);
    const y = padding.top + plotHeight - valRatio * plotHeight;
    return { x, y, pt, idx };
  });

  // Smooth spline path
  let pathD = '';
  if (coords.length > 0) {
    pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = i > 0 ? coords[i - 1] : coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = i < coords.length - 2 ? coords[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`
    : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => minVal + r * (maxVal - minVal));
  const isBullish = trendChange >= 0;

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span>Points: <strong className="text-on-surface">{parsedPoints.length}</strong></span>
          <span>Range: <strong className="text-on-surface">{minVal.toFixed(1)} — {maxVal.toFixed(1)}</strong></span>
          <span className="flex items-center gap-1">
            Net Change:
            <strong className={`flex items-center gap-0.5 ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className="material-symbols-outlined text-[14px]">
                {isBullish ? 'trending_up' : 'trending_down'}
              </span>
              {trendChange >= 0 ? '+' : ''}{trendChange.toFixed(2)}%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-highest p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setShowAreaFill(!showAreaFill)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${showAreaFill ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {showAreaFill ? 'Area Gradient' : 'Line Only'}
          </button>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="relative w-full overflow-x-auto bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          style={{ minHeight: `${height}px` }}
        >
          <defs>
            <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isBullish ? '#10b981' : '#f43f5e'} stopOpacity="0.45" />
              <stop offset="100%" stopColor={isBullish ? '#10b981' : '#f43f5e'} stopOpacity="0.0" />
            </linearGradient>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {yTicks.map((val, idx) => {
            const y = padding.top + plotHeight - ((val - minVal) / (maxVal - minVal || 1)) * plotHeight;
            return (
              <g key={`ygrid-${idx}`}>
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
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {showAreaFill && areaD && (
            <path d={areaD} fill="url(#lineAreaGradient)" />
          )}

          {/* Line Curve */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={isBullish ? '#10b981' : '#f43f5e'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
            />
          )}

          {/* Interactive Crosshair & Points */}
          {coords.map((c, idx) => {
            const isHovered = hoveredIdx === idx;
            const isEndpoint = idx === 0 || idx === coords.length - 1;
            const showPoint = isHovered || isEndpoint || coords.length <= 15;

            return (
              <g
                key={`pt-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Invisible hover trigger */}
                <rect
                  x={c.x - (plotWidth / coords.length) / 2}
                  y={padding.top}
                  width={plotWidth / coords.length}
                  height={plotHeight}
                  fill="transparent"
                />

                {isHovered && (
                  <line
                    x1={c.x}
                    y1={padding.top}
                    x2={c.x}
                    y2={padding.top + plotHeight}
                    stroke="#94a3b8"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                )}

                {showPoint && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isHovered ? 5.5 : 3.5}
                    fill={isHovered ? '#ffffff' : (isBullish ? '#10b981' : '#f43f5e')}
                    stroke={isBullish ? '#065f46' : '#881337'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                  />
                )}

                {/* X labels (sample at intervals) */}
                {(idx % Math.ceil(coords.length / 7) === 0 || idx === coords.length - 1) && (
                  <text
                    x={c.x}
                    y={padding.top + plotHeight + 16}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {c.pt.label.length > 8 ? `${c.pt.label.slice(0, 7)}…` : c.pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Info Card */}
      {hoveredIdx !== null && parsedPoints[hoveredIdx] && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isBullish ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-semibold text-on-surface">{parsedPoints[hoveredIdx].label}</span>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant">
            <span>Value: <strong className="text-on-surface">{parsedPoints[hoveredIdx].value.toLocaleString()}</strong></span>
            <span>Index: <strong>#{hoveredIdx + 1} of {parsedPoints.length}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
