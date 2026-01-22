import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const API_VERSION = "0.2";

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
  break_price?: number;
  boundary_value_at_break?: number;
  break_strength_atr?: number;
}

interface PrefilterRequest {
  symbol: string;
  timeframe?: string;
}

interface PrefilterResult {
  symbol: string;
  structure_score: number;
  raw_structure_score: number;
  regime_hint: 'trending' | 'ranging' | 'unclear';
  cage_presence_score: number;
  alternation_score: number;
  proportionality_score: number;
  pivot_quality_score: number;
  wave3_bonus: number;
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
// Max theoretical raw score: 105 (30 + 25 + 30 + 20 + 0) - Wave3 bonus rarely applies
// Realistic max: 115 (30 + 25 + 30 + 20 + 10) with W3 bonus
// Normalized to 0-100 via: round((raw / 115) * 100)
// ============================================================================

function calculateAlternationScore(pivots: Pivot[]): number {
  if (pivots.length < 4) return 0;
  
  let alternationValid = true;
  
  // Check alternation pattern (high-low-high-low)
  for (let i = 1; i < Math.min(pivots.length, 10); i++) {
    if (pivots[i].type === pivots[i - 1].type) {
      alternationValid = false;
      break;
    }
  }
  
  // Max: 30
  return alternationValid ? 30 : 10;
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
  const maxMove = Math.max(...moves);
  const minMove = Math.min(...moves);
  
  // Good proportionality: max is not more than 4x min
  const ratio = maxMove / Math.max(minMove, 0.1);
  
  // Max: 25
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
  
  // Max: 30
  return countScore + prominenceScore;
}

function calculateCagePresenceScore(candles: Candle[], pivots: Pivot[], atr: number): { score: number; info: CageInfo } {
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
  
  // Project upper boundary from high pivots
  const topSlope = highPivots.length >= 2 
    ? (highPivots[highPivots.length - 1].price - highPivots[highPivots.length - 2].price) / 
      (highPivots[highPivots.length - 1].index - highPivots[highPivots.length - 2].index)
    : slope;
  
  // Check if recent candles respect the channel
  const lastIdx = candles.length - 1;
  const projectedLower = w2Candidate.price + slope * (lastIdx - w2Candidate.index);
  const projectedUpper = highPivots[highPivots.length - 2] 
    ? highPivots[highPivots.length - 2].price + topSlope * (lastIdx - highPivots[highPivots.length - 2].index)
    : projectedLower + atr * 3; // Fallback upper boundary
  const lastClose = candles[lastIdx].close;
  
  // ============================================================
  // BIDIRECTIONAL CAGE BREAK DETECTION
  // ============================================================
  const brokeDown = lastClose < projectedLower;
  const brokeUp = lastClose > projectedUpper;
  
  let broken = false;
  let break_direction: 'up' | 'down' | undefined = undefined;
  let break_price: number | undefined = undefined;
  let boundary_value_at_break: number | undefined = undefined;
  
  if (brokeDown) {
    broken = true;
    break_direction = 'down';
    break_price = lastClose;
    boundary_value_at_break = projectedLower;
  } else if (brokeUp) {
    broken = true;
    break_direction = 'up';
    break_price = lastClose;
    boundary_value_at_break = projectedUpper;
  }
  
  const breakStrengthAtr = broken && boundary_value_at_break 
    ? Math.abs(boundary_value_at_break - lastClose) / atr 
    : 0;
  
  // ============================================================
  // CAGE SCORING LOGIC (max = 20, comments aligned with logic)
  // - exists -> +10 base
  // - exists && !broken -> +10 extra (total 20)
  // - exists && broken && break_strength_atr >= 0.8 -> +3 (total 13)
  // - otherwise just exists bonus (10)
  // ============================================================
  let score = 10; // Base for cage existence
  
  if (!broken) {
    score += 10; // Bonus for unbroken cage: total 20
  } else if (breakStrengthAtr >= 0.8) {
    score += 3; // Small bonus for significant break: total 13
  }
  // Otherwise just 10 for broken cage with weak break
  
  // Max from cage scoring: 20 (comments now match logic)
  return {
    score: Math.min(20, score),
    info: {
      exists: true,
      broken,
      break_direction,
      break_price,
      boundary_value_at_break,
      break_strength_atr: breakStrengthAtr
    }
  };
}

function calculateWave3Bonus(pivots: Pivot[]): { bonus: number; hasImpulseLegs: boolean } {
  // Only apply if 3+ candidate impulse legs are detected
  const upMoves: number[] = [];
  for (let i = 0; i < pivots.length - 1; i++) {
    if (pivots[i].type === 'low' && pivots[i + 1].type === 'high') {
      upMoves.push(pivots[i + 1].price - pivots[i].price);
    }
  }
  
  // Guard: require at least 3 impulse legs
  if (upMoves.length < 3) {
    return { bonus: 0, hasImpulseLegs: false };
  }
  
  const lastThree = upMoves.slice(-3);
  const middleIsSmallest = lastThree[1] <= Math.min(lastThree[0], lastThree[2]);
  
  // Max: 10
  return {
    bonus: middleIsSmallest ? 0 : 10,
    hasImpulseLegs: true
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
        raw_structure_score: 0,
        regime_hint: 'unclear',
        cage_presence_score: 0,
        alternation_score: 0,
        proportionality_score: 0,
        pivot_quality_score: 0,
        wave3_bonus: 0,
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

    // Score components (raw values, will normalize at end)
    const alternation_score = calculateAlternationScore(mesoPivots);
    if (alternation_score >= 25) notes.push('Good alternation pattern');

    const proportionality_score = calculateProportionalityScore(mesoPivots);
    if (proportionality_score >= 20) notes.push('Proportional wave structure');

    const pivot_quality_score = calculatePivotQualityScore(candles, atr);
    if (pivot_quality_score >= 25) notes.push('Clean pivot structure');

    const { score: cage_presence_score, info: cageInfo } = calculateCagePresenceScore(candles, mesoPivots, atr);
    if (cageInfo.exists) {
      if (cageInfo.broken) {
        notes.push(`Cage broken (strength: ${cageInfo.break_strength_atr?.toFixed(2)} ATR)`);
      } else {
        notes.push('Intact cage channel');
      }
    }

    // Wave 3 bonus with guard
    const { bonus: wave3_bonus, hasImpulseLegs } = calculateWave3Bonus(mesoPivots);
    if (hasImpulseLegs) {
      if (wave3_bonus > 0) {
        notes.push('W3≠shortest check passed');
      } else {
        notes.push('W3 may be shortest');
      }
    }

    // Determine regime
    const regime_hint = determineRegime(candles);
    if (regime_hint === 'trending') notes.push('Trending regime');

    // Calculate raw structure score (max realistic: 115)
    const raw_structure_score = 
      alternation_score +       // Max 30
      proportionality_score +   // Max 25
      pivot_quality_score +     // Max 30
      cage_presence_score +     // Max 20 (aligned with scoring logic)
      wave3_bonus;              // Max 10 (only if 3+ impulse legs)

    // Normalize to 0-100 scale: (raw / 115) * 100 (aligned with realistic max)
    const structure_score = Math.round((raw_structure_score / 115) * 100);

    const result: PrefilterResult = {
      symbol,
      structure_score,
      raw_structure_score: Math.round(raw_structure_score * 10) / 10,
      regime_hint,
      cage_presence_score,
      alternation_score,
      proportionality_score,
      pivot_quality_score,
      wave3_bonus,
      notes,
      api_version: API_VERSION
    };

    console.log(`Prefilter complete for ${symbol}: raw=${raw_structure_score}, normalized=${structure_score}`);

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
