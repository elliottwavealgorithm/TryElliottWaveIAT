import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WaveData {
  wave: string;
  start_price: number;
  end_price: number;
  start_date: string;
  end_date: string;
}

interface ChartData {
  waves: WaveData[];
  key_levels: {
    support: number[];
    resistance: number[];
    invalidation: number;
  };
}

interface ElliottWaveChartProps {
  data: ChartData;
  symbol: string;
}

export function ElliottWaveChart({ data, symbol }: ElliottWaveChartProps) {
  if (!data?.waves) return null;

  // Convert wave data to chart format - create a continuous line
  const chartData: any[] = [];
  
  data.waves.forEach((wave, index) => {
    // Add start point
    chartData.push({
      date: wave.start_date,
      price: wave.start_price,
      wave: wave.wave,
      label: `Wave ${wave.wave} Start`
    });
    
    // Add end point
    chartData.push({
      date: wave.end_date,
      price: wave.end_price,
      wave: wave.wave,
      label: `Wave ${wave.wave} End`
    });
  });

  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) * 0.95 : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) * 1.05 : 100;

  return (
    <div className="w-full h-64 mt-4">
      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
        Conteo Elliott Wave - {symbol}
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[minPrice, maxPrice]}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip 
            labelFormatter={(label) => `Fecha: ${label}`}
            formatter={(value: any, name) => [`$${Number(value).toFixed(2)}`, name === 'price' ? 'Precio' : name]}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#8884d8" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {/* Key Levels Legend */}
      <div className="mt-2 text-xs text-muted-foreground">
        <div className="flex gap-4">
          <span>📈 Resistencia: ${data.key_levels.resistance?.join(', ') || 'N/A'}</span>
          <span>📉 Soporte: ${data.key_levels.support?.join(', ') || 'N/A'}</span>
          <span>❌ Invalidación: ${data.key_levels.invalidation || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}