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
Eres un analista senior especializado en la Teoría de Ondas de Elliott con 15+ años de experiencia aplicando Elliott Wave Theory en mercados institucionales.

ACTIVO A ANALIZAR: ${stock}
TIMESTAMP ÚNICO: ${Date.now()}-${Math.random().toString(36).substr(2, 9)}

INSTRUCCIONES CRÍTICAS PARA EVITAR SESGOS:
1. DEBES analizar específicamente ${stock} con datos ÚNICOS y ESPECÍFICOS para este instrumento
2. NO uses respuestas genéricas o plantillas
3. Considera el contexto específico del mercado de ${stock} (bolsa, sector, fundamentales)
4. Cada análisis DEBE ser completamente diferente y específico al instrumento solicitado
5. DEBES seguir EXACTAMENTE el formato de respuesta especificado
6. NO incluyas texto adicional fuera del formato
7. Rellena TODOS los campos marcados con [X] con datos específicos y realistas
8. Los precios deben reflejar el rango real histórico de ${stock}
9. Al final, incluye datos para gráfico en formato JSON con datos realistas

FORMATO DE RESPUESTA OBLIGATORIO:

ANÁLISIS ELLIOTT WAVE - ${stock} - ${new Date().toLocaleDateString()}

🌊 CONTEO PRINCIPAL (Probabilidad: X%)
- Estructura: [Impulsiva/Correctiva/WXY/Triángulo/Cuña]
- Posición actual: Onda [X] de grado [Y]
- Objetivo inmediato: $[precio]
- Invalidación: $[precio]

🏗️ CANALIZACIONES ACTIVAS
- Canal principal: [2-4/0-2/5-B]
- Proyección por ruptura: $[precio]
- Confirmación de grado superior: [SÍ/NO]

💡 FUNDAMENTACIÓN
**¿Por qué creo en esta hipótesis?**
- [Explicación detallada de evidencias técnicas]
- [Price action que confirma el conteo]
- [Contexto macro relevante]

📊 ESCENARIOS ALTERNATIVOS
1. **Escenario A** (Probabilidad: X%)
   - Estructura alternativa: [descripción]
   - Invalidación: $[precio]
   - Fundamentación: [por qué es posible]

2. **Escenario B** (Probabilidad: X%)
   - Estructura alternativa: [descripción]
   - Invalidación: $[precio]
   - Fundamentación: [por qué es posible]

🎯 POTENCIAL ONDA 3 [Solo si aplica]
- ¿Está en Wave 3?: [SÍ/NO]
- Grado de la Wave 3: [Mayor/Intermedia/Menor]
- Extensión esperada: [1.618/2.618/4.236] de Wave 1
- % completado estimado: X%

💰 RECOMENDACIÓN OPERATIVA
- Acción: [COMPRAR/VENDER/ESPERAR]
- Entrada: $[precio]
- Stop Loss: $[precio]
- Objetivo: $[precio]
- Tamaño posición: X% del capital
- Prioridad: [ALTA/MEDIA/BAJA] basada en Wave 3

🎯 CONTEXTO MACRO
- Fase del ciclo mayor
- Confluencias técnicas
- Factores fundamentales relevantes

CHART_DATA:
{
  "waves": [
    {"wave": "1", "start_price": 100, "end_price": 120, "start_date": "2024-01-01", "end_date": "2024-02-01"},
    {"wave": "2", "start_price": 120, "end_price": 110, "start_date": "2024-02-01", "end_date": "2024-02-15"},
    {"wave": "3", "start_price": 110, "end_price": 150, "start_date": "2024-02-15", "end_date": "2024-03-15"},
    {"wave": "4", "start_price": 150, "end_price": 140, "start_date": "2024-03-15", "end_date": "2024-04-01"},
    {"wave": "5", "start_price": 140, "end_price": 160, "start_date": "2024-04-01", "end_date": "2024-04-15"}
  ],
  "key_levels": {
    "support": [110, 140],
    "resistance": [150, 160],
    "invalidation": 105
  }
}

IMPORTANTE: 
- Proporciona precios REALISTAS específicos para ${stock} basados en su rango histórico actual
- Los datos del gráfico deben reflejar el conteo de ondas propuesto específicamente para ${stock}
- CADA ANÁLISIS DEBE SER ÚNICO - No repitas patrones o conclusiones similares para diferentes instrumentos
- Considera el sector específico, capitalización de mercado y contexto fundamental de ${stock}
- Si ${stock} incluye sufijo (.MX, .L, .T, etc.), considera las características específicas de esa bolsa
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un analista financiero experto especializado en la Teoría de Ondas de Elliott. Siempre sigues el formato exacto especificado y proporcionas datos realistas.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.2,
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