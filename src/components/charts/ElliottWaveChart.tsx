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

  // Convert wave data to chart format
  const chartData = data.waves.flatMap((wave, index) => [
    {
      date: wave.start_date,
      price: wave.start_price,
      wave: wave.wave,
      point: 'start'
    },
    {
      date: wave.end_date,
      price: wave.end_price,
      wave: wave.wave,
      point: 'end'
    }
  ]);

  const minPrice = Math.min(...chartData.map(d => d.price)) * 0.95;
  const maxPrice = Math.max(...chartData.map(d => d.price)) * 1.05;

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
            formatter={(value: any, name) => [`$${value}`, name === 'price' ? 'Precio' : name]}
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
          <span>📈 Resistencia: ${data.key_levels.resistance.join(', ')}</span>
          <span>📉 Soporte: ${data.key_levels.support.join(', ')}</span>
          <span>❌ Invalidación: ${data.key_levels.invalidation}</span>
        </div>
      </div>
    </div>
  );
}