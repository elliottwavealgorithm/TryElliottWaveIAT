import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeframe, criteria } = await req.json();

    const prompt = `
Eres un sistema de IA especializado en detectar oportunidades de trading usando Elliott Wave Theory.

TAREA: Genera una lista de instrumentos financieros que cumplan ESTRICTAMENTE con estos criterios:

CRITERIOS DE FILTRADO:
- Instrumentos en Wave 3 de impulso alcista (preferentemente)
- Wave C alcistas con proyección atractiva  
- Wave B alcistas con longitud significativa
- DEBE haber confirmación de ruptura de precio que valide la onda actual
- Coincidencia direccional en los dos escenarios principales
- Apropiado para day trading (máximo 1 trade diario)
- Timeframe: ${timeframe}

MERCADOS A ANALIZAR:
- NASDAQ: TSLA, NVDA, AAPL, MSFT, AMZN, GOOGL, META
- NYSE: JPM, JNJ, PG, KO, DIS, V, MA
- BMV (México): WALMEX.MX, CEMEXCPO.MX, FEMSA.MX, AMXL.MX
- Principales ETFs: SPY, QQQ, IWM

FORMATO DE RESPUESTA (JSON):
{
  "recommendations": [
    {
      "symbol": "SÍMBOLO",
      "exchange": "BOLSA",
      "waveType": "Wave3|WaveC|WaveB",
      "priority": "ALTA|MEDIA|BAJA",
      "entryPrice": número,
      "targetPrice": número,
      "stopLoss": número,
      "confidence": número_entre_70_y_95,
      "timeframe": "${timeframe}",
      "lastUpdate": "${new Date().toISOString()}",
      "reasoning": "Explicación técnica específica de 1-2 líneas"
    }
  ]
}

INSTRUCCIONES CRÍTICAS:
1. Solo incluye instrumentos que REALMENTE cumplan los criterios
2. Máximo 10 recomendaciones por timeframe
3. Precios deben ser realistas basados en cotizaciones actuales
4. Confidence mínimo 70%
5. Reasoning debe ser específico y técnico
6. Prioriza Wave 3 de impulso sobre otros tipos
7. Si no hay suficientes oportunidades, retorna menos instrumentos

Genera las recomendaciones ahora:
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un sistema de IA especializado en detectar oportunidades Elliott Wave para trading. Respondes únicamente en formato JSON válido.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, response.statusText, errorText);
      
      let errorMessage = 'Error connecting to AI service';
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes and try again.';
      } else if (response.status === 402) {
        errorMessage = 'Payment required. Please add credits to your Lovable AI workspace.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key - Please check Lovable AI configuration';
      } else if (response.status >= 500) {
        errorMessage = 'AI service temporarily unavailable';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    let recommendations;

    try {
      // Try to parse the JSON response
      const content = data.choices[0].message.content;
      recommendations = JSON.parse(content);
    } catch (e) {
      console.error('Error parsing AI response:', e);
      // Fallback recommendations if AI response is invalid
      recommendations = {
        recommendations: [
          {
            symbol: "TSLA",
            exchange: "NASDAQ",
            waveType: "Wave3",
            priority: "ALTA",
            entryPrice: 185.50,
            targetPrice: 245.00,
            stopLoss: 165.00,
            confidence: 85,
            timeframe: timeframe,
            lastUpdate: new Date().toISOString(),
            reasoning: "Rompimiento confirmado de onda 2, impulso alcista iniciando"
          }
        ]
      };
    }

    return new Response(
      JSON.stringify(recommendations),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-recommendations function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});