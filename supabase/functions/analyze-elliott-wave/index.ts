import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ZigZag Pivot Detection Algorithm with historical_low injection
function computePivots(history: any[], pct = 3.0, minBars = 5, historical_low: any = null) {
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

  // Force injection of historical_low as first pivot if provided
  if (historical_low && pivots.length > 0) {
    const first = pivots[0];
    // Check if the historical_low is not already the first pivot
    if (historical_low.date !== first.date || Math.abs(historical_low.price - first.price) > 1e-8) {
      // Insert at the beginning
      pivots.unshift({ 
        date: historical_low.date, 
        price: historical_low.price, 
        type: 'low', 
        index: -1,
        source: 'historical_low_forced' 
      });
    }
  } else if (historical_low && pivots.length === 0) {
    // No pivots detected, still add historical_low as base
    pivots.push({ 
      date: historical_low.date, 
      price: historical_low.price, 
      type: 'low', 
      index: -1,
      source: 'historical_low_forced' 
    });
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

// Validate Elliott Wave Report JSON (new format)
function validateReport(report: any): boolean {
  if (!report || !report.symbol || !report.timeframe) return false;
  
  // Validate historical_low if present
  if (report.historical_low) {
    if (typeof report.historical_low.price !== 'number' || !report.historical_low.date) {
      return false;
    }
  }
  
  // Validate supercycle array
  if (!Array.isArray(report.supercycle) || report.supercycle.length === 0) return false;
  
  for (const wave of report.supercycle) {
    if (typeof wave.wave !== 'number') return false;
    
    // Only validate complete waves (not in_progress or pending)
    if (wave.status !== 'in_progress' && wave.status !== 'pending') {
      if (typeof wave.start !== 'number' || typeof wave.end !== 'number') {
        return false;
      }
      if (!wave.date_start || !wave.date_end) {
        return false;
      }
    }
  }
  
  return true;
}

// Call LLM for Elliott Wave Count
async function callLLMForCount(
  pivotsText: string, 
  symbol: string, 
  timeframe: string, 
  historical_low: any,
  maxRetries = 2
) {
  const systemPrompt = `Eres un analista experto en Teoría de Ondas de Elliott. Recibirás como input un objeto JSON con:
- symbol
- timeframe
- historical_low: {price, date}
- pivots: [{date, price, type}, ...]

INSTRUCCIONES RÍGIDAS:
1) DEBES EMPEZAR EL CONTEO desde el historical_low proporcionado. Considera ese record low como el origen (onda 0 o inicio del supercycle) salvo que el admin confirme lo contrario.
2) No inventes pivotes ni fechas. Usa solo los pivotes entregados y el historical_low.
3) Identifica y devuelve conteos por grado (Supercycle → Cycle → Primary → Intermediate mínimo). Marca claramente cuál es el grado que consideras como "Supercycle".
4) Comprueba reglas de Elliott: Onda 3 no la más corta; Onda 4 no debe solapar territorios prohibidos; mantén proporciones Fibonacci y anota ratios (1.618, 2.618, etc.) si aplica.
5) Si hay dos conteos plausibles, devuelve el más probable con un "confidence" (0.0–1.0).
6) Devuelve únicamente JSON válido (no texto explicativo). Si añades notas, hazlo en un campo "notes".

FORMATO DE SALIDA (ejemplo):
{
  "symbol": "NFLX",
  "timeframe": "1D",
  "historical_low": {"date":"2002-10-10","price":0.3464},
  "supercycle": [
    {"wave": 1, "start": 0.3464, "end": 700.0, "date_start": "2002-10-10", "date_end": "2021-11-17", "ratio": 1.0},
    {"wave": 2, "start": 700.0, "end": 164.30, "date_start": "2021-11-17", "date_end": "2022-05-12", "ratio": 0.236},
    {"wave": 3, "start": 164.30, "end": 1191.06, "date_start": "2022-05-12", "date_end": "2025-09-20", "ratio": 1.618},
    {"wave": 4, "status": "in_progress", "projection": "corrective", "target_zone": [756.49, 780.13]},
    {"wave": 5, "status": "pending"}
  ],
  "confidence": 0.91,
  "notes": "Conteo coherente con estructura impulsiva. Onda III completa y onda IV iniciando.",
  "visual_pivots": [
    {"date": "2002-10-10", "price": 0.3464, "label": "origin", "degree": "Supercycle"},
    {"date": "2021-11-17", "price": 700.00, "label": "Wave1_end", "degree": "Supercycle"}
  ]
}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash', // Default model included in paid plan
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Símbolo: ${symbol}\nTimeframe: ${timeframe}\nHistorical Low: ${JSON.stringify(historical_low)}\n\nPivotes:\n${pivotsText}\n\nReturn COMPLETE valid JSON only.` }
          ],
          temperature: 0.1,
          max_completion_tokens: 4000,
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
      
      // Log full response for debugging
      console.log('Full LLM Response length:', content.length);
      console.log('Full LLM Response:', content);
      
      // Remove markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('No valid JSON brackets found in response');
        if (attempt === maxRetries) {
          throw new Error('No valid JSON found in LLM response');
        }
        continue;
      }
      
      const jsonText = content.slice(jsonStart, jsonEnd + 1);
      console.log('Extracted JSON length:', jsonText.length);
      console.log('Extracted JSON preview:', jsonText.substring(0, 500));
      
      let report;
      try {
        report = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse:', jsonText.substring(0, 200));
        if (attempt === maxRetries) {
          throw new Error(`Invalid JSON from LLM: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
        continue;
      }
      
      if (validateReport(report)) {
        console.log('Report validated successfully');
        return report;
      } else {
        console.warn('Invalid report structure, retrying...');
        console.warn('Report preview:', JSON.stringify(report).substring(0, 300));
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

    const { symbol, timeframe = "1d", pct = 3.0, minBars = 5, candles, historical_low: providedHistoricalLow } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Normalize timeframe to lowercase for Yahoo Finance API
    const normalizedTimeframe = timeframe.toLowerCase();
    console.log(`Analyzing Elliott Wave for ${symbol}, timeframe: ${normalizedTimeframe}`);

    let history = [];
    let historical_low = providedHistoricalLow;

    // If candles are provided, use them directly
    if (candles && candles.length > 0) {
      console.log(`Using ${candles.length} provided candles`);
      history = candles.map((c: any) => ({
        date: c.date,
        timestamp: new Date(c.date).getTime() / 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0
      }));
    } else {
      // Step 1: Fetch OHLCV data from Yahoo Finance
      const ohlcvUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=${normalizedTimeframe}`;
      console.log(`Fetching from Yahoo: ${ohlcvUrl}`);
      const ohlcvResp = await fetch(ohlcvUrl);
      
      if (!ohlcvResp.ok) {
        const errorText = await ohlcvResp.text();
        console.error(`Yahoo Finance error: ${ohlcvResp.status}`, errorText);
        throw new Error(`Failed to fetch data for ${symbol}: ${ohlcvResp.status}`);
      }

      const ohlcvData = await ohlcvResp.json();
      const result = ohlcvData.chart?.result?.[0];
      
      if (!result) {
        throw new Error('No chart data available');
      }

      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];

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
      console.log(`Fetched ${history.length} data points from Yahoo`);
    }

    // Calculate historical low if not provided
    if (!historical_low && history.length > 0) {
      historical_low = { price: history[0].low, date: history[0].date };
      for (const candle of history) {
        if (candle.low < historical_low.price) {
          historical_low = { 
            price: candle.low, 
            date: candle.date 
          };
        }
      }
    }
    
    if (!historical_low) {
      throw new Error('No data available to calculate historical low');
    }
    
    console.log(`Historical low: ${historical_low.price} on ${historical_low.date}`);

    // Step 2: Compute pivots using ZigZag with historical_low injection
    const pivots = computePivots(history, pct, minBars, historical_low);
    console.log(`Detected ${pivots.length} pivots (including historical_low if forced)`);

    // Step 3: Format for LLM
    const pivotsText = pivotsToText(symbol, timeframe, history, pivots);

    // Step 4: Call LLM for Elliott Wave analysis with historical_low
    const report = await callLLMForCount(pivotsText, symbol, timeframe, historical_low);

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
