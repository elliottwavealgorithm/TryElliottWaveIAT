import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, LineStyle, BusinessDay } from 'lightweight-charts';
import { Candle, ElliottAnalysisResult, WavePoint } from '@/types/analysis';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingUp, Grid3X3, Target, AlertTriangle } from 'lucide-react';

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

interface NormalizedWaveLabel {
  raw: string;
  degree: string | null;
  waveNum: number | null;
  waveABC: 'A' | 'B' | 'C' | null;
  colorKey: string;
  display: string;
}

export interface ChartOverlayToggles {
  showWaves: boolean;
  showCages: boolean;
  showLevels: boolean;
}

interface ChartWarning {
  type: 'no_candles' | 'no_waves' | 'waves_outside_range' | 'no_cages';
  message: string;
}

interface LightweightChartProps {
  candles: Candle[];
  symbol: string;
  analysis?: ElliottAnalysisResult | null;
  selectedAlternateIndex?: number | null;
  height?: number;
  overlayToggles?: ChartOverlayToggles;
  onToggleChange?: (toggles: ChartOverlayToggles) => void;
}

type SeriesWithChartId<T> = { series: T; chartId: number };

function isCurrentSeries<T>(
  meta: SeriesWithChartId<T> | null,
  currentChartId: number
): meta is SeriesWithChartId<T> {
  return !!meta && meta.chartId === currentChartId;
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

const DEGREE_ABBREV: Record<string, string> = {
  'supercycle': 'SC',
  'cycle': 'C',
  'primary': 'P',
  'intermediate': 'I',
  'minor': 'm',
  'minute': 'μ',
};

const ROMAN_TO_ARABIC: Record<string, number> = {
  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
  'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
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

function normalizeWaveLabel(raw: string): NormalizedWaveLabel {
  const result: NormalizedWaveLabel = {
    raw,
    degree: null,
    waveNum: null,
    waveABC: null,
    colorKey: 'X',
    display: raw,
  };

  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  const degreeKeywords = ['supercycle', 'cycle', 'primary', 'intermediate', 'minor', 'minute'];
  for (const deg of degreeKeywords) {
    if (lower.includes(deg)) {
      result.degree = deg.charAt(0).toUpperCase() + deg.slice(1);
      break;
    }
  }

  const arabicMatch = raw.match(/\b([1-5])\b/);
  if (arabicMatch) {
    result.waveNum = parseInt(arabicMatch[1], 10);
    result.colorKey = arabicMatch[1];
  }

  if (!result.waveNum) {
    const romanMatch = raw.match(/\b(IV|III|II|I|V)\b/i);
    if (romanMatch) {
      const romanUpper = romanMatch[1].toUpperCase();
      if (ROMAN_TO_ARABIC[romanUpper]) {
        result.waveNum = ROMAN_TO_ARABIC[romanUpper];
        result.colorKey = String(result.waveNum);
      }
    }
  }

  const abcMatch = upper.match(/\b([ABC])\b|\(([ABC])\)/);
  if (abcMatch) {
    const letter = (abcMatch[1] || abcMatch[2]) as 'A' | 'B' | 'C';
    result.waveABC = letter;
    if (!result.waveNum) {
      result.colorKey = letter;
    }
  }

  if (!result.waveNum && !result.waveABC) {
    const wxyMatch = upper.match(/\b([WXY])\b/);
    if (wxyMatch) {
      result.colorKey = wxyMatch[1];
    }
  }

  const degAbbrev = result.degree ? DEGREE_ABBREV[result.degree.toLowerCase()] || '' : '';
  if (result.waveNum) {
    result.display = degAbbrev ? `${degAbbrev}${result.waveNum}` : String(result.waveNum);
  } else if (result.waveABC) {
    result.display = degAbbrev ? `${degAbbrev}-${result.waveABC}` : result.waveABC;
  } else if (result.colorKey !== 'X') {
    result.display = result.colorKey;
  }

  return result;
}

function findDominantDegree(points: { norm: NormalizedWaveLabel }[]): string | null {
  const recentPoints = points.slice(-7);
  const degreeCounts: Record<string, number> = {};
  
  for (const p of recentPoints) {
    if (p.norm.degree) {
      degreeCounts[p.norm.degree] = (degreeCounts[p.norm.degree] || 0) + 1;
    }
  }
  
  if (Object.keys(degreeCounts).length === 0) return null;
  
  const maxCount = Math.max(...Object.values(degreeCounts));
  const topDegrees = Object.entries(degreeCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([deg]) => deg);
  
  if (topDegrees.length === 1) return topDegrees[0];
  
  let bestDeg = topDegrees[0];
  let bestPriority = DEGREE_PRIORITY[bestDeg] || 0;
  
  for (const deg of topDegrees) {
    const priority = DEGREE_PRIORITY[deg] || 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestDeg = deg;
    }
  }
  
  return bestDeg;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LightweightChart({ 
  candles, 
  symbol, 
  analysis,
  selectedAlternateIndex = null,
  height = 500,
  overlayToggles: externalToggles,
  onToggleChange
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartRemovedRef = useRef(false); // Track if chart was removed
  const chartInstanceIdRef = useRef(0);
  const currentChartIdRef = useRef(0);
  const candleSeriesChartIdRef = useRef(0);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const waveLineSeriesRef = useRef<SeriesWithChartId<ISeriesApi<'Line'>> | null>(null);
  const cageSeriesRefs = useRef<Array<SeriesWithChartId<ISeriesApi<'Line'>>>>([]);
  const cageSeriesByKeyRef = useRef<Record<string, SeriesWithChartId<ISeriesApi<'Line'>>>>({});
  const levelLinesRef = useRef<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [warnings, setWarnings] = useState<ChartWarning[]>([]);
  
  const [internalToggles, setInternalToggles] = useState<ChartOverlayToggles>({
    showWaves: true,
    showCages: true,
    showLevels: true
  });
  
  const toggles = externalToggles || internalToggles;
  
  const handleToggle = (key: keyof ChartOverlayToggles) => {
    const newToggles = { ...toggles, [key]: !toggles[key] };
    if (onToggleChange) {
      onToggleChange(newToggles);
    } else {
      setInternalToggles(newToggles);
    }
  };

  // Get candle date range for validation
  const candleDateRange = useMemo(() => {
    if (candles.length === 0) return { min: '', max: '' };
    return {
      min: candles[0].date,
      max: candles[candles.length - 1].date
    };
  }, [candles]);

  // Get active wave points (primary or alternate)
  const activeWavePoints: WavePoint[] = useMemo(() => {
    if (!analysis) return [];
    
    if (selectedAlternateIndex !== null && 
        analysis.alternate_counts[selectedAlternateIndex]?.waves &&
        analysis.alternate_counts[selectedAlternateIndex].waves!.length > 0) {
      return analysis.alternate_counts[selectedAlternateIndex].waves!;
    }
    
    return analysis.primary_count?.waves || [];
  }, [analysis, selectedAlternateIndex]);

  // Normalize and validate wave labels
  const normalizedActiveWavePoints = useMemo(() => {
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

  // Validate data and set warnings
  useEffect(() => {
    const newWarnings: ChartWarning[] = [];
    
    if (candles.length === 0) {
      newWarnings.push({ type: 'no_candles', message: 'No candles returned from backend' });
      console.warn('[LightweightChart] No candles data');
    }
    
    if (analysis && (!analysis.primary_count?.waves || analysis.primary_count.waves.length === 0)) {
      newWarnings.push({ type: 'no_waves', message: 'No wave points in analysis' });
      console.warn('[LightweightChart] No wave points in primary_count.waves');
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
        console.warn('[LightweightChart] Wave points outside candle range:', outsideRange);
      }
    }
    
    setWarnings(newWarnings);
  }, [candles, analysis, activeWavePoints, candleDateRange]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart ONCE per mount
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

    let candleSeries: any;
    if (typeof (chart as any).addCandlestickSeries === 'function') {
      candleSeries = (chart as any).addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
    } else {
      candleSeries = (chart as any).addSeries({
        type: 'Candlestick',
      }, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    candleSeriesChartIdRef.current = myId;
    setIsReady(true);

    // Keep width in sync with container (ResizeObserver avoids window resize races)
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        if (chartRemovedRef.current) return;
        const c = chartRef.current;
        if (!c || currentChartIdRef.current !== myId) return;
        const w = container.clientWidth;
        if (w > 0) {
          c.applyOptions({ width: w });
        }
      });
      ro.observe(container);
    } catch {
      // Ignore (old browsers) - chart will still render with initial width.
    }

    return () => {
      chartRemovedRef.current = true; // Mark as removed BEFORE removing
      currentChartIdRef.current = 0;

      try {
        ro?.disconnect();
      } catch {}

      // Clear refs (avoid later effects touching stale series)
      chartRef.current = null;
      candleSeriesRef.current = null;
      waveLineSeriesRef.current = null;
      cageSeriesRefs.current = [];
      cageSeriesByKeyRef.current = {};
      levelLinesRef.current = [];
      candleSeriesChartIdRef.current = 0;

      try {
        chart.remove();
      } catch {}
    };
  }, []);

  // Apply height updates WITHOUT recreating the chart
  useEffect(() => {
    if (chartRemovedRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({ height });
  }, [height]);

  // Update candle data with BusinessDay format
  useEffect(() => {
    if (chartRemovedRef.current) return;
    if (!candleSeriesRef.current || !isReady || candles.length === 0) return;
    if (candleSeriesChartIdRef.current !== currentChartIdRef.current) return;

    const chartData = candles
      .filter(c => isValidDateStr(c.date))
      .map(c => ({
        time: toBusinessDay(c.date) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    if (chartData.length === 0) {
      console.warn('[LightweightChart] No valid candle dates after filtering');
      return;
    }

    console.log(`[LightweightChart] Setting ${chartData.length} candles`);
    candleSeriesRef.current.setData(chartData);
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, isReady]);

  // Add wave lines with BusinessDay format
  useEffect(() => {
    if (chartRemovedRef.current) return;
    if (!candleSeriesRef.current || !isReady) return;
    if (candleSeriesChartIdRef.current !== currentChartIdRef.current) return;

    const currentChartId = currentChartIdRef.current;

    // If we have a stale series (from some previous chart instance), drop it without touching chart.removeSeries
    if (waveLineSeriesRef.current && waveLineSeriesRef.current.chartId !== currentChartId) {
      waveLineSeriesRef.current = null;
    }

    // Toggle off => keep series but clear data (avoid remove/add churn)
    if (!toggles.showWaves || normalizedActiveWavePoints.length === 0) {
      if (isCurrentSeries(waveLineSeriesRef.current, currentChartId)) {
        try {
          waveLineSeriesRef.current.series.setData([]);
        } catch {}
      }
      try {
        (candleSeriesRef.current as any).setMarkers?.([]);
      } catch {}
      return;
    }

    // Filter wave points to those within candle range
    const validWavePoints = normalizedActiveWavePoints.filter(wp => 
      wp.date >= candleDateRange.min && wp.date <= candleDateRange.max
    );

    if (validWavePoints.length < 2) {
      console.warn('[LightweightChart] Less than 2 valid wave points within candle range');
      if (isCurrentSeries(waveLineSeriesRef.current, currentChartId)) {
        try {
          waveLineSeriesRef.current.series.setData([]);
        } catch {}
      }
      return;
    }

    const chart = chartRef.current;
    if (!chart) return;

    try {
      const lineColor = selectedAlternateIndex !== null ? WAVE_COLORS.alternate : WAVE_COLORS.primary;

      let lineMeta = waveLineSeriesRef.current;
      if (!isCurrentSeries(lineMeta, currentChartId)) {
        let lineSeries: any;
        if (typeof (chart as any).addLineSeries === 'function') {
          lineSeries = (chart as any).addLineSeries({
            color: lineColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
          });
        } else {
          lineSeries = (chart as any).addSeries({
            type: 'Line',
          }, {
            color: lineColor,
            lineWidth: 2,
          });
        }
        lineMeta = { series: lineSeries as ISeriesApi<'Line'>, chartId: currentChartId };
        waveLineSeriesRef.current = lineMeta;
      } else {
        // Update color when switching between primary/alternate
        try {
          (lineMeta.series as any).applyOptions?.({ color: lineColor });
        } catch {}
      }

      const lineData = validWavePoints.map(wp => ({
        time: toBusinessDay(wp.date) as Time,
        value: wp.price,
      }));

      console.log(`[LightweightChart] Drawing wave line with ${lineData.length} points`);
      lineMeta.series.setData(lineData);

      // Add markers for wave labels
      try {
        const markers = validWavePoints.map(wp => {
          const isLow = wp.price <= Math.min(...validWavePoints.map(p => p.price)) * 1.02;
          return {
            time: toBusinessDay(wp.date) as Time,
            position: isLow ? 'belowBar' : 'aboveBar',
            color: WAVE_LABEL_COLORS[wp.norm.colorKey] || '#6b7280',
            shape: 'circle',
            text: wp.norm.display,
            size: 1,
          };
        });
        (candleSeriesRef.current as any).setMarkers?.(markers);
      } catch (markerError) {
        console.warn('[LightweightChart] Could not set markers:', markerError);
      }

    } catch (e) {
      console.warn('[LightweightChart] Failed to create wave lines:', e);
    }
  }, [normalizedActiveWavePoints, isReady, selectedAlternateIndex, toggles.showWaves, candleDateRange]);

  // Draw cage lines with BusinessDay format
  useEffect(() => {
    if (chartRemovedRef.current) return;
    if (!isReady) return;

    const chart = chartRef.current;
    if (!chart) return;

    const currentChartId = currentChartIdRef.current;

    // Drop any stale cage series refs (from previous chart instances)
    if (cageSeriesRefs.current.some(m => m.chartId !== currentChartId)) {
      cageSeriesRefs.current = [];
      cageSeriesByKeyRef.current = {};
    }

    if (!toggles.showCages || !analysis?.cage_features) {
      console.log('[LightweightChart] Cages toggle off or no cage_features');

      // Toggle off => clear all cage data but keep series instances
      cageSeriesRefs.current.forEach(meta => {
        if (meta.chartId !== currentChartId) return;
        try {
          meta.series.setData([]);
        } catch {}
      });
      return;
    }

    const cageFeatures = analysis.cage_features;

    const getOrCreateCageSeries = (key: string, color: string, isBroken: boolean) => {
      const existing = cageSeriesByKeyRef.current[key];
      if (existing && existing.chartId === currentChartId) {
        // Update style as broken/unbroken changes
        try {
          (existing.series as any).applyOptions?.({
            color: isBroken ? `${color}60` : color,
            lineWidth: isBroken ? 1 : 2,
            lineStyle: isBroken ? LineStyle.Dotted : LineStyle.Dashed,
          });
        } catch {}
        return existing;
      }

      let s: any;
      if (typeof (chart as any).addLineSeries === 'function') {
        s = (chart as any).addLineSeries({
          color: isBroken ? `${color}60` : color,
          lineWidth: isBroken ? 1 : 2,
          lineStyle: isBroken ? LineStyle.Dotted : LineStyle.Dashed,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else {
        s = (chart as any).addSeries({ type: 'Line' }, {
          color: isBroken ? `${color}60` : color,
          lineWidth: isBroken ? 1 : 2,
        });
      }

      const meta: SeriesWithChartId<ISeriesApi<'Line'>> = { series: s as ISeriesApi<'Line'>, chartId: currentChartId };
      cageSeriesByKeyRef.current[key] = meta;
      cageSeriesRefs.current.push(meta);
      return meta;
    };

    const drawCageFromPoints = (
      upperPoints: Array<{ date: string; value: number }> | undefined,
      lowerPoints: Array<{ date: string; value: number }> | undefined,
      color: string,
      isBroken: boolean,
      cageLabel: string
    ) => {
      if (!upperPoints || !lowerPoints || upperPoints.length < 2 || lowerPoints.length < 2) {
        console.warn(`[LightweightChart] ${cageLabel} cage missing points`);
        return;
      }
      
      // Validate dates
      const allDates = [...upperPoints, ...lowerPoints].map(p => p.date);
      if (!allDates.every(d => isValidDateStr(d))) {
        console.warn(`[LightweightChart] ${cageLabel} cage has invalid dates`);
        return;
      }
      
      if (chartRemovedRef.current) return;

      try {
        const lowerMeta = getOrCreateCageSeries(`${cageLabel}-lower`, color, isBroken);
        lowerMeta.series.setData([
          { time: toBusinessDay(lowerPoints[0].date) as Time, value: lowerPoints[0].value },
          { time: toBusinessDay(lowerPoints[1].date) as Time, value: lowerPoints[1].value },
        ]);

        const upperMeta = getOrCreateCageSeries(`${cageLabel}-upper`, color, isBroken);
        upperMeta.series.setData([
          { time: toBusinessDay(upperPoints[0].date) as Time, value: upperPoints[0].value },
          { time: toBusinessDay(upperPoints[1].date) as Time, value: upperPoints[1].value },
        ]);

        console.log(`[LightweightChart] Drew ${cageLabel} cage (broken: ${isBroken})`);
      } catch (e) {
        console.warn(`[LightweightChart] Failed to draw ${cageLabel} cage:`, e);
      }
    };

    const expectedKeys = new Set<string>();

    // Draw cage_2_4
    if (cageFeatures.cage_2_4?.exists) {
      expectedKeys.add('2-4-lower');
      expectedKeys.add('2-4-upper');
      drawCageFromPoints(
        cageFeatures.cage_2_4.upper_points,
        cageFeatures.cage_2_4.lower_points,
        '#f59e0b',
        cageFeatures.cage_2_4.broken || false,
        '2-4'
      );
    }

    // Draw cage_ACB
    if (cageFeatures.cage_ACB?.exists) {
      const acbBroken = cageFeatures.cage_ACB.broken_up || cageFeatures.cage_ACB.broken_down || false;
      expectedKeys.add('ACB-lower');
      expectedKeys.add('ACB-upper');
      drawCageFromPoints(
        cageFeatures.cage_ACB.upper_points,
        cageFeatures.cage_ACB.lower_points,
        '#06b6d4',
        acbBroken,
        'ACB'
      );
    }

    // Draw wedge_cage
    if (cageFeatures.wedge_cage?.exists) {
      expectedKeys.add('Wedge-lower');
      expectedKeys.add('Wedge-upper');
      drawCageFromPoints(
        cageFeatures.wedge_cage.upper_points,
        cageFeatures.wedge_cage.lower_points,
        '#a855f7',
        cageFeatures.wedge_cage.broken || false,
        'Wedge'
      );
    }

    // Any previously-created cage series that is no longer relevant gets cleared (not removed)
    Object.entries(cageSeriesByKeyRef.current).forEach(([key, meta]) => {
      if (meta.chartId !== currentChartId) return;
      if (!expectedKeys.has(key)) {
        try {
          meta.series.setData([]);
        } catch {}
      }
    });
  }, [analysis?.cage_features, isReady, toggles.showCages]);

  // Add price lines for key levels
  useEffect(() => {
    if (chartRemovedRef.current) return;
    if (!candleSeriesRef.current || !isReady) return;
    if (candleSeriesChartIdRef.current !== currentChartIdRef.current) return;

    const series = candleSeriesRef.current;

    levelLinesRef.current.forEach(line => {
      try {
        series.removePriceLine(line);
      } catch (e) {}
    });
    levelLinesRef.current = [];

    if (!toggles.showLevels || !analysis?.key_levels) {
      console.log('[LightweightChart] Levels toggle off or no key_levels');
      return;
    }

    const keyLevels = analysis.key_levels;
    
    // Support levels
    if (Array.isArray(keyLevels.support)) {
      keyLevels.support.forEach((level, idx) => {
        if (typeof level === 'number' && !isNaN(level)) {
          try {
            const priceLine = series.createPriceLine({
              price: level,
              color: '#22c55e',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `S${idx + 1}`,
            });
            levelLinesRef.current.push(priceLine);
          } catch (e) {}
        }
      });
    }

    // Resistance levels
    if (Array.isArray(keyLevels.resistance)) {
      keyLevels.resistance.forEach((level, idx) => {
        if (typeof level === 'number' && !isNaN(level)) {
          try {
            const priceLine = series.createPriceLine({
              price: level,
              color: '#ef4444',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `R${idx + 1}`,
            });
            levelLinesRef.current.push(priceLine);
          } catch (e) {}
        }
      });
    }

    // Invalidation level (prominent)
    if (typeof keyLevels.invalidation === 'number' && !isNaN(keyLevels.invalidation)) {
      try {
        const priceLine = series.createPriceLine({
          price: keyLevels.invalidation,
          color: '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: 'INV',
        });
        levelLinesRef.current.push(priceLine);
        console.log(`[LightweightChart] Drew invalidation line at ${keyLevels.invalidation}`);
      } catch (e) {
        console.warn('[LightweightChart] Failed to draw invalidation line:', e);
      }
    } else {
      console.warn('[LightweightChart] No valid invalidation level:', keyLevels.invalidation);
    }
  }, [analysis?.key_levels, isReady, toggles.showLevels]);

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
        {analysis?.status && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            analysis.status === 'conclusive' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {analysis.status}
          </span>
        )}
        {selectedAlternateIndex !== null && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            Alt #{selectedAlternateIndex + 1}
          </span>
        )}
        
        <div className="h-4 w-px bg-border/50" />
        
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
        
        <div className="flex items-center gap-1">
          <Switch
            id="toggle-cages"
            checked={toggles.showCages}
            onCheckedChange={() => handleToggle('showCages')}
            className="h-4 w-7"
          />
          <Label htmlFor="toggle-cages" className="text-xs flex items-center gap-1 cursor-pointer">
            <Grid3X3 className="h-3 w-3 text-amber-400" />
            <span className="hidden sm:inline">Cages</span>
          </Label>
        </div>
        
        <div className="flex items-center gap-1">
          <Switch
            id="toggle-levels"
            checked={toggles.showLevels}
            onCheckedChange={() => handleToggle('showLevels')}
            className="h-4 w-7"
          />
          <Label htmlFor="toggle-levels" className="text-xs flex items-center gap-1 cursor-pointer">
            <Target className="h-3 w-3 text-green-400" />
            <span className="hidden sm:inline">Levels</span>
          </Label>
        </div>
      </div>

      {/* Wave Legend */}
      {toggles.showWaves && normalizedActiveWavePoints.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-border/50">
          <span className="text-muted-foreground">Waves:</span>
          {normalizedActiveWavePoints.slice(-8).map((wp, idx) => {
            const color = WAVE_LABEL_COLORS[wp.norm.colorKey] || '#6b7280';
            return (
              <span 
                key={`${wp.norm.display}-${idx}`}
                className="px-1.5 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${color}20`,
                  color: color,
                }}
                title={`${wp.wave} @ ${wp.price.toFixed(2)}`}
              >
                {wp.norm.display}
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
