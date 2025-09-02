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
Eres un analista senior especializado en la Teoría de Ondas de Elliott con las siguientes credenciales:
- Educación: Postgrado en Análisis Técnico por New York Institute of Finance, Londres School of Economics (Financial Markets)
- Experiencia: 15+ años aplicando Elliott Wave Theory en mercados institucionales
- Especialización: Implementación práctica de las teorías de Ralph Nelson Elliott y Robert Prechter

ACTIVO A ANALIZAR: ${stock}

ANÁLISIS REQUERIDO:
Proporciona un análisis completo de Elliott Wave siguiendo este formato exacto:

### ANÁLISIS ELLIOTT WAVE - ${stock} - ${new Date().toLocaleDateString()}

🌊 **CONTEO PRINCIPAL** (Probabilidad: X%)
- Estructura: [Impulsiva/Correctiva/WXY/Triángulo/Cuña]
- Posición actual: Onda [X] de grado [Y]
- Objetivo inmediato: $[precio]
- Invalidación: $[precio]

🏗️ **CANALIZACIONES ACTIVAS**
- Canal principal: [2-4/0-2/5-B]
- Proyección por ruptura: $[precio]
- Confirmación de grado superior: [SÍ/NO]

💡 **FUNDAMENTACIÓN**
**¿Por qué creo en esta hipótesis?**
- [Explicación detallada de evidencias técnicas]
- [Price action que confirma el conteo]
- [Contexto macro relevante]

📊 **ESCENARIOS ALTERNATIVOS**
1. **Escenario A** (Probabilidad: X%)
   - Estructura alternativa: [descripción]
   - Invalidación: $[precio]
   - Fundamentación: [por qué es posible]

2. **Escenario B** (Probabilidad: X%)
   - Estructura alternativa: [descripción]
   - Invalidación: $[precio]
   - Fundamentación: [por qué es posible]

🎯 **POTENCIAL ONDA 3** [Solo si aplica]
- ¿Está en Wave 3?: [SÍ/NO]
- Grado de la Wave 3: [Mayor/Intermedia/Menor]
- Extensión esperada: [1.618/2.618/4.236] de Wave 1
- % completado estimado: X%

💰 **RECOMENDACIÓN OPERATIVA**
- Acción: [COMPRAR/VENDER/ESPERAR]
- Entrada: $[precio]
- Stop Loss: $[precio]
- Objetivo: $[precio]
- Tamaño posición: X% del capital
- Prioridad: [ALTA/MEDIA/BAJA] basada en Wave 3

🎯 **CONTEXTO MACRO**
- Fase del ciclo mayor
- Confluencias técnicas
- Factores fundamentales relevantes

INSTRUCCIONES ESPECÍFICAS:
1. Identifica la estructura de ondas actual (impulsiva/correctiva)
2. Especifica en qué onda te encuentras (1,2,3,4,5 o A,B,C)
3. Proporciona mínimo 2 escenarios alternativos con probabilidades
4. Incluye puntos de invalidación claros para cada escenario
5. Enfócate especialmente en identificar si está en Wave 3 de cualquier grado
6. Proporciona gestión de riesgo específica

Pregunta adicional del usuario: ${question}
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
            content: 'Eres un analista financiero experto que proporciona insights prácticos sobre acciones e inversiones en español.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3,
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

    return new Response(
      JSON.stringify({ 
        stock: stock.toUpperCase(), 
        analysis: analysis 
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