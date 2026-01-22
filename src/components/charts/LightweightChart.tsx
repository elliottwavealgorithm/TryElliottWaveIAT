import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type BusinessDay,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { 
  Candle, 
  ElliottAnalysisResult, 
  WavePoint, 
  MultiLayerAnalysis, 
  WaveLayer,
  WaveDegree,
  CageFeatures,
  KeyLevels,
  normalizeWaveLabel,
  formatWaveLabelByDegree,
  normalizeKeyLevelEntry,
  getInvalidationLevel,
  DEGREE_ABBREV_MAP,
  NormalizedWaveLabel,
} from '@/types/analysis';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Grid3X3, Target, AlertTriangle, Info, HelpCircle } from 'lucide-react';

// ============================================================================
// SERIES HELPERS - v4/v5 compatibility
// ============================================================================

function safeAddCandles(chart: IChartApi, options: Record<string, unknown>): ISeriesApi<'Candlestick'> {
  if (typeof (chart as any).addCandlestickSeries === 'function') {
    return (chart as any).addCandlestickSeries(options);
  }
  return (chart as any).addSeries(CandlestickSeries, options);
}

function safeAddLine(chart: IChartApi, options: Record<string, unknown>): ISeriesApi<'Line'> {
  if (typeof (chart as any).addLineSeries === 'function') {
    return (chart as any).addLineSeries(options);
  }
  return (chart as any).addSeries(LineSeries, options);
}

// ============================================================================
// TIME FORMAT HELPER - Convert YYYY-MM-DD to BusinessDay
// ============================================================================

function toBusinessDay(dateStr: string): BusinessDay {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function isValidDateStr(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// ============================================================================
// TYPES
// ============================================================================

interface NormalizedWavePoint extends WavePoint {
  norm: NormalizedWaveLabel;
}

export interface ChartOverlayToggles {
  showWaves: boolean;
  showCages: boolean;
  showLevels: boolean;
}

interface ChartWarning {
  type: 'no_candles' | 'no_waves' | 'waves_outside_range' | 'no_cages' | 'missing_origin';
  message: string;
}

interface LightweightChartProps {
  candles: Candle[];
  symbol: string;
  analysis?: ElliottAnalysisResult | null;
  multiLayer?: MultiLayerAnalysis | null;
  activeLayerIds?: Set<string>;
  selectedAlternateIndex?: number | null;
  height?: number;
  overlayToggles?: ChartOverlayToggles;
  onToggleChange?: (toggles: ChartOverlayToggles) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WAVE_COLORS = {
  impulse: '#3b82f6',
  correction: '#f97316',
  primary: '#22c55e',
  alternate: '#a855f7',
};

const WAVE_LABEL_COLORS: Record<string, string> = {
  '0': '#9ca3af',
  'Start': '#9ca3af',
  '1': '#3b82f6',
  '2': '#22c55e',
  '3': '#ef4444',
  '4': '#f59e0b',
  '5': '#8b5cf6',
  'A': '#f97316',
  'B': '#06b6d4',
  'C': '#ec4899',
  'W': '#84cc16',
  'X': '#64748b',
  'Y': '#0ea5e9',
};

const DEGREE_LINE_COLORS: Record<WaveDegree, string> = {
  'Supercycle': '#8b5cf6',
  'Cycle': '#3b82f6',
  'Primary': '#22c55e',
  'Intermediate': '#f59e0b',
  'Minor': '#06b6d4',
  'Minute': '#ec4899',
};

const DEGREE_PRIORITY: Record<string, number> = {
  'Minute': 6,
  'Minor': 5,
  'Intermediate': 4,
  'Primary': 3,
  'Cycle': 2,
  'Supercycle': 1,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findDominantDegree(points: NormalizedWavePoint[]): WaveDegree | null {
  const recentPoints = points.slice(-10);
  const degreeCounts: Record<string, number> = {};
  
  for (const p of recentPoints) {
    if (p.norm.degreeKey) {
      degreeCounts[p.norm.degreeKey] = (degreeCounts[p.norm.degreeKey] || 0) + 1;
    }
  }
  
  if (Object.keys(degreeCounts).length === 0) return null;
  
  const maxCount = Math.max(...Object.values(degreeCounts));
  const topDegrees = Object.entries(degreeCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([deg]) => deg);
  
  if (topDegrees.length === 1) return topDegrees[0] as WaveDegree;
  
  let bestDeg = topDegrees[0];
  let bestPriority = DEGREE_PRIORITY[bestDeg] || 0;
  
  for (const deg of topDegrees) {
    const priority = DEGREE_PRIORITY[deg] || 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestDeg = deg;
    }
  }
  
  return bestDeg as WaveDegree;
}

// Check if waves array has origin pivot (Start or 0)
function hasOriginPivot(points: NormalizedWavePoint[]): boolean {
  if (points.length === 0) return false;
  return points.some(p => p.norm.isStart);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LightweightChart({ 
  candles, 
  symbol, 
  analysis,
  multiLayer,
  activeLayerIds,
  selectedAlternateIndex = null,
  height = 500,
  overlayToggles: externalToggles,
  onToggleChange
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartRemovedRef = useRef(false);
  const chartInstanceIdRef = useRef(0);
  const currentChartIdRef = useRef(0);
  
  // Single operation token for unified overlay management
  const overlayOpRef = useRef(0);

  // Series refs (all managed in a single overlay effect)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const waveSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cageSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const levelLinesRef = useRef<any[]>([]);
  
  const [isReady, setIsReady] = useState(false);
  const [warnings, setWarnings] = useState<ChartWarning[]>([]);
  
  const [internalToggles, setInternalToggles] = useState<ChartOverlayToggles>({
    showWaves: true,
    showCages: true,
    showLevels: true
  });
  
  const toggles = externalToggles || internalToggles;
  
  const handleToggle = useCallback((key: keyof ChartOverlayToggles) => {
    const newToggles = { ...toggles, [key]: !toggles[key] };
    if (onToggleChange) {
      onToggleChange(newToggles);
    } else {
      setInternalToggles(newToggles);
    }
  }, [toggles, onToggleChange]);

  // Get candle date range for validation
  const candleDateRange = useMemo(() => {
    if (candles.length === 0) return { min: '', max: '' };
    return {
      min: candles[0].date,
      max: candles[candles.length - 1].date
    };
  }, [candles]);

  // Get active layers from multiLayer or fallback to single analysis
  const activeLayers: WaveLayer[] = useMemo(() => {
    if (multiLayer && activeLayerIds && activeLayerIds.size > 0) {
      return multiLayer.layers.filter(l => activeLayerIds.has(l.layer_id));
    }
    if (analysis) {
      return [{
        layer_id: 'legacy',
        degree: 'Primary' as WaveDegree,
        timeframe: analysis.timeframe,
        status: analysis.status,
        waves: analysis.primary_count?.waves || [],
        key_levels: analysis.key_levels,
        cage_features: analysis.cage_features,
        summary: analysis.summary,
        analyzed_at: new Date().toISOString(),
        source: 'llm',
      }];
    }
    return [];
  }, [multiLayer, activeLayerIds, analysis]);

  // Get combined wave points (for legacy compatibility)
  const activeWavePoints: WavePoint[] = useMemo(() => {
    if (activeLayers.length === 0) return [];
    
    if (analysis && selectedAlternateIndex !== null && 
        analysis.alternate_counts[selectedAlternateIndex]?.waves?.length > 0) {
      return analysis.alternate_counts[selectedAlternateIndex].waves!;
    }
    
    return activeLayers.flatMap(l => l.waves);
  }, [activeLayers, analysis, selectedAlternateIndex]);

  // Normalize wave points with enhanced label parsing
  const normalizedActiveWavePoints: NormalizedWavePoint[] = useMemo(() => {
    return activeWavePoints
      .filter(wp => isValidDateStr(wp.date))
      .map(wp => ({
        ...wp,
        norm: normalizeWaveLabel(wp.wave),
      }));
  }, [activeWavePoints]);

  const dominantDegree = useMemo(() => {
    return findDominantDegree(normalizedActiveWavePoints);
  }, [normalizedActiveWavePoints]);

  // Get base layer for cage/levels (first active layer)
  const baseLayer = useMemo(() => {
    return activeLayers[0] || null;
  }, [activeLayers]);

  // Validate data and set warnings
  useEffect(() => {
    const newWarnings: ChartWarning[] = [];
    
    if (candles.length === 0) {
      newWarnings.push({ type: 'no_candles', message: 'No candles returned from backend' });
    }
    
    if (analysis && (!analysis.primary_count?.waves || analysis.primary_count.waves.length === 0)) {
      newWarnings.push({ type: 'no_waves', message: 'No wave points in analysis' });
    }
    
    if (activeWavePoints.length > 0 && candles.length > 0) {
      const outsideRange = activeWavePoints.filter(wp => 
        wp.date < candleDateRange.min || wp.date > candleDateRange.max
      );
      if (outsideRange.length > 0) {
        newWarnings.push({ 
          type: 'waves_outside_range', 
          message: `${outsideRange.length} wave points outside candle range` 
        });
      }
    }
    
    // Check for missing origin pivot
    if (normalizedActiveWavePoints.length > 0 && !hasOriginPivot(normalizedActiveWavePoints)) {
      newWarnings.push({
        type: 'missing_origin',
        message: 'Missing Start/0 wave point (origin of wave 1)'
      });
    }
    
    setWarnings(newWarnings);
  }, [candles, analysis, activeWavePoints, candleDateRange, normalizedActiveWavePoints]);

  // Initialize chart ONCE on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRemovedRef.current = false;
    chartInstanceIdRef.current += 1;
    const myId = chartInstanceIdRef.current;
    currentChartIdRef.current = myId;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(150, 150, 150, 1)',
      },
      grid: {
        vertLines: { color: 'rgba(100, 100, 100, 0.2)' },
        horzLines: { color: 'rgba(100, 100, 100, 0.2)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(100, 100, 100, 0.3)',
      },
      timeScale: {
        borderColor: 'rgba(100, 100, 100, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height,
      crosshair: {
        mode: 1,
      },
    });

    const candleSeries = safeAddCandles(chart, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setIsReady(true);

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        if (chartRemovedRef.current) return;
        const c = chartRef.current;
        if (!c || currentChartIdRef.current !== myId) return;
        const w = container.clientWidth;
        if (w > 0) c.applyOptions({ width: w });
      });
      ro.observe(container);
    } catch {}

    return () => {
      chartRemovedRef.current = true;
      currentChartIdRef.current = 0;
      try { ro?.disconnect(); } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      waveSeriesRef.current = null;
      cageSeriesMapRef.current.clear();
      levelLinesRef.current = [];
      try { chart.remove(); } catch {}
    };
  }, []);

  // Apply height updates
  useEffect(() => {
    if (chartRemovedRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({ height });
  }, [height]);

  // Update candle data
  useEffect(() => {
    if (chartRemovedRef.current || !candleSeriesRef.current || !isReady || candles.length === 0) return;

    const chartData = candles
      .filter(c => isValidDateStr(c.date))
      .map(c => ({
        time: toBusinessDay(c.date) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    if (chartData.length === 0) return;

    candleSeriesRef.current.setData(chartData);
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, isReady]);

  // ============================================================================
  // UNIFIED OVERLAY MANAGER - Single effect for all overlays to prevent race conditions
  // ============================================================================
  useEffect(() => {
    // Guard: ensure chart is ready and not removed
    if (chartRemovedRef.current || !isReady) return;
    
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    // Increment operation token to invalidate any stale operations
    overlayOpRef.current += 1;
    const opId = overlayOpRef.current;

    // Stale check helper - use throughout to abort if conditions change
    const isStale = () => chartRemovedRef.current || overlayOpRef.current !== opId || !chartRef.current;

    // ========================================================================
    // STEP 1: CLEAR ALL EXISTING OVERLAYS
    // ========================================================================
    
    // Clear markers
    try { (candleSeries as any).setMarkers?.([]); } catch {}
    
    // Clear wave series data (don't remove series, just clear data)
    if (waveSeriesRef.current) {
      try { waveSeriesRef.current.setData([]); } catch {}
    }
    
    // Clear cage series data
    cageSeriesMapRef.current.forEach(series => {
      try { series.setData([]); } catch {}
    });
    
    // Remove level price lines
    levelLinesRef.current.forEach(line => {
      try { candleSeries.removePriceLine(line); } catch {}
    });
    levelLinesRef.current = [];

    if (isStale()) return;

    // ========================================================================
    // STEP 2: DRAW WAVES (polyline + markers)
    // ========================================================================
    
    if (toggles.showWaves && normalizedActiveWavePoints.length >= 2) {
      // Filter to valid points within candle range
      const validPoints = normalizedActiveWavePoints.filter(wp => 
        wp.date >= candleDateRange.min && wp.date <= candleDateRange.max
      );

      if (validPoints.length >= 2 && !isStale()) {
        // Create or reuse wave series
        if (!waveSeriesRef.current) {
          const lineColor = selectedAlternateIndex !== null ? WAVE_COLORS.alternate : WAVE_COLORS.primary;
          waveSeriesRef.current = safeAddLine(chart, {
            color: lineColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
          });
        }

        if (!isStale()) {
          // Update line color based on alternate selection
          const lineColor = selectedAlternateIndex !== null ? WAVE_COLORS.alternate : WAVE_COLORS.primary;
          try {
            (waveSeriesRef.current as any).applyOptions?.({ color: lineColor });
          } catch {}

          // Set line data
          const lineData = validPoints.map(wp => ({
            time: toBusinessDay(wp.date) as Time,
            value: wp.price,
          }));
          waveSeriesRef.current.setData(lineData);

          // Create markers with proper Elliott Wave nomenclature
          try {
            const minPrice = Math.min(...validPoints.map(p => p.price));
            const maxPrice = Math.max(...validPoints.map(p => p.price));
            
            const markers = validPoints.map(wp => {
              // Position marker above or below bar based on price relative to range
              const priceRange = maxPrice - minPrice;
              const relativePos = priceRange > 0 ? (wp.price - minPrice) / priceRange : 0.5;
              const isLow = relativePos < 0.3;
              
              const effectiveDegree = wp.norm.degreeKey || dominantDegree || 'Primary';
              
              // Get proper display label using standard EW nomenclature
              let displayLabel = wp.norm.displayEw;
              if (wp.norm.isStart) {
                displayLabel = '○'; // Circle for origin/start
              }
              
              return {
                time: toBusinessDay(wp.date) as Time,
                position: isLow ? 'belowBar' : 'aboveBar',
                color: WAVE_LABEL_COLORS[wp.norm.colorKey] || '#6b7280',
                shape: wp.norm.isStart ? 'circle' : 'circle' as const,
                text: displayLabel,
                size: wp.norm.isStart ? 0.5 : 1,
              };
            });
            (candleSeries as any).setMarkers?.(markers);
          } catch {}
        }
      }
    }

    if (isStale()) return;

    // ========================================================================
    // STEP 3: DRAW CAGES (2-4, 5-B, Wedge) with break markers
    // ========================================================================
    
    if (toggles.showCages && baseLayer?.cage_features) {
      const cf = baseLayer.cage_features;
      
      const drawCageFromPoints = (
        upperPoints: Array<{ date: string; value: number }> | undefined,
        lowerPoints: Array<{ date: string; value: number }> | undefined,
        color: string,
        isBroken: boolean,
        cageLabel: string,
        breakInfo?: { 
          break_date?: string | null; 
          break_price?: number | null; 
          boundary_value_at_break?: number | null; 
          break_strength_atr?: number;
          break_direction?: 'up' | 'down';
        }
      ) => {
        if (isStale()) return;
        if (!upperPoints || !lowerPoints || upperPoints.length < 2 || lowerPoints.length < 2) return;
        if (!upperPoints.every(p => isValidDateStr(p.date)) || !lowerPoints.every(p => isValidDateStr(p.date))) return;

        const style = isBroken ? LineStyle.Dotted : LineStyle.Dashed;
        const opacity = isBroken ? '99' : '';
        const width = isBroken ? 1 : 2;

        // Lower line
        const lowerKey = `${cageLabel}-lower`;
        if (!cageSeriesMapRef.current.has(lowerKey)) {
          cageSeriesMapRef.current.set(lowerKey, safeAddLine(chart, {
            color: `${color}${opacity}`,
            lineWidth: width,
            lineStyle: style,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          }));
        }
        const lowerSeries = cageSeriesMapRef.current.get(lowerKey)!;
        try {
          (lowerSeries as any).applyOptions?.({ color: `${color}${opacity}`, lineWidth: width, lineStyle: style });
        } catch {}
        lowerSeries.setData([
          { time: toBusinessDay(lowerPoints[0].date) as Time, value: lowerPoints[0].value },
          { time: toBusinessDay(lowerPoints[1].date) as Time, value: lowerPoints[1].value },
        ]);

        // Upper line
        const upperKey = `${cageLabel}-upper`;
        if (!cageSeriesMapRef.current.has(upperKey)) {
          cageSeriesMapRef.current.set(upperKey, safeAddLine(chart, {
            color: `${color}${opacity}`,
            lineWidth: width,
            lineStyle: style,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          }));
        }
        const upperSeries = cageSeriesMapRef.current.get(upperKey)!;
        try {
          (upperSeries as any).applyOptions?.({ color: `${color}${opacity}`, lineWidth: width, lineStyle: style });
        } catch {}
        upperSeries.setData([
          { time: toBusinessDay(upperPoints[0].date) as Time, value: upperPoints[0].value },
          { time: toBusinessDay(upperPoints[1].date) as Time, value: upperPoints[1].value },
        ]);

        // Add break marker if cage is broken
        if (isBroken && breakInfo?.break_date && isValidDateStr(breakInfo.break_date)) {
          const breakPrice = breakInfo.break_price || breakInfo.boundary_value_at_break;
          if (breakPrice && !isStale()) {
            // Add break indicator as a price line with label
            try {
              const breakDirection = breakInfo.break_direction || 'up';
              const atrStr = breakInfo.break_strength_atr ? ` (${breakInfo.break_strength_atr.toFixed(1)} ATR)` : '';
              const breakLine = candleSeries.createPriceLine({
                price: breakPrice,
                color: breakDirection === 'up' ? '#22c55e' : '#ef4444',
                lineWidth: 1,
                lineStyle: LineStyle.SparseDotted,
                axisLabelVisible: false,
                title: `${cageLabel} break ${breakDirection === 'up' ? '↑' : '↓'}${atrStr}`,
              });
              levelLinesRef.current.push(breakLine);
            } catch {}
          }
        }
      };

      // Draw cage_2_4 (impulse channel: Wave 2 → Wave 4, parallel through Wave 3)
      if (cf.cage_2_4?.exists) {
        drawCageFromPoints(
          cf.cage_2_4.upper_points,
          cf.cage_2_4.lower_points,
          '#f59e0b', // Amber
          cf.cage_2_4.broken || false,
          '2-4',
          {
            break_date: cf.cage_2_4.break_date,
            break_price: cf.cage_2_4.break_price,
            boundary_value_at_break: cf.cage_2_4.boundary_value_at_break,
            break_strength_atr: cf.cage_2_4.break_strength_atr,
            break_direction: cf.cage_2_4.break_direction,
          }
        );
      }

      // Draw cage_ACB (5-B channel: Wave 5 → Wave B, parallel through Wave A)
      if (cf.cage_ACB?.exists) {
        const acbBroken = cf.cage_ACB.broken_up || cf.cage_ACB.broken_down || false;
        const acbDirection = cf.cage_ACB.broken_up ? 'up' : cf.cage_ACB.broken_down ? 'down' : undefined;
        drawCageFromPoints(
          cf.cage_ACB.upper_points,
          cf.cage_ACB.lower_points,
          '#06b6d4', // Cyan
          acbBroken,
          '5-B',
          {
            break_date: cf.cage_ACB.break_date,
            break_price: cf.cage_ACB.break_price,
            boundary_value_at_break: cf.cage_ACB.boundary_value_at_break,
            break_strength_atr: cf.cage_ACB.break_strength_atr,
            break_direction: acbDirection,
          }
        );
      }

      // Draw wedge_cage
      if (cf.wedge_cage?.exists) {
        drawCageFromPoints(
          cf.wedge_cage.upper_points,
          cf.wedge_cage.lower_points,
          '#a855f7', // Purple
          cf.wedge_cage.broken || false,
          'Wedge',
          {
            break_date: cf.wedge_cage.break_date,
            break_price: cf.wedge_cage.break_price,
            boundary_value_at_break: cf.wedge_cage.boundary_value_at_break,
            break_strength_atr: cf.wedge_cage.break_strength_atr,
          }
        );
      }
    }

    if (isStale()) return;

    // ========================================================================
    // STEP 4: DRAW KEY LEVELS (Support / Resistance / Invalidation)
    // ========================================================================
    
    if (toggles.showLevels && baseLayer?.key_levels) {
      const kl = baseLayer.key_levels;
      const degreeAbbrev = baseLayer.degree ? DEGREE_ABBREV_MAP[baseLayer.degree] : '';
      const sourceLabel = baseLayer.source === 'structure' ? ' [S]' : '';

      // Supports (green dashed)
      if (Array.isArray(kl.support)) {
        kl.support.forEach((entry, idx) => {
          if (isStale()) return;
          const normalized = normalizeKeyLevelEntry(entry);
          if (isNaN(normalized.level)) return;
          try {
            const sourceTag = normalized.source !== 'pivot-derived' ? ` [${normalized.source.charAt(0).toUpperCase()}]` : '';
            const line = candleSeries.createPriceLine({
              price: normalized.level,
              color: '#22c55e',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `Support S${idx + 1}${sourceTag}`,
            });
            levelLinesRef.current.push(line);
          } catch {}
        });
      }

      // Resistances (red dashed)
      if (Array.isArray(kl.resistance)) {
        kl.resistance.forEach((entry, idx) => {
          if (isStale()) return;
          const normalized = normalizeKeyLevelEntry(entry);
          if (isNaN(normalized.level)) return;
          try {
            const sourceTag = normalized.source !== 'pivot-derived' ? ` [${normalized.source.charAt(0).toUpperCase()}]` : '';
            const line = candleSeries.createPriceLine({
              price: normalized.level,
              color: '#ef4444',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `Resistance R${idx + 1}${sourceTag}`,
            });
            levelLinesRef.current.push(line);
          } catch {}
        });
      }

      // Invalidation (amber, prominent) - the critical Elliott level
      const invLevel = getInvalidationLevel(kl.invalidation);
      if (invLevel > 0 && !isNaN(invLevel) && !isStale()) {
        try {
          // Get rule if available
          let invRule = '';
          if (typeof kl.invalidation === 'object' && kl.invalidation?.rule) {
            invRule = ` (${kl.invalidation.rule})`;
          }
          const line = candleSeries.createPriceLine({
            price: invLevel,
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.LargeDashed,
            axisLabelVisible: true,
            title: `INV${invRule}`,
          });
          levelLinesRef.current.push(line);
        } catch {}
      }
    }

  }, [
    isReady,
    toggles.showWaves,
    toggles.showCages,
    toggles.showLevels,
    normalizedActiveWavePoints,
    baseLayer,
    candleDateRange,
    dominantDegree,
    selectedAlternateIndex,
  ]);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="relative w-full">
      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="absolute top-12 left-2 right-2 z-30 flex flex-col gap-1">
          {warnings.map((w, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded">
              <AlertTriangle className="h-3 w-3" />
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Overlay Toggle Controls */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-4 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
        <span className="text-sm font-medium text-foreground">{symbol}</span>
        
        {/* Degree + Status Badge */}
        {baseLayer && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            baseLayer.status === 'conclusive' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : baseLayer.status === 'structure_only'
              ? 'bg-slate-500/20 text-slate-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {baseLayer.degree} • {baseLayer.status === 'structure_only' ? 'Struct' : baseLayer.status}
          </span>
        )}
        
        {selectedAlternateIndex !== null && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            Alt #{selectedAlternateIndex + 1}
          </span>
        )}
        
        <div className="h-4 w-px bg-border/50" />
        
        {/* Wave Toggle */}
        <div className="flex items-center gap-1">
          <Switch
            id="toggle-waves"
            checked={toggles.showWaves}
            onCheckedChange={() => handleToggle('showWaves')}
            className="h-4 w-7"
          />
          <Label htmlFor="toggle-waves" className="text-xs flex items-center gap-1 cursor-pointer">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="hidden sm:inline">Waves</span>
          </Label>
        </div>
        
        {/* Cage Toggle */}
        <div className="flex items-center gap-1">
          <Switch
            id="toggle-cages"
            checked={toggles.showCages}
            onCheckedChange={() => handleToggle('showCages')}
            className="h-4 w-7"
          />
          <Label htmlFor="toggle-cages" className="text-xs flex items-center gap-1 cursor-pointer">
            <Grid3X3 className="h-3 w-3 text-amber-400" />
            <span className="hidden sm:inline">Channels</span>
          </Label>
        </div>
        
        {/* Key Levels Toggle with Tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Switch
                  id="toggle-levels"
                  checked={toggles.showLevels}
                  onCheckedChange={() => handleToggle('showLevels')}
                  className="h-4 w-7"
                />
                <Label htmlFor="toggle-levels" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Target className="h-3 w-3 text-green-400" />
                  <span className="hidden sm:inline">Key Levels</span>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-semibold mb-1">Key Levels (S/R/INV)</p>
              <ul className="space-y-0.5">
                <li><span className="text-green-400">Support S1, S2...</span> – Price floors from pivots/structure</li>
                <li><span className="text-red-400">Resistance R1, R2...</span> – Price ceilings from pivots/structure</li>
                <li><span className="text-amber-400 font-bold">INV</span> – Invalidation: if price crosses here, this wave count is wrong</li>
              </ul>
              <p className="mt-2 text-muted-foreground text-[10px]">
                Source tags: [L] = LLM, [F] = Fibonacci, [S] = Structure
              </p>
              {baseLayer?.source === 'structure' && (
                <p className="mt-1 text-muted-foreground italic">Currently showing structure-derived levels</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Wave Legend (right side) */}
      {toggles.showWaves && normalizedActiveWavePoints.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-border/50">
          <span className="text-muted-foreground">
            {dominantDegree || 'Waves'}:
          </span>
          {normalizedActiveWavePoints.slice(-8).map((wp, idx) => {
            const color = WAVE_LABEL_COLORS[wp.norm.colorKey] || '#6b7280';
            return (
              <span 
                key={`${wp.norm.displayEw}-${idx}`}
                className="px-1.5 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${color}20`,
                  color: color,
                }}
                title={`${wp.wave} @ ${wp.price.toFixed(2)} (${wp.date})`}
              >
                {wp.norm.isStart ? '○' : wp.norm.displayEw}
              </span>
            );
          })}
        </div>
      )}

      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ height, minHeight: 420 }}
      />
    </div>
  );
}
