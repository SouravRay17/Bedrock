import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

export const GRAPH_TYPES = [
  { id: 'candles', label: 'Japanese Candlesticks', shortLabel: 'Candles', icon: 'candlestick_chart', desc: 'Classical OHLC real bodies & wicks' },
  { id: 'hollow', label: 'Hollow / Heikin-Ashi', shortLabel: 'Heikin-Ashi', icon: 'tune', desc: 'Smoothed trend & momentum visualization' },
  { id: 'line', label: 'Area / Mountain Line', shortLabel: 'Line', icon: 'show_chart', desc: 'Continuous closing curve with glowing gradient' },
  { id: 'bars', label: 'OHLC Bar Chart', shortLabel: 'Bars', icon: 'stacked_bar_chart', desc: 'Western tick bars (left Open, right Close)' },
  { id: 'baseline', label: 'Baseline Deviation', shortLabel: 'Baseline', icon: 'waterfall_chart', desc: 'Color-coded deviation above & below mean' },
  { id: 'range', label: 'High-Low Volatility Band', shortLabel: 'Range Band', icon: 'analytics', desc: 'Intraday spread corridor with median line' },
  { id: 'table', label: 'Tabular Data Matrix', shortLabel: 'Table', icon: 'table_rows', desc: 'Detailed numeric OHLCV records' },
];

/**
 * TradingView-Style Interactive Candlestick & Multi-Horizon Financial Chart
 * Native React + SVG, zero external dependencies.
 * Features:
 * - Live Timeframe Bar: [ 1D ] [ 5D ] [ 1M ] [ 3M ] [ 6M ] [ 1Y ] [ 5Y ] [ ALL ]
 * - Interactive Graph Types Dropdown (Candles, Heikin-Ashi, Line, Bars, Baseline, Range, Table)
 * - Dynamic On-Demand Data Fetching on Tab Click
 * - Interactive Mouse Wheel Zoom & Drag-to-Pan (TradingView style)
 * - Dedicated Zoom Controls (+ / - / Reset)
 * - Fullscreen Expand Mode
 * - Crosshair with Y-axis Price Tag & X-axis Date Tag
 */
export default function CandlestickChart({
  data = [],
  symbol = 'AAPL',
  title = 'Interactive Trading Chart',
  period = '1mo',
  interval = '1d',
}) {
  const [activePeriod, setActivePeriod] = useState(period.toLowerCase());
  const [candlesData, setCandlesData] = useState(data);
  const [loadingTimeframe, setLoadingTimeframe] = useState(false);
  const [viewMode, setViewMode] = useState('candles'); // 'candles' | 'hollow' | 'line' | 'bars' | 'baseline' | 'range' | 'table'
  const [showGraphDropdown, setShowGraphDropdown] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%, etc.
  const [panOffset, setPanOffset] = useState(0); // Pan offset in bars
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const activeGraphType = useMemo(
    () => GRAPH_TYPES.find((gt) => gt.id === viewMode) || GRAPH_TYPES[0],
    [viewMode]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowGraphDropdown(false);
      }
    }
    if (showGraphDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGraphDropdown]);

  const currencySymbol = useMemo(() => {
    const s = String(symbol || '').toUpperCase();
    if (s.endsWith('.NS') || s.endsWith('.BO') || s.endsWith('.BSE') || s.endsWith('.NSE')) {
      return '₹';
    }
    if (s.endsWith('.L') || s.endsWith('.LON')) return '£';
    if (s.endsWith('.PA') || s.endsWith('.DE')) return '€';
    return '$';
  }, [symbol]);


  // Synchronize initial data if prop changes
  useEffect(() => {
    if (data && data.length > 0) {
      setCandlesData(data);
    }
  }, [data]);

  // Dynamic timeframe filter on tab click
  const fetchTimeframe = useCallback((selectedPeriod) => {
    setActivePeriod(selectedPeriod);
    setLoadingTimeframe(true);
    setHoveredIndex(null);
    setZoomLevel(1);
    setPanOffset(0);

    try {
      if (Array.isArray(data) && data.length > 0) {
        const periodLimits = {
          '5d': 5,
          '1mo': 22,
          '3mo': 66,
          '6mo': 130,
          '1y': 252,
          'all': data.length
        };
        const limit = periodLimits[selectedPeriod] || data.length;
        const sliced = data.slice(Math.max(0, data.length - limit));
        setCandlesData(sliced.length > 0 ? sliced : data);
      }
    } catch (err) {
      console.error('Failed to filter timeframe:', err);
    } finally {
      setLoadingTimeframe(false);
    }
  }, [data]);

  // Normalize raw candles
  const allCandles = useMemo(() => {
    if (!Array.isArray(candlesData)) return [];
    return candlesData
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const rawDate = item.date || item.Date || item.time || item.timestamp || `Bar ${idx + 1}`;
        const open = parseFloat(String(item.open ?? item.Open ?? '').replace(/[$,]/g, ''));
        const high = parseFloat(String(item.high ?? item.High ?? '').replace(/[$,]/g, ''));
        const low = parseFloat(String(item.low ?? item.Low ?? '').replace(/[$,]/g, ''));
        const close = parseFloat(String(item.close ?? item.Close ?? '').replace(/[$,]/g, ''));
        const volume = parseFloat(String(item.volume ?? item.Volume ?? 0).replace(/[$,]/g, ''));

        if (isNaN(open) || isNaN(close) || open === null || close === null) return null;

        const isBullish = close >= open;
        const change = close - open;
        const changePercent = open > 0 ? (change / open) * 100 : 0;

        return {
          id: idx,
          date: String(rawDate).split('T')[0],
          open,
          high: isNaN(high) || high === null ? Math.max(open, close) : high,
          low: isNaN(low) || low === null ? Math.min(open, close) : low,
          close,
          volume: isNaN(volume) || volume === null ? 0 : volume,
          isBullish,
          change,
          changePercent,
        };
      })
      .filter(Boolean);
  }, [candlesData]);

  // Calculate visible window based on Zoom & Pan
  const visibleCandles = useMemo(() => {
    const total = allCandles.length;
    if (total === 0) return [];
    const windowSize = Math.max(10, Math.floor(total / zoomLevel));
    // Max left offset
    const maxOffset = total - windowSize;
    const clampedOffset = Math.max(0, Math.min(maxOffset, Math.floor(panOffset)));
    return allCandles.slice(clampedOffset, clampedOffset + windowSize);
  }, [allCandles, zoomLevel, panOffset]);

  // Visible price and volume bounds
  const stats = useMemo(() => {
    if (!visibleCandles.length) return null;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    visibleCandles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    const padding = (maxPrice - minPrice) * 0.08 || 1;
    const yMin = Math.max(0, minPrice - padding);
    const yMax = maxPrice + padding;
    const latest = visibleCandles[visibleCandles.length - 1];
    const first = visibleCandles[0];
    const totalChange = latest.close - first.open;
    const totalChangePercent = first.open > 0 ? (totalChange / first.open) * 100 : 0;

    return {
      minPrice,
      maxPrice,
      yMin,
      yMax,
      maxVol: maxVol || 1,
      latest,
      totalChange,
      totalChangePercent,
    };
  }, [visibleCandles]);

  // Dimensions
  const svgWidth = isFullscreen ? 1100 : 720;
  const svgHeight = isFullscreen ? 420 : 280;
  const chartHeight = isFullscreen ? 310 : 200;
  const volumeHeight = isFullscreen ? 60 : 45;
  const volumeTop = chartHeight + 15;
  const rightAxisWidth = 65;
  const plotWidth = svgWidth - rightAxisWidth;

  const count = visibleCandles.length || 1;
  const candleSpacing = plotWidth / count;
  const candleBodyWidth = Math.max(1.2, Math.min(18, candleSpacing * 0.72));

  const getY = (val) => {
    if (!stats || stats.yMax === stats.yMin) return chartHeight / 2;
    return chartHeight - ((val - stats.yMin) / (stats.yMax - stats.yMin)) * chartHeight;
  };

  const getPriceFromY = (y) => {
    if (!stats) return 0;
    const ratio = (chartHeight - y) / chartHeight;
    return stats.yMin + ratio * (stats.yMax - stats.yMin);
  };

  const getVolY = (vol) => {
    if (!stats) return volumeTop + volumeHeight;
    const barH = (vol / stats.maxVol) * volumeHeight;
    return volumeTop + volumeHeight - barH;
  };

  // 5 Horizontal Gridlines
  const gridSteps = 4;
  const gridLines = useMemo(() => {
    if (!stats) return [];
    const lines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const price = stats.yMin + ((stats.yMax - stats.yMin) * i) / gridSteps;
      const y = getY(price);
      lines.push({ y, price });
    }
    return lines;
  }, [stats]);

  // Line Chart Path
  const linePoints = visibleCandles.map((c, i) => {
    const x = i * candleSpacing + candleSpacing / 2;
    const y = getY(c.close);
    return `${x},${y}`;
  });
  const linePath = linePoints.length ? `M ${linePoints.join(' L ')}` : '';
  const areaPath = linePoints.length
    ? `M ${linePoints[0]} L ${linePoints.join(' L ')} L ${
        (count - 1) * candleSpacing + candleSpacing / 2
      },${chartHeight} L ${candleSpacing / 2},${chartHeight} Z`
    : '';

  // Heikin-Ashi smoothed candles calculation
  const heikinAshiCandles = useMemo(() => {
    if (!visibleCandles.length) return [];
    const ha = [];
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      const isBullish = haClose >= haOpen;
      ha.push({
        ...c,
        open: haOpen,
        close: haClose,
        high: haHigh,
        low: haLow,
        isBullish,
      });
    }
    return ha;
  }, [visibleCandles]);

  // Baseline mean price calculation
  const meanBaselinePrice = useMemo(() => {
    if (!visibleCandles.length) return 0;
    return visibleCandles.reduce((acc, c) => acc + c.close, 0) / visibleCandles.length;
  }, [visibleCandles]);

  // Range corridor (High-Low volatility envelope)
  const rangeHighPoints = visibleCandles.map((c, i) => `${i * candleSpacing + candleSpacing / 2},${getY(c.high)}`);
  const rangeLowPoints = visibleCandles.map((c, i) => `${i * candleSpacing + candleSpacing / 2},${getY(c.low)}`);
  const rangeHighPath = rangeHighPoints.length ? `M ${rangeHighPoints.join(' L ')}` : '';
  const rangeLowPath = rangeLowPoints.length ? `M ${rangeLowPoints.join(' L ')}` : '';
  const rangeBandPolygon = rangeHighPoints.length
    ? `M ${rangeHighPoints.join(' L ')} L ${rangeLowPoints.slice().reverse().join(' L ')} Z`
    : '';

  // Zoom handlers
  const handleZoom = (direction) => {
    setZoomLevel((prev) => {
      if (direction === 'in') return Math.min(6, prev * 1.35);
      if (direction === 'out') return Math.max(1, prev / 1.35);
      return 1; // reset
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoom('in');
    } else {
      handleZoom('out');
    }
  };

  // Mouse Drag / Pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((e.clientY - rect.top) / rect.height) * svgHeight;
    setMousePos({ x, y });

    if (isDragging) {
      const deltaX = e.clientX - dragStartX;
      const barsMoved = deltaX / (candleSpacing || 1);
      setPanOffset((prev) => prev - barsMoved * 0.4);
      setDragStartX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const activeCandle = hoveredIndex !== null && visibleCandles[hoveredIndex] ? visibleCandles[hoveredIndex] : stats?.latest;
  const currentCursorPrice = getPriceFromY(mousePos.y);

  // Timeframe presets
  const timeframes = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' },
    { label: 'ALL', value: 'max' },
  ];

  return (
    <div
      ref={containerRef}
      className={`my-3 rounded-xl border border-outline-variant/50 bg-[#0c1017] shadow-2xl overflow-hidden text-on-surface select-none transition-all duration-200 ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#0c1017]/98 backdrop-blur-xl border-primary/50' : 'relative'
      }`}
    >
      {/* Top Header: Symbol, Latest Price, Zoom Controls, Modes */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container-high/40 px-4 py-2.5">
        {/* Left: Symbol & Price Summary */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono-code font-bold text-xs shadow-inner">
            {symbol ? symbol.slice(0, 3).toUpperCase() : 'STK'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-on-surface tracking-tight">{symbol}</span>
              <span className="text-[11px] font-medium text-on-surface-variant hidden sm:inline">{title}</span>
              <span className="rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[10px] font-mono-code text-primary uppercase font-bold">
                {activePeriod}
              </span>
              {loadingTimeframe && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono-code text-primary animate-pulse">
                  <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                  <span>Updating...</span>
                </span>
              )}
            </div>
            {activeCandle && (
              <div className="flex items-center gap-2.5 mt-0.5 text-[11px] font-mono-code flex-wrap">
                <span className="text-on-surface font-bold text-sm">
                  {currencySymbol}{activeCandle.close.toFixed(2)}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    activeCandle.isBullish
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {activeCandle.isBullish ? '▲' : '▼'}
                  {activeCandle.change >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(activeCandle.change).toFixed(2)} (
                  {activeCandle.changePercent >= 0 ? '+' : ''}
                  {activeCandle.changePercent.toFixed(2)}%)
                </span>
                {stats && (
                  <span className="text-on-surface-variant hidden md:inline">
                    Range: <span className="text-rose-400 font-semibold">{currencySymbol}{stats.minPrice.toFixed(2)}</span> -{' '}
                    <span className="text-emerald-400 font-semibold">{currencySymbol}{stats.maxPrice.toFixed(2)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Zoom buttons, Mode switch, Fullscreen */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom Buttons */}
          <div className="flex items-center rounded-lg bg-surface-container-low p-0.5 border border-outline-variant/40">
            <button
              type="button"
              title="Zoom In"
              onClick={() => handleZoom('in')}
              className="px-2 py-1 hover:bg-surface-container-high rounded text-xs text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">zoom_in</span>
            </button>
            <button
              type="button"
              title="Zoom Out"
              onClick={() => handleZoom('out')}
              className="px-2 py-1 hover:bg-surface-container-high rounded text-xs text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">zoom_out</span>
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                title="Reset Zoom"
                onClick={() => { setZoomLevel(1); setPanOffset(0); }}
                className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                Reset ({Math.round(zoomLevel * 100)}%)
              </button>
            )}
          </div>

          {/* Graph Types Dropdown Selector & Quick Switch */}
          <div className="flex items-center gap-1.5">
            {/* Quick-switch pills for top 3 popular modes */}
            <div className="hidden md:flex items-center gap-1 rounded-lg bg-surface-container-low p-0.5 border border-outline-variant/40">
              <button
                type="button"
                onClick={() => setViewMode('candles')}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'candles' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Japanese Candlesticks"
              >
                Candles
              </button>
              <button
                type="button"
                onClick={() => setViewMode('line')}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'line' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Area Line Chart"
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setViewMode('bars')}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'bars' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="OHLC Bar Chart"
              >
                Bars
              </button>
            </div>

            {/* Dropdown Menu Button */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowGraphDropdown(!showGraphDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/60 text-xs font-semibold text-on-surface transition-all shadow-xs"
                title="Choose different types of graphs for this stock data"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">
                  {activeGraphType?.icon || 'candlestick_chart'}
                </span>
                <span className="hidden sm:inline font-medium">{activeGraphType?.label}</span>
                <span className="sm:hidden font-medium">{activeGraphType?.shortLabel}</span>
                <span className={`material-symbols-outlined text-[14px] text-on-surface-variant transition-transform duration-150 ${showGraphDropdown ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {/* Glassmorphic Dropdown List */}
              {showGraphDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-[#0f141d]/95 backdrop-blur-xl border border-outline-variant/70 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-outline-variant/30 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Available Graph Types
                    </span>
                    <span className="text-[10px] text-primary font-mono-code font-bold">
                      {GRAPH_TYPES.length} formats
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {GRAPH_TYPES.map((gt) => {
                      const isSelected = viewMode === gt.id;
                      return (
                        <button
                          key={gt.id}
                          type="button"
                          onClick={() => {
                            setViewMode(gt.id);
                            setShowGraphDropdown(false);
                          }}
                          className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                            isSelected
                              ? 'bg-primary/20 text-primary border border-primary/40'
                              : 'hover:bg-surface-container-high text-on-surface border border-transparent'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[18px] mt-0.5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                            {gt.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold truncate">{gt.label}</span>
                              {isSelected && (
                                <span className="material-symbols-outlined text-[14px] text-primary">check</span>
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant leading-tight truncate">
                              {gt.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Trading View'}
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* TradingView-Style Timeframe Bar */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-low/60 px-4 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-2 hidden sm:inline">
            Timeframe:
          </span>
          {timeframes.map((tf) => {
            const isSelected = activePeriod === tf.value;
            return (
              <button
                key={tf.value}
                type="button"
                onClick={() => fetchTimeframe(tf.value)}
                disabled={loadingTimeframe}
                className={`px-2.5 py-1 rounded-md text-xs font-mono-code font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm ring-1 ring-primary/50'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] font-mono-code text-on-surface-variant hidden sm:flex items-center gap-3">
          <span>Scroll to Zoom • Drag to Pan</span>
          <span className="rounded bg-surface-container-highest px-1.5 py-0.5">
            {visibleCandles.length} / {allCandles.length} bars
          </span>
        </div>
      </div>

      {/* Main Chart Area */}
      {viewMode === 'table' ? (
        <div className="max-h-96 overflow-y-auto overflow-x-auto p-4 flex-1">
          <table className="w-full text-left text-xs font-mono-code">
            <thead className="sticky top-0 bg-[#141822] text-[11px] text-primary uppercase border-b border-outline-variant/40">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Open</th>
                <th className="py-2.5 px-3">High</th>
                <th className="py-2.5 px-3">Low</th>
                <th className="py-2.5 px-3">Close</th>
                <th className="py-2.5 px-3">Change</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {visibleCandles.map((c, i) => (
                <tr key={i} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="py-1.5 px-3 text-on-surface-variant">{c.date}</td>
                  <td className="py-1.5 px-3">{currencySymbol}{c.open.toFixed(2)}</td>
                  <td className="py-1.5 px-3 text-emerald-400">{currencySymbol}{c.high.toFixed(2)}</td>
                  <td className="py-1.5 px-3 text-rose-400">{currencySymbol}{c.low.toFixed(2)}</td>
                  <td className="py-1.5 px-3 font-semibold">{currencySymbol}{c.close.toFixed(2)}</td>
                  <td className="py-1.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        c.isBullish ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {c.change >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(c.change).toFixed(2)} (
                      {c.changePercent >= 0 ? '+' : ''}
                      {c.changePercent.toFixed(2)}%)
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-right text-on-surface-variant">
                    {c.volume ? c.volume.toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={`relative p-3 flex-1 flex flex-col justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoveredIndex(null); handleMouseUp(); }}
        >
          {loadingTimeframe && (
            <div className="absolute inset-0 bg-[#0c1017]/80 backdrop-blur-xs flex items-center justify-center z-30">
              <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2 shadow-lg border border-outline-variant/50 text-xs font-mono-code text-primary">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>Fetching {activePeriod.toUpperCase()} Trading Data...</span>
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full max-h-[500px] overflow-visible"
          >
            <defs>
              <linearGradient id="areaGradientTV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines & Right Axis Price Labels */}
            {gridLines.map((g, idx) => (
              <g key={idx}>
                <line
                  x1={0}
                  y1={g.y}
                  x2={plotWidth}
                  y2={g.y}
                  stroke="#263141"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />
                <text
                  x={plotWidth + 8}
                  y={g.y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {currencySymbol}{g.price.toFixed(2)}
                </text>
              </g>
            ))}

            {/* Volume Separator */}
            <line
              x1={0}
              y1={volumeTop - 5}
              x2={plotWidth}
              y2={volumeTop - 5}
              stroke="#263141"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x={plotWidth + 8}
              y={volumeTop + 14}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              VOL
            </text>

            {/* Mode: Area Line */}
            {viewMode === 'line' && (
              <g>
                <path d={areaPath} fill="url(#areaGradientTV)" />
                <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                {visibleCandles.map((c, i) => {
                  const x = i * candleSpacing + candleSpacing / 2;
                  const y = getY(c.close);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={hoveredIndex === i ? 4.5 : count > 80 ? 0 : 2}
                      fill={hoveredIndex === i ? '#ffffff' : '#10b981'}
                      stroke="#0c1017"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            )}

            {/* Mode: Range / Volatility Band */}
            {viewMode === 'range' && (
              <g>
                <path d={rangeBandPolygon} fill="rgba(56, 189, 248, 0.12)" />
                <path d={rangeHighPath} fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <path d={rangeLowPath} fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                {visibleCandles.map((c, i) => {
                  const x = i * candleSpacing + candleSpacing / 2;
                  const y = getY(c.close);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={hoveredIndex === i ? 4.5 : count > 80 ? 0 : 2}
                      fill={hoveredIndex === i ? '#ffffff' : '#38bdf8'}
                      stroke="#0c1017"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            )}

            {/* Mode: Baseline Deviation */}
            {viewMode === 'baseline' && (
              <g>
                <line
                  x1={0}
                  y1={getY(meanBaselinePrice)}
                  x2={plotWidth}
                  y2={getY(meanBaselinePrice)}
                  stroke="#64748b"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  opacity="0.85"
                />
                <text
                  x={plotWidth - 6}
                  y={getY(meanBaselinePrice) - 4}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  Baseline Mean: {currencySymbol}{meanBaselinePrice.toFixed(2)}
                </text>
                <path d={linePath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              </g>
            )}

            {/* Per-Candle Shapes (Candles, Hollow, Bars, Baseline Stems) & Volume Histogram */}
            {visibleCandles.map((c, i) => {
              const xCenter = i * candleSpacing + candleSpacing / 2;
              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);

              const bodyTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(1.2, Math.abs(yOpen - yClose));
              const bodyLeft = xCenter - candleBodyWidth / 2;

              const volY = getVolY(c.volume);
              const volHeight = Math.max(1, volumeTop + volumeHeight - volY);

              const candleColor = c.isBullish ? '#10b981' : '#f43f5e';
              const isHovered = hoveredIndex === i;

              // Heikin-Ashi data for hollow mode
              const ha = heikinAshiCandles[i] || c;
              const haYOpen = getY(ha.open);
              const haYClose = getY(ha.close);
              const haYHigh = getY(ha.high);
              const haYLow = getY(ha.low);
              const haBodyTop = Math.min(haYOpen, haYClose);
              const haBodyHeight = Math.max(1.2, Math.abs(haYOpen - haYClose));
              const haColor = ha.isBullish ? '#10b981' : '#f43f5e';

              return (
                <g key={i}>
                  {/* Volume Bar */}
                  <rect
                    x={bodyLeft}
                    y={volY}
                    width={candleBodyWidth}
                    height={volHeight}
                    fill={candleColor}
                    opacity={isHovered ? 0.85 : 0.3}
                    rx="1"
                  />

                  {/* Mode: Standard Japanese Candlesticks */}
                  {viewMode === 'candles' && (
                    <g>
                      <line
                        x1={xCenter}
                        y1={yHigh}
                        x2={xCenter}
                        y2={yLow}
                        stroke={candleColor}
                        strokeWidth={candleSpacing < 3.5 ? 1 : isHovered ? 2 : 1.2}
                        opacity={isHovered ? 1 : 0.85}
                      />
                      <rect
                        x={bodyLeft}
                        y={bodyTop}
                        width={candleBodyWidth}
                        height={bodyHeight}
                        fill={c.isBullish ? '#10b981' : '#f43f5e'}
                        stroke={c.isBullish ? '#059669' : '#e11d48'}
                        strokeWidth={candleSpacing < 4 ? 0.5 : isHovered ? 1.5 : 0.75}
                        rx={candleSpacing < 4 ? 0 : 1}
                        filter={isHovered ? 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.6))' : 'none'}
                      />
                    </g>
                  )}

                  {/* Mode: Hollow / Heikin-Ashi Candlesticks */}
                  {viewMode === 'hollow' && (
                    <g>
                      <line
                        x1={xCenter}
                        y1={haYHigh}
                        x2={xCenter}
                        y2={haYLow}
                        stroke={haColor}
                        strokeWidth={candleSpacing < 3.5 ? 1 : isHovered ? 2 : 1.2}
                        opacity={isHovered ? 1 : 0.85}
                      />
                      <rect
                        x={bodyLeft}
                        y={haBodyTop}
                        width={candleBodyWidth}
                        height={haBodyHeight}
                        fill={ha.isBullish ? 'transparent' : '#f43f5e'}
                        stroke={ha.isBullish ? '#10b981' : '#e11d48'}
                        strokeWidth={ha.isBullish ? 1.5 : 0.75}
                        rx={candleSpacing < 4 ? 0 : 1}
                        filter={isHovered ? 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.6))' : 'none'}
                      />
                    </g>
                  )}

                  {/* Mode: OHLC Western Tick Bars */}
                  {viewMode === 'bars' && (
                    <g>
                      {/* Vertical High-Low Spine */}
                      <line
                        x1={xCenter}
                        y1={yHigh}
                        x2={xCenter}
                        y2={yLow}
                        stroke={candleColor}
                        strokeWidth={candleSpacing < 3.5 ? 1 : isHovered ? 2.2 : 1.5}
                      />
                      {/* Left Tick: Open */}
                      <line
                        x1={xCenter - Math.max(3, candleBodyWidth / 2)}
                        y1={yOpen}
                        x2={xCenter}
                        y2={yOpen}
                        stroke={candleColor}
                        strokeWidth={candleSpacing < 3.5 ? 1 : isHovered ? 2 : 1.5}
                      />
                      {/* Right Tick: Close */}
                      <line
                        x1={xCenter}
                        y1={yClose}
                        x2={xCenter + Math.max(3, candleBodyWidth / 2)}
                        y2={yClose}
                        stroke={candleColor}
                        strokeWidth={candleSpacing < 3.5 ? 1 : isHovered ? 2 : 1.5}
                      />
                    </g>
                  )}

                  {/* Mode: Baseline Deviation Stems */}
                  {viewMode === 'baseline' && (
                    <g>
                      <line
                        x1={xCenter}
                        y1={getY(meanBaselinePrice)}
                        x2={xCenter}
                        y2={yClose}
                        stroke={c.close >= meanBaselinePrice ? '#10b981' : '#f43f5e'}
                        strokeWidth={Math.max(1.5, candleBodyWidth * 0.6)}
                        opacity={isHovered ? 1 : 0.7}
                      />
                      <circle
                        cx={xCenter}
                        cy={yClose}
                        r={isHovered ? 4 : 2}
                        fill={c.close >= meanBaselinePrice ? '#10b981' : '#f43f5e'}
                      />
                    </g>
                  )}

                  {/* Hit Target for Crosshair */}
                  <rect
                    x={i * candleSpacing}
                    y={0}
                    width={candleSpacing}
                    height={svgHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIndex(i)}
                  />
                </g>
              );
            })}

            {/* TradingView Crosshair Lines */}
            {hoveredIndex !== null && visibleCandles[hoveredIndex] && (
              <g pointerEvents="none">
                {/* Vertical Crosshair Line */}
                <line
                  x1={hoveredIndex * candleSpacing + candleSpacing / 2}
                  y1={0}
                  x2={hoveredIndex * candleSpacing + candleSpacing / 2}
                  y2={chartHeight}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />
                {/* Horizontal Crosshair Line */}
                <line
                  x1={0}
                  y1={getY(visibleCandles[hoveredIndex].close)}
                  x2={plotWidth}
                  y2={getY(visibleCandles[hoveredIndex].close)}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />

                {/* Right Axis Price Tag */}
                <rect
                  x={plotWidth}
                  y={getY(visibleCandles[hoveredIndex].close) - 10}
                  width={60}
                  height={20}
                  fill={visibleCandles[hoveredIndex].isBullish ? '#10b981' : '#f43f5e'}
                  rx="3"
                />
                <text
                  x={plotWidth + 6}
                  y={getY(visibleCandles[hoveredIndex].close) + 4}
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {currencySymbol}{visibleCandles[hoveredIndex].close.toFixed(2)}
                </text>

                {/* Bottom Axis Date Tag */}
                <rect
                  x={hoveredIndex * candleSpacing + candleSpacing / 2 - 35}
                  y={chartHeight + 1}
                  width={70}
                  height={18}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1"
                  rx="3"
                />
                <text
                  x={hoveredIndex * candleSpacing + candleSpacing / 2}
                  y={chartHeight + 13}
                  fill="#f1f5f9"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {visibleCandles[hoveredIndex].date}
                </text>
              </g>
            )}

            {/* Standard X-Axis Date Intervals */}
            {visibleCandles.map((c, i) => {
              const step = Math.max(1, Math.floor(count / 6));
              if (i % step === 0 || i === count - 1) {
                const x = i * candleSpacing + candleSpacing / 2;
                return (
                  <text
                    key={i}
                    x={x}
                    y={chartHeight + 12}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {allCandles.length > 100 ? c.date.slice(0, 7) : c.date.slice(5)}
                  </text>
                );
              }
              return null;
            })}
          </svg>

          {/* Floating Hover Card (Top Left) */}
          {hoveredIndex !== null && visibleCandles[hoveredIndex] && (
            <div className="pointer-events-none absolute top-4 left-4 z-20 rounded-lg border border-outline-variant/60 bg-[#141822]/95 px-3 py-2 shadow-2xl backdrop-blur-md text-[11px] font-mono-code space-y-0.5">
              <div className="flex items-center justify-between gap-4 font-bold text-on-surface border-b border-outline-variant/30 pb-1">
                <span>{visibleCandles[hoveredIndex].date}</span>
                <span className={visibleCandles[hoveredIndex].isBullish ? 'text-emerald-400' : 'text-rose-400'}>
                  {visibleCandles[hoveredIndex].isBullish ? '▲ Bullish' : '▼ Bearish'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5">
                <div className="text-on-surface-variant">
                  Open: <span className="text-on-surface font-semibold">{currencySymbol}{visibleCandles[hoveredIndex].open.toFixed(2)}</span>
                </div>
                <div className="text-on-surface-variant">
                  High: <span className="text-emerald-400 font-semibold">{currencySymbol}{visibleCandles[hoveredIndex].high.toFixed(2)}</span>
                </div>
                <div className="text-on-surface-variant">
                  Low: <span className="text-rose-400 font-semibold">{currencySymbol}{visibleCandles[hoveredIndex].low.toFixed(2)}</span>
                </div>
                <div className="text-on-surface-variant">
                  Close: <span className="text-on-surface font-semibold">{currencySymbol}{visibleCandles[hoveredIndex].close.toFixed(2)}</span>
                </div>
                <div className="text-on-surface-variant col-span-2">
                  Change:{' '}
                  <span className={visibleCandles[hoveredIndex].isBullish ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {visibleCandles[hoveredIndex].change >= 0 ? '+' : ''}{currencySymbol}{Math.abs(visibleCandles[hoveredIndex].change).toFixed(2)} (
                    {visibleCandles[hoveredIndex].changePercent >= 0 ? '+' : ''}
                    {visibleCandles[hoveredIndex].changePercent.toFixed(2)}%)
                  </span>
                </div>
                {visibleCandles[hoveredIndex].volume > 0 && (
                  <div className="text-on-surface-variant col-span-2">
                    Vol: <span className="text-cyan-300 font-semibold">{visibleCandles[hoveredIndex].volume.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Status Footer */}
      <div className="flex items-center justify-between border-t border-outline-variant/30 bg-surface-container-high/30 px-4 py-2 text-[10px] text-on-surface-variant font-mono-code flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Bullish
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span> Bearish
          </span>
          <span className="hidden sm:inline">Volume histogram below</span>
        </div>
        <div className="text-primary font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">candlestick_chart</span>
          <span>TradingView-Grade Interactive Engine • Live Bedrock MCP</span>
        </div>
      </div>
    </div>
  );
}
