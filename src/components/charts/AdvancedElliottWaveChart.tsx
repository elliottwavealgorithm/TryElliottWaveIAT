import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from 'recharts';

interface WaveData {
  wave: string;
  start_price: number;
  end_price: number;
  start_date: string;
  end_date: string;
  degree?: string;
}

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartData {
  waves: WaveData[];
  key_levels: {
    support: number[];
    resistance: number[];
    invalidation: number;
  };
  scenarios?: Array<{
    label: string;
    price: number;
  }>;
}

interface AdvancedElliottWaveChartProps {
  data: ChartData;
  symbol: string;
  candles?: Candle[];
}

export function AdvancedElliottWaveChart({ data, symbol, candles }: AdvancedElliottWaveChartProps) {
  if (!data?.waves) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No hay datos de ondas para mostrar</p>
      </div>
    );
  }

  // Merge candle data with wave points
  const chartData: any[] = [];
  
  // If we have candles, use them as the base
  if (candles && candles.length > 0) {
    candles.forEach(candle => {
      chartData.push({
        date: candle.date,
        candleHigh: candle.high,
        candleLow: candle.low,
        candleOpen: candle.open,
        candleClose: candle.close,
        timestamp: new Date(candle.date).getTime()
      });
    });
  }

  // Create wave line points
  const wavePoints: any[] = [];
  data.waves.forEach((wave) => {
    wavePoints.push({
      date: wave.start_date,
      wavePrice: wave.start_price,
      wave: wave.wave,
      label: `Onda ${wave.wave} Inicio`,
      degree: wave.degree || 'Supercycle',
      timestamp: new Date(wave.start_date).getTime()
    });
    
    wavePoints.push({
      date: wave.end_date,
      wavePrice: wave.end_price,
      wave: wave.wave,
      label: `Onda ${wave.wave} Fin`,
      degree: wave.degree || 'Supercycle',
      timestamp: new Date(wave.end_date).getTime()
    });
  });

  // Merge wave points into chart data
  wavePoints.forEach(wp => {
    const existing = chartData.find(cd => cd.date === wp.date);
    if (existing) {
      existing.wavePrice = wp.wavePrice;
      existing.wave = wp.wave;
      existing.label = wp.label;
      existing.degree = wp.degree;
    } else {
      chartData.push(wp);
    }
  });

  // Sort by timestamp
  chartData.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate price range
  const allPrices = chartData.flatMap(d => [
    d.candleHigh, 
    d.candleLow, 
    d.wavePrice
  ].filter(p => p != null));
  
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) * 0.95 : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) * 1.05 : 100;

  const getDegreeColor = (degree?: string) => {
    switch(degree) {
      case 'Supercycle': return '#8b5cf6';
      case 'Cycle': return '#3b82f6';
      case 'Primary': return '#10b981';
      case 'Intermediate': return '#f59e0b';
      default: return '#8b5cf6';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{data.date}</p>
        {data.candleClose && (
          <div className="space-y-1">
            <p className="text-xs"><span className="font-medium">O:</span> ${data.candleOpen?.toFixed(2)}</p>
            <p className="text-xs"><span className="font-medium">H:</span> ${data.candleHigh?.toFixed(2)}</p>
            <p className="text-xs"><span className="font-medium">L:</span> ${data.candleLow?.toFixed(2)}</p>
            <p className="text-xs"><span className="font-medium">C:</span> ${data.candleClose?.toFixed(2)}</p>
          </div>
        )}
        {data.wavePrice && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs font-medium">{data.label}</p>
            <p className="text-xs">Precio: ${data.wavePrice?.toFixed(2)}</p>
            {data.degree && <p className="text-xs text-muted-foreground">{data.degree}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">
          Conteo Elliott Wave - {symbol}
        </h4>
      </div>

      <div className="w-full h-96 bg-background border rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Candles as Area */}
            {candles && candles.length > 0 && (
              <>
                <Area 
                  type="monotone" 
                  dataKey="candleHigh" 
                  stroke="hsl(var(--muted-foreground) / 0.5)"
                  fill="hsl(var(--muted) / 0.2)"
                  strokeWidth={0.5}
                />
                <Area 
                  type="monotone" 
                  dataKey="candleLow" 
                  stroke="hsl(var(--muted-foreground) / 0.5)"
                  fill="hsl(var(--background))"
                  strokeWidth={0.5}
                />
              </>
            )}
            
            {/* Elliott Wave Line */}
            <Line 
              type="linear" 
              dataKey="wavePrice" 
              stroke={getDegreeColor(data.waves[0]?.degree)}
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload.wavePrice) return null;
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={getDegreeColor(payload.degree)}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                    <text 
                      x={cx} 
                      y={cy - 12} 
                      textAnchor="middle" 
                      fontSize="11" 
                      fontWeight="bold"
                      fill={getDegreeColor(payload.degree)}
                    >
                      {payload.wave}
                    </text>
                  </g>
                );
              }}
              connectNulls
            />

            {/* Support Lines */}
            {data.key_levels.support?.map((level, idx) => (
              <ReferenceLine 
                key={`support-${idx}`}
                y={level} 
                stroke="#10b981" 
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: `Soporte: $${level.toFixed(2)}`, position: 'left', fill: '#10b981', fontSize: 10 }}
              />
            ))}

            {/* Resistance Lines */}
            {data.key_levels.resistance?.map((level, idx) => (
              <ReferenceLine 
                key={`resistance-${idx}`}
                y={level} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: `Resistencia: $${level.toFixed(2)}`, position: 'right', fill: '#ef4444', fontSize: 10 }}
              />
            ))}

            {/* Invalidation Line */}
            {data.key_levels.invalidation && (
              <ReferenceLine 
                y={data.key_levels.invalidation} 
                stroke="#f59e0b" 
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{ value: `Invalidación: $${data.key_levels.invalidation.toFixed(2)}`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 10 }}
              />
            )}

            {/* Scenario Lines */}
            {data.scenarios?.map((scenario, idx) => (
              <ReferenceLine 
                key={`scenario-${idx}`}
                y={scenario.price} 
                stroke="#8b5cf6" 
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{ value: scenario.label, position: 'insideTopRight', fill: '#8b5cf6', fontSize: 9 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getDegreeColor(data.waves[0]?.degree) }}></div>
          <span className="text-muted-foreground">Ondas Elliott</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#10b981]" style={{borderTop: '1.5px dashed #10b981'}}></div>
          <span className="text-muted-foreground">Soporte</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#ef4444]" style={{borderTop: '1.5px dashed #ef4444'}}></div>
          <span className="text-muted-foreground">Resistencia</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#f59e0b]" style={{borderTop: '2px dashed #f59e0b'}}></div>
          <span className="text-muted-foreground">Invalidación</span>
        </div>
        {candles && candles.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted/40 border border-muted-foreground/50"></div>
            <span className="text-muted-foreground">Precio (velas)</span>
          </div>
        )}
      </div>
    </div>
  );
}
