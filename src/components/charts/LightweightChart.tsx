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

function isImpulseWave(wave: string): boolean {
  return ['1', '2', '3', '4', '5'].includes(wave);
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
    
    // If alternate selected and has wave data (check if alternate has waves)
    if (selectedAlternateIndex !== null && analysis.alternate_counts[selectedAlternateIndex]) {
      // Alternates typically don't have full wave points in this schema
      // Fall back to primary
      return analysis.primary_count?.waves || [];
    }
    
    return analysis.primary_count?.waves || [];
  }, [analysis, selectedAlternateIndex]);

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

  // Add cage lines
  useEffect(() => {
    if (!chartRef.current || !isReady || !analysis?.cage_features) return;

    const chart = chartRef.current;
    const cageFeatures = analysis.cage_features;

    // Clear previous cage lines
    cageSeriesRefs.current.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch (e) {}
    });
    cageSeriesRefs.current = [];

    // Draw cage 2-4 if exists and not broken
    if (cageFeatures.cage_2_4?.exists && !cageFeatures.cage_2_4?.broken) {
      // We need at least 2 wave points to draw cage
      const w2 = activeWavePoints.find(wp => wp.wave === '2');
      const w4 = activeWavePoints.find(wp => wp.wave === '4');
      
      if (w2 && w4) {
        try {
          // Lower cage line (through wave 2 and 4)
          let lowerLine: any;
          if (typeof (chart as any).addLineSeries === 'function') {
            lowerLine = (chart as any).addLineSeries({
              color: '#f59e0b',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              priceLineVisible: false,
            });
          } else {
            lowerLine = (chart as any).addSeries({ type: 'Line' }, {
              color: '#f59e0b',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
            });
          }

          lowerLine.setData([
            { time: w2.date as Time, value: w2.price },
            { time: w4.date as Time, value: w4.price },
          ]);
          cageSeriesRefs.current.push(lowerLine);

          // Upper cage line (parallel through wave 3)
          const w3 = activeWavePoints.find(wp => wp.wave === '3');
          if (w3) {
            // Calculate parallel line
            const slope = (w4.price - w2.price) / (new Date(w4.date).getTime() - new Date(w2.date).getTime());
            const upperPrice2 = w3.price + slope * (new Date(w2.date).getTime() - new Date(w3.date).getTime());
            const upperPrice4 = w3.price + slope * (new Date(w4.date).getTime() - new Date(w3.date).getTime());
            
            let upperLine: any;
            if (typeof (chart as any).addLineSeries === 'function') {
              upperLine = (chart as any).addLineSeries({
                color: '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                crosshairMarkerVisible: false,
                lastValueVisible: false,
                priceLineVisible: false,
              });
            } else {
              upperLine = (chart as any).addSeries({ type: 'Line' }, {
                color: '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
              });
            }

            upperLine.setData([
              { time: w2.date as Time, value: upperPrice2 },
              { time: w4.date as Time, value: upperPrice4 },
            ]);
            cageSeriesRefs.current.push(upperLine);
          }
        } catch (e) {
          console.warn('Failed to draw cage lines:', e);
        }
      }
    }
  }, [analysis?.cage_features, activeWavePoints, isReady]);

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
      {activeWavePoints.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Waves:</span>
          {activeWavePoints.map(wp => (
            <span 
              key={wp.wave} 
              className="px-1.5 py-0.5 rounded"
              style={{ 
                backgroundColor: `${WAVE_LABEL_COLORS[wp.wave]}20`,
                color: WAVE_LABEL_COLORS[wp.wave] 
              }}
            >
              {wp.wave}
            </span>
          ))}
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
