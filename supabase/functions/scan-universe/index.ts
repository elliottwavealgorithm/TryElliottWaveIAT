import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "0.4";

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

interface Pivot {
  index: number;
  type: 'high' | 'low';
  price: number;
  date: string;
  prominence: number;
  scale: 'macro' | 'meso' | 'micro';
}

interface SymbolMetrics {
  symbol: string;
  shortName?: string;
  liquidity_score: number;
  volatility_score: number;
  regime: 'trending' | 'ranging' | 'unknown';
  pivot_cleanliness: number;
  pre_filter_score: number;
  last_price: number;
  avg_volume_30d: number;
  atr_pct: number;
  // Structure scoring fields
  structure_score?: number;
  fundamentals_score?: number;
  attention_score_13f?: number;
  final_score?: number;
  // Deep precheck fields (only for topN)
  ew_structural_score?: number;
  ew_ready?: boolean;
  ew_notes?: string;
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
  include_structure_score?: boolean;
  run_deep_precheck?: boolean;
  persist?: boolean;
  user_id?: string;
}

interface ScanResult {
  scan_id: string;
  api_version: string;
  total_symbols: number;
  processed: number;
  failed: number;
  rankings: SymbolMetrics[];
  top_symbols: string[];
  created_at: string;
  persisted?: boolean;
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

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=${interval === '1W' ? '1wk' : '1d'}`;
  
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

  setCache(cacheKey, candles, 5 * 60 * 1000);
  return candles;
}

async function fetchFundamentals(symbol: string): Promise<FundamentalsSnapshot> {
  const cacheKey = `fundamentals_${symbol}`;
  const cached = getCached<FundamentalsSnapshot>(cacheKey);
  if (cached) return cached;

  try {
    // Use quote endpoint for shortName + basic stats
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const quoteResponse = await fetch(quoteUrl);
    let shortName: string | null = null;
    let marketCap: number | null = null;
    let trailingPE: number | null = null;
    
    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      const quote = quoteData.quoteResponse?.result?.[0];
      if (quote) {
        shortName = quote.shortName || quote.longName || null;
        marketCap = quote.marketCap || null;
        trailingPE = quote.trailingPE || null;
      }
    }

    // Fetch detailed fundamentals
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryProfile,defaultKeyStatistics,financialData,calendarEvents`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Fundamentals not available for ${symbol}`);
      return { ...getEmptyFundamentals(), shortName };
    }

    const data = await response.json();
    const result = data.quoteSummary?.result?.[0];
    
    if (!result) return { ...getEmptyFundamentals(), shortName };

    const profile = result.summaryProfile || {};
    const keyStats = result.defaultKeyStatistics || {};
    const financialData = result.financialData || {};
    const calendar = result.calendarEvents || {};

    const fundamentals: FundamentalsSnapshot = {
      marketCap: marketCap || keyStats.marketCap?.raw || financialData.marketCap?.raw || null,
      trailingPE: trailingPE || keyStats.trailingPE?.raw || null,
      forwardPE: keyStats.forwardPE?.raw || null,
      revenueGrowth: financialData.revenueGrowth?.raw || null,
      earningsGrowth: financialData.earningsGrowth?.raw || null,
      nextEarningsDate: calendar.earnings?.earningsDate?.[0]?.fmt || null,
      sector: profile.sector || null,
      industry: profile.industry || null,
      shortName
    };

    setCache(cacheKey, fundamentals, 60 * 60 * 1000);
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
// SECTION 4: TECHNICAL ANALYSIS - ADAPTIVE ZIGZAG
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
  if (candles.length < period * 2) return 25;
  
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
  
  const recentDX = dx.slice(-period);
  return recentDX.reduce((a, b) => a + b, 0) / recentDX.length;
}

// Adaptive ZigZag with ATR-based thresholds (same approach as analyze-elliott-wave)
function computeAdaptiveZigZag(
  candles: Candle[],
  thresholdPct: number,
  minBars: number,
  atr: number,
  minSwingATRMultiple: number,
  scale: 'macro' | 'meso' | 'micro'
): Pivot[] {
  if (candles.length < minBars) return [];

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const n = candles.length;
  const minSwing = atr * minSwingATRMultiple;

  let lastPivotIdx = 0;
  let lastHigh = highs[0], lastLow = lows[0];
  let lastHighIdx = 0, lastLowIdx = 0;
  let trend = 0;

  const pivots: Pivot[] = [];

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
    const dropAbs = lastHigh - lows[i];
    const riseAbs = highs[i] - lastLow;

    const dropValid = dropFromHigh >= thresholdPct && dropAbs >= minSwing;
    const riseValid = riseFromLow >= thresholdPct && riseAbs >= minSwing;

    if ((trend >= 0) && dropValid && ((i - lastPivotIdx) >= minBars)) {
      pivots.push({
        index: lastHighIdx,
        type: "high",
        price: lastHigh,
        date: candles[lastHighIdx].date,
        prominence: dropFromHigh,
        scale
      });
      lastPivotIdx = lastHighIdx;
      lastLow = lows[i];
      lastLowIdx = i;
      trend = -1;
    } else if ((trend <= 0) && riseValid && ((i - lastPivotIdx) >= minBars)) {
      pivots.push({
        index: lastLowIdx,
        type: "low",
        price: lastLow,
        date: candles[lastLowIdx].date,
        prominence: riseFromLow,
        scale
      });
      lastPivotIdx = lastLowIdx;
      lastHigh = highs[i];
      lastHighIdx = i;
      trend = 1;
    }
  }

  return pivots;
}

// ============================================================================
// SECTION 5: PIVOT CLEANLINESS & STRUCTURAL SCORING
// ============================================================================

interface PivotCleanlinessMetrics {
  score: number;
  pivot_count_120bars: number;
  median_prominence: number;
  avg_swing_atr_multiple: number;
}

function calculatePivotCleanliness(candles: Candle[], atr: number): PivotCleanlinessMetrics {
  const recent120 = candles.slice(-120);
  if (recent120.length < 30) {
    return { score: 0, pivot_count_120bars: 0, median_prominence: 0, avg_swing_atr_multiple: 0 };
  }
  
  const recentATR = calculateATR(recent120) || atr;
  
  // Use meso-level thresholds for cleanliness
  const pivots = computeAdaptiveZigZag(recent120, 4.0, 4, recentATR, 1.2, 'meso');
  
  const pivot_count_120bars = pivots.length;
  
  // Ideal range: 8-15 pivots for 120 bars
  const expectedMin = 8;
  const expectedMax = 15;
  let countScore = 0;
  if (pivot_count_120bars >= expectedMin && pivot_count_120bars <= expectedMax) {
    countScore = 40; // Ideal
  } else if (pivot_count_120bars > expectedMax) {
    countScore = Math.max(0, 40 - (pivot_count_120bars - expectedMax) * 3); // Penalty for too many
  } else {
    countScore = Math.max(0, 40 - (expectedMin - pivot_count_120bars) * 5); // Penalty for too few
  }
  
  // Median prominence
  const prominences = pivots.map(p => p.prominence).sort((a, b) => a - b);
  const median_prominence = prominences.length > 0 
    ? prominences[Math.floor(prominences.length / 2)] 
    : 0;
  
  // Prominence score: higher is better (3-8% is sweet spot)
  let prominenceScore = 0;
  if (median_prominence >= 3 && median_prominence <= 8) {
    prominenceScore = 30;
  } else if (median_prominence > 8) {
    prominenceScore = 25;
  } else if (median_prominence >= 2) {
    prominenceScore = 15;
  }
  
  // Calculate avg swing in ATR multiples
  let totalSwingATR = 0;
  for (let i = 0; i < pivots.length - 1; i++) {
    const swing = Math.abs(pivots[i + 1].price - pivots[i].price);
    totalSwingATR += swing / recentATR;
  }
  const avg_swing_atr_multiple = pivots.length > 1 ? totalSwingATR / (pivots.length - 1) : 0;
  
  // ATR multiple score: 1.5-3.0 is ideal
  let atrScore = 0;
  if (avg_swing_atr_multiple >= 1.5 && avg_swing_atr_multiple <= 3.0) {
    atrScore = 30;
  } else if (avg_swing_atr_multiple > 3.0) {
    atrScore = 20;
  } else if (avg_swing_atr_multiple >= 1.0) {
    atrScore = 15;
  }
  
  const score = Math.min(100, countScore + prominenceScore + atrScore);
  
  return {
    score: Math.round(score * 10) / 10,
    pivot_count_120bars,
    median_prominence: Math.round(median_prominence * 100) / 100,
    avg_swing_atr_multiple: Math.round(avg_swing_atr_multiple * 100) / 100
  };
}

// ============================================================================
// SECTION 6: DEEP PRECHECK (EW Structural Score without LLM)
// ============================================================================

interface DeepPrecheckResult {
  ew_structural_score: number;
  ew_ready: boolean;
  notes: string;
}

function runDeepPrecheck(candles: Candle[], atr: number): DeepPrecheckResult {
  if (candles.length < 100) {
    return { ew_structural_score: 0, ew_ready: false, notes: "Insufficient data (<100 bars)" };
  }
  
  // Get multi-scale pivots
  const macroPivots = computeAdaptiveZigZag(candles, 10.0, 10, atr, 3.0, 'macro');
  const mesoPivots = computeAdaptiveZigZag(candles, 5.0, 5, atr, 1.5, 'meso');
  
  let score = 0;
  const notes: string[] = [];
  
  // Check 1: Minimum macro pivots for structure (at least 3)
  if (macroPivots.length >= 3) {
    score += 20;
    notes.push("Macro structure present");
  } else {
    notes.push("Insufficient macro pivots");
  }
  
  // Check 2: Alternation pattern (high-low-high or low-high-low)
  let alternationValid = true;
  for (let i = 1; i < Math.min(mesoPivots.length, 6); i++) {
    if (mesoPivots[i].type === mesoPivots[i - 1].type) {
      alternationValid = false;
      break;
    }
  }
  if (alternationValid && mesoPivots.length >= 4) {
    score += 25;
    notes.push("Good alternation pattern");
  }
  
  // Check 3: Wave 3 not shortest approximation
  // Find 3 consecutive up-moves and check middle isn't shortest
  const upMoves: number[] = [];
  for (let i = 0; i < mesoPivots.length - 1; i++) {
    if (mesoPivots[i].type === 'low' && mesoPivots[i + 1].type === 'high') {
      upMoves.push(mesoPivots[i + 1].price - mesoPivots[i].price);
    }
  }
  if (upMoves.length >= 3) {
    const lastThree = upMoves.slice(-3);
    const middleIdx = 1;
    const middleIsSmallest = lastThree[middleIdx] <= Math.min(lastThree[0], lastThree[2]);
    if (!middleIsSmallest) {
      score += 25;
      notes.push("W3≠shortest check passed");
    } else {
      notes.push("Potential W3 shortest issue");
    }
  }
  
  // Check 4: Clear trend bias in recent action
  const recent50 = candles.slice(-50);
  const startPrice = recent50[0].close;
  const endPrice = recent50[recent50.length - 1].close;
  const trendPct = ((endPrice - startPrice) / startPrice) * 100;
  if (Math.abs(trendPct) > 5) {
    score += 15;
    notes.push(`Clear trend: ${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%`);
  }
  
  // Check 5: Not in extreme chop
  const volatility = (Math.max(...recent50.map(c => c.high)) - Math.min(...recent50.map(c => c.low))) / endPrice * 100;
  if (volatility < 30 && volatility > 5) {
    score += 15;
    notes.push("Healthy volatility range");
  }
  
  return {
    ew_structural_score: Math.min(100, score),
    ew_ready: score >= 50,
    notes: notes.join("; ")
  };
}

// ============================================================================
// SECTION 7: MAIN ANALYSIS FUNCTION
// ============================================================================

function analyzeSymbol(candles: Candle[], symbol: string, atr: number): Omit<SymbolMetrics, 'fundamentals' | 'shortName'> {
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
  
  const last_price = candles[candles.length - 1].close;
  
  // Liquidity: avg volume * price (proxy for dollar volume)
  const avg_volume_30d = recent30.reduce((sum, c) => sum + c.volume, 0) / recent30.length;
  const dollarVolume = avg_volume_30d * last_price;
  
  // CALIBRATED liquidity score (logarithmic, less saturating)
  // $100K = 10, $1M = 30, $10M = 50, $100M = 70, $1B = 90
  const liquidity_score = Math.min(100, Math.max(0, 
    10 + Math.log10(Math.max(dollarVolume, 100000)) * 12 - 60
  ));
  
  // Volatility: ATR as percentage of price
  const atr_pct = (atr / last_price) * 100;
  
  // CALIBRATED volatility score (less saturating)
  // 0.5% = 25, 1% = 40, 2% = 55, 4% = 70, 8% = 85
  const volatility_score = Math.min(100, Math.max(0,
    25 + Math.log2(Math.max(atr_pct, 0.5)) * 20
  ));
  
  // Regime detection using ADX
  const adx = calculateADX(recent90);
  const regime: 'trending' | 'ranging' | 'unknown' = adx > 25 ? 'trending' : 'ranging';
  
  // Pivot cleanliness using adaptive ZigZag
  const cleanlinessMetrics = calculatePivotCleanliness(candles, atr);
  const pivot_cleanliness = cleanlinessMetrics.score;
  
  // Pre-filter score: weighted combination
  const trendBonus = regime === 'trending' ? 10 : 0;
  const volatilityBonus = atr_pct >= 1 && atr_pct <= 4 ? 8 : (atr_pct >= 0.5 && atr_pct <= 6 ? 4 : 0);
  
  const pre_filter_score = Math.min(100, 
    liquidity_score * 0.20 +
    pivot_cleanliness * 0.45 +
    volatilityBonus +
    trendBonus +
    (regime === 'trending' ? volatility_score * 0.10 : 0) +
    15 // Base score
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
// SECTION 8: MAIN HANDLER
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
      include_fundamentals = false,
      include_structure_score = false,
      run_deep_precheck = false,
      persist = false,
      user_id
    } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('symbols array is required');
    }

    console.log(`[v${API_VERSION}] Scanning ${symbols.length} symbols with base_timeframe=${base_timeframe}, topN=${topN}, structure=${include_structure_score}, persist=${persist}`);

    // Initialize Supabase client for persistence
    let supabase: any = null;
    let scanId: string | null = null;
    
    if (persist) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Create scan record
      if (user_id) {
        const { data: scanData, error: scanError } = await supabase
          .from('scans')
          .insert({
            user_id,
            base_timeframe,
            universe_size: symbols.length,
            top_n: topN,
            include_fundamentals,
            include_structure_score,
            status: 'running',
            params: { symbols }
          })
          .select('id')
          .single();
        
        if (scanError) {
          console.error('Failed to create scan record:', scanError);
        } else {
          scanId = scanData.id;
          console.log(`Created scan record: ${scanId}`);
        }
      }
    }

    const rankings: SymbolMetrics[] = [];
    let processed = 0;
    let failed = 0;

    // Process symbols in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const candles = await fetchOHLCV(symbol, base_timeframe);
            const atr = calculateATR(candles);
            const metrics = analyzeSymbol(candles, symbol, atr);
            
            let result: SymbolMetrics = { ...metrics };
            
            // Fetch fundamentals if requested
            if (include_fundamentals) {
              const fundamentals = await fetchFundamentals(symbol);
              result.fundamentals = fundamentals;
              result.shortName = fundamentals.shortName || undefined;
            }
            
            return result;
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
      
      if (i + batchSize < symbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Sort by pre_filter_score descending
    rankings.sort((a, b) => b.pre_filter_score - a.pre_filter_score);

    // Get top N symbols for structure scoring
    const topRankings = rankings.filter(r => !r.error).slice(0, topN);
    
    // Run structure scoring for topN if requested
    if (include_structure_score && topRankings.length > 0) {
      console.log(`Running structure scoring for top ${topRankings.length} symbols...`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      // Process in smaller batches for structure scoring
      for (let i = 0; i < topRankings.length; i += 3) {
        const batch = topRankings.slice(i, i + 3);
        
        await Promise.all(batch.map(async (ranking) => {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/prefilter-elliott`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
              },
              body: JSON.stringify({ symbol: ranking.symbol, timeframe: base_timeframe })
            });
            
            if (response.ok) {
              const prefilterData = await response.json();
              ranking.structure_score = prefilterData.structure_score || 0;
              ranking.ew_notes = prefilterData.notes?.join('; ') || '';
            }
          } catch (error) {
            console.error(`Structure score failed for ${ranking.symbol}:`, error);
            ranking.structure_score = 0;
          }
        }));
        
        if (i + 3 < topRankings.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
    
    // Run deep precheck for topN if requested
    if (run_deep_precheck && topRankings.length > 0) {
      console.log(`Running deep precheck for top ${topRankings.length} symbols...`);
      
      for (const ranking of topRankings) {
        try {
          const candles = await fetchOHLCV(ranking.symbol, base_timeframe);
          const atr = calculateATR(candles);
          const precheck = runDeepPrecheck(candles, atr);
          
          ranking.ew_structural_score = precheck.ew_structural_score;
          ranking.ew_ready = precheck.ew_ready;
          ranking.ew_notes = precheck.notes;
        } catch (error) {
          console.error(`Deep precheck failed for ${ranking.symbol}:`, error);
          ranking.ew_structural_score = 0;
          ranking.ew_ready = false;
          ranking.ew_notes = 'Precheck failed';
        }
      }
    }

    // Calculate fundamentals_score and final_score with protections
    for (const ranking of topRankings) {
      // PROTECTION: Zero score for symbols with errors or insufficient data
      if (ranking.error) {
        ranking.fundamentals_score = 0;
        ranking.final_score = 0;
        ranking.attention_score_13f = null;
        continue;
      }
      
      // Fundamentals score (simple heuristic)
      let fundScore = 50; // Base score
      let hasMissingFundamentals = false;
      
      if (include_fundamentals && ranking.fundamentals) {
        const f = ranking.fundamentals;
        if (f.earningsGrowth !== null && f.earningsGrowth > 0) fundScore += 15;
        if (f.revenueGrowth !== null && f.revenueGrowth > 0) fundScore += 10;
        if (f.forwardPE !== null && f.forwardPE > 0 && f.forwardPE < 30) fundScore += 10;
        
        // PROTECTION: Penalize missing fundamentals when requested
        if (f.marketCap === null && f.sector === null) {
          fundScore -= 15; // Significant penalty for completely missing fundamentals
          hasMissingFundamentals = true;
        } else if (!f.marketCap) {
          fundScore -= 10; // Penalize missing market cap
        }
      } else if (include_fundamentals && !ranking.fundamentals) {
        // Fundamentals requested but completely unavailable
        fundScore -= 15;
        hasMissingFundamentals = true;
      }
      
      ranking.fundamentals_score = Math.min(100, Math.max(0, fundScore));
      
      // Attention score placeholder
      ranking.attention_score_13f = null;
      
      // Final score: weighted combination
      // 55% pre_filter + 30% structure + 15% fundamentals
      const structScore = ranking.structure_score ?? ranking.ew_structural_score ?? ranking.pre_filter_score;
      let finalScore = 
        ranking.pre_filter_score * 0.55 +
        structScore * 0.30 +
        (ranking.fundamentals_score || 50) * 0.15;
      
      // PROTECTION: Subtract penalty if data quality issues detected
      if (hasMissingFundamentals) {
        finalScore = Math.max(0, finalScore - 5);
      }
      
      ranking.final_score = Math.round(finalScore * 10) / 10;
    }

    // Re-sort by final_score
    topRankings.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    // Update all rankings with final scores
    for (const ranking of rankings) {
      const top = topRankings.find(t => t.symbol === ranking.symbol);
      if (top) {
        ranking.structure_score = top.structure_score;
        ranking.fundamentals_score = top.fundamentals_score;
        ranking.final_score = top.final_score;
        ranking.ew_structural_score = top.ew_structural_score;
        ranking.ew_ready = top.ew_ready;
        ranking.ew_notes = top.ew_notes;
      }
    }

    const top_symbols = topRankings.map(r => r.symbol);
    const createdAt = new Date().toISOString();
    
    // Persist scan_symbols if requested
    let persisted = false;
    if (persist && supabase && scanId) {
      const symbolRows = rankings.map(r => ({
        scan_id: scanId,
        symbol: r.symbol,
        final_score: r.final_score ?? r.pre_filter_score,
        liquidity_score: r.liquidity_score,
        volatility_score: r.volatility_score,
        regime: r.regime,
        pivot_cleanliness: r.pivot_cleanliness,
        atr_pct: r.atr_pct,
        structure_score: r.structure_score ?? null,
        fundamentals_score: r.fundamentals_score ?? null,
        attention_score_13f: r.attention_score_13f ?? null,
        last_price: r.last_price,
        avg_volume_30d: r.avg_volume_30d,
        fundamentals: r.fundamentals ?? null,
        error: r.error ?? null
      }));
      
      const { error: insertError } = await supabase
        .from('scan_symbols')
        .insert(symbolRows);
      
      if (insertError) {
        console.error('Failed to persist scan_symbols:', insertError);
      } else {
        persisted = true;
        console.log(`Persisted ${symbolRows.length} scan_symbols`);
      }
      
      // Update scan status
      await supabase
        .from('scans')
        .update({
          status: 'completed',
          completed_at: createdAt,
          completed_count: processed,
          symbols_count: symbols.length,
          results_summary: {
            processed,
            failed,
            top_symbols
          }
        })
        .eq('id', scanId);
    }

    const result: ScanResult = {
      scan_id: scanId || crypto.randomUUID(),
      api_version: API_VERSION,
      total_symbols: symbols.length,
      processed,
      failed,
      rankings,
      top_symbols,
      created_at: createdAt,
      persisted
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
        details: 'Failed to complete universe scan',
        api_version: API_VERSION
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
