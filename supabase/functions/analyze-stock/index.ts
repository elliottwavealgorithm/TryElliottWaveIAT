import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stock, question } = await req.json();

    if (!stock || !question) {
      return new Response(
        JSON.stringify({ error: 'Stock symbol and question are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const prompt = `
INSTRUCCIONES PARA EL ANALISTA ELLIOTT WAVE:

Eres un analista técnico senior especializado en Elliott Wave Theory. Debes proporcionar un análisis OBJETIVO y VARIADO del instrumento ${stock}.

IMPORTANTE - EVITA SESGOS:
- NO asumas automáticamente que está en Onda 5
- Analiza REALMENTE las estructuras de precio actuales  
- Considera TODOS los escenarios posibles (ondas 1, 2, 3, 4, 5, A, B, C)
- Varía tus conclusiones entre diferentes instrumentos
- Usa datos de precio REALISTAS para ${stock}

CONTEXTO DEL INSTRUMENTO: ${stock}
Fecha de análisis: ${new Date().toLocaleDateString()}
ID único: ${Date.now()}-${Math.random().toString(36).substr(2, 9)}

ANÁLISIS REQUERIDO:

🌊 CONTEO PRINCIPAL
- Estructura actual: [Describe objetivamente]
- Posición en el ciclo: [Onda específica y grado]
- Probabilidad de escenario: [%]
- Invalidación crítica: $[precio]

📈 NIVELES TÉCNICOS
- Soporte clave: $[precio]
- Resistencia inmediata: $[precio]
- Objetivo proyectado: $[precio]

🔍 ANÁLISIS ESTRUCTURAL
**Evidencias técnicas observadas:**
- [Describe patrones específicos reales]
- [Retrocesos de Fibonacci relevantes]
- [Momentum y divergencias]

📊 ESCENARIOS ALTERNATIVOS
1. **Escenario Alcista** ([%]% probabilidad)
   - Descripción: [estructura]
   - Invalidación: $[precio]

2. **Escenario Bajista** ([%]% probabilidad) 
   - Descripción: [estructura]
   - Invalidación: $[precio]

💡 RECOMENDACIÓN
- Sesgo direccional: [ALCISTA/BAJISTA/NEUTRAL]
- Nivel de entrada: $[precio]
- Stop loss: $[precio]
- Objetivo: $[precio]
- Horizonte temporal: [corto/medio/largo plazo]

IMPORTANTE:
- Sé OBJETIVO en tu análisis
- No repitas el mismo patrón para todos los instrumentos
- Considera el contexto específico de mercado para ${stock}
- Varía entre ondas impulsivas y correctivas según corresponda
- Usa precios REALISTAS basados en el rango histórico del instrumento

CHART_DATA:
{
  "waves": [
    {"wave": "1", "start_price": 100, "end_price": 120, "start_date": "2024-01-01", "end_date": "2024-02-01"},
    {"wave": "2", "start_price": 120, "end_price": 110, "start_date": "2024-02-01", "end_date": "2024-02-15"},
    {"wave": "3", "start_price": 110, "end_price": 150, "start_date": "2024-02-15", "end_date": "2024-03-15"}
  ],
  "key_levels": {
    "support": [110, 140],
    "resistance": [150, 160],
    "invalidation": 105
  }
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un analista financiero experto especializado en la Teoría de Ondas de Elliott. Siempre sigues el formato exacto especificado y proporcionas datos realistas.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Error connecting to AI service' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    // Extract chart data if present
    let chartData = null;
    const chartDataMatch = analysis.match(/CHART_DATA:\s*(\{[\s\S]*?\})\s*$/);
    if (chartDataMatch) {
      try {
        chartData = JSON.parse(chartDataMatch[1]);
      } catch (e) {
        console.error('Error parsing chart data:', e);
      }
    }

    // Remove chart data from analysis text
    const cleanAnalysis = analysis.replace(/CHART_DATA:[\s\S]*$/, '').trim();

    return new Response(
      JSON.stringify({ 
        stock: stock.toUpperCase(), 
        analysis: cleanAnalysis,
        chartData: chartData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-stock function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});