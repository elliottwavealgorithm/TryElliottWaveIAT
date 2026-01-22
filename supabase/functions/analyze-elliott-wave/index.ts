import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const API_VERSION = "0.3";

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
  prominence?: number;
  source_timeframe?: string;
  scale?: 'macro' | 'meso' | 'micro';
}

interface SegmentFeatures {
  from_pivot: number;
  to_pivot: number;
  pct_move: number;
  abs_move: number;
  bars_count: number;
  slope: number;
  atr_normalized_range: number;
  avg_volume: number;
  rel_volume_vs_prev: number;
  volume_slope: number;
  max_drawdown: number;
  rsi_at_end: number;
  direction: 'up' | 'down';
}

interface MultiScaleSegmentFeatures {
  macro: SegmentFeatures[];
  meso: SegmentFeatures[];
  micro: SegmentFeatures[];
}

interface CageCandidateBreak {
  break_strength_pct: number;
  break_strength_atr: number;
  broken: boolean;
  break_direction?: 'up' | 'down';
  bars_since_break: number;
  first_break_date?: string;
  break_index?: number | null;
  break_price?: number | null;
  boundary_value_at_break?: number | null;
}

interface CagePoint {
  date: string;
  value: number;
}

interface CageCandidate {
  label: string;
  exists: boolean;
  upper_line?: Line;
  lower_line?: Line;
  upper_points?: [CagePoint, CagePoint];
  lower_points?: [CagePoint, CagePoint];
  start_index?: number;
  start_date?: string;
  anchor_index?: number;
  anchor_date?: string;
  projected_to_index?: number;
  projected_to_date?: string;
  break_index?: number | null;
  break_date?: string | null;
  w2_idx?: number;
  w3_idx?: number;
  w4_idx?: number;
  break_info: CageCandidateBreak;
}

interface CageFeatures {
  cage_2_4: {
    exists: boolean;
    broken: boolean;
    break_direction?: 'up' | 'down';
    break_strength_pct: number;
    break_strength_atr: number;
    bars_since_break: number;
    first_break_date?: string;
    selected_candidate?: string;
    upper_line?: Line;
    lower_line?: Line;
    upper_points?: [CagePoint, CagePoint];
    lower_points?: [CagePoint, CagePoint];
    start_index?: number;
    start_date?: string;
    anchor_index?: number;
    anchor_date?: string;
    projected_to_index?: number;
    projected_to_date?: string;
    break_index?: number | null;
    break_date?: string | null;
  };
  cage_2_4_candidates: CageCandidate[];
  cage_ACB: {
    exists: boolean;
    broken_up: boolean;
    broken_down: boolean;
    break_strength_pct: number;
    break_strength_atr: number;
    upper_line?: Line;
    lower_line?: Line;
    upper_points?: [CagePoint, CagePoint];
    lower_points?: [CagePoint, CagePoint];
    start_index?: number;
    start_date?: string;
    anchor_index?: number;
    anchor_date?: string;
    projected_to_index?: number;
    projected_to_date?: string;
    break_index?: number | null;
    break_date?: string | null;
  };
  wedge_cage: {
    exists: boolean;
    broken: boolean;
    break_strength_pct: number;
    break_strength_atr: number;
    wedge_type?: 'expanding' | 'contracting';
    upper_line?: Line;
    lower_line?: Line;
    upper_points?: [CagePoint, CagePoint];
    lower_points?: [CagePoint, CagePoint];
    start_index?: number;
    start_date?: string;
    anchor_index?: number;
    anchor_date?: string;
    projected_to_index?: number;
    projected_to_date?: string;
    break_index?: number | null;
    break_date?: string | null;
  };
}

interface MultiScalePivots {
  macro: Pivot[];
  meso: Pivot[];
  micro: Pivot[];
}

interface TimeframeData {
  candles: Candle[];
  pivots: MultiScalePivots;
  atr: number;
  interval: string;
}

interface CacheEntry {
  data: Candle[];
  timestamp: number;
  ttl: number;
}

interface LLMStatus {
  ok: boolean;
  status_code: number;
  retry_after_seconds?: number;
  error_type?: 'rate_limit' | 'payment_required' | 'server_error' | 'parse_error';
  error_message?: string;
}

interface MajorDegreeInfo {
  degree: 'Supercycle' | 'Cycle' | 'Primary' | 'Intermediate';
  timeframe_used: string;
  from_historical_low: { date: string; price: number };
  why_this_degree: string;
  years_of_data: number;
}

interface Line {
  slope: number;
  intercept: number;
}

// ============================================================================
// SECTION 2: SIMPLE IN-MEMORY CACHE (per-invocation, can be replaced with KV)
// ============================================================================

const cache = new Map<string, CacheEntry>();

function getCacheKey(symbol: string, interval: string): string {
  return `${symbol.toUpperCase()}_${interval}_max`;
}

function getCacheTTL(interval: string): number {
  if (interval === '1wk' || interval === '1d') {
    return 6 * 60 * 60 * 1000; // 6 hours for daily/weekly
  }
  return 5 * 60 * 1000; // 5 minutes for intraday
}

function getFromCache(key: string): Candle[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.timestamp + entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Candle[], interval: string): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: getCacheTTL(interval)
  });
}

// ============================================================================
// SECTION 3: DATA FETCHING FROM YAHOO FINANCE
// ============================================================================

async function fetchOHLCV(symbol: string, interval: string, retries = 3): Promise<Candle[]> {
  const cacheKey = getCacheKey(symbol, interval);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${cacheKey}`);
    return cached;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=${interval}`;
      console.log(`Fetching ${url} (attempt ${attempt + 1})`);
      
      const response = await fetch(url);
      
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Yahoo Finance error for ${symbol}/${interval}:`, errorText);
        if (attempt === retries - 1) {
          throw new Error(`Failed to fetch data for ${symbol}: ${response.status}`);
        }
        continue;
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result || !result.timestamp) {
        throw new Error(`No data available for ${symbol} at ${interval}`);
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

      console.log(`Fetched ${candles.length} candles for ${symbol}/${interval}`);
      setCache(cacheKey, candles, interval);
      return candles;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error(`Failed to fetch data for ${symbol} after ${retries} retries`);
}

function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;
    result.push({
      date: group[0].date,
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0)
    });
  }
  return result;
}

// ============================================================================
// SECTION 4: TECHNICAL INDICATORS
// ============================================================================

function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  
  const recentTRs = trs.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
}

function calculateRSI(candles: Candle[], period = 14): number[] {
  const rsi: number[] = new Array(candles.length).fill(50);
  if (candles.length < period + 1) return rsi;

  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i + 1] = 100 - (100 / (1 + rs));
  }

  return rsi;
}

// ============================================================================
// SECTION 5: MULTI-SCALE ZIGZAG PIVOT DETECTION
// ============================================================================

function computeAdaptiveZigZag(
  candles: Candle[],
  thresholdPct: number,
  minBars: number,
  atr: number,
  minSwingATRMultiple: number,
  scale: 'macro' | 'meso' | 'micro',
  sourceTimeframe: string
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
      const prominence = dropFromHigh;
      pivots.push({
        index: lastHighIdx,
        type: "high",
        price: lastHigh,
        date: candles[lastHighIdx].date,
        prominence,
        scale,
        source_timeframe: sourceTimeframe
      });
      lastPivotIdx = lastHighIdx;
      lastLow = lows[i];
      lastLowIdx = i;
      trend = -1;
    } else if ((trend <= 0) && riseValid && ((i - lastPivotIdx) >= minBars)) {
      const prominence = riseFromLow;
      pivots.push({
        index: lastLowIdx,
        type: "low",
        price: lastLow,
        date: candles[lastLowIdx].date,
        prominence,
        scale,
        source_timeframe: sourceTimeframe
      });
      lastPivotIdx = lastLowIdx;
      lastHigh = highs[i];
      lastHighIdx = i;
      trend = 1;
    }
  }

  return pivots;
}

function computeMultiScalePivots(
  candles: Candle[],
  atr: number,
  sourceTimeframe: string,
  macroThreshold = 10.0,
  mesoThreshold = 5.0,
  microThreshold = 2.0
): MultiScalePivots {
  const macro = computeAdaptiveZigZag(candles, macroThreshold, 10, atr, 3.0, 'macro', sourceTimeframe);
  const meso = computeAdaptiveZigZag(candles, mesoThreshold, 5, atr, 1.5, 'meso', sourceTimeframe);
  const micro = computeAdaptiveZigZag(candles, microThreshold, 3, atr, 0.8, 'micro', sourceTimeframe);

  return { macro, meso, micro };
}

// ============================================================================
// SECTION 6: SEGMENT FEATURES CALCULATION (BY SCALE)
// ============================================================================

function calculateSegmentFeaturesForPivots(
  candles: Candle[],
  pivots: Pivot[],
  rsiValues: number[]
): SegmentFeatures[] {
  const features: SegmentFeatures[] = [];
  
  for (let i = 0; i < pivots.length - 1; i++) {
    const from = pivots[i];
    const to = pivots[i + 1];
    
    const fromIdx = from.index >= 0 ? from.index : 0;
    const toIdx = to.index >= 0 ? to.index : candles.length - 1;
    
    if (fromIdx >= toIdx || fromIdx >= candles.length || toIdx >= candles.length) continue;
    
    const segment = candles.slice(fromIdx, toIdx + 1);
    if (segment.length < 2) continue;
    
    const pct_move = ((to.price - from.price) / from.price) * 100;
    const abs_move = to.price - from.price;
    const bars_count = segment.length;
    const slope = abs_move / bars_count;
    
    const segmentRange = Math.max(...segment.map(c => c.high)) - Math.min(...segment.map(c => c.low));
    const segmentATR = calculateATR(segment, Math.min(14, segment.length - 1)) || 1;
    const atr_normalized_range = segmentRange / segmentATR;
    
    const volumes = segment.map(c => c.volume);
    const avg_volume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const prevSegmentVolume = i > 0 && features[i - 1] ? features[i - 1].avg_volume : avg_volume;
    const rel_volume_vs_prev = avg_volume / (prevSegmentVolume || 1);
    
    let volume_slope = 0;
    if (volumes.length > 1) {
      const midpoint = Math.floor(volumes.length / 2);
      const firstHalf = volumes.slice(0, midpoint);
      const secondHalf = volumes.slice(midpoint);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      volume_slope = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;
    }
    
    let maxDrawdown = 0;
    if (from.type === 'low') {
      let peak = segment[0].close;
      for (const candle of segment) {
        if (candle.high > peak) peak = candle.high;
        const dd = (peak - candle.low) / peak * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    } else {
      let trough = segment[0].close;
      for (const candle of segment) {
        if (candle.low < trough) trough = candle.low;
        const rally = trough > 0 ? (candle.high - trough) / trough * 100 : 0;
        if (rally > maxDrawdown) maxDrawdown = rally;
      }
    }
    
    const rsi_at_end = rsiValues[toIdx] || 50;
    
    features.push({
      from_pivot: i,
      to_pivot: i + 1,
      pct_move,
      abs_move,
      bars_count,
      slope,
      atr_normalized_range,
      avg_volume,
      rel_volume_vs_prev,
      volume_slope,
      max_drawdown: maxDrawdown,
      rsi_at_end,
      direction: pct_move > 0 ? 'up' : 'down'
    });
  }
  
  return features;
}

function calculateMultiScaleSegmentFeatures(
  candles: Candle[],
  pivots: MultiScalePivots,
  rsiValues: number[]
): MultiScaleSegmentFeatures {
  return {
    macro: calculateSegmentFeaturesForPivots(candles, pivots.macro, rsiValues),
    meso: calculateSegmentFeaturesForPivots(candles, pivots.meso, rsiValues),
    micro: calculateSegmentFeaturesForPivots(candles, pivots.micro, rsiValues)
  };
}

// ============================================================================
// SECTION 7: CAGE FEATURES CALCULATION (MULTI-CANDIDATE + ATR BREAK STRENGTH)
// ============================================================================

function detectCageBreakWithATR(
  cage: { upper: Line; lower: Line },
  candles: Candle[],
  startCheckIdx: number,
  atr: number
): CageCandidateBreak {
  const result: CageCandidateBreak = {
    break_strength_pct: 0,
    break_strength_atr: 0,
    broken: false,
    bars_since_break: 0,
    break_index: null,
    break_price: null,
    boundary_value_at_break: null
  };

  if (!cage.upper || !cage.lower || atr === 0) return result;

  for (let i = Math.max(startCheckIdx, 0); i < candles.length; i++) {
    const projectedUpper = cage.upper.slope * i + cage.upper.intercept;
    const projectedLower = cage.lower.slope * i + cage.lower.intercept;
    const close = candles[i].close;

    const brokeDown = close < projectedLower;
    const brokeUp = close > projectedUpper;

    if (brokeDown || brokeUp) {
      const distance = brokeDown 
        ? (projectedLower - close) 
        : (close - projectedUpper);
      const boundary = brokeDown ? projectedLower : projectedUpper;
      
      result.broken = true;
      result.break_direction = brokeDown ? 'down' : 'up';
      result.break_strength_pct = (distance / boundary) * 100;
      result.break_strength_atr = distance / atr;
      result.bars_since_break = candles.length - 1 - i;
      result.first_break_date = candles[i].date;
      result.break_index = i;
      result.break_price = close;
      result.boundary_value_at_break = boundary;
      break;
    }
  }

  return result;
}

function generateCageCandidates(
  candles: Candle[],
  pivots: Pivot[],
  atr: number
): CageCandidate[] {
  const candidates: CageCandidate[] = [];
  
  const lowPivots = pivots.filter(p => p.type === 'low').slice(-6);
  const highPivots = pivots.filter(p => p.type === 'high').slice(-6);
  
  if (lowPivots.length < 2 || highPivots.length < 1) return candidates;
  
  for (let i = 0; i < lowPivots.length - 1; i++) {
    const w2 = lowPivots[i];
    const w4 = lowPivots[i + 1];
    
    const middleHighs = highPivots.filter(h => h.index > w2.index && h.index < w4.index);
    if (middleHighs.length === 0) continue;
    
    const w3 = middleHighs.reduce((a, b) => a.price > b.price ? a : b);
    
    const barsW2toW4 = w4.index - w2.index;
    if (barsW2toW4 < 5) continue;
    
    const lowerSlope = (w4.price - w2.price) / barsW2toW4;
    const lowerIntercept = w2.price - lowerSlope * w2.index;
    
    const upperSlope = lowerSlope;
    const upperIntercept = w3.price - upperSlope * w3.index;
    
    const cage = {
      upper: { slope: upperSlope, intercept: upperIntercept },
      lower: { slope: lowerSlope, intercept: lowerIntercept }
    };
    
    const breakInfo = detectCageBreakWithATR(cage, candles, w4.index + 1, atr);
    
    const lastCandleIndex = candles.length - 1;
    const lastCandleDate = candles[lastCandleIndex].date;
    
    const startDate = candles[w2.index].date;
    const anchorDate = candles[w4.index].date;
    
    const upperY1 = upperSlope * w2.index + upperIntercept;
    const upperY2 = upperSlope * lastCandleIndex + upperIntercept;
    const lowerY1 = lowerSlope * w2.index + lowerIntercept;
    const lowerY2 = lowerSlope * lastCandleIndex + lowerIntercept;
    
    candidates.push({
      label: `cage_${i}`,
      exists: true,
      upper_line: cage.upper,
      lower_line: cage.lower,
      upper_points: [
        { date: startDate, value: upperY1 },
        { date: lastCandleDate, value: upperY2 }
      ],
      lower_points: [
        { date: startDate, value: lowerY1 },
        { date: lastCandleDate, value: lowerY2 }
      ],
      start_index: w2.index,
      start_date: startDate,
      anchor_index: w4.index,
      anchor_date: anchorDate,
      projected_to_index: lastCandleIndex,
      projected_to_date: lastCandleDate,
      break_index: breakInfo.break_index,
      break_date: breakInfo.first_break_date || null,
      w2_idx: w2.index,
      w3_idx: w3.index,
      w4_idx: w4.index,
      break_info: breakInfo
    });
  }
  
  return candidates;
}

function computeCageFeatures(
  candles: Candle[],
  pivots: Pivot[],
  atr: number
): CageFeatures {
  const result: CageFeatures = {
    cage_2_4: {
      exists: false,
      broken: false,
      break_strength_pct: 0,
      break_strength_atr: 0,
      bars_since_break: 0
    },
    cage_2_4_candidates: [],
    cage_ACB: {
      exists: false,
      broken_up: false,
      broken_down: false,
      break_strength_pct: 0,
      break_strength_atr: 0
    },
    wedge_cage: {
      exists: false,
      broken: false,
      break_strength_pct: 0,
      break_strength_atr: 0
    }
  };

  if (pivots.length < 4 || candles.length < 10) return result;

  const candidates = generateCageCandidates(candles, pivots, atr);
  result.cage_2_4_candidates = candidates;
  
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => 
      (b.break_info.broken && b.break_info.break_strength_atr > a.break_info.break_strength_atr) ? b : a
    );
    
    result.cage_2_4 = {
      exists: true,
      broken: best.break_info.broken,
      break_direction: best.break_info.break_direction,
      break_strength_pct: best.break_info.break_strength_pct,
      break_strength_atr: best.break_info.break_strength_atr,
      bars_since_break: best.break_info.bars_since_break,
      first_break_date: best.break_info.first_break_date,
      selected_candidate: best.label,
      upper_line: best.upper_line,
      lower_line: best.lower_line,
      upper_points: best.upper_points,
      lower_points: best.lower_points,
      start_index: best.start_index,
      start_date: best.start_date,
      anchor_index: best.anchor_index,
      anchor_date: best.anchor_date,
      projected_to_index: best.projected_to_index,
      projected_to_date: best.projected_to_date,
      break_index: best.break_index,
      break_date: best.break_date
    };
  }

  const highPivots = pivots.filter(p => p.type === 'high').slice(-4);
  const lowPivots = pivots.filter(p => p.type === 'low').slice(-4);
  
  if (highPivots.length >= 2 && lowPivots.length >= 2) {
    const A = lowPivots[0];
    const C = highPivots[0];
    const B = lowPivots.find(l => l.index > C.index) || lowPivots[1];
    
    if (A && C && B && A.index < C.index && C.index < B.index) {
      const barsAtoB = B.index - A.index;
      if (barsAtoB >= 5) {
        const lowerSlope = (B.price - A.price) / barsAtoB;
        const lowerIntercept = A.price - lowerSlope * A.index;
        
        const upperSlope = lowerSlope;
        const upperIntercept = C.price - upperSlope * C.index;
        
        const cage = {
          upper: { slope: upperSlope, intercept: upperIntercept },
          lower: { slope: lowerSlope, intercept: lowerIntercept }
        };
        
        const lastCandleIndex = candles.length - 1;
        const lastCandleDate = candles[lastCandleIndex].date;
        const startDate = candles[A.index].date;
        const anchorDate = candles[B.index].date;
        
        const upperY1 = upperSlope * A.index + upperIntercept;
        const upperY2 = upperSlope * lastCandleIndex + upperIntercept;
        const lowerY1 = lowerSlope * A.index + lowerIntercept;
        const lowerY2 = lowerSlope * lastCandleIndex + lowerIntercept;
        
        result.cage_ACB.exists = true;
        result.cage_ACB.upper_line = cage.upper;
        result.cage_ACB.lower_line = cage.lower;
        result.cage_ACB.upper_points = [
          { date: startDate, value: upperY1 },
          { date: lastCandleDate, value: upperY2 }
        ];
        result.cage_ACB.lower_points = [
          { date: startDate, value: lowerY1 },
          { date: lastCandleDate, value: lowerY2 }
        ];
        result.cage_ACB.start_index = A.index;
        result.cage_ACB.start_date = startDate;
        result.cage_ACB.anchor_index = B.index;
        result.cage_ACB.anchor_date = anchorDate;
        result.cage_ACB.projected_to_index = lastCandleIndex;
        result.cage_ACB.projected_to_date = lastCandleDate;
        
        for (let i = B.index + 1; i < candles.length; i++) {
          const projectedUpper = cage.upper.slope * i + cage.upper.intercept;
          const projectedLower = cage.lower.slope * i + cage.lower.intercept;
          const close = candles[i].close;
          
          if (close > projectedUpper && !result.cage_ACB.broken_up) {
            result.cage_ACB.broken_up = true;
            const distance = close - projectedUpper;
            result.cage_ACB.break_strength_pct = (distance / projectedUpper) * 100;
            result.cage_ACB.break_strength_atr = distance / atr;
            result.cage_ACB.break_index = i;
            result.cage_ACB.break_date = candles[i].date;
          }
          if (close < projectedLower && !result.cage_ACB.broken_down) {
            result.cage_ACB.broken_down = true;
            const distance = projectedLower - close;
            result.cage_ACB.break_strength_pct = (distance / projectedLower) * 100;
            result.cage_ACB.break_strength_atr = distance / atr;
            result.cage_ACB.break_index = i;
            result.cage_ACB.break_date = candles[i].date;
          }
        }
      }
    }
  }

  if (pivots.length >= 5) {
    const recentPivots = pivots.slice(-5);
    const highs = recentPivots.filter(p => p.type === 'high');
    const lows = recentPivots.filter(p => p.type === 'low');
    
    if (highs.length >= 2 && lows.length >= 2) {
      const upperSlope = (highs[1].price - highs[0].price) / (highs[1].index - highs[0].index);
      const lowerSlope = (lows[1].price - lows[0].price) / (lows[1].index - lows[0].index);
      
      const isConverging = upperSlope < 0 && lowerSlope > 0;
      const isDiverging = upperSlope > 0 && lowerSlope < 0;
      
      if (isConverging || isDiverging) {
        const wedge = {
          upper: { slope: upperSlope, intercept: highs[0].price - upperSlope * highs[0].index },
          lower: { slope: lowerSlope, intercept: lows[0].price - lowerSlope * lows[0].index }
        };
        
        result.wedge_cage.exists = true;
        result.wedge_cage.wedge_type = isConverging ? 'contracting' : 'expanding';
        result.wedge_cage.upper_line = wedge.upper;
        result.wedge_cage.lower_line = wedge.lower;
        
        const startIdx = Math.min(highs[0].index, lows[0].index);
        const anchorIdx = Math.max(highs[1].index, lows[1].index);
        const lastCandleIndex = candles.length - 1;
        const lastCandleDate = candles[lastCandleIndex].date;
        const startDate = candles[startIdx].date;
        const anchorDate = candles[anchorIdx].date;
        
        const upperY1 = wedge.upper.slope * startIdx + wedge.upper.intercept;
        const upperY2 = wedge.upper.slope * lastCandleIndex + wedge.upper.intercept;
        const lowerY1 = wedge.lower.slope * startIdx + wedge.lower.intercept;
        const lowerY2 = wedge.lower.slope * lastCandleIndex + wedge.lower.intercept;
        
        result.wedge_cage.upper_points = [
          { date: startDate, value: upperY1 },
          { date: lastCandleDate, value: upperY2 }
        ];
        result.wedge_cage.lower_points = [
          { date: startDate, value: lowerY1 },
          { date: lastCandleDate, value: lowerY2 }
        ];
        result.wedge_cage.start_index = startIdx;
        result.wedge_cage.start_date = startDate;
        result.wedge_cage.anchor_index = anchorIdx;
        result.wedge_cage.anchor_date = anchorDate;
        result.wedge_cage.projected_to_index = lastCandleIndex;
        result.wedge_cage.projected_to_date = lastCandleDate;
        
        const breakResult = detectCageBreakWithATR(wedge, candles, anchorIdx + 1, atr);
        result.wedge_cage.broken = breakResult.broken;
        result.wedge_cage.break_strength_pct = breakResult.break_strength_pct;
        result.wedge_cage.break_strength_atr = breakResult.break_strength_atr;
        if (breakResult.broken) {
          result.wedge_cage.break_index = breakResult.break_index;
          result.wedge_cage.break_date = breakResult.first_break_date || null;
        }
      }
    }
  }

  return result;
}

// ============================================================================
// SECTION 8: AUTO MAJOR DEGREE SELECTION
// ============================================================================

function determineMajorDegree(
  weeklyCandles: Candle[],
  historicalLow: { price: number; date: string }
): MajorDegreeInfo {
  const yearsOfData = weeklyCandles.length / 52;
  
  let degree: MajorDegreeInfo['degree'];
  let timeframe_used: string;
  let why_this_degree: string;
  
  if (yearsOfData >= 20) {
    degree = 'Supercycle';
    timeframe_used = '1wk';
    why_this_degree = `${yearsOfData.toFixed(1)} years of history enables Supercycle degree analysis from the ${historicalLow.date} low.`;
  } else if (yearsOfData >= 10) {
    degree = 'Cycle';
    timeframe_used = '1wk';
    why_this_degree = `${yearsOfData.toFixed(1)} years of history supports Cycle degree analysis anchored at ${historicalLow.date}.`;
  } else if (yearsOfData >= 3) {
    degree = 'Primary';
    timeframe_used = '1d';
    why_this_degree = `${yearsOfData.toFixed(1)} years of data allows Primary degree analysis from ${historicalLow.date} low.`;
  } else {
    degree = 'Intermediate';
    timeframe_used = '1d';
    why_this_degree = `${yearsOfData.toFixed(1)} years of data limits analysis to Intermediate degree from ${historicalLow.date}.`;
  }
  
  return {
    degree,
    timeframe_used,
    from_historical_low: historicalLow,
    why_this_degree,
    years_of_data: yearsOfData
  };
}

// ============================================================================
// SECTION 9: DETERMINISTIC INVALIDATION CALCULATION
// ============================================================================

function computeDeterministicInvalidation(
  pivots: Pivot[],
  pattern: string,
  currentWave: string,
  historicalLow: { price: number; date: string },
  lastPrice: number
): number {
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  
  // Default to historical low as ultimate invalidation
  let invalidation = historicalLow.price;
  
  const isImpulse = pattern?.toLowerCase().includes('impulse') || 
                    pattern?.toLowerCase().includes('diagonal');
  const isCorrection = pattern?.toLowerCase().includes('zigzag') || 
                       pattern?.toLowerCase().includes('flat') || 
                       pattern?.toLowerCase().includes('triangle');
  
  const waveNum = parseInt(currentWave, 10);
  
  if (isImpulse) {
    if (waveNum === 5 || currentWave?.includes('5')) {
      // Wave 5: Invalidation at wave 4 low
      if (lowPivots.length >= 2) {
        invalidation = lowPivots[lowPivots.length - 1].price;
      }
    } else if (waveNum === 4 || currentWave?.includes('4')) {
      // Wave 4: Invalidation at wave 1 high (cannot enter wave 1 territory)
      if (highPivots.length >= 1) {
        invalidation = highPivots[0].price;
      }
    } else if (waveNum === 3 || currentWave?.includes('3')) {
      // Wave 3: Invalidation at wave 2 low (below wave 1 start)
      if (lowPivots.length >= 1) {
        invalidation = lowPivots[0].price;
      }
    } else if (waveNum === 2 || currentWave?.includes('2')) {
      // Wave 2: Cannot retrace 100% of wave 1
      if (lowPivots.length >= 1) {
        invalidation = lowPivots[0].price * 0.999; // Just below wave 1 start
      }
    }
  } else if (isCorrection) {
    if (currentWave?.includes('C') || currentWave?.includes('c')) {
      // Wave C: Invalidation at wave B high (for bearish) or low (for bullish)
      if (highPivots.length >= 1) {
        const lastHigh = highPivots[highPivots.length - 1];
        const lastLow = lowPivots.length > 0 ? lowPivots[lowPivots.length - 1] : null;
        
        // Determine correction direction
        if (lastLow && lastLow.index > lastHigh.index) {
          // Bearish correction
          invalidation = lastHigh.price;
        } else {
          // Bullish correction
          invalidation = lastLow?.price || historicalLow.price;
        }
      }
    } else if (currentWave?.includes('B') || currentWave?.includes('b')) {
      // Wave B: Invalidation depends on A
      if (lowPivots.length >= 1) {
        invalidation = lowPivots[lowPivots.length - 1].price;
      }
    }
  }
  
  // Ensure invalidation is below current price for bullish counts
  if (invalidation > lastPrice * 0.99) {
    // Use the nearest significant low below price
    const lowerPivots = lowPivots.filter(p => p.price < lastPrice);
    if (lowerPivots.length > 0) {
      invalidation = lowerPivots[lowerPivots.length - 1].price;
    } else {
      invalidation = historicalLow.price;
    }
  }
  
  return invalidation;
}

// ============================================================================
// SECTION 10: KEY LEVELS NORMALIZATION
// ============================================================================

function normalizeKeyLevels(
  keyLevels: any,
  fallbackInvalidation: number
): { support: number[]; resistance: number[]; fibonacci_targets: number[]; invalidation: number } {
  const normalized = {
    support: [] as number[],
    resistance: [] as number[],
    fibonacci_targets: [] as number[],
    invalidation: fallbackInvalidation
  };
  
  // Normalize support array
  if (Array.isArray(keyLevels?.support)) {
    normalized.support = keyLevels.support
      .map((v: any) => typeof v === 'number' ? v : parseFloat(v))
      .filter((v: number) => !isNaN(v) && isFinite(v));
  }
  
  // Normalize resistance array
  if (Array.isArray(keyLevels?.resistance)) {
    normalized.resistance = keyLevels.resistance
      .map((v: any) => typeof v === 'number' ? v : parseFloat(v))
      .filter((v: number) => !isNaN(v) && isFinite(v));
  }
  
  // Normalize fibonacci_targets array
  if (Array.isArray(keyLevels?.fibonacci_targets)) {
    normalized.fibonacci_targets = keyLevels.fibonacci_targets
      .map((v: any) => typeof v === 'number' ? v : parseFloat(v))
      .filter((v: number) => !isNaN(v) && isFinite(v));
  }
  
  // Normalize invalidation (must be a number)
  if (keyLevels?.invalidation !== undefined && keyLevels?.invalidation !== null) {
    const parsed = typeof keyLevels.invalidation === 'number' 
      ? keyLevels.invalidation 
      : parseFloat(keyLevels.invalidation);
    if (!isNaN(parsed) && isFinite(parsed)) {
      normalized.invalidation = parsed;
    }
  }
  
  return normalized;
}

// ============================================================================
// SECTION 11: TOP-DOWN MULTI-TIMEFRAME ANALYSIS
// ============================================================================

async function performTopDownAnalysis(
  symbol: string,
  requestedTimeframe: string
): Promise<{
  macro: TimeframeData;
  meso: TimeframeData;
  micro: TimeframeData;
  requested: TimeframeData;
}> {
  const weeklyCandles = await fetchOHLCV(symbol, '1wk');
  const dailyCandles = await fetchOHLCV(symbol, '1d');
  
  let requestedInterval: string;
  let mesoInterval: string;
  let microInterval: string;
  
  switch (requestedTimeframe) {
    case '1wk':
      requestedInterval = '1wk';
      mesoInterval = '1d';
      microInterval = '1h';
      break;
    case '1d':
      requestedInterval = '1d';
      mesoInterval = '1h';
      microInterval = '15m';
      break;
    case '4h':
      requestedInterval = '1h';
      mesoInterval = '1h';
      microInterval = '15m';
      break;
    case '1h':
      requestedInterval = '1h';
      mesoInterval = '15m';
      microInterval = '5m';
      break;
    case '15m':
      requestedInterval = '15m';
      mesoInterval = '5m';
      microInterval = '5m';
      break;
    default:
      requestedInterval = '1d';
      mesoInterval = '1h';
      microInterval = '15m';
  }
  
  let requestedCandles: Candle[];
  if (requestedTimeframe === '1wk') {
    requestedCandles = weeklyCandles;
  } else if (requestedTimeframe === '1d') {
    requestedCandles = dailyCandles;
  } else {
    requestedCandles = await fetchOHLCV(symbol, requestedInterval);
    if (requestedTimeframe === '4h') {
      requestedCandles = aggregateCandles(requestedCandles, 4);
    }
  }
  
  let mesoCandles: Candle[];
  try {
    mesoCandles = await fetchOHLCV(symbol, mesoInterval);
  } catch (e) {
    console.log(`Could not fetch ${mesoInterval}, using daily`);
    mesoCandles = dailyCandles;
  }
  
  let microCandles: Candle[];
  try {
    microCandles = await fetchOHLCV(symbol, microInterval);
  } catch (e) {
    console.log(`Could not fetch ${microInterval}, using meso`);
    microCandles = mesoCandles;
  }
  
  const weeklyATR = calculateATR(weeklyCandles);
  const dailyATR = calculateATR(dailyCandles);
  const requestedATR = calculateATR(requestedCandles);
  const mesoATR = calculateATR(mesoCandles);
  const microATR = calculateATR(microCandles);
  
  const weeklyPivots = computeMultiScalePivots(weeklyCandles, weeklyATR, '1wk', 15, 8, 4);
  const dailyPivots = computeMultiScalePivots(dailyCandles, dailyATR, '1d', 10, 5, 2);
  const requestedPivots = computeMultiScalePivots(requestedCandles, requestedATR, requestedTimeframe, 8, 4, 2);
  const mesoPivots = computeMultiScalePivots(mesoCandles, mesoATR, mesoInterval, 6, 3, 1.5);
  const microPivots = computeMultiScalePivots(microCandles, microATR, microInterval, 5, 2.5, 1);
  
  return {
    macro: {
      candles: weeklyCandles,
      pivots: weeklyPivots,
      atr: weeklyATR,
      interval: '1wk'
    },
    meso: {
      candles: dailyCandles,
      pivots: dailyPivots,
      atr: dailyATR,
      interval: '1d'
    },
    micro: {
      candles: mesoCandles,
      pivots: mesoPivots,
      atr: mesoATR,
      interval: mesoInterval
    },
    requested: {
      candles: requestedCandles,
      pivots: requestedPivots,
      atr: requestedATR,
      interval: requestedTimeframe
    }
  };
}

// ============================================================================
// SECTION 12: LLM PROMPT WITH MAJOR DEGREE FIRST + ANTI-GENERIC RULES
// ============================================================================

function buildSystemPrompt(majorDegree: MajorDegreeInfo): string {
  return `You are GOX Agent, an expert quantitative analyst specialized in Elliott Wave Theory.

## CORE APPROACH: MAJOR DEGREE FIRST

**CRITICAL**: This analysis MUST start from the historical low and work from the HIGHEST degree down.
- Primary analysis degree: ${majorDegree.degree}
- Historical low: $${majorDegree.from_historical_low.price.toFixed(4)} on ${majorDegree.from_historical_low.date}
- Years of data: ${majorDegree.years_of_data.toFixed(1)}

You MUST analyze in this order:
1. ${majorDegree.degree} (Highest) → identify the full wave structure from historical low
2. Next lower degree → refine subdivisions
3. Current actionable degree → immediate trading context

## HARD RULES (AUTOMATIC INVALIDATION IF VIOLATED)

1. Wave 2 NEVER retraces 100% of wave 1
2. Wave 3 is NEVER the shortest among waves 1, 3, 5
3. Wave 4 NEVER enters wave 1 territory (except diagonals)
4. Impulse internal structure: 5-3-5-3-5
5. Zigzag: 5-3-5 | Flat: 3-3-5 | Triangle: 3-3-3-3-3

## CAGE THEORY VALIDATION (MANDATORY)

The backend provides MULTIPLE cage candidates (cage_2_4_candidates). 
YOU MUST select the most appropriate cage based on your wave count.

🟦 cage_2_4: Impulse channel scoring (use break_strength_atr):
- break_strength_atr >= 1.5: STRONG break (20 points)
- break_strength_atr 1.0-1.5: MODERATE break (15 points)
- break_strength_atr 0.5-1.0: WEAK break (10 points)
- break_strength_atr < 0.5 or not broken: (5 points)

## 🚫 ANTI-GENERIC RULE (CRITICAL)

You CANNOT conclude "wave 5 in formation" or "completing wave 5" UNLESS at least 3 of these 5 criteria are met:

1. ✅ STRUCTURE: Waves 1-4 clearly identifiable with proper internal structure
2. ✅ HARD RULES: No violations of the 5 hard rules
3. ✅ FIBONACCI: Wave 5 projection aligns with 0.618, 1.0, or 1.618 of wave 1
4. ✅ MOMENTUM: RSI divergence present OR volume declining vs wave 3
5. ✅ CAGE: At least one cage with break_strength_atr >= 0.5

If <3 criteria met → status must be "inconclusive"

## ALTERNATE COUNT WAVES REQUIREMENT (MANDATORY)

For EVERY alternate count, you MUST include a "waves" array with the same format as primary_count.waves.

## OUTPUT FORMAT

**CRITICAL WAVE ARRAY REQUIREMENT**:
- The "waves" array MUST include a "Start" or "0" entry as the FIRST element
- This represents the origin pivot (the low/high before wave 1 begins)
- Example: [{ "wave": "Start", "date": "...", "price": ..., "degree": "..." }, { "wave": "1", ... }, ...]
- Without this origin point, we cannot properly draw wave 1 on the chart

{
  "status": "conclusive" | "inconclusive",
  "symbol": "...",
  "timeframe": "...",
  "evidence_score": 0-100,
  "evidence_checklist": {
    "hard_rules": { "passed": true|false, "score": 0|20, "details": "..." },
    "fibonacci": { "score": 0-20, "details": "..." },
    "momentum_volume": { "score": 0-20, "details": "..." },
    "cages": { "score": 0-20, "details": "...", "selected_cage": "cage_label" },
    "multi_tf_consistency": { "score": 0-20, "details": "..." }
  },
  "multi_degree_analysis": {
    "macro": { "degree": "${majorDegree.degree}", "current_wave": "...", "structure": "..." },
    "meso": { "degree": "...", "current_wave": "...", "within_macro": "..." },
    "micro": { "degree": "...", "current_wave": "...", "within_meso": "..." }
  },
  "historical_low": { "date": "${majorDegree.from_historical_low.date}", "price": ${majorDegree.from_historical_low.price} },
  "primary_count": {
    "pattern": "impulse" | "diagonal" | "zigzag" | "flat" | "complex",
    "correction_type": "zigzag" | "flat" | "triangle" | "combo" | null,
    "waves": [
      { "wave": "Start", "date": "...", "price": ..., "degree": "${majorDegree.degree}" },
      { "wave": "1", "date": "...", "price": ..., "degree": "${majorDegree.degree}" },
      { "wave": "2", "date": "...", "price": ..., "degree": "${majorDegree.degree}" },
      ...
    ],
    "current_wave": "...",
    "next_expected": "...",
    "confidence": 0-100
  },
  "alternate_counts": [{
    "label": "...",
    "probability": 0-100,
    "pattern": "...",
    "justification": "...",
    "key_difference": "...",
    "waves": [
      { "wave": "Start", "date": "...", "price": ..., "degree": "..." },
      { "wave": "1", "date": "...", "price": ..., "degree": "..." },
      ...
    ]
  }],
  "key_levels": {
    "support": [{ "level": number, "source": "pivot-derived" | "fibonacci" | "llm" }],
    "resistance": [{ "level": number, "source": "pivot-derived" | "fibonacci" | "llm" }],
    "fibonacci_targets": [number, number, ...],
    "invalidation": { "level": number, "rule": "wave4-into-wave1" | "wave2-100pct" | "wave-structure", "source": "hard-rule" | "llm" }
  },
  "forecast": {
    "short_term": { "direction": "bullish"|"bearish"|"neutral", "target": number, "timeframe": "..." },
    "medium_term": { "direction": "...", "target": number, "timeframe": "..." },
    "long_term": { "direction": "...", "target": number, "timeframe": "..." }
  },
  "key_uncertainties": ["..."],
  "what_would_confirm": ["..."],
  "summary": "..."
}

## IMPORTANT NOTES

- ALL key_levels values MUST be numeric (not strings) - use objects with "level" and "source" keys
- ALL forecast directions must be: "bullish", "bearish", or "neutral"  
- The invalidation level is MANDATORY and must be a valid number
- EVERY waves array MUST start with a "Start" wave point representing the origin pivot`;
}

function buildUserPrompt(
  symbol: string,
  timeframe: string,
  macroData: TimeframeData,
  mesoData: TimeframeData,
  microData: TimeframeData,
  requestedData: TimeframeData,
  segmentFeatures: MultiScaleSegmentFeatures,
  cageFeatures: CageFeatures,
  historicalLow: { price: number; date: string },
  majorDegree: MajorDegreeInfo,
  userAdjustments?: any
): string {
  const lastCandles = requestedData.candles.slice(-100);
  const candleSummary = lastCandles.map(c => 
    `${c.date}|O:${c.open.toFixed(2)}|H:${c.high.toFixed(2)}|L:${c.low.toFixed(2)}|C:${c.close.toFixed(2)}|V:${c.volume}`
  ).join('\n');

  const formatPivots = (pivots: Pivot[], limit: number) => 
    pivots.slice(-limit).map(p => 
      `${p.date} ${p.type.toUpperCase()} $${p.price.toFixed(2)} (prom: ${p.prominence?.toFixed(1)}%, scale: ${p.scale}, tf: ${p.source_timeframe})`
    ).join('\n');

  let prompt = `
## SYMBOL: ${symbol} | MAJOR DEGREE: ${majorDegree.degree} | AUTO-TIMEFRAME: ${majorDegree.timeframe_used}

## HISTORICAL LOW (ANALYSIS ANCHOR)
Date: ${historicalLow.date} | Price: ${historicalLow.price.toFixed(4)}
Years of Data: ${majorDegree.years_of_data.toFixed(1)}

## MACRO DATA (Weekly - ${majorDegree.degree})
Interval: ${macroData.interval} | ATR(14): ${macroData.atr.toFixed(4)}
### Macro Pivots:
${formatPivots(macroData.pivots.macro, 10)}
### Meso Pivots:
${formatPivots(macroData.pivots.meso, 10)}

## MESO DATA (Daily)
Interval: ${mesoData.interval} | ATR(14): ${mesoData.atr.toFixed(4)}
### Macro Pivots:
${formatPivots(mesoData.pivots.macro, 8)}
### Meso Pivots:
${formatPivots(mesoData.pivots.meso, 12)}
### Micro Pivots:
${formatPivots(mesoData.pivots.micro, 8)}

## MICRO DATA (${microData.interval})
ATR(14): ${microData.atr.toFixed(4)}
### Meso Pivots:
${formatPivots(microData.pivots.meso, 10)}
### Micro Pivots:
${formatPivots(microData.pivots.micro, 15)}

## SEGMENT FEATURES BY SCALE
### Macro Segments:
${JSON.stringify(segmentFeatures.macro.slice(-5), null, 2)}
### Meso Segments:
${JSON.stringify(segmentFeatures.meso.slice(-8), null, 2)}
### Micro Segments:
${JSON.stringify(segmentFeatures.micro.slice(-10), null, 2)}

## CAGE CANDIDATES (EVALUATE AND SELECT)
### cage_2_4_candidates (pick the best one for your count):
${JSON.stringify(cageFeatures.cage_2_4_candidates, null, 2)}

### cage_ACB:
${JSON.stringify(cageFeatures.cage_ACB, null, 2)}

### wedge_cage:
${JSON.stringify(cageFeatures.wedge_cage, null, 2)}

## LAST 100 CANDLES (${timeframe})
${candleSummary}

## CURRENT PRICE
${requestedData.candles[requestedData.candles.length - 1].close.toFixed(2)} (${requestedData.candles[requestedData.candles.length - 1].date})

Total data points: ${requestedData.candles.length}
`;

  if (userAdjustments) {
    prompt += `
## USER ADJUSTMENTS (Training Mode)
${JSON.stringify(userAdjustments, null, 2)}
`;
  }

  prompt += `
## INSTRUCTION
1. Start from historical low at ${historicalLow.date} ($${historicalLow.price.toFixed(2)})
2. Apply ${majorDegree.degree} degree analysis FIRST
3. Use break_strength_atr for CAGES scoring
4. Return ONLY valid JSON matching the specified format
5. ALL key_levels values MUST be numbers (not strings)
`;

  return prompt;
}

// ============================================================================
// SECTION 13: LLM CALL WITH STATUS TRACKING
// ============================================================================

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2
): Promise<{ report: any; llm_status: LLMStatus }> {
  let lastStatus: LLMStatus = { ok: false, status_code: 0 };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`LLM call attempt ${attempt + 1}, prompt length: ${userPrompt.length}`);
      
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
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_completion_tokens: 8000,
        }),
      });

      const statusCode = response.status;
      
      // Parse retry-after header if present
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`LLM API error (attempt ${attempt + 1}):`, statusCode, errorText);
        
        if (statusCode === 429) {
          lastStatus = {
            ok: false,
            status_code: 429,
            error_type: 'rate_limit',
            error_message: 'Rate limit exceeded. Please wait and try again.',
            retry_after_seconds: retryAfterSeconds || 60
          };
          
          if (attempt === maxRetries) {
            return { report: null, llm_status: lastStatus };
          }
          
          // Wait before retry
          const waitTime = Math.pow(2, attempt) * 2000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (statusCode === 402) {
          lastStatus = {
            ok: false,
            status_code: 402,
            error_type: 'payment_required',
            error_message: 'LLM credits required. Please add credits to your Lovable AI workspace.'
          };
          return { report: null, llm_status: lastStatus };
        }
        
        if (statusCode >= 500) {
          lastStatus = {
            ok: false,
            status_code: statusCode,
            error_type: 'server_error',
            error_message: 'AI service temporarily unavailable. Please try again.'
          };
          
          if (attempt === maxRetries) {
            return { report: null, llm_status: lastStatus };
          }
          continue;
        }
        
        lastStatus = {
          ok: false,
          status_code: statusCode,
          error_type: 'server_error',
          error_message: `AI service error: ${statusCode}`
        };
        
        if (attempt === maxRetries) {
          return { report: null, llm_status: lastStatus };
        }
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';
      
      console.log('LLM Response length:', content.length);
      
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('No valid JSON in response');
        lastStatus = {
          ok: false,
          status_code: 200,
          error_type: 'parse_error',
          error_message: 'Could not parse LLM response as JSON'
        };
        if (attempt === maxRetries) {
          return { report: null, llm_status: lastStatus };
        }
        continue;
      }
      
      const jsonText = content.slice(jsonStart, jsonEnd + 1);
      
      try {
        const report = JSON.parse(jsonText);
        console.log('Parsed report, status:', report.status);
        
        // Validate alternate_counts have waves for top 2
        const alternates = report.alternate_counts || [];
        const top2WithoutWaves = alternates.slice(0, 2).filter(
          (alt: any) => !alt.waves || !Array.isArray(alt.waves) || alt.waves.length === 0
        );
        
        if (top2WithoutWaves.length > 0 && attempt < maxRetries) {
          console.log(`Alternate validation failed: ${top2WithoutWaves.length} of top 2 missing waves. Retrying...`);
          continue;
        }
        
        // Normalize forecast directions
        if (report.forecast) {
          const normalizeDirection = (dir: string) => {
            const d = String(dir).toLowerCase();
            if (d === 'up' || d === 'bull') return 'bullish';
            if (d === 'down' || d === 'bear') return 'bearish';
            if (d === 'sideways' || d === 'flat' || d === 'range') return 'neutral';
            return d;
          };
          
          if (report.forecast.short_term) {
            report.forecast.short_term.direction = normalizeDirection(report.forecast.short_term.direction);
          }
          if (report.forecast.medium_term) {
            report.forecast.medium_term.direction = normalizeDirection(report.forecast.medium_term.direction);
          }
          if (report.forecast.long_term) {
            report.forecast.long_term.direction = normalizeDirection(report.forecast.long_term.direction);
          }
        }
        
        // Ensure waves arrays have Start/0 origin pivot
        const ensureOriginPivot = (waves: any[], degree: string) => {
          if (!waves || waves.length === 0) return waves;
          const first = waves[0];
          const waveLabel = String(first?.wave || '').toLowerCase();
          if (waveLabel === 'start' || waveLabel === '0') {
            return waves; // Already has origin
          }
          // Check if first wave is "1" - if so, we're missing origin
          if (waveLabel === '1' || waveLabel.includes('1')) {
            console.log(`Warning: waves array missing origin pivot for degree ${degree}`);
          }
          return waves;
        };
        
        if (report.primary_count?.waves) {
          report.primary_count.waves = ensureOriginPivot(
            report.primary_count.waves, 
            report.primary_count.waves[0]?.degree || 'unknown'
          );
        }
        
        for (const alt of (report.alternate_counts || [])) {
          if (alt.waves) {
            alt.waves = ensureOriginPivot(alt.waves, alt.waves[0]?.degree || 'unknown');
          }
        }
        
        lastStatus = {
          ok: true,
          status_code: 200
        };
        
        return { report, llm_status: lastStatus };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        lastStatus = {
          ok: false,
          status_code: 200,
          error_type: 'parse_error',
          error_message: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown'}`
        };
        if (attempt === maxRetries) {
          return { report: null, llm_status: lastStatus };
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastStatus = {
        ok: false,
        status_code: 0,
        error_type: 'server_error',
        error_message: error instanceof Error ? error.message : 'Network error'
      };
      if (attempt === maxRetries) {
        return { report: null, llm_status: lastStatus };
      }
    }
  }
  
  return { report: null, llm_status: lastStatus };
}

// ============================================================================
// SECTION 14: MAIN HTTP SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Lovable AI key not configured',
          llm_status: { ok: false, status_code: 500, error_type: 'server_error', error_message: 'API key not configured' }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      symbol, 
      timeframe,
      mode = 'auto_major_degree',
      user_adjustments
    } = body;

    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol is required', api_version: API_VERSION }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`=== Analyzing ${symbol} (mode: ${mode}) [API v${API_VERSION}] ===`);

    // Fetch weekly data first to determine major degree
    let weeklyCandles: Candle[];
    try {
      weeklyCandles = await fetchOHLCV(symbol, '1wk');
    } catch (error: any) {
      console.error('Data fetch error:', error);
      
      const suggestions = [];
      if (!symbol.includes('.')) {
        suggestions.push(`For Mexican stocks, try adding ".MX" (e.g., ${symbol}.MX)`);
        suggestions.push(`For US stocks, use the standard ticker (e.g., AAPL, MSFT)`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error.message || 'Symbol not found',
          error_type: 'symbol_not_found',
          symbol,
          suggestions,
          api_version: API_VERSION,
          llm_status: { ok: true, status_code: 200 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate historical low from weekly data (full history)
    let historicalLow = { price: Infinity, date: '' };
    for (const candle of weeklyCandles) {
      if (candle.low < historicalLow.price) {
        historicalLow = { price: candle.low, date: candle.date };
      }
    }
    console.log(`Historical low: ${historicalLow.price} on ${historicalLow.date}`);

    // Determine major degree based on data availability
    const majorDegree = determineMajorDegree(weeklyCandles, historicalLow);
    console.log(`Major degree: ${majorDegree.degree} (${majorDegree.years_of_data.toFixed(1)} years)`);

    // Auto-select timeframe based on mode
    const effectiveTimeframe = mode === 'auto_major_degree' 
      ? majorDegree.timeframe_used 
      : (timeframe || '1d').toLowerCase();

    let topDownData;
    try {
      topDownData = await performTopDownAnalysis(symbol, effectiveTimeframe);
    } catch (error: any) {
      console.error('Top-down analysis error:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error.message || 'Failed to fetch timeframe data',
          symbol,
          api_version: API_VERSION,
          llm_status: { ok: true, status_code: 200 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { macro, meso, micro, requested } = topDownData;

    // Calculate RSI for segment features
    const rsiValues = calculateRSI(requested.candles);

    // Calculate segment features BY SCALE
    const segmentFeatures = calculateMultiScaleSegmentFeatures(
      requested.candles, 
      requested.pivots, 
      rsiValues
    );
    console.log(`Segment features: macro=${segmentFeatures.macro.length}, meso=${segmentFeatures.meso.length}, micro=${segmentFeatures.micro.length}`);

    // Merge all pivots for cage calculation
    const allPivots = [...requested.pivots.meso].sort((a, b) => a.index - b.index);
    
    // Calculate cage features
    const cageFeatures = computeCageFeatures(requested.candles, allPivots, requested.atr);
    console.log(`Cage candidates: ${cageFeatures.cage_2_4_candidates.length}`);

    // Build prompts and call LLM
    const systemPrompt = buildSystemPrompt(majorDegree);
    const userPrompt = buildUserPrompt(
      symbol,
      effectiveTimeframe,
      macro,
      meso,
      micro,
      requested,
      segmentFeatures,
      cageFeatures,
      historicalLow,
      majorDegree,
      user_adjustments
    );

    console.log(`User prompt length: ${userPrompt.length} chars`);

    const { report, llm_status } = await callLLM(systemPrompt, userPrompt);

    // Handle LLM failure - return structure-only fallback
    if (!report) {
      // Compute deterministic invalidation for fallback
      const lastPrice = requested.candles[requested.candles.length - 1].close;
      const fallbackInvalidation = computeDeterministicInvalidation(
        allPivots,
        undefined,
        undefined,
        historicalLow,
        lastPrice
      );

      // Structure-only fallback response
      return new Response(
        JSON.stringify({
          success: false,
          structure_only: true,
          error: llm_status.error_message || 'LLM analysis failed',
          error_type: llm_status.error_type,
          retry_after_seconds: llm_status.retry_after_seconds,
          symbol: symbol.toUpperCase(),
          api_version: API_VERSION,
          analysis_timeframe_selected: effectiveTimeframe,
          degree_focus: majorDegree.degree,
          candles_used_count: requested.candles.length,
          major_degree: majorDegree,
          llm_status,
          // Still provide candles and pivots for chart rendering
          candles: requested.candles,
          pivots: allPivots,
          // Minimal analysis structure for fallback rendering
          analysis: {
            symbol: symbol.toUpperCase(),
            timeframe: effectiveTimeframe,
            status: 'inconclusive',
            evidence_score: 0,
            primary_count: null,
            alternate_counts: [],
            key_levels: {
              support: [],
              resistance: [],
              fibonacci_targets: [],
              invalidation: fallbackInvalidation
            },
            cage_features: cageFeatures,
            forecast: null,
            summary: 'LLM unavailable. Showing structure-only result with chart data and computed features.'
          },
          computed_features: {
            cage_features: cageFeatures,
            atr_values: {
              requested: requested.atr
            }
          },
          historical_low: historicalLow,
          lastPrice,
          timestamp: new Date().toISOString()
        }),
        { 
          status: llm_status.status_code === 429 ? 429 : 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Compute deterministic invalidation as fallback
    const lastPrice = requested.candles[requested.candles.length - 1].close;
    const fallbackInvalidation = computeDeterministicInvalidation(
      allPivots,
      report.primary_count?.pattern,
      report.primary_count?.current_wave,
      historicalLow,
      lastPrice
    );

    // Normalize key levels
    const normalizedKeyLevels = normalizeKeyLevels(report.key_levels, fallbackInvalidation);
    report.key_levels = normalizedKeyLevels;

    // Include cage features in the analysis report
    report.cage_features = cageFeatures;

    // Return complete response with candles as single source of truth
    return new Response(
      JSON.stringify({ 
        success: true,
        api_version: API_VERSION,
        symbol: symbol.toUpperCase(),
        timeframe: effectiveTimeframe,
        analysis_timeframe_selected: effectiveTimeframe,
        degree_focus: majorDegree.degree,
        candles_used_count: requested.candles.length,
        mode,
        major_degree: majorDegree,
        analysis: report,
        llm_status,
        // Single source of truth: candles aligned with analysis timeframe
        candles: requested.candles,
        pivots: allPivots,
        computed_features: {
          timeframes_used: {
            macro: macro.interval,
            meso: meso.interval,
            micro: micro.interval,
            requested: requested.interval
          },
          pivots_by_timeframe: {
            macro: {
              macro: macro.pivots.macro.length,
              meso: macro.pivots.meso.length,
              micro: macro.pivots.micro.length
            },
            meso: {
              macro: meso.pivots.macro.length,
              meso: meso.pivots.meso.length,
              micro: meso.pivots.micro.length
            },
            requested: {
              macro: requested.pivots.macro.length,
              meso: requested.pivots.meso.length,
              micro: requested.pivots.micro.length
            }
          },
          segment_features: segmentFeatures,
          cage_features: cageFeatures,
          atr_values: {
            macro: macro.atr,
            meso: meso.atr,
            micro: micro.atr,
            requested: requested.atr
          }
        },
        requested_pivots: {
          macro: requested.pivots.macro.slice(-15),
          meso: requested.pivots.meso.slice(-20),
          micro: requested.pivots.micro.slice(-25)
        },
        historical_low: historicalLow,
        dataPoints: requested.candles.length,
        lastPrice,
        timestamp: new Date().toISOString(),
        training_mode: !!user_adjustments
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-elliott-wave:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        error_type: 'server_error',
        api_version: API_VERSION,
        llm_status: { 
          ok: false, 
          status_code: 500, 
          error_type: 'server_error',
          error_message: error instanceof Error ? error.message : 'Internal server error'
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
