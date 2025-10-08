import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ZigZag Pivot Detection Algorithm
function computePivots(history: any[], pct = 3.0, minBars = 5) {
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);
  const n = history.length;

  let lastPivotIdx = 0;
  let lastHigh = highs[0], lastLow = lows[0];
  let lastHighIdx = 0, lastLowIdx = 0;
  let trend = 0; // 1 up, -1 down, 0 unknown

  const pivots = [];

  for (let i = 1; i < n; i++) {
    if (highs[i] >= lastHigh) { 
      lastHigh = highs[i]; 
      lastHighIdx = i; 
    }
    if (lows[i] <= lastLow) { 
      lastLow = lows[i]; 
      lastLowIdx = i; 
    }

    const dropFromHigh = (lastHigh - lows[i]) / lastHigh * 100;
    const riseFromLow = (highs[i] - lastLow) / lastLow * 100;

    if ((trend >= 0) && (dropFromHigh >= pct) && ((i - lastPivotIdx) >= minBars)) {
      pivots.push({
        index: lastHighIdx,
        type: "high",
        price: lastHigh,
        date: history[lastHighIdx].date
      });
      lastPivotIdx = lastHighIdx;
      lastLow = lows[i];
      lastLowIdx = i;
      trend = -1;
    } else if ((trend <= 0) && (riseFromLow >= pct) && ((i - lastPivotIdx) >= minBars)) {
      pivots.push({
        index: lastLowIdx,
        type: "low",
        price: lastLow,
        date: history[lastLowIdx].date
      });
      lastPivotIdx = lastLowIdx;
      lastHigh = highs[i];
      lastHighIdx = i;
      trend = 1;
    }
  }

  return pivots;
}

// Format pivots for LLM
function pivotsToText(symbol: string, timeframe: string, history: any[], pivots: any[], lastN = 60) {
  const tail = history.slice(Math.max(0, history.length - lastN));
  let text = `SYMBOL: ${symbol}\nTIMEFRAME: ${timeframe}\n\nPIVOTS:\n`;
  
  for (const p of pivots.slice(-20)) {
    text += `${p.date} ${p.type.toUpperCase()} ${p.price.toFixed(2)}\n`;
  }
  
  const lastClose = history[history.length - 1].close;
  text += `\nLAST_CLOSE: ${lastClose.toFixed(2)}\n`;
  text += `TOTAL_PIVOTS: ${pivots.length}\n`;
  
  return text;
}

// Validate Elliott Wave Report JSON
function validateReport(report: any): boolean {
  if (!report || !report.simbolo || !Array.isArray(report.conteos)) return false;
  
  for (const c of report.conteos) {
    if (!Array.isArray(c.ondas) || c.ondas.length === 0) return false;
    for (const o of c.ondas) {
      if (typeof o.n !== 'number' || !o.inicio || !o.fin || typeof o.precio_inicio !== 'number') {
        return false;
      }
    }
  }
  return true;
}

// Call LLM for Elliott Wave Count
async function callLLMForCount(pivotsText: string, symbol: string, timeframe: string, maxRetries = 2) {
  const systemPrompt = `Eres un analista técnico experto en la Teoría de Ondas de Elliott. Tu tarea es analizar series de precios históricas completas de una acción, comenzando siempre desde el mínimo histórico disponible en los datos, y construir conteos de ondas válidos según las reglas formales de Elliott Wave.

⚙️ INSTRUCCIONES DE ANÁLISIS

1. Identifica el mínimo histórico (low más antiguo) y úsalo como punto inicial (onda 0 o punto de origen del conteo).
2. Construye el conteo completo en grados:
   - Supercycle
   - Cycle
   - Primary
   - Intermediate
   - Minor
   - Minute (si hay resolución suficiente)
3. Aplica las reglas estructurales:
   - Onda 3 nunca es la más corta.
   - Onda 4 no se solapa con el territorio de la onda 1.
   - Correcciones (ABC) deben seguir patrones zigzag, flat o triangle.
   - Verifica proporciones entre ondas con ratios de Fibonacci: 0.382, 0.618, 1.0, 1.618, 2.618, 4.236.
4. Usa pivotes relevantes (máximos/mínimos significativos) y calcula las proporciones entre las ondas 1–3 y 2–4 para validar estructura.
5. Indica el grado actual y la fase probable (impulsiva o correctiva).
6. Si el conteo tiene ambigüedad, muestra las dos interpretaciones más probables, asignando un % de confianza.

🧮 FORMATO DE RESPUESTA (JSON)
{
  "symbol": "NFLX",
  "timeframe": "1D",
  "historical_low": {
    "price": 0.3464,
    "date": "2002-10-10"
  },
  "supercycle": [
    {"wave": 1, "start": 0.3464, "end": 700.0, "date_start": "2002-10-10", "date_end": "2021-11-17", "ratio": 1.0},
    {"wave": 2, "start": 700.0, "end": 164.30, "date_start": "2021-11-17", "date_end": "2022-05-12", "ratio": 0.236},
    {"wave": 3, "start": 164.30, "end": 1191.06, "date_start": "2022-05-12", "date_end": "2025-09-20", "ratio": 1.618},
    {"wave": 4, "status": "in_progress", "projection": "corrective", "target_zone": [756.49, 780.13]},
    {"wave": 5, "status": "pending"}
  ],
  "confidence": 0.91,
  "notes": "Conteo coherente con estructura impulsiva. Onda III completa y onda IV iniciando. Confirmar validación si el precio rompe $780."
}

📊 VISUALIZACIÓN
Devuelve también un arreglo con los pivotes de cada grado para graficarlos visualmente:
{
  "visual_pivots": [
    {"date": "2002-10-10", "price": 0.3464, "wave": "I", "degree": "Supercycle"},
    {"date": "2021-11-17", "price": 700.00, "wave": "I", "degree": "Cycle"},
    {"date": "2022-05-12", "price": 164.30, "wave": "II", "degree": "Cycle"}
  ]
}

No inventes precios ni fechas. Usa solo los valores que existan en el dataset o los pivotes provistos.`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Pivots data:\n\n${pivotsText}\n\nReturn only JSON per schema.` }
          ],
          temperature: 0.1,
          max_completion_tokens: 2500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`LLM API error (attempt ${attempt + 1}):`, response.status, errorText);
        
        if (attempt === maxRetries) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait and try again.');
          } else if (response.status === 402) {
            throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
          }
          throw new Error(`AI service error: ${response.status}`);
        }
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';
      
      console.log('LLM Response (first 300 chars):', content.substring(0, 300));
      console.log('LLM Response (last 300 chars):', content.substring(content.length - 300));
      
      // Remove markdown code blocks if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in LLM response');
      }
      
      const jsonText = content.slice(jsonStart, jsonEnd + 1);
      console.log('Extracted JSON length:', jsonText.length);
      
      const report = JSON.parse(jsonText);
      
      if (validateReport(report)) {
        return report;
      } else {
        console.warn('Invalid report structure, retrying...');
        if (attempt === maxRetries) {
          throw new Error('Failed to get valid Elliott Wave analysis after retries');
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to analyze Elliott Wave patterns');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Lovable AI key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { symbol, timeframe = "1d", pct = 3.0, minBars = 5 } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Analyzing Elliott Wave for ${symbol}, timeframe: ${timeframe}`);

    // Step 1: Fetch OHLCV data
    const ohlcvUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=${timeframe}`;
    const ohlcvResp = await fetch(ohlcvUrl);
    
    if (!ohlcvResp.ok) {
      throw new Error(`Failed to fetch data for ${symbol}`);
    }

    const ohlcvData = await ohlcvResp.json();
    const result = ohlcvData.chart?.result?.[0];
    
    if (!result) {
      throw new Error('No chart data available');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] === null) continue;
      history.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        timestamp: timestamps[i],
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i]
      });
    }

    console.log(`Fetched ${history.length} data points`);

    // Step 2: Compute pivots using ZigZag
    const pivots = computePivots(history, pct, minBars);
    console.log(`Detected ${pivots.length} pivots`);

    // Step 3: Format for LLM
    const pivotsText = pivotsToText(symbol, timeframe, history, pivots);

    // Step 4: Call LLM for Elliott Wave analysis
    const report = await callLLMForCount(pivotsText, symbol, timeframe);

    // Step 5: Return complete analysis
    return new Response(
      JSON.stringify({ 
        success: true,
        symbol: symbol.toUpperCase(),
        timeframe,
        analysis: report,
        pivots: pivots.slice(-20), // Last 20 pivots
        dataPoints: history.length,
        lastPrice: history[history.length - 1].close,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-elliott-wave function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to analyze Elliott Wave patterns'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
