/**
 * AI Graph Advisor & Dataset Shape Discriminator
 * 
 * Inspects any incoming data payload (arrays, dictionaries, time series, multi-metric profiles)
 * and determines the optimal graph visualization with natural language rationale and confidence score.
 */

export const SUPPORTED_GRAPH_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: 'bar_chart', desc: 'Categorical comparisons, rankings, and metric distributions' },
  { id: 'line', label: 'Line / Trend', icon: 'show_chart', desc: 'Continuous time-series progressions and temporal trends' },
  { id: 'area', label: 'Area Curve', icon: 'area_chart', desc: 'Cumulative volume and continuous trend envelopes' },
  { id: 'donut', label: 'Donut / Pie', icon: 'pie_chart', desc: 'Proportions of a whole and percentage breakdowns' },
  { id: 'scatter', label: 'Scatter / Bubble', icon: 'bubble_chart', desc: 'Correlation, bivariate distribution, and cluster outliers' },
  { id: 'radar', label: 'Radar Polygon', icon: 'radar', desc: 'Multi-dimensional attribute scoring and comparative profiling' },
  { id: 'heatmap', label: 'Heatmap Matrix', icon: 'grid_view', desc: '2D frequency density, correlation grids, and intensity tables' },
  { id: 'candlestick', label: 'Financial Candlesticks', icon: 'candlestick_chart', desc: 'Financial market price action, OHLC volatility, and ranges' },
  { id: 'table', label: 'Data Matrix Table', icon: 'table_chart', desc: 'Raw records, multi-column search, sorting, and tabular inspection' }
];

export function analyzeDatasetShape(rawPayload) {
  if (!rawPayload) {
    return {
      recommendedType: 'table',
      confidence: 0.5,
      rationale: 'Empty or undefined dataset; tabular view provides safest default.',
      alternateTypes: ['bar', 'table'],
      normalizedData: []
    };
  }

  // 1. Check if model explicitly provided an AI recommendation in the payload
  let explicitType = null;
  let explicitReason = null;
  let records = [];

  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    explicitType = rawPayload.graphType || rawPayload.chartType || rawPayload.recommendedGraph || rawPayload.type;
    explicitReason = rawPayload.recommendationReason || rawPayload.reason || rawPayload.aiRationale;
    records = rawPayload.data || rawPayload.records || rawPayload.candles || rawPayload.series || rawPayload.items || [];
  } else if (Array.isArray(rawPayload)) {
    records = rawPayload;
  }

  // If records is empty, check if payload itself is tabular dictionary
  if (!Array.isArray(records) || records.length === 0) {
    if (typeof rawPayload === 'object') {
      records = Object.entries(rawPayload)
        .filter(([_, v]) => typeof v === 'number' || typeof v === 'string')
        .map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : parseFloat(v) || 0 }));
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return {
      recommendedType: 'table',
      confidence: 0.5,
      rationale: 'Dataset does not contain structured numeric records.',
      alternateTypes: ['table'],
      normalizedData: []
    };
  }

  // Sanitize and sample records
  const sample = records.slice(0, 10);
  const sampleKeys = Array.from(new Set(sample.flatMap(r => (r && typeof r === 'object' ? Object.keys(r) : []))));
  const lowerKeys = sampleKeys.map(k => k.toLowerCase());

  // Check 1: Financial OHLC Candlestick data
  const hasOpen = lowerKeys.some(k => k === 'open');
  const hasHigh = lowerKeys.some(k => k === 'high');
  const hasLow = lowerKeys.some(k => k === 'low');
  const hasClose = lowerKeys.some(k => k === 'close');
  if (hasOpen && hasHigh && hasLow && hasClose) {
    return {
      recommendedType: 'candlestick',
      confidence: 0.98,
      rationale: explicitReason || 'Dataset contains Open-High-Low-Close (OHLC) financial coordinates, specifically tailored for candlestick analysis.',
      alternateTypes: ['line', 'area', 'bar', 'table'],
      normalizedData: records
    };
  }

  // Check 2: Explicit AI Model Suggestion
  if (explicitType && SUPPORTED_GRAPH_TYPES.some(t => t.id === explicitType.toLowerCase())) {
    const matched = explicitType.toLowerCase();
    const alternates = SUPPORTED_GRAPH_TYPES.map(t => t.id).filter(id => id !== matched);
    return {
      recommendedType: matched,
      confidence: 0.95,
      rationale: explicitReason || `AI model explicitly selected ${matched.toUpperCase()} visualization as the optimal representation for this insight.`,
      alternateTypes: alternates.slice(0, 4),
      normalizedData: records
    };
  }

  // Check 3: Multi-dimensional attribute scoring (Radar Chart)
  // Detected when objects have 4-8 numeric properties (like metrics, skills, latency, throughput, errorRate)
  const firstObj = sample[0];
  if (firstObj && typeof firstObj === 'object') {
    const numericKeys = Object.keys(firstObj).filter(k => typeof firstObj[k] === 'number');
    const isRadarCandidate = (records.length <= 6 && numericKeys.length >= 4 && numericKeys.length <= 10) ||
      (sampleKeys.includes('axis') || sampleKeys.includes('metric') || sampleKeys.includes('attribute'));
    if (isRadarCandidate) {
      return {
        recommendedType: 'radar',
        confidence: 0.91,
        rationale: 'Multi-criteria multidimensional profile detected. A Radar chart exposes multivariate balance across attributes.',
        alternateTypes: ['bar', 'table', 'donut'],
        normalizedData: records
      };
    }
  }

  // Check 4: Temporal Progression (Line / Area Curve)
  const timeKeywords = ['date', 'time', 'timestamp', 'year', 'month', 'day', 'hour', 'quarter', 'period', 'week'];
  const hasTemporalKey = lowerKeys.some(k => timeKeywords.some(tk => k.includes(tk)));
  if (hasTemporalKey && records.length >= 3) {
    return {
      recommendedType: 'line',
      confidence: 0.93,
      rationale: 'Chronological time-series sequence detected. A continuous Line/Area chart visualizes velocity, inflection points, and trends.',
      alternateTypes: ['area', 'bar', 'scatter', 'table'],
      normalizedData: records
    };
  }

  // Check 5: Bivariate correlation (Scatter / Bubble Plot)
  const isScatterCandidate = (lowerKeys.includes('x') && lowerKeys.includes('y')) ||
    (sampleKeys.length >= 2 && Object.values(sample[0] || {}).filter(v => typeof v === 'number').length >= 2 && records.length > 8);
  if (isScatterCandidate) {
    return {
      recommendedType: 'scatter',
      confidence: 0.88,
      rationale: 'Continuous bivariate distribution detected. A Scatter plot illuminates correlation, clusters, and regression tendencies.',
      alternateTypes: ['line', 'bar', 'table'],
      normalizedData: records
    };
  }

  // Check 6: Proportions of a whole (Donut / Pie Chart)
  const isPercentageData = sample.some(r => Object.values(r).some(v => String(v).includes('%') || (typeof v === 'number' && v <= 100 && v > 0)));
  if ((records.length >= 2 && records.length <= 7) && (isPercentageData || sampleKeys.some(k => ['share', 'ratio', 'percentage', 'proportion', 'segment'].includes(k.toLowerCase())))) {
    return {
      recommendedType: 'donut',
      confidence: 0.92,
      rationale: 'Categorical composition with few discrete segments. A Donut chart provides high-contrast proportional breakdown.',
      alternateTypes: ['bar', 'table'],
      normalizedData: records
    };
  }

  // Check 7: 2D Matrix (Heatmap)
  const isMatrix = records.length >= 3 && (sampleKeys.length >= 5 || sample.some(r => Array.isArray(r) || (r && typeof r === 'object' && Object.values(r).every(v => typeof v === 'number'))));
  if (isMatrix && records.length * sampleKeys.length >= 15) {
    return {
      recommendedType: 'heatmap',
      confidence: 0.85,
      rationale: 'Dense 2D grid matrix detected. A Heatmap highlights relative frequency hotspots and variance across rows and columns.',
      alternateTypes: ['bar', 'table'],
      normalizedData: records
    };
  }

  // Default: Bar Chart (Most versatile and legible for general categorical data)
  return {
    recommendedType: 'bar',
    confidence: 0.90,
    rationale: 'Categorical entities with comparative values. A Bar chart delivers clear ranking and delta comparisons.',
    alternateTypes: ['donut', 'line', 'table'],
    normalizedData: records
  };
}
