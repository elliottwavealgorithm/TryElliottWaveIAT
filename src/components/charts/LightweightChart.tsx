import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, LineStyle } from 'lightweight-charts';
import { Candle, ElliottAnalysisResult, WavePoint } from '@/types/analysis';

// Marker type for wave labels (v5 uses different API)
interface WaveMarker {
  time: Time;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
  size: number;
}

interface NormalizedWaveLabel {
  raw: string;
  degree: string | null;
  waveNum: number | null;
  waveABC: 'A' | 'B' | 'C' | null;
  colorKey: string;
  display: string;
}

interface LightweightChartProps {
  candles: Candle[];
  symbol: string;
  analysis?: ElliottAnalysisResult | null;
  selectedAlternateIndex?: number | null;
  height?: number;
}

// Wave colors by type
const WAVE_COLORS = {
  impulse: '#3b82f6', // blue
  correction: '#f97316', // orange
  primary: '#22c55e', // green for primary count lines
  alternate: '#a855f7', // purple for alternate
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

  // Extract degree if present
  const degreeKeywords = ['supercycle', 'cycle', 'primary', 'intermediate', 'minor', 'minute'];
  for (const deg of degreeKeywords) {
    if (lower.includes(deg)) {
      result.degree = deg.charAt(0).toUpperCase() + deg.slice(1);
      break;
    }
  }

  // Try Arabic digit 1-5 with word boundary to avoid matching digits inside numbers
  const arabicMatch = raw.match(/\b([1-5])\b/);
  if (arabicMatch) {
    result.waveNum = parseInt(arabicMatch[1], 10);
    result.colorKey = arabicMatch[1];
  }

  // Try Roman numerals if no Arabic found (case-insensitive, convert to upper for mapping)
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

  // Check for correction letters A, B, C
  const abcMatch = upper.match(/\b([ABC])\b|\(([ABC])\)/);
  if (abcMatch) {
    const letter = (abcMatch[1] || abcMatch[2]) as 'A' | 'B' | 'C';
    result.waveABC = letter;
    if (!result.waveNum) {
      result.colorKey = letter;
    }
  }

  // Check for W, X, Y
  if (!result.waveNum && !result.waveABC) {
    const wxyMatch = upper.match(/\b([WXY])\b/);
    if (wxyMatch) {
      result.colorKey = wxyMatch[1];
    }
  }

  // Build compact display
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

function isImpulseWave(wave: string): boolean {
  const norm = normalizeWaveLabel(wave);
  return norm.waveNum !== null && [1, 2, 3, 4, 5].includes(norm.waveNum);
}

// Degree priority: more granular = higher priority for tie-breaking
const DEGREE_PRIORITY: Record<string, number> = {
  'Minute': 6,
  'Minor': 5,
  'Intermediate': 4,
  'Primary': 3,
  'Cycle': 2,
  'Supercycle': 1,
};

function findDominantDegree(points: { norm: NormalizedWaveLabel }[]): string | null {
  // Only consider last 7 wave points for recency weighting
  const recentPoints = points.slice(-7);
  
  const degreeCounts: Record<string, number> = {};
  for (const p of recentPoints) {
    if (p.norm.degree) {
      degreeCounts[p.norm.degree] = (degreeCounts[p.norm.degree] || 0) + 1;
    }
  }
  
  if (Object.keys(degreeCounts).length === 0) {
    return null;
  }
  
  // Find max count
  const maxCount = Math.max(...Object.values(degreeCounts));
  
  // Get all degrees with max count (potential ties)
  const topDegrees = Object.entries(degreeCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([deg]) => deg);
  
  if (topDegrees.length === 1) {
    return topDegrees[0];
  }
  
  // Break tie: prefer more granular degree (higher priority number)
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

export function LightweightChart({ 
  candles, 
  symbol, 
  analysis,
  selectedAlternateIndex = null,
  height = 500 
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const waveLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cageSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Get active wave points (primary or alternate)
  const activeWavePoints: WavePoint[] = useMemo(() => {
    if (!analysis) return [];
    
    // If alternate selected and has wave data, use alternate waves
    if (selectedAlternateIndex !== null && 
        analysis.alternate_counts[selectedAlternateIndex]?.waves &&
        analysis.alternate_counts[selectedAlternateIndex].waves!.length > 0) {
      return analysis.alternate_counts[selectedAlternateIndex].waves!;
    }
    
    // Default to primary count waves
    return analysis.primary_count?.waves || [];
  }, [analysis, selectedAlternateIndex]);

  // Normalize wave labels for matching and display
  const normalizedActiveWavePoints = useMemo(() => {
    return activeWavePoints.map(wp => ({
      ...wp,
      norm: normalizeWaveLabel(wp.wave),
    }));
  }, [activeWavePoints]);

  // Find dominant degree for cage matching
  const dominantDegree = useMemo(() => {
    return findDominantDegree(normalizedActiveWavePoints);
  }, [normalizedActiveWavePoints]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
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
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        mode: 1,
      },
    });

    // Create candlestick series (v4 API with fallback)
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
    setIsReady(true);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      waveLineSeriesRef.current = null;
      cageSeriesRefs.current = [];
    };
  }, [height]);

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !isReady || candles.length === 0) return;

    const chartData = candles.map(c => ({
      time: c.date as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(chartData);
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, isReady]);

  // Add wave markers and lines
  useEffect(() => {
    if (!candleSeriesRef.current || !isReady || !chartRef.current) return;

    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;

    // Clear previous wave line series
    if (waveLineSeriesRef.current) {
      try {
        chart.removeSeries(waveLineSeriesRef.current);
      } catch (e) {}
      waveLineSeriesRef.current = null;
    }

    // Clear previous cage lines
    cageSeriesRefs.current.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch (e) {}
    });
    cageSeriesRefs.current = [];

    if (!activeWavePoints || activeWavePoints.length === 0) {
      return;
    }

    // Note: lightweight-charts v5 removed setMarkers from candlestick series
    // Wave labels are now shown via the line series connecting wave points
    // and the legend in the top-right corner

    // Create line series connecting wave points
    if (activeWavePoints.length >= 2) {
      try {
        const lineColor = selectedAlternateIndex !== null ? WAVE_COLORS.alternate : WAVE_COLORS.primary;
        
        let lineSeries: any;
        if (typeof (chart as any).addLineSeries === 'function') {
          lineSeries = (chart as any).addLineSeries({
            color: lineColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: false,
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

        const lineData = activeWavePoints.map(wp => ({
          time: wp.date as Time,
          value: wp.price,
        }));

        lineSeries.setData(lineData);
        waveLineSeriesRef.current = lineSeries;
      } catch (e) {
        console.warn('Failed to create wave lines:', e);
      }
    }
  }, [activeWavePoints, isReady, selectedAlternateIndex]);

  // Draw cage lines using backend-provided pre-computed points
  useEffect(() => {
    if (!chartRef.current || !isReady) return;

    const chart = chartRef.current;

    // Always clear previous cage lines first
    cageSeriesRefs.current.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch (e) {}
    });
    cageSeriesRefs.current = [];

    // Exit if no cage features
    if (!analysis?.cage_features) return;

    const cageFeatures = analysis.cage_features;

    // Helper to create a line series with proper styling
    const createLineSeries = (color: string, isBroken: boolean): any => {
      if (typeof (chart as any).addLineSeries === 'function') {
        return (chart as any).addLineSeries({
          color: isBroken ? `${color}60` : color, // More opacity reduction if broken
          lineWidth: isBroken ? 1 : 2,
          lineStyle: isBroken ? LineStyle.Dotted : LineStyle.Dashed,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else {
        return (chart as any).addSeries({ type: 'Line' }, {
          color: isBroken ? `${color}60` : color,
          lineWidth: isBroken ? 1 : 2,
          lineStyle: isBroken ? LineStyle.Dotted : LineStyle.Dashed,
        });
      }
    };

    // Helper to draw a cage using pre-computed points
    const drawCageFromPoints = (
      upperPoints: Array<{ date: string; value: number }> | undefined,
      lowerPoints: Array<{ date: string; value: number }> | undefined,
      color: string,
      isBroken: boolean,
      breakDirection?: 'up' | 'down',
      breakDate?: string | null,
      breakPrice?: number | null,
      cageLabel?: string
    ) => {
      if (!upperPoints || !lowerPoints || upperPoints.length < 2 || lowerPoints.length < 2) return;
      
      try {
        // Draw lower line
        const lowerSeries = createLineSeries(color, isBroken);
        lowerSeries.setData([
          { time: lowerPoints[0].date as Time, value: lowerPoints[0].value },
          { time: lowerPoints[1].date as Time, value: lowerPoints[1].value },
        ]);
        cageSeriesRefs.current.push(lowerSeries);
        
        // Draw upper line
        const upperSeries = createLineSeries(color, isBroken);
        upperSeries.setData([
          { time: upperPoints[0].date as Time, value: upperPoints[0].value },
          { time: upperPoints[1].date as Time, value: upperPoints[1].value },
        ]);
        cageSeriesRefs.current.push(upperSeries);
        
        // Draw break marker if broken and we have the date
        if (isBroken && breakDate && candleSeriesRef.current) {
          const breakCandle = candles.find(c => c.date === breakDate);
          if (breakCandle) {
            const markerPrice = breakPrice ?? breakCandle.close;
            const position = breakDirection === 'up' ? 'aboveBar' : 'belowBar';
            const shape = breakDirection === 'up' ? 'arrowUp' : 'arrowDown';
            const markerColor = breakDirection === 'up' ? '#22c55e' : '#ef4444';
            
            // Add marker to candlestick series if supported
            try {
              const markers = [{
                time: breakDate as Time,
                position: position as 'aboveBar' | 'belowBar',
                color: markerColor,
                shape: shape as 'arrowUp' | 'arrowDown',
                text: `${cageLabel || 'Cage'} break`,
                size: 1,
              }];
              
              // Get existing markers and append
              const existingMarkers = (candleSeriesRef.current as any).markers?.() || [];
              (candleSeriesRef.current as any).setMarkers?.([...existingMarkers, ...markers]);
            } catch (markerError) {
              // Fallback: draw a vertical line at break point
              let breakMarker: any;
              if (typeof (chart as any).addLineSeries === 'function') {
                breakMarker = (chart as any).addLineSeries({
                  color: markerColor,
                  lineWidth: 2,
                  lineStyle: LineStyle.Solid,
                  crosshairMarkerVisible: false,
                  lastValueVisible: false,
                  priceLineVisible: false,
                });
              } else {
                breakMarker = (chart as any).addSeries({ type: 'Line' }, {
                  color: markerColor,
                  lineWidth: 2,
                });
              }
              breakMarker.setData([
                { time: breakCandle.date as Time, value: breakCandle.low * 0.995 },
                { time: breakCandle.date as Time, value: breakCandle.high * 1.005 },
              ]);
              cageSeriesRefs.current.push(breakMarker);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to draw cage lines:', e);
      }
    };

    // Draw cage_2_4 using pre-computed points
    if (cageFeatures.cage_2_4?.exists && cageFeatures.cage_2_4?.upper_points && cageFeatures.cage_2_4?.lower_points) {
      drawCageFromPoints(
        cageFeatures.cage_2_4.upper_points,
        cageFeatures.cage_2_4.lower_points,
        '#f59e0b', // amber
        cageFeatures.cage_2_4.broken || false,
        cageFeatures.cage_2_4.break_direction,
        cageFeatures.cage_2_4.break_date,
        undefined, // break_price not on cage_2_4 directly, would need to get from break_info
        '2-4'
      );
    }

    // Draw cage_ACB
    if (cageFeatures.cage_ACB?.exists && cageFeatures.cage_ACB?.upper_points && cageFeatures.cage_ACB?.lower_points) {
      const acbBroken = cageFeatures.cage_ACB.broken_up || cageFeatures.cage_ACB.broken_down || false;
      const acbDirection = cageFeatures.cage_ACB.broken_up ? 'up' : cageFeatures.cage_ACB.broken_down ? 'down' : undefined;
      drawCageFromPoints(
        cageFeatures.cage_ACB.upper_points,
        cageFeatures.cage_ACB.lower_points,
        '#06b6d4', // cyan
        acbBroken,
        acbDirection,
        cageFeatures.cage_ACB.break_date,
        undefined,
        'ACB'
      );
    }

    // Draw wedge_cage
    if (cageFeatures.wedge_cage?.exists && cageFeatures.wedge_cage?.upper_points && cageFeatures.wedge_cage?.lower_points) {
      drawCageFromPoints(
        cageFeatures.wedge_cage.upper_points,
        cageFeatures.wedge_cage.lower_points,
        '#a855f7', // purple
        cageFeatures.wedge_cage.broken || false,
        undefined, // wedge doesn't have break_direction in same format
        cageFeatures.wedge_cage.break_date,
        undefined,
        'Wedge'
      );
    }
  }, [analysis?.cage_features, candles, isReady]);

  // Add price lines for key levels
  useEffect(() => {
    if (!candleSeriesRef.current || !isReady || !analysis?.key_levels) return;

    const series = candleSeriesRef.current;

    // Remove existing price lines by creating new ones
    // (Lightweight Charts doesn't have a clean way to remove specific price lines)
    
    analysis.key_levels.support?.forEach(level => {
      try {
        series.createPriceLine({
          price: level,
          color: '#22c55e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'S',
        });
      } catch (e) {}
    });

    analysis.key_levels.resistance?.forEach(level => {
      try {
        series.createPriceLine({
          price: level,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'R',
        });
      } catch (e) {}
    });

    if (analysis.key_levels.invalidation) {
      try {
        series.createPriceLine({
          price: analysis.key_levels.invalidation,
          color: '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: 'INV',
        });
      } catch (e) {}
    }
  }, [analysis?.key_levels, isReady]);

  return (
    <div className="relative w-full">
      {/* Chart Header */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className="text-lg font-bold text-foreground">{symbol}</span>
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
      </div>

      {/* Legend */}
      {normalizedActiveWavePoints.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Waves:</span>
          {normalizedActiveWavePoints.map((wp, idx) => {
            const color = WAVE_LABEL_COLORS[wp.norm.colorKey] || '#6b7280';
            return (
              <span 
                key={`${wp.norm.display}-${idx}`}
                className="px-1.5 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${color}20`,
                  color: color,
                }}
                title={wp.wave}
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
        style={{ height }}
      />
    </div>
  );
}
