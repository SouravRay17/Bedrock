import React, { useState, useMemo } from 'react';

export default function RadarGraph({ data = [], height = 340 }) {
  const [hoveredMetric, setHoveredMetric] = useState(null);

  const { axes, series } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return { axes: [], series: [] };

    // Format A: List of { axis: 'Speed', value: 85 }
    if (data[0] && (data[0].axis || data[0].metric || data[0].attribute)) {
      const axisList = data.map(d => d.axis || d.metric || d.attribute);
      const values = data.map(d => (typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0));
      return {
        axes: axisList,
        series: [{ name: 'Profile', values, color: '#38bdf8' }]
      };
    }

    // Format B: List of entities with multiple numeric keys
    const first = data[0];
    if (first && typeof first === 'object') {
      const numericKeys = Object.keys(first).filter(k => typeof first[k] === 'number');
      if (numericKeys.length >= 3) {
        const seriesList = data.slice(0, 3).map((item, sIdx) => {
          const name = item.name || item.label || item.entity || `Model ${sIdx + 1}`;
          const values = numericKeys.map(k => item[k]);
          const colors = ['#38bdf8', '#818cf8', '#34d399'];
          return { name, values, color: colors[sIdx % colors.length] };
        });
        return { axes: numericKeys, series: seriesList };
      }
    }

    return { axes: [], series: [] };
  }, [data]);

  const maxVal = useMemo(() => {
    const allVals = series.flatMap(s => s.values);
    return Math.max(...allVals, 100);
  }, [series]);

  if (axes.length < 3) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-xs">
        Radar chart requires at least 3 distinct attributes/metrics.
      </div>
    );
  }

  const cx = 360;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 45;
  const totalAxes = axes.length;
  const angleStep = (2 * Math.PI) / totalAxes;

  // Concentric polygon webs (at 25%, 50%, 75%, 100%)
  const webs = [0.25, 0.5, 0.75, 1.0].map(level => {
    const points = axes.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = radius * level;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return { level, points };
  });

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between text-xs px-1 text-on-surface-variant">
        <div className="flex items-center gap-3">
          <span>Dimensions: <strong className="text-on-surface">{axes.length}</strong></span>
          <span>Entities: <strong className="text-on-surface">{series.length}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          {series.map((s, idx) => (
            <div key={`rad-leg-${idx}`} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-on-surface">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto bg-[#0a0d14] rounded-xl border border-outline-variant/30 p-2 shadow-inner">
        <svg
          viewBox={`0 0 720 ${height}`}
          className="w-full h-auto select-none font-sans"
          style={{ minHeight: `${height}px` }}
        >
          {/* Concentric Webs */}
          {webs.map((w, idx) => (
            <polygon
              key={`web-${idx}`}
              points={w.points}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray={idx === webs.length - 1 ? 'none' : '3 3'}
            />
          ))}

          {/* Radial Axis Spokes */}
          {axes.map((axis, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x2 = cx + radius * Math.cos(angle);
            const y2 = cy + radius * Math.sin(angle);
            const labelX = cx + (radius + 20) * Math.cos(angle);
            const labelY = cy + (radius + 18) * Math.sin(angle);

            return (
              <g key={`spoke-${i}`}>
                <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#334155" strokeWidth="1" />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fill={hoveredMetric === axis ? '#38bdf8' : '#94a3b8'}
                  fontSize="10"
                  fontWeight={hoveredMetric === axis ? 'bold' : 'normal'}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMetric(axis)}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  {axis}
                </text>
              </g>
            );
          })}

          {/* Series Polygons */}
          {series.map((s, sIdx) => {
            const polygonPoints = s.values.map((val, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = radius * Math.min(val / maxVal, 1);
              return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
            }).join(' ');

            return (
              <g key={`poly-${sIdx}`}>
                <polygon
                  points={polygonPoints}
                  fill={s.color}
                  fillOpacity="0.25"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Vertex points */}
                {s.values.map((val, i) => {
                  const angle = i * angleStep - Math.PI / 2;
                  const r = radius * Math.min(val / maxVal, 1);
                  const px = cx + r * Math.cos(angle);
                  const py = cy + r * Math.sin(angle);
                  return (
                    <circle
                      key={`vtx-${sIdx}-${i}`}
                      cx={px}
                      cy={py}
                      r="3.5"
                      fill="#ffffff"
                      stroke={s.color}
                      strokeWidth="2"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
