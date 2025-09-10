import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base de datos de símbolos populares por bolsa
const SYMBOLS_DATABASE = {
  "NASDAQ": [
    { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
    { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
    { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary" },
    { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
    { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
    { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
    { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication Services" },
    { symbol: "PYPL", name: "PayPal Holdings Inc.", sector: "Financial Services" },
    { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
    { symbol: "INTC", name: "Intel Corporation", sector: "Technology" },
    { symbol: "CMCSA", name: "Comcast Corporation", sector: "Communication Services" },
    { symbol: "COST", name: "Costco Wholesale Corporation", sector: "Consumer Staples" },
    { symbol: "QCOM", name: "QUALCOMM Incorporated", sector: "Technology" },
    { symbol: "AMD", name: "Advanced Micro Devices Inc.", sector: "Technology" }
  ],
  "NYSE": [
    { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financial Services" },
    { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
    { symbol: "V", name: "Visa Inc.", sector: "Financial Services" },
    { symbol: "UNH", name: "UnitedHealth Group Inc.", sector: "Healthcare" },
    { symbol: "HD", name: "The Home Depot Inc.", sector: "Consumer Discretionary" },
    { symbol: "PG", name: "The Procter & Gamble Company", sector: "Consumer Staples" },
    { symbol: "MA", name: "Mastercard Incorporated", sector: "Financial Services" },
    { symbol: "DIS", name: "The Walt Disney Company", sector: "Communication Services" },
    { symbol: "BAC", name: "Bank of America Corporation", sector: "Financial Services" },
    { symbol: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
    { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
    { symbol: "CVX", name: "Chevron Corporation", sector: "Energy" },
    { symbol: "LLY", name: "Eli Lilly and Company", sector: "Healthcare" },
    { symbol: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
    { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" }
  ],
  "BMV": [
    { symbol: "WALMEX", name: "Wal-Mart de México", sector: "Consumer Staples" },
    { symbol: "AMXL", name: "América Móvil", sector: "Telecommunications" },
    { symbol: "GFNORTEO", name: "Grupo Financiero Banorte", sector: "Financial Services" },
    { symbol: "FEMSA", name: "Fomento Económico Mexicano", sector: "Consumer Staples" },
    { symbol: "GMEXICO", name: "Grupo México", sector: "Materials" },
    { symbol: "CEMEXCPO", name: "CEMEX", sector: "Materials" },
    { symbol: "TLEVISACPO", name: "Grupo Televisa", sector: "Communication Services" },
    { symbol: "GMEXICOB", name: "Grupo México Serie B", sector: "Materials" },
    { symbol: "ALSEA", name: "Alsea", sector: "Consumer Discretionary" },
    { symbol: "BIMBOA", name: "Grupo Bimbo", sector: "Consumer Staples" },
    { symbol: "KIMBERA", name: "Kimberly-Clark de México", sector: "Consumer Staples" },
    { symbol: "LIVEPOLC-1", name: "Liverpool", sector: "Consumer Discretionary" },
    { symbol: "PINFRA", name: "Promotora y Operadora de Infraestructura", sector: "Industrials" },
    { symbol: "ASURB", name: "Grupo Aeroportuario del Sureste", sector: "Industrials" },
    { symbol: "ORBIA", name: "Orbia Advance Corporation", sector: "Materials" }
  ],
  "LSE": [
    { symbol: "SHEL", name: "Shell plc", sector: "Energy" },
    { symbol: "AZN", name: "AstraZeneca PLC", sector: "Healthcare" },
    { symbol: "ULVR", name: "Unilever PLC", sector: "Consumer Staples" },
    { symbol: "HSBA", name: "HSBC Holdings plc", sector: "Financial Services" },
    { symbol: "BP", name: "BP p.l.c.", sector: "Energy" },
    { symbol: "VOD", name: "Vodafone Group Plc", sector: "Telecommunications" },
    { symbol: "GSK", name: "GSK plc", sector: "Healthcare" },
    { symbol: "LLOY", name: "Lloyds Banking Group plc", sector: "Financial Services" },
    { symbol: "BT.A", name: "BT Group plc", sector: "Telecommunications" },
    { symbol: "BARC", name: "Barclays PLC", sector: "Financial Services" }
  ],
  "TSE": [
    { symbol: "7203", name: "Toyota Motor Corporation", sector: "Consumer Discretionary" },
    { symbol: "6758", name: "Sony Group Corporation", sector: "Technology" },
    { symbol: "9984", name: "SoftBank Group Corp.", sector: "Technology" },
    { symbol: "8306", name: "Mitsubishi UFJ Financial Group", sector: "Financial Services" },
    { symbol: "6861", name: "Keyence Corporation", sector: "Technology" },
    { symbol: "9432", name: "Nippon Telegraph and Telephone", sector: "Telecommunications" },
    { symbol: "7974", name: "Nintendo Co., Ltd.", sector: "Technology" },
    { symbol: "8035", name: "Tokyo Electron Limited", sector: "Technology" },
    { symbol: "6098", name: "Recruit Holdings Co., Ltd.", sector: "Industrials" },
    { symbol: "4519", name: "Chugai Pharmaceutical Co., Ltd.", sector: "Healthcare" }
  ]
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exchange, search } = await req.json();

    console.log('Getting symbols for exchange:', exchange, 'search:', search);

    if (!exchange || !SYMBOLS_DATABASE[exchange]) {
      return new Response(
        JSON.stringify({ error: 'Invalid exchange' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let symbols = SYMBOLS_DATABASE[exchange];

    // Filtrar por término de búsqueda si se proporciona
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      symbols = symbols.filter(
        symbol => 
          symbol.symbol.toLowerCase().includes(searchTerm) ||
          symbol.name.toLowerCase().includes(searchTerm) ||
          symbol.sector.toLowerCase().includes(searchTerm)
      );
    }

    // Validar símbolos con formato TradingView
    const validatedSymbols = symbols.map(symbol => ({
      ...symbol,
      tradingViewSymbol: `${exchange}:${symbol.symbol}`,
      isValid: true // En un futuro podríamos validar contra la API real de TradingView
    }));

    console.log(`Found ${validatedSymbols.length} symbols for ${exchange}`);

    return new Response(
      JSON.stringify({ 
        symbols: validatedSymbols,
        total: validatedSymbols.length,
        exchange 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-tradingview-symbols:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});