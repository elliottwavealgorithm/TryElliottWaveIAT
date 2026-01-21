import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface Candle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SymbolMetrics {
  symbol: string;
  liquidity_score: number;
  volatility_score: number;
  regime: 'trending' | 'ranging' | 'unknown';
  pivot_cleanliness: number;
  pre_filter_score: number;
  last_price: number;
  avg_volume_30d: number;
  atr_pct: number;
  fundamentals?: FundamentalsSnapshot;
  error?: string;
}

interface FundamentalsSnapshot {
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  nextEarningsDate: string | null;
  sector: string | null;
  industry: string | null;
  shortName: string | null;
}

interface ScanRequest {
  symbols: string[];
  base_timeframe: '1D' | '1W';
  deep_timeframes?: string[];
  topN?: number;
  include_fundamentals?: boolean;
}

interface ScanResult {
  scan_id: string;
  total_symbols: number;
  processed: number;
  failed: number;
  rankings: SymbolMetrics[];
  top_symbols: string[];
  created_at: string;
}

// ============================================================================
// SECTION 2: CACHE (simple in-memory for edge function)
// ============================================================================

const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ============================================================================
// SECTION 3: YAHOO FINANCE DATA FETCHING
// ============================================================================

async function fetchOHLCV(symbol: string, interval: string): Promise<Candle[]> {
  const cacheKey = `ohlcv_${symbol}_${interval}`;
  const cached = getCached<Candle[]>(cacheKey);
  if (cached) return cached;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=${interval === '1W' ? '1wk' : '1d'}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];
  
  if (!result?.timestamp) {
    throw new Error(`No data for ${symbol}`);
  }

  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0];
  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (quote.open[i] === null || quote.close[i] === null) continue;
    candles.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      timestamp: timestamps[i],
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i] || 0
    });
  }

  setCache(cacheKey, candles, 5 * 60 * 1000); // 5 min cache
  return candles;
}

async function fetchFundamentals(symbol: string): Promise<FundamentalsSnapshot> {
  const cacheKey = `fundamentals_${symbol}`;
  const cached = getCached<FundamentalsSnapshot>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryProfile,defaultKeyStatistics,financialData,calendarEvents`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Fundamentals not available for ${symbol}`);
      return getEmptyFundamentals();
    }

    const data = await response.json();
    const result = data.quoteSummary?.result?.[0];
    
    if (!result) return getEmptyFundamentals();

    const profile = result.summaryProfile || {};
    const keyStats = result.defaultKeyStatistics || {};
    const financialData = result.financialData || {};
    const calendar = result.calendarEvents || {};

    const fundamentals: FundamentalsSnapshot = {
      marketCap: keyStats.marketCap?.raw || financialData.marketCap?.raw || null,
      trailingPE: keyStats.trailingPE?.raw || null,
      forwardPE: keyStats.forwardPE?.raw || null,
      revenueGrowth: financialData.revenueGrowth?.raw || null,
      earningsGrowth: financialData.earningsGrowth?.raw || null,
      nextEarningsDate: calendar.earnings?.earningsDate?.[0]?.fmt || null,
      sector: profile.sector || null,
      industry: profile.industry || null,
      shortName: null // Will be filled from quote data
    };

    setCache(cacheKey, fundamentals, 60 * 60 * 1000); // 1 hour cache
    return fundamentals;
  } catch (error) {
    console.error(`Error fetching fundamentals for ${symbol}:`, error);
    return getEmptyFundamentals();
  }
}

function getEmptyFundamentals(): FundamentalsSnapshot {
  return {
    marketCap: null,
    trailingPE: null,
    forwardPE: null,
    revenueGrowth: null,
    earningsGrowth: null,
    nextEarningsDate: null,
    sector: null,
    industry: null,
    shortName: null
  };
}

// ============================================================================
// SECTION 4: TECHNICAL ANALYSIS FOR SCREENING
// ============================================================================

function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  
  const recentTRs = trs.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
}

function calculateADX(candles: Candle[], period = 14): number {
  if (candles.length < period * 2) return 25; // Default neutral
  
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const highDiff = candles[i].high - candles[i - 1].high;
    const lowDiff = candles[i - 1].low - candles[i].low;
    
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  
  // Smooth the values
  const smooth = (arr: number[], p: number) => {
    const result: number[] = [];
    let sum = arr.slice(0, p).reduce((a, b) => a + b, 0);
    result.push(sum);
    for (let i = p; i < arr.length; i++) {
      sum = sum - sum / p + arr[i];
      result.push(sum);
    }
    return result;
  };
  
  const smoothTR = smooth(trs, period);
  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);
  
  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) continue;
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = plusDI + minusDI;
    if (diSum > 0) {
      dx.push(Math.abs(plusDI - minusDI) / diSum * 100);
    }
  }
  
  if (dx.length < period) return 25;
  
  // ADX is smoothed DX
  const recentDX = dx.slice(-period);
  return recentDX.reduce((a, b) => a + b, 0) / recentDX.length;
}

function detectPivots(candles: Candle[], threshold: number): number[] {
  const pivots: number[] = [];
  if (candles.length < 5) return pivots;
  
  for (let i = 2; i < candles.length - 2; i++) {
    const isHigh = candles[i].high > candles[i - 1].high &&
                   candles[i].high > candles[i - 2].high &&
                   candles[i].high > candles[i + 1].high &&
                   candles[i].high > candles[i + 2].high;
    
    const isLow = candles[i].low < candles[i - 1].low &&
                  candles[i].low < candles[i - 2].low &&
                  candles[i].low < candles[i + 1].low &&
                  candles[i].low < candles[i + 2].low;
    
    if (isHigh || isLow) {
      // Check if significant (above threshold)
      const move = isHigh
        ? (candles[i].high - Math.min(candles[i - 2].low, candles[i + 2].low)) / candles[i].high * 100
        : (Math.max(candles[i - 2].high, candles[i + 2].high) - candles[i].low) / candles[i].low * 100;
      
      if (move >= threshold) {
        pivots.push(i);
      }
    }
  }
  
  return pivots;
}

function analyzeSymbol(candles: Candle[], symbol: string): Omit<SymbolMetrics, 'fundamentals'> {
  if (candles.length < 30) {
    return {
      symbol,
      liquidity_score: 0,
      volatility_score: 0,
      regime: 'unknown',
      pivot_cleanliness: 0,
      pre_filter_score: 0,
      last_price: 0,
      avg_volume_30d: 0,
      atr_pct: 0,
      error: 'Insufficient data'
    };
  }

  const recent30 = candles.slice(-30);
  const recent90 = candles.slice(-90);
  
  // Last price
  const last_price = candles[candles.length - 1].close;
  
  // Liquidity: avg volume * price (proxy for dollar volume)
  const avg_volume_30d = recent30.reduce((sum, c) => sum + c.volume, 0) / recent30.length;
  const dollarVolume = avg_volume_30d * last_price;
  
  // Normalize liquidity score (0-100)
  // $1M daily = 20, $10M = 50, $100M+ = 100
  const liquidity_score = Math.min(100, Math.log10(Math.max(dollarVolume, 1000)) * 15);
  
  // Volatility: ATR as percentage of price
  const atr = calculateATR(recent30);
  const atr_pct = (atr / last_price) * 100;
  
  // Normalize volatility score (higher = more volatile, 0-100)
  // 1% ATR = 50, 2% = 70, 5% = 100
  const volatility_score = Math.min(100, atr_pct * 20);
  
  // Regime detection using ADX
  const adx = calculateADX(recent90);
  const regime: 'trending' | 'ranging' | 'unknown' = adx > 25 ? 'trending' : 'ranging';
  
  // Pivot cleanliness: ratio of significant pivots to noise
  const pivots = detectPivots(candles.slice(-120), 3); // 3% threshold
  const expectedPivots = 10; // Roughly what we'd expect for clean structure
  const pivotRatio = pivots.length / expectedPivots;
  // Score: closer to expected = higher, too many or too few = lower
  const pivot_cleanliness = Math.max(0, 100 - Math.abs(1 - pivotRatio) * 50);
  
  // Pre-filter score: weighted combination
  // Higher liquidity, moderate volatility, trending regime, clean pivots
  const trendBonus = regime === 'trending' ? 15 : 0;
  const volatilityBonus = atr_pct >= 1 && atr_pct <= 4 ? 10 : 0; // Sweet spot
  
  const pre_filter_score = Math.min(100, 
    liquidity_score * 0.3 +
    pivot_cleanliness * 0.4 +
    volatilityBonus +
    trendBonus +
    (regime === 'trending' ? volatility_score * 0.15 : 0)
  );

  return {
    symbol,
    liquidity_score: Math.round(liquidity_score * 10) / 10,
    volatility_score: Math.round(volatility_score * 10) / 10,
    regime,
    pivot_cleanliness: Math.round(pivot_cleanliness * 10) / 10,
    pre_filter_score: Math.round(pre_filter_score * 10) / 10,
    last_price: Math.round(last_price * 100) / 100,
    avg_volume_30d: Math.round(avg_volume_30d),
    atr_pct: Math.round(atr_pct * 100) / 100
  };
}

// ============================================================================
// SECTION 5: MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ScanRequest = await req.json();
    const { 
      symbols, 
      base_timeframe = '1D',
      topN = 10,
      include_fundamentals = false 
    } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('symbols array is required');
    }

    console.log(`Scanning ${symbols.length} symbols with base_timeframe=${base_timeframe}, topN=${topN}`);

    const rankings: SymbolMetrics[] = [];
    let processed = 0;
    let failed = 0;

    // Process symbols in parallel batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const candles = await fetchOHLCV(symbol, base_timeframe);
            const metrics = analyzeSymbol(candles, symbol);
            
            // Optionally fetch fundamentals
            if (include_fundamentals) {
              const fundamentals = await fetchFundamentals(symbol);
              return { ...metrics, fundamentals };
            }
            
            return metrics;
          } catch (error) {
            console.error(`Error processing ${symbol}:`, error);
            failed++;
            return {
              symbol,
              liquidity_score: 0,
              volatility_score: 0,
              regime: 'unknown' as const,
              pivot_cleanliness: 0,
              pre_filter_score: 0,
              last_price: 0,
              avg_volume_30d: 0,
              atr_pct: 0,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      rankings.push(...batchResults);
      processed += batch.length;
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < symbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Sort by pre_filter_score descending
    rankings.sort((a, b) => b.pre_filter_score - a.pre_filter_score);

    // Get top N symbols for deep analysis
    const top_symbols = rankings
      .filter(r => !r.error)
      .slice(0, topN)
      .map(r => r.symbol);

    const result: ScanResult = {
      scan_id: crypto.randomUUID(),
      total_symbols: symbols.length,
      processed,
      failed,
      rankings,
      top_symbols,
      created_at: new Date().toISOString()
    };

    console.log(`Scan complete: ${processed} processed, ${failed} failed, top ${top_symbols.length} symbols selected`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Scan error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to complete universe scan'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
