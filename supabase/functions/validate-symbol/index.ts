import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    console.log('Validating symbol:', symbol);

    if (!symbol || typeof symbol !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Lista de símbolos conocidos que funcionan en TradingView
    const knownValidSymbols = [
      // NASDAQ
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'PYPL', 'ADBE',
      'INTC', 'CMCSA', 'COST', 'QCOM', 'AMD',
      // NYSE
      'JPM', 'JNJ', 'V', 'UNH', 'HD', 'PG', 'MA', 'DIS', 'BAC', 'XOM', 'WMT', 'CVX',
      'LLY', 'ABBV', 'PFE',
      // BMV (con sufijo .MX)
      'WALMEX.MX', 'AMXL.MX', 'GFNORTEO.MX', 'FEMSA.MX', 'GMEXICO.MX', 'CEMEXCPO.MX',
      'TLEVISACPO.MX', 'GMEXICOB.MX', 'ALSEA.MX', 'BIMBOA.MX', 'KIMBERA.MX',
      'LIVEPOLC-1.MX', 'PINFRA.MX', 'ASURB.MX', 'ORBIA.MX',
      // LSE (con sufijo .L)
      'SHEL.L', 'AZN.L', 'ULVR.L', 'HSBA.L', 'BP.L', 'VOD.L', 'GSK.L', 'LLOY.L',
      'BT.A.L', 'BARC.L',
      // TSE (con sufijo .T)
      '7203.T', '6758.T', '9984.T', '8306.T', '6861.T', '9432.T', '7974.T', '8035.T',
      '6098.T', '4519.T'
    ];

    const cleanSymbol = symbol.toUpperCase().trim();
    const isValid = knownValidSymbols.includes(cleanSymbol);

    // Sugerir símbolos similares si no es válido
    let suggestions = [];
    if (!isValid) {
      suggestions = knownValidSymbols
        .filter(validSymbol => 
          validSymbol.includes(cleanSymbol.split('.')[0]) ||
          cleanSymbol.split('.')[0].includes(validSymbol.split('.')[0])
        )
        .slice(0, 5);
    }

    const result = {
      symbol: cleanSymbol,
      isValid,
      suggestions,
      message: isValid 
        ? 'Símbolo válido para TradingView' 
        : 'Símbolo no encontrado en TradingView'
    };

    console.log('Validation result:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in validate-symbol:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});