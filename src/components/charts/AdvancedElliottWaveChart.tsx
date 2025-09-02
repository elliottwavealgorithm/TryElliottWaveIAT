import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';

interface WaveData {
  wave: string;
  start_price: number;
  end_price: number;
  start_date: string;
  end_date: string;
  degree?: 'Primary' | 'Intermediate' | 'Minor';
}

interface ChartData {
  waves: WaveData[];
  key_levels: {
    support: number[];
    resistance: number[];
    invalidation: number;
  };
  scenarios?: {
    name: string;
    probability: number;
    target: number;
    color: string;
  }[];
}

interface AdvancedElliottWaveChartProps {
  data: ChartData;
  symbol: string;
}

export function AdvancedElliottWaveChart({ data, symbol }: AdvancedElliottWaveChartProps) {
  if (!data?.waves) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No hay datos de ondas para mostrar</p>
      </div>
    );
  }

  // Convert wave data to chart format - create a continuous line
  const chartData: any[] = [];
  
  data.waves.forEach((wave, index) => {
    // Add start point
    chartData.push({
      date: wave.start_date,
      price: wave.start_price,
      wave: wave.wave,
      degree: wave.degree || 'Minor',
      label: `Wave ${wave.wave} Start`,
      timestamp: new Date(wave.start_date).getTime()
    });
    
    // Add end point
    chartData.push({
      date: wave.end_date,
      price: wave.end_price,
      wave: wave.wave,
      degree: wave.degree || 'Minor',
      label: `Wave ${wave.wave} End`,
      timestamp: new Date(wave.end_date).getTime()
    });
  });

  // Sort by timestamp
  chartData.sort((a, b) => a.timestamp - b.timestamp);

  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) * 0.95 : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) * 1.05 : 100;

  // Get degree colors
  const getDegreeColor = (degree: string) => {
    switch (degree) {
      case 'Primary': return '#ef4444';
      case 'Intermediate': return '#3b82f6';
      case 'Minor': return '#10b981';
      default: return '#10b981';
    }
  };

  // Get degree symbol
  const getDegreeSymbol = (degree: string, wave: string) => {
    switch (degree) {
      case 'Primary': return ['①', '②', '③', '④', '⑤'][parseInt(wave) - 1] || wave;
      case 'Intermediate': return `(${wave})`;
      case 'Minor': return wave;
      default: return wave;
    }
  };

  // Custom dot renderer for wave labels
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;

    const symbol = getDegreeSymbol(payload.degree, payload.wave);
    const color = getDegreeColor(payload.degree);

    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
        <text 
          x={cx} 
          y={cy - 15} 
          textAnchor="middle" 
          fontSize="12" 
          fontWeight="bold"
          fill={color}
        >
          {symbol}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">
          Análisis Elliott Wave - {symbol}
        </h4>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
            Conteo Principal
          </span>
          <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
            Escenarios
          </span>
        </div>
      </div>

      <div className="w-full h-96 bg-background border rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120, 113, 108, 0.2)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'rgb(120, 113, 108)' }}
              interval="preserveStartEnd"
              axisLine={{ stroke: 'rgba(120, 113, 108, 0.2)' }}
            />
            <YAxis 
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: 'rgb(120, 113, 108)' }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              axisLine={{ stroke: 'rgba(120, 113, 108, 0.2)' }}
            />
            <Tooltip 
              labelFormatter={(label) => `Fecha: ${label}`}
              formatter={(value: any, name) => [
                `$${Number(value).toFixed(2)}`, 
                name === 'price' ? 'Precio' : name
              ]}
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(120, 113, 108, 0.2)',
                borderRadius: '8px',
                color: 'white'
              }}
            />
            
            {/* Support levels */}
            {data.key_levels.support?.map((level, index) => (
              <ReferenceLine 
                key={`support-${index}`}
                y={level} 
                stroke="rgba(34, 197, 94, 0.7)" 
                strokeDasharray="5 5"
                label={{ value: `Soporte ${index + 1}`, position: "insideTopRight" }}
              />
            ))}
            
            {/* Resistance levels */}
            {data.key_levels.resistance?.map((level, index) => (
              <ReferenceLine 
                key={`resistance-${index}`}
                y={level} 
                stroke="rgba(239, 68, 68, 0.7)" 
                strokeDasharray="5 5"
                label={{ value: `Resistencia ${index + 1}`, position: "insideTopRight" }}
              />
            ))}
            
            {/* Invalidation level */}
            {data.key_levels.invalidation && (
              <ReferenceLine 
                y={data.key_levels.invalidation} 
                stroke="rgba(251, 191, 36, 0.8)" 
                strokeDasharray="10 5"
                label={{ value: "Invalidación", position: "insideTopRight" }}
              />
            )}
            
            {/* Scenario projections */}
            {data.scenarios?.map((scenario, index) => (
              <ReferenceLine 
                key={`scenario-${index}`}
                y={scenario.target} 
                stroke={scenario.color} 
                strokeDasharray="2 2"
                label={{ value: `${scenario.name} (${scenario.probability}%)`, position: "insideTopRight" }}
              />
            ))}
            
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={<CustomDot />}
              activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-2">
          <h5 className="font-medium text-green-400">📈 Niveles de Soporte</h5>
          {data.key_levels.support?.map((level, index) => (
            <div key={index} className="flex justify-between">
              <span>Soporte {index + 1}:</span>
              <span className="font-mono">${level.toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className="space-y-2">
          <h5 className="font-medium text-red-400">📉 Niveles de Resistencia</h5>
          {data.key_levels.resistance?.map((level, index) => (
            <div key={index} className="flex justify-between">
              <span>Resistencia {index + 1}:</span>
              <span className="font-mono">${level.toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className="space-y-2">
          <h5 className="font-medium text-yellow-400">❌ Nivel de Invalidación</h5>
          <div className="flex justify-between">
            <span>Invalidación:</span>
            <span className="font-mono">${data.key_levels.invalidation?.toFixed(2) || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Wave Degrees Legend */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <h5 className="font-medium mb-2">🌊 Grados de Ondas Elliott</h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span><span className="font-medium">Primary:</span> ①②③④⑤</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span><span className="font-medium">Intermediate:</span> (1)(2)(3)(4)(5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span><span className="font-medium">Minor:</span> 1-2-3-4-5</span>
          </div>
        </div>
      </div>

      {/* Scenarios if available */}
      {data.scenarios && data.scenarios.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <h5 className="font-medium mb-2">🎯 Escenarios Posibles</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {data.scenarios.map((scenario, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: scenario.color }}
                  ></div>
                  <span>{scenario.name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono">${scenario.target.toFixed(2)}</span>
                  <span className="text-muted-foreground">({scenario.probability}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}