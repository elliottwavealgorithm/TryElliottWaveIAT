import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const API_VERSION = "0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS
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

interface CageInfo {
  exists: boolean;
  broken: boolean;
  break_direction?: 'up' | 'down';
  break_strength_pct?: number;
}

interface PrefilterRequest {
  symbol: string;
  timeframe?: string;
}

interface PrefilterResult {
  symbol: string;
  structure_score: number;
  regime_hint: 'trending' | 'ranging' | 'unclear';
  cage_presence_score: number;
  alternation_score: number;
  proportionality_score: number;
  pivot_quality_score: number;
  notes: string[];
  api_version: string;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchOHLCV(symbol: string, interval: string): Promise<Candle[]> {
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

  return candles;
}

// ============================================================================
// TECHNICAL HELPERS
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
// STRUCTURE SCORING (Non-LLM Elliott Wave readiness)
// ============================================================================

function calculateAlternationScore(pivots: Pivot[]): number {
  if (pivots.length < 4) return 0;
  
  let score = 0;
  let alternationValid = true;
  
  // Check alternation pattern (high-low-high-low)
  for (let i = 1; i < Math.min(pivots.length, 10); i++) {
    if (pivots[i].type === pivots[i - 1].type) {
      alternationValid = false;
      break;
    }
  }
  
  if (alternationValid) {
    score = 30;
  } else {
    score = 10;
  }
  
  return score;
}

function calculateProportionalityScore(pivots: Pivot[]): number {
  if (pivots.length < 4) return 0;
  
  // Calculate segment moves
  const moves: number[] = [];
  for (let i = 1; i < pivots.length; i++) {
    const pctMove = Math.abs(pivots[i].price - pivots[i - 1].price) / pivots[i - 1].price * 100;
    moves.push(pctMove);
  }
  
  if (moves.length < 2) return 0;
  
  // Check if moves are proportional (not extreme variance)
  const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
  const maxMove = Math.max(...moves);
  const minMove = Math.min(...moves);
  
  // Good proportionality: max is not more than 4x min
  const ratio = maxMove / Math.max(minMove, 0.1);
  
  if (ratio <= 3) return 25;
  if (ratio <= 5) return 15;
  if (ratio <= 8) return 8;
  return 0;
}

function calculatePivotQualityScore(candles: Candle[], atr: number): number {
  const recent120 = candles.slice(-120);
  if (recent120.length < 30) return 0;
  
  const recentATR = calculateATR(recent120) || atr;
  const pivots = computeAdaptiveZigZag(recent120, 4.0, 4, recentATR, 1.2, 'meso');
  
  const pivotCount = pivots.length;
  
  // Ideal range: 8-15 pivots for 120 bars
  let countScore = 0;
  if (pivotCount >= 8 && pivotCount <= 15) {
    countScore = 20;
  } else if (pivotCount > 15) {
    countScore = Math.max(0, 20 - (pivotCount - 15) * 2);
  } else {
    countScore = Math.max(0, 20 - (8 - pivotCount) * 3);
  }
  
  // Median prominence bonus
  const prominences = pivots.map(p => p.prominence).sort((a, b) => a - b);
  const medianProminence = prominences.length > 0 
    ? prominences[Math.floor(prominences.length / 2)] 
    : 0;
  
  let prominenceScore = 0;
  if (medianProminence >= 3 && medianProminence <= 8) {
    prominenceScore = 10;
  } else if (medianProminence > 8) {
    prominenceScore = 7;
  } else if (medianProminence >= 2) {
    prominenceScore = 4;
  }
  
  return countScore + prominenceScore;
}

function calculateCagePresenceScore(candles: Candle[], pivots: Pivot[]): { score: number; info: CageInfo } {
  if (pivots.length < 5) {
    return { score: 0, info: { exists: false, broken: false } };
  }
  
  // Find potential wave 2 and wave 4 pivots (look for lows after highs)
  const lowPivots = pivots.filter(p => p.type === 'low').slice(-3);
  const highPivots = pivots.filter(p => p.type === 'high').slice(-3);
  
  if (lowPivots.length < 2 || highPivots.length < 1) {
    return { score: 0, info: { exists: false, broken: false } };
  }
  
  // Check if there's a valid channel (2-4 line)
  const w2Candidate = lowPivots[lowPivots.length - 2];
  const w4Candidate = lowPivots[lowPivots.length - 1];
  
  if (w4Candidate.index <= w2Candidate.index) {
    return { score: 0, info: { exists: false, broken: false } };
  }
  
  // Calculate slope and check if channel is valid
  const slope = (w4Candidate.price - w2Candidate.price) / (w4Candidate.index - w2Candidate.index);
  
  // Check if recent candles respect the channel
  const lastIdx = candles.length - 1;
  const projectedLower = w2Candidate.price + slope * (lastIdx - w2Candidate.index);
  const lastClose = candles[lastIdx].close;
  
  const broken = lastClose < projectedLower;
  
  let score = 15; // Base score for cage existence
  if (!broken) {
    score += 10; // Bonus for unbroken cage
  }
  
  return {
    score,
    info: {
      exists: true,
      broken,
      break_direction: broken ? 'down' : undefined
    }
  };
}

function determineRegime(candles: Candle[]): 'trending' | 'ranging' | 'unclear' {
  const recent90 = candles.slice(-90);
  if (recent90.length < 30) return 'unclear';
  
  const adx = calculateADX(recent90);
  
  if (adx > 30) return 'trending';
  if (adx < 20) return 'ranging';
  return 'unclear';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PrefilterRequest = await req.json();
    const { symbol, timeframe = '1d' } = body;

    if (!symbol) {
      throw new Error('symbol is required');
    }

    console.log(`[v${API_VERSION}] Prefiltering ${symbol} on ${timeframe}`);

    // Fetch candles
    const candles = await fetchOHLCV(symbol, timeframe);
    
    if (candles.length < 100) {
      return new Response(JSON.stringify({
        symbol,
        structure_score: 0,
        regime_hint: 'unclear',
        cage_presence_score: 0,
        alternation_score: 0,
        proportionality_score: 0,
        pivot_quality_score: 0,
        notes: ['Insufficient data (<100 bars)'],
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const atr = calculateATR(candles);
    const notes: string[] = [];

    // Get multi-scale pivots
    const macroPivots = computeAdaptiveZigZag(candles, 10.0, 10, atr, 3.0, 'macro');
    const mesoPivots = computeAdaptiveZigZag(candles, 5.0, 5, atr, 1.5, 'meso');

    // Score components
    const alternation_score = calculateAlternationScore(mesoPivots);
    if (alternation_score >= 25) notes.push('Good alternation pattern');

    const proportionality_score = calculateProportionalityScore(mesoPivots);
    if (proportionality_score >= 20) notes.push('Proportional wave structure');

    const pivot_quality_score = calculatePivotQualityScore(candles, atr);
    if (pivot_quality_score >= 25) notes.push('Clean pivot structure');

    const { score: cage_presence_score, info: cageInfo } = calculateCagePresenceScore(candles, mesoPivots);
    if (cageInfo.exists) {
      notes.push(cageInfo.broken ? 'Cage broken' : 'Intact cage channel');
    }

    // Check wave 3 not shortest (basic approximation)
    const upMoves: number[] = [];
    for (let i = 0; i < mesoPivots.length - 1; i++) {
      if (mesoPivots[i].type === 'low' && mesoPivots[i + 1].type === 'high') {
        upMoves.push(mesoPivots[i + 1].price - mesoPivots[i].price);
      }
    }
    
    let wave3Bonus = 0;
    if (upMoves.length >= 3) {
      const lastThree = upMoves.slice(-3);
      const middleIsSmallest = lastThree[1] <= Math.min(lastThree[0], lastThree[2]);
      if (!middleIsSmallest) {
        wave3Bonus = 10;
        notes.push('W3≠shortest check passed');
      }
    }

    // Determine regime
    const regime_hint = determineRegime(candles);
    if (regime_hint === 'trending') notes.push('Trending regime');

    // Calculate final structure score
    const structure_score = Math.min(100,
      alternation_score +
      proportionality_score +
      pivot_quality_score +
      cage_presence_score +
      wave3Bonus
    );

    const result: PrefilterResult = {
      symbol,
      structure_score: Math.round(structure_score * 10) / 10,
      regime_hint,
      cage_presence_score,
      alternation_score,
      proportionality_score,
      pivot_quality_score,
      notes,
      api_version: API_VERSION
    };

    console.log(`Prefilter complete for ${symbol}: structure_score=${structure_score}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Prefilter error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        api_version: API_VERSION
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
