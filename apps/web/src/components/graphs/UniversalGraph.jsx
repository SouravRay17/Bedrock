import React, { useState, useMemo } from 'react';
import { analyzeDatasetShape, SUPPORTED_GRAPH_TYPES } from './aiGraphAdvisor';
import BarGraph from './BarGraph';
import LineAreaGraph from './LineAreaGraph';
import PieDonutGraph from './PieDonutGraph';
import ScatterBubbleGraph from './ScatterBubbleGraph';
import RadarGraph from './RadarGraph';
import HeatmapGraph from './HeatmapGraph';
import TableMatrixGraph from './TableMatrixGraph';
import CandlestickGraph from './CandlestickGraph';

export default function UniversalGraph({
  data = [],
  title = 'AI Data Visualization',
  suggestedType = null,
  recommendationReason = null,
  symbol = 'DATA'
}) {
  const analysis = useMemo(() => {
    // If raw payload is an object wrapping data and AI suggestions
    const payload = (typeof data === 'object' && !Array.isArray(data) && (data.data || data.candles || data.records))
      ? data
      : {
          data,
          graphType: suggestedType,
          recommendationReason: recommendationReason
        };
    return analyzeDatasetShape(payload);
  }, [data, suggestedType, recommendationReason]);

  const [activeType, setActiveType] = useState(() => analysis.recommendedType || 'bar');
  const [showRationale, setShowRationale] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cleanData = analysis.normalizedData.length > 0 ? analysis.normalizedData : data;

  const activeMeta = SUPPORTED_GRAPH_TYPES.find(t => t.id === activeType) || SUPPORTED_GRAPH_TYPES[0];
  const recommendedMeta = SUPPORTED_GRAPH_TYPES.find(t => t.id === analysis.recommendedType) || SUPPORTED_GRAPH_TYPES[0];

  const renderActiveGraph = () => {
    switch (activeType) {
      case 'bar':
        return <BarGraph data={cleanData} title={title} />;
      case 'line':
        return <LineAreaGraph data={cleanData} isArea={false} />;
      case 'area':
        return <LineAreaGraph data={cleanData} isArea={true} />;
      case 'donut':
      case 'pie':
        return <PieDonutGraph data={cleanData} />;
      case 'scatter':
        return <ScatterBubbleGraph data={cleanData} />;
      case 'radar':
        return <RadarGraph data={cleanData} />;
      case 'heatmap':
        return <HeatmapGraph data={cleanData} />;
      case 'candlestick':
        return <CandlestickGraph data={cleanData} symbol={symbol} title={title} />;
      case 'table':
      default:
        return <TableMatrixGraph data={cleanData} />;
    }
  };

  return (
    <div className={`w-full my-4 flex flex-col rounded-2xl border border-outline-variant/40 bg-[#07090e] shadow-2xl transition-all duration-300 overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50 p-6 bg-[#07090e]/95 backdrop-blur-xl max-h-[96vh] overflow-y-auto' : 'p-4'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[18px]">{activeMeta.icon}</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-container-high border border-outline-variant/30 text-primary">
                {activeMeta.label}
              </span>
            </h4>
            <p className="text-[11px] text-on-surface-variant line-clamp-1">{activeMeta.desc}</p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowRationale(!showRationale)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${showRationale ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/30'}`}
            title="Inspect AI recommendation logic"
          >
            <span className="material-symbols-outlined text-[14px]">psychology</span>
            <span>AI Advice</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/30 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isFullscreen ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      <div className="my-3 p-2.5 rounded-xl bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/20 border border-sky-500/30 shadow-inner flex flex-col gap-1.5 animate-fadeIn">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            <span className="font-semibold text-sky-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              AI Suggested View: <strong className="text-white">{recommendedMeta.label}</strong>
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-300">
            {Math.round(analysis.confidence * 100)}% Confidence
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed pl-4 border-l-2 border-sky-400/40">
          {analysis.rationale}
        </p>

        {showRationale && (
          <div className="mt-2 pt-2 border-t border-sky-500/20 text-[11px] text-slate-400 space-y-1">
            <div>• <strong>Data Shape:</strong> {cleanData.length} records analyzed across dimensions.</div>
            <div>• <strong>Alternate Views:</strong> {analysis.alternateTypes.join(', ')}</div>
            <div className="text-sky-300/80">• Click any graph type in the toolbar below to switch visualizations.</div>
          </div>
        )}
      </div>

      {/* Interactive Graph Type Switcher Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {SUPPORTED_GRAPH_TYPES.map((type) => {
          const isActive = activeType === type.id;
          const isAiPick = analysis.recommendedType === type.id;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setActiveType(type.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 border ${isActive ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20 scale-[1.02]' : isAiPick ? 'bg-surface-container-high text-sky-300 border-sky-500/50 hover:bg-surface-container-highest ring-1 ring-sky-500/30' : 'bg-surface-container/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-outline-variant/30'}`}
            >
              <span className="material-symbols-outlined text-[16px]">{type.icon}</span>
              <span>{type.label}</span>
              {isAiPick && !isActive && (
                <span className="ml-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-sky-400/20 text-sky-300 uppercase">
                  AI Pick
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Graph Render Area */}
      <div className="w-full mt-2 pt-2">
        {renderActiveGraph()}
      </div>
    </div>
  );
}
