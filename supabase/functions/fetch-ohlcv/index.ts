import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, range = "max", interval = "1d" } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Fetching OHLCV for ${symbol}, range: ${range}, interval: ${interval}`);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const resp = await fetch(url);
    
    if (!resp.ok) {
      console.error('Yahoo Finance error:', resp.status, resp.statusText);
      throw new Error(`No data from Yahoo Finance: ${resp.status}`);
    }

    const data = await resp.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      throw new Error('No chart data available for this symbol');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    if (!timestamps || !quote) {
      throw new Error('Invalid data structure from Yahoo Finance');
    }

    const ohlcv = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] === null) continue;
      
      ohlcv.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        timestamp: timestamps[i],
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i]
      });
    }

    console.log(`Successfully fetched ${ohlcv.length} data points for ${symbol}`);

    return new Response(
      JSON.stringify({ 
        symbol,
        range,
        interval,
        dataPoints: ohlcv.length,
        ohlcv 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-ohlcv function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to fetch OHLCV data'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
