import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const API_VERSION = "0.2";

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
        const dd = (candle.high - trough) / trough * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }
    
    const rsi_at_end = rsiValues[toIdx] || 50;
    const direction = pct_move > 0 ? 'up' : 'down';
    
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
      direction
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
// SECTION 7: CAGE THEORY IMPLEMENTATION (CANDIDATE-BASED)
// ============================================================================

interface Line {
  slope: number;
  intercept: number;
}

function buildLine(x1: number, y1: number, x2: number, y2: number): Line {
  const slope = (y2 - y1) / (x2 - x1);
  const intercept = y1 - slope * x1;
  return { slope, intercept };
}

function getLineValue(line: Line, x: number): number {
  return line.slope * x + line.intercept;
}

function detectCageBreakWithATR(
  cage: { upper: Line; lower: Line },
  candles: Candle[],
  startIdx: number,
  atr: number,
  confirmBars = 2,
  tolerancePct = 0.5
): CageCandidateBreak {
  let broken = false;
  let direction: 'up' | 'down' | undefined = undefined;
  let strengthPct = 0;
  let strengthAtr = 0;
  let barsSince = 0;
  let breakDate: string | undefined = undefined;
  let confirmedBreakIdx = -1;

  for (let i = startIdx; i < candles.length; i++) {
    const upperValue = getLineValue(cage.upper, i);
    const lowerValue = getLineValue(cage.lower, i);
    const tolerance = (upperValue - lowerValue) * (tolerancePct / 100);
    
    if (candles[i].close > upperValue + tolerance) {
      let confirmed = true;
      for (let j = 1; j <= confirmBars && i + j < candles.length; j++) {
        if (candles[i + j].close <= upperValue) {
          confirmed = false;
          break;
        }
      }
      if (confirmed && !broken) {
        broken = true;
        direction = 'up';
        confirmedBreakIdx = i;
        breakDate = candles[i].date;
        const breakDist = candles[i].close - upperValue;
        strengthPct = (breakDist / upperValue) * 100;
        strengthAtr = atr > 0 ? breakDist / atr : 0;
        break;
      }
    }
    
    if (candles[i].close < lowerValue - tolerance) {
      let confirmed = true;
      for (let j = 1; j <= confirmBars && i + j < candles.length; j++) {
        if (candles[i + j].close >= lowerValue) {
          confirmed = false;
          break;
        }
      }
      if (confirmed && !broken) {
        broken = true;
        direction = 'down';
        confirmedBreakIdx = i;
        breakDate = candles[i].date;
        const breakDist = lowerValue - candles[i].close;
        strengthPct = (breakDist / lowerValue) * 100;
        strengthAtr = atr > 0 ? breakDist / atr : 0;
        break;
      }
    }
  }

  if (confirmedBreakIdx >= 0) {
    barsSince = candles.length - 1 - confirmedBreakIdx;
  }

  return { 
    broken, 
    break_direction: direction, 
    break_strength_pct: Math.round(strengthPct * 1000) / 1000,
    break_strength_atr: Math.round(strengthAtr * 100) / 100,
    bars_since_break: barsSince, 
    first_break_date: breakDate,
    break_index: confirmedBreakIdx >= 0 ? confirmedBreakIdx : null
  };
}

function buildImpulseCage24(
  w2End: { index: number; price: number },
  w3End: { index: number; price: number },
  w4End: { index: number; price: number }
): { upper: Line; lower: Line } | null {
  if (!w2End || !w3End || !w4End) return null;
  if (w2End.index >= w4End.index) return null;
  
  const lower = buildLine(w2End.index, w2End.price, w4End.index, w4End.price);
  const upper = {
    slope: lower.slope,
    intercept: w3End.price - lower.slope * w3End.index
  };
  
  return { upper, lower };
}

function generateCageCandidates(
  candles: Candle[],
  pivots: Pivot[],
  atr: number
): CageCandidate[] {
  const candidates: CageCandidate[] = [];
  const lastCandleIndex = candles.length - 1;
  const lastCandleDate = candles[lastCandleIndex]?.date || '';
  
  if (pivots.length < 4) {
    return [{ 
      label: "insufficient_pivots", 
      exists: false, 
      break_info: { broken: false, break_strength_pct: 0, break_strength_atr: 0, bars_since_break: 0 }
    }];
  }

  // Helper to build candidate with dates and points
  const buildCandidate = (
    label: string,
    cage: { upper: Line; lower: Line },
    startIdx: number,
    anchorIdx: number,
    w2Idx: number,
    w3Idx: number,
    w4Idx: number
  ): CageCandidate => {
    const breakInfo = detectCageBreakWithATR(cage, candles, anchorIdx + 1, atr);
    const startDate = candles[startIdx]?.date || '';
    const anchorDate = candles[anchorIdx]?.date || '';
    
    // Compute y values at start and end for rendering
    const upperY1 = getLineValue(cage.upper, startIdx);
    const upperY2 = getLineValue(cage.upper, lastCandleIndex);
    const lowerY1 = getLineValue(cage.lower, startIdx);
    const lowerY2 = getLineValue(cage.lower, lastCandleIndex);
    
    return {
      label,
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
      start_index: startIdx,
      start_date: startDate,
      anchor_index: anchorIdx,
      anchor_date: anchorDate,
      projected_to_index: lastCandleIndex,
      projected_to_date: lastCandleDate,
      break_index: breakInfo.break_index,
      break_date: breakInfo.first_break_date || null,
      w2_idx: w2Idx,
      w3_idx: w3Idx,
      w4_idx: w4Idx,
      break_info: breakInfo
    };
  };

  // Get all lows and highs
  const lows = pivots.filter(p => p.type === 'low');
  const highs = pivots.filter(p => p.type === 'high');

  // Strategy 1: Use last 5 pivots (classic approach)
  if (lows.length >= 2 && highs.length >= 1) {
    const recentLows = lows.slice(-3);
    const recentHighs = highs.slice(-2);
    
    for (let li = 0; li < recentLows.length - 1; li++) {
      for (let hi = 0; hi < recentHighs.length; hi++) {
        const w2 = recentLows[li];
        const w4 = recentLows[li + 1];
        const w3 = recentHighs[hi];
        
        // Validate order: w2 < w3 < w4 in time
        if (w2.index < w3.index && w3.index < w4.index) {
          const cage = buildImpulseCage24(
            { index: w2.index, price: w2.price },
            { index: w3.index, price: w3.price },
            { index: w4.index, price: w4.price }
          );
          
          if (cage) {
            candidates.push(buildCandidate(
              `cage_L${li}_H${hi}`,
              cage,
              w2.index,
              w4.index,
              w2.index,
              w3.index,
              w4.index
            ));
          }
        }
      }
    }
  }

  // Strategy 2: Most prominent pivots
  if (pivots.length >= 5) {
    const sortedByProminence = [...pivots].sort((a, b) => (b.prominence || 0) - (a.prominence || 0));
    const topPivots = sortedByProminence.slice(0, 5).sort((a, b) => a.index - b.index);
    
    const prominentLows = topPivots.filter(p => p.type === 'low');
    const prominentHighs = topPivots.filter(p => p.type === 'high');
    
    if (prominentLows.length >= 2 && prominentHighs.length >= 1) {
      const w2 = prominentLows[0];
      const w4 = prominentLows[prominentLows.length - 1];
      const w3 = prominentHighs.find(h => h.index > w2.index && h.index < w4.index);
      
      if (w3) {
        const cage = buildImpulseCage24(
          { index: w2.index, price: w2.price },
          { index: w3.index, price: w3.price },
          { index: w4.index, price: w4.price }
        );
        
        if (cage) {
          candidates.push(buildCandidate(
            "cage_prominent",
            cage,
            w2.index,
            w4.index,
            w2.index,
            w3.index,
            w4.index
          ));
        }
      }
    }
  }

  if (candidates.length === 0) {
    return [{ 
      label: "no_valid_cage",
      exists: false, 
      break_info: { broken: false, break_strength_pct: 0, break_strength_atr: 0, bars_since_break: 0 }
    }];
  }

  return candidates;
}

function buildCorrectionCageACB(
  aEnd: { index: number; price: number },
  bEnd: { index: number; price: number },
  cEnd: { index: number; price: number }
): { upper: Line; lower: Line } | null {
  if (!aEnd || !bEnd || !cEnd) return null;
  
  const acLine = buildLine(aEnd.index, aEnd.price, cEnd.index, cEnd.price);
  const bLine = {
    slope: acLine.slope,
    intercept: bEnd.price - acLine.slope * bEnd.index
  };
  
  if (bEnd.price > getLineValue(acLine, bEnd.index)) {
    return { upper: bLine, lower: acLine };
  } else {
    return { upper: acLine, lower: bLine };
  }
}

function buildDiagonalWedgeCage(
  pivots: Pivot[]
): { upper: Line; lower: Line; type: 'expanding' | 'contracting' } | null {
  if (pivots.length < 4) return null;
  
  const highs = pivots.filter(p => p.type === 'high').slice(-2);
  const lows = pivots.filter(p => p.type === 'low').slice(-2);
  
  if (highs.length < 2 || lows.length < 2) return null;
  
  const upperLine = buildLine(highs[0].index, highs[0].price, highs[1].index, highs[1].price);
  const lowerLine = buildLine(lows[0].index, lows[0].price, lows[1].index, lows[1].price);
  
  const type = Math.abs(upperLine.slope) > Math.abs(lowerLine.slope) ? 'contracting' : 'expanding';
  
  return { upper: upperLine, lower: lowerLine, type };
}

function computeCageFeatures(
  candles: Candle[],
  pivots: Pivot[],
  atr: number
): CageFeatures {
  const lastCandleIndex = candles.length - 1;
  const lastCandleDate = candles[lastCandleIndex]?.date || '';
  
  const result: CageFeatures = {
    cage_2_4: {
      exists: false,
      broken: false,
      break_strength_pct: 0,
      break_strength_atr: 0,
      bars_since_break: 0,
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

  // Generate multiple cage candidates for LLM to evaluate
  result.cage_2_4_candidates = generateCageCandidates(candles, pivots, atr);
  
  // Select the best candidate (prioritize unbroken, then by prominence)
  const validCandidates = result.cage_2_4_candidates.filter(c => c.exists);
  if (validCandidates.length > 0) {
    // Prefer unbroken cages, then most recent
    const selected = validCandidates.find(c => !c.break_info.broken) || validCandidates[validCandidates.length - 1];
    
    result.cage_2_4 = {
      exists: true,
      broken: selected.break_info.broken,
      break_direction: selected.break_info.break_direction,
      break_strength_pct: selected.break_info.break_strength_pct,
      break_strength_atr: selected.break_info.break_strength_atr,
      bars_since_break: selected.break_info.bars_since_break,
      first_break_date: selected.break_info.first_break_date,
      selected_candidate: selected.label,
      upper_line: selected.upper_line,
      lower_line: selected.lower_line,
      upper_points: selected.upper_points,
      lower_points: selected.lower_points,
      start_index: selected.start_index,
      start_date: selected.start_date,
      anchor_index: selected.anchor_index,
      anchor_date: selected.anchor_date,
      projected_to_index: selected.projected_to_index,
      projected_to_date: selected.projected_to_date,
      break_index: selected.break_index,
      break_date: selected.break_date,
    };
  }

  // A-C-B cage for corrections
  if (pivots.length >= 3) {
    const lastThree = pivots.slice(-3);
    if (lastThree[0].type !== lastThree[1].type && lastThree[1].type !== lastThree[2].type) {
      const cageACB = buildCorrectionCageACB(
        { index: lastThree[0].index, price: lastThree[0].price },
        { index: lastThree[1].index, price: lastThree[1].price },
        { index: lastThree[2].index, price: lastThree[2].price }
      );
      
      if (cageACB) {
        const startIdx = lastThree[0].index;
        const anchorIdx = lastThree[2].index;
        const startDate = candles[startIdx]?.date || '';
        const anchorDate = candles[anchorIdx]?.date || '';
        
        // Compute y values for rendering
        const upperY1 = getLineValue(cageACB.upper, startIdx);
        const upperY2 = getLineValue(cageACB.upper, lastCandleIndex);
        const lowerY1 = getLineValue(cageACB.lower, startIdx);
        const lowerY2 = getLineValue(cageACB.lower, lastCandleIndex);
        
        result.cage_ACB.exists = true;
        result.cage_ACB.upper_line = cageACB.upper;
        result.cage_ACB.lower_line = cageACB.lower;
        result.cage_ACB.upper_points = [
          { date: startDate, value: upperY1 },
          { date: lastCandleDate, value: upperY2 }
        ];
        result.cage_ACB.lower_points = [
          { date: startDate, value: lowerY1 },
          { date: lastCandleDate, value: lowerY2 }
        ];
        result.cage_ACB.start_index = startIdx;
        result.cage_ACB.start_date = startDate;
        result.cage_ACB.anchor_index = anchorIdx;
        result.cage_ACB.anchor_date = anchorDate;
        result.cage_ACB.projected_to_index = lastCandleIndex;
        result.cage_ACB.projected_to_date = lastCandleDate;
        
        const breakResult = detectCageBreakWithATR(cageACB, candles, anchorIdx + 1, atr);
        if (breakResult.broken) {
          result.cage_ACB.broken_up = breakResult.break_direction === 'up';
          result.cage_ACB.broken_down = breakResult.break_direction === 'down';
          result.cage_ACB.break_strength_pct = breakResult.break_strength_pct;
          result.cage_ACB.break_strength_atr = breakResult.break_strength_atr;
          result.cage_ACB.break_index = breakResult.break_index;
          result.cage_ACB.break_date = breakResult.first_break_date || null;
        }
      }
    }
  }
  
  // Wedge cage
  const wedge = buildDiagonalWedgeCage(pivots.slice(-6));
  if (wedge) {
    result.wedge_cage.exists = true;
    result.wedge_cage.wedge_type = wedge.type;
    result.wedge_cage.upper_line = wedge.upper;
    result.wedge_cage.lower_line = wedge.lower;
    
    // Get start/anchor from the pivots used
    const lastSixPivots = pivots.slice(-6);
    const highs = lastSixPivots.filter(p => p.type === 'high').slice(-2);
    const lows = lastSixPivots.filter(p => p.type === 'low').slice(-2);
    if (highs.length >= 2 && lows.length >= 2) {
      const startIdx = Math.min(highs[0].index, lows[0].index);
      const anchorIdx = Math.max(highs[1].index, lows[1].index);
      const startDate = candles[startIdx]?.date || '';
      const anchorDate = candles[anchorIdx]?.date || '';
      
      // Compute y values for rendering
      const upperY1 = getLineValue(wedge.upper, startIdx);
      const upperY2 = getLineValue(wedge.upper, lastCandleIndex);
      const lowerY1 = getLineValue(wedge.lower, startIdx);
      const lowerY2 = getLineValue(wedge.lower, lastCandleIndex);
      
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
    }
    
    const breakResult = detectCageBreakWithATR({ upper: wedge.upper, lower: wedge.lower }, candles, pivots[pivots.length - 1].index + 1, atr);
    result.wedge_cage.broken = breakResult.broken;
    result.wedge_cage.break_strength_pct = breakResult.break_strength_pct;
    result.wedge_cage.break_strength_atr = breakResult.break_strength_atr;
    if (breakResult.broken) {
      result.wedge_cage.break_index = breakResult.break_index;
      result.wedge_cage.break_date = breakResult.first_break_date || null;
    }
  }

  return result;
}

// ============================================================================
// SECTION 8: TOP-DOWN MULTI-TIMEFRAME ANALYSIS
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
      requestedInterval = '1h'; // Will aggregate
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
  
  // Pivots computed on THEIR OWN timeframe candles
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
// SECTION 9: LLM PROMPT WITH ANTI-GENERIC RULES
// ============================================================================

function buildSystemPrompt(): string {
  return `You are GOX Agent, an expert quantitative analyst specialized in Elliott Wave Theory.

## CORE ANALYSIS APPROACH: TOP-DOWN MULTI-DEGREE

You MUST analyze in this order:
1. MACRO (Supercycle/Cycle): Weekly pivots -> identify major structure
2. MESO (Primary/Intermediate): Daily pivots -> refine within macro context
3. MICRO (Minor/Minute): Intraday pivots -> current position within meso

## HARD RULES (AUTOMATIC INVALIDATION IF VIOLATED)

1. Wave 2 NEVER retraces 100% of wave 1
2. Wave 3 is NEVER the shortest among waves 1, 3, 5
3. Wave 4 NEVER enters wave 1 territory (except diagonals)
4. Impulse internal structure: 5-3-5-3-5
5. Zigzag: 5-3-5 | Flat: 3-3-5 | Triangle: 3-3-3-3-3

## CAGE THEORY VALIDATION (MANDATORY)

The backend provides MULTIPLE cage candidates (cage_2_4_candidates). 
YOU MUST select the most appropriate cage based on your wave count.

For each cage candidate you receive:
- label: identifier
- w2_idx, w3_idx, w4_idx: pivot indices used
- break_info.break_strength_pct: percentage break
- break_info.break_strength_atr: break in ATR units (USE THIS FOR SCORING)

🟦 cage_2_4: Impulse channel scoring:
- break_strength_atr >= 1.5: STRONG break (20 points)
- break_strength_atr 1.0-1.5: MODERATE break (15 points)
- break_strength_atr 0.5-1.0: WEAK break (10 points)
- break_strength_atr < 0.5 or not broken: (5 points)

🟩 cage_ACB: Correction channel
🟥 wedge_cage: Diagonal/wedge pattern

## SEGMENT FEATURES BY SCALE

Backend provides segment_features separated by scale:
- segment_features.macro: Features between macro pivots
- segment_features.meso: Features between meso pivots  
- segment_features.micro: Features between micro pivots

Use the appropriate scale for each degree of analysis.

## 🚫 ANTI-GENERIC RULE (CRITICAL)

You CANNOT conclude "wave 5 in formation" or "completing wave 5" UNLESS at least 3 of these 5 criteria are met:

1. ✅ STRUCTURE: Waves 1-4 are clearly identifiable with proper internal structure
2. ✅ HARD RULES: No violations of the 5 hard rules
3. ✅ FIBONACCI: Wave 5 projection aligns with 0.618, 1.0, or 1.618 of wave 1
4. ✅ MOMENTUM: RSI divergence present OR volume declining vs wave 3
5. ✅ CAGE: At least one cage_2_4_candidate with break_strength_atr >= 0.5

If <3 criteria met → You MUST output:
{
  "status": "inconclusive",
  "primary_count": { "label": "Inconclusive - Multiple scenarios", ... },
  "alternate_counts": [at least 2 alternates with equal weight, EACH with "waves" array]
}

## ALTERNATE COUNT WAVES REQUIREMENT (MANDATORY)

For EVERY alternate count, you MUST include a "waves" array with the same format as primary_count.waves:
- waves: [{ "wave": string, "date": string, "price": number, "degree": string }]
- At minimum, include waves for the top 2 alternates
- Each alternate's waves must be internally time-consistent (dates non-decreasing)
- No duplicate sequential pivots with same date but different price

## FORECAST DIRECTION NORMALIZATION

All forecast.direction values MUST be one of: "bullish" | "bearish" | "neutral"
Do NOT use: "up", "down", "sideways", or any other variations.

## 📊 EVIDENCE SCORE CALCULATION (0-100)

### 1. HARD_RULES (Pass/Fail → 20 points if pass, 0 if fail)
Return both "passed" and "score" fields.

### 2. FIBONACCI (0-20 points)
Based on wave ratios matching Fibonacci.

### 3. MOMENTUM_VOLUME (0-20 points)
Based on volume patterns and RSI divergence.

### 4. CAGES (0-20 points) - USE break_strength_atr
- Best cage has break_strength_atr >= 1.5: 20
- break_strength_atr 1.0-1.5: 15
- break_strength_atr 0.5-1.0: 10
- break_strength_atr < 0.5: 5

### 5. MULTI_TF_CONSISTENCY (0-20 points)
Alignment across macro/meso/micro.

## OUTPUT FORMAT

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
    "macro": { "degree": "Supercycle", "current_wave": "...", "structure": "..." },
    "meso": { "degree": "Primary", "current_wave": "...", "within_macro": "..." },
    "micro": { "degree": "Minor", "current_wave": "...", "within_meso": "..." }
  },
  "historical_low": { "date": "...", "price": ... },
  "primary_count": {
    "pattern": "impulse" | "diagonal" | "zigzag" | "flat" | "complex",
    "waves": [{ "wave": "1", "date": "...", "price": ..., "degree": "Primary" }],
    "current_wave": "5",
    "next_expected": "A or new cycle",
    "confidence": 0-100
  },
  "alternate_counts": [{
    "label": "...",
    "probability": 0-100,
    "pattern": "...",
    "justification": "...",
    "key_difference": "...",
    "waves": [{ "wave": "1", "date": "...", "price": ..., "degree": "..." }]
  }],
  "key_levels": {
    "support": [...],
    "resistance": [...],
    "fibonacci_targets": [...],
    "invalidation": number
  },
  "cage_features": {
    "cage_2_4": { "selected_candidate": "...", "exists": bool, "broken": bool, "break_direction": "up"|"down", "break_strength_pct": number, "break_strength_atr": number, "bars_since_break": number },
    "cage_ACB": { ... },
    "wedge_cage": { ... }
  },
  "forecast": {
    "short_term": { "direction": "...", "target": number, "timeframe": "..." },
    "medium_term": { ... },
    "long_term": { ... }
  },
  "key_uncertainties": ["..."],
  "what_would_confirm": ["..."],
  "summary": "..."
}

## TRAINING MODE

If user_adjustments are provided:
- Honor the forced wave labels
- Re-analyze from those constraints
- Note adjustments in commentary`;
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
## SYMBOL: ${symbol} | REQUESTED TIMEFRAME: ${timeframe}

## HISTORICAL LOW
Date: ${historicalLow.date} | Price: ${historicalLow.price.toFixed(4)}

## MACRO DATA (Weekly - Supercycle)
Interval: ${macroData.interval} | ATR(14): ${macroData.atr.toFixed(4)}
### Macro Pivots:
${formatPivots(macroData.pivots.macro, 10)}
### Meso Pivots:
${formatPivots(macroData.pivots.meso, 10)}

## MESO DATA (Daily - Primary)
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

## REQUESTED TIMEFRAME DATA (${timeframe})
ATR(14): ${requestedData.atr.toFixed(4)}
### Macro Pivots:
${formatPivots(requestedData.pivots.macro, 8)}
### Meso Pivots:
${formatPivots(requestedData.pivots.meso, 12)}
### Micro Pivots:
${formatPivots(requestedData.pivots.micro, 15)}

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
The user has provided the following wave label adjustments. You MUST honor these constraints:
${JSON.stringify(userAdjustments, null, 2)}

Re-analyze the structure based on these forced labels. Note any conflicts in commentary.
`;
  }

  prompt += `
## INSTRUCTION
1. Analyze TOP-DOWN: macro → meso → micro
2. Use segment_features BY SCALE (macro for macro analysis, meso for meso, etc.)
3. EVALUATE cage_2_4_candidates and SELECT the best one for your count
4. Use break_strength_atr (not _pct) for CAGES scoring
5. Check the anti-generic rule for wave 5 conclusions
6. Return ONLY valid JSON matching the specified format
7. All text in English
`;

  return prompt;
}

// ============================================================================
// SECTION 10: LLM CALL
// ============================================================================

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2
): Promise<any> {
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
      
      console.log('LLM Response length:', content.length);
      
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('No valid JSON in response');
        if (attempt === maxRetries) throw new Error('No valid JSON found');
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
            return d; // Already correct or unknown
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
        
        return report;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        if (attempt === maxRetries) {
          throw new Error(`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) throw error;
    }
  }
  
  throw new Error('Failed to analyze Elliott Wave patterns');
}

// ============================================================================
// SECTION 11: MAIN HTTP SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Lovable AI key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      symbol, 
      timeframe = "1d", 
      user_adjustments,
      macro_threshold = 10.0,
      meso_threshold = 5.0,
      micro_threshold = 2.0
    } = body;

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedTimeframe = timeframe.toLowerCase();
    console.log(`=== Analyzing ${symbol} on ${normalizedTimeframe} (top-down) [API v${API_VERSION}] ===`);

    let topDownData;
    try {
      topDownData = await performTopDownAnalysis(symbol, normalizedTimeframe);
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
          symbol,
          suggestions,
          details: 'Verify the symbol exists on Yahoo Finance',
          api_version: API_VERSION
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { macro, meso, micro, requested } = topDownData;

    // Calculate historical low from requested timeframe
    let historicalLow = { price: Infinity, date: '' };
    for (const candle of requested.candles) {
      if (candle.low < historicalLow.price) {
        historicalLow = { price: candle.low, date: candle.date };
      }
    }
    console.log(`Historical low: ${historicalLow.price} on ${historicalLow.date}`);

    // Calculate RSI for segment features
    const rsiValues = calculateRSI(requested.candles);

    // Calculate segment features BY SCALE from requested timeframe pivots
    const segmentFeatures = calculateMultiScaleSegmentFeatures(
      requested.candles, 
      requested.pivots, 
      rsiValues
    );
    console.log(`Segment features: macro=${segmentFeatures.macro.length}, meso=${segmentFeatures.meso.length}, micro=${segmentFeatures.micro.length}`);

    // Merge all pivots for cage calculation (use meso scale for most balanced view)
    const allPivots = [...requested.pivots.meso].sort((a, b) => a.index - b.index);
    
    // Calculate cage features with ATR-based break strength
    const cageFeatures = computeCageFeatures(requested.candles, allPivots, requested.atr);
    console.log(`Cage candidates: ${cageFeatures.cage_2_4_candidates.length}, ACB=${cageFeatures.cage_ACB.exists}, wedge=${cageFeatures.wedge_cage.exists}`);

    // Build prompts and call LLM
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      symbol,
      normalizedTimeframe,
      macro,
      meso,
      micro,
      requested,
      segmentFeatures,
      cageFeatures,
      historicalLow,
      user_adjustments
    );

    console.log(`User prompt length: ${userPrompt.length} chars`);

    const report = await callLLM(systemPrompt, userPrompt);

    // Return complete response with api_version
    return new Response(
      JSON.stringify({ 
        success: true,
        api_version: API_VERSION,
        symbol: symbol.toUpperCase(),
        timeframe: normalizedTimeframe,
        analysis: report,
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
        lastPrice: requested.candles[requested.candles.length - 1].close,
        timestamp: new Date().toISOString(),
        training_mode: !!user_adjustments
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-elliott-wave:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: 'Failed to analyze Elliott Wave patterns',
        api_version: API_VERSION
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
