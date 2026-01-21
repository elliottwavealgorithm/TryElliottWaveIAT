import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

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
  source?: string;
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

interface CageFeatures {
  cage_2_4: {
    exists: boolean;
    upper_line?: { slope: number; intercept: number };
    lower_line?: { slope: number; intercept: number };
    broken: boolean;
    break_direction?: 'up' | 'down';
    break_strength: number;
    bars_since_break: number;
    first_break_date?: string;
  };
  cage_ACB: {
    exists: boolean;
    broken_up: boolean;
    broken_down: boolean;
    break_strength: number;
  };
  wedge_cage: {
    exists: boolean;
    broken: boolean;
    break_strength: number;
    wedge_type?: 'expanding' | 'contracting';
  };
}

interface MultiScalePivots {
  macro: Pivot[];
  meso: Pivot[];
  micro: Pivot[];
}

interface TimeframeData {
  candles: Candle[];
  pivots: Pivot[];
  atr: number;
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
  // TTL in milliseconds
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
        // Rate limited - exponential backoff
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

// Aggregate candles to create 4H from 1H
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
  
  // Simple moving average of TR for ATR
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
  minSwingATRMultiple = 1.5,
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
  let trend = 0; // 1 up, -1 down, 0 unknown

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

    // Check both percentage AND ATR-based minimum
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
        scale
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

function computeMultiScalePivots(
  candles: Candle[],
  atr: number,
  macroThreshold = 10.0,
  mesoThreshold = 5.0,
  microThreshold = 2.0
): MultiScalePivots {
  // Macro: large moves, higher ATR multiple
  const macro = computeAdaptiveZigZag(candles, macroThreshold, 10, atr, 3.0, 'macro');
  
  // Meso: medium moves
  const meso = computeAdaptiveZigZag(candles, mesoThreshold, 5, atr, 1.5, 'meso');
  
  // Micro: small moves, lower requirements
  const micro = computeAdaptiveZigZag(candles, microThreshold, 3, atr, 0.8, 'micro');

  return { macro, meso, micro };
}

// ============================================================================
// SECTION 6: SEGMENT FEATURES CALCULATION
// ============================================================================

function calculateSegmentFeatures(
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
    
    // ATR normalized range
    const segmentRange = Math.max(...segment.map(c => c.high)) - Math.min(...segment.map(c => c.low));
    const segmentATR = calculateATR(segment, Math.min(14, segment.length - 1)) || 1;
    const atr_normalized_range = segmentRange / segmentATR;
    
    // Volume analysis
    const volumes = segment.map(c => c.volume);
    const avg_volume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const prevSegmentVolume = i > 0 && features[i - 1] ? features[i - 1].avg_volume : avg_volume;
    const rel_volume_vs_prev = avg_volume / (prevSegmentVolume || 1);
    
    // Volume slope (linear regression approximation)
    let volume_slope = 0;
    if (volumes.length > 1) {
      const midpoint = Math.floor(volumes.length / 2);
      const firstHalf = volumes.slice(0, midpoint);
      const secondHalf = volumes.slice(midpoint);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      volume_slope = (avgSecond - avgFirst) / avgFirst;
    }
    
    // Max drawdown within segment
    let maxDrawdown = 0;
    if (from.type === 'low') {
      // Uptrend: measure pullbacks from highs
      let peak = segment[0].close;
      for (const candle of segment) {
        if (candle.high > peak) peak = candle.high;
        const dd = (peak - candle.low) / peak * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    } else {
      // Downtrend: measure rallies from lows
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

// ============================================================================
// SECTION 7: CAGE THEORY IMPLEMENTATION
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

function buildImpulseCage24(
  w2End: { index: number; price: number },
  w3End: { index: number; price: number },
  w4End: { index: number; price: number }
): { upper: Line; lower: Line } | null {
  if (!w2End || !w3End || !w4End) return null;
  if (w2End.index >= w4End.index) return null;
  
  // Lower line: connects wave 2 end to wave 4 end
  const lower = buildLine(w2End.index, w2End.price, w4End.index, w4End.price);
  
  // Upper line: parallel through wave 3 end
  const upper = {
    slope: lower.slope,
    intercept: w3End.price - lower.slope * w3End.index
  };
  
  return { upper, lower };
}

function detectCageBreak(
  cage: { upper: Line; lower: Line },
  candles: Candle[],
  startIdx: number,
  confirmBars = 2,
  tolerancePct = 0.5
): { broken: boolean; direction: 'up' | 'down' | null; strength: number; barsSince: number; breakDate: string | null } {
  let broken = false;
  let direction: 'up' | 'down' | null = null;
  let strength = 0;
  let barsSince = 0;
  let breakDate: string | null = null;
  let confirmedBreakIdx = -1;

  for (let i = startIdx; i < candles.length; i++) {
    const upperValue = getLineValue(cage.upper, i);
    const lowerValue = getLineValue(cage.lower, i);
    const tolerance = (upperValue - lowerValue) * (tolerancePct / 100);
    
    // Check for break above upper line
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
        strength = (candles[i].close - upperValue) / upperValue * 100;
        break;
      }
    }
    
    // Check for break below lower line
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
        strength = (lowerValue - candles[i].close) / lowerValue * 100;
        break;
      }
    }
  }

  if (confirmedBreakIdx >= 0) {
    barsSince = candles.length - 1 - confirmedBreakIdx;
  }

  return { broken, direction, strength, barsSince, breakDate };
}

function buildCorrectionCageACB(
  aEnd: { index: number; price: number },
  bEnd: { index: number; price: number },
  cEnd: { index: number; price: number }
): { upper: Line; lower: Line } | null {
  if (!aEnd || !bEnd || !cEnd) return null;
  
  // For ABC correction: A and C typically on same side, B is the extreme
  const acLine = buildLine(aEnd.index, aEnd.price, cEnd.index, cEnd.price);
  
  // Parallel through B
  const bLine = {
    slope: acLine.slope,
    intercept: bEnd.price - acLine.slope * bEnd.index
  };
  
  // Determine which is upper/lower
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
  
  // Get alternating highs and lows
  const highs = pivots.filter(p => p.type === 'high').slice(-2);
  const lows = pivots.filter(p => p.type === 'low').slice(-2);
  
  if (highs.length < 2 || lows.length < 2) return null;
  
  const upperLine = buildLine(highs[0].index, highs[0].price, highs[1].index, highs[1].price);
  const lowerLine = buildLine(lows[0].index, lows[0].price, lows[1].index, lows[1].price);
  
  // Determine wedge type
  const upperSlope = upperLine.slope;
  const lowerSlope = lowerLine.slope;
  const type = Math.abs(upperSlope) > Math.abs(lowerSlope) ? 'contracting' : 'expanding';
  
  return { upper: upperLine, lower: lowerLine, type };
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
      break_strength: 0,
      bars_since_break: 0
    },
    cage_ACB: {
      exists: false,
      broken_up: false,
      broken_down: false,
      break_strength: 0
    },
    wedge_cage: {
      exists: false,
      broken: false,
      break_strength: 0
    }
  };

  // Need at least 5 pivots for impulse cage (W1, W2, W3, W4, W5)
  if (pivots.length >= 4) {
    // Try to build 2-4 cage from last 4 pivots (assuming impulse pattern)
    const recentPivots = pivots.slice(-5);
    
    // Find potential wave 2, 3, 4 endpoints
    // In impulse: L -> H -> L -> H -> L (for bullish) 
    // Wave 2 end = first correction low after wave 1
    // Wave 3 end = high after wave 2
    // Wave 4 end = correction low after wave 3
    
    const lows = recentPivots.filter(p => p.type === 'low');
    const highs = recentPivots.filter(p => p.type === 'high');
    
    if (lows.length >= 2 && highs.length >= 1) {
      const w2End = { index: lows[0].index, price: lows[0].price };
      const w4End = { index: lows[lows.length - 1].index, price: lows[lows.length - 1].price };
      const w3End = { index: highs[0].index, price: highs[0].price };
      
      const cage24 = buildImpulseCage24(w2End, w3End, w4End);
      if (cage24) {
        result.cage_2_4.exists = true;
        result.cage_2_4.upper_line = cage24.upper;
        result.cage_2_4.lower_line = cage24.lower;
        
        const breakResult = detectCageBreak(cage24, candles, w4End.index + 1);
        result.cage_2_4.broken = breakResult.broken;
        result.cage_2_4.break_direction = breakResult.direction || undefined;
        result.cage_2_4.break_strength = breakResult.strength;
        result.cage_2_4.bars_since_break = breakResult.barsSince;
        result.cage_2_4.first_break_date = breakResult.breakDate || undefined;
      }
    }
    
    // Try A-C-B cage for corrections
    if (pivots.length >= 3) {
      const lastThree = pivots.slice(-3);
      if (lastThree[0].type !== lastThree[1].type && lastThree[1].type !== lastThree[2].type) {
        const cageACB = buildCorrectionCageACB(
          { index: lastThree[0].index, price: lastThree[0].price },
          { index: lastThree[1].index, price: lastThree[1].price },
          { index: lastThree[2].index, price: lastThree[2].price }
        );
        
        if (cageACB) {
          result.cage_ACB.exists = true;
          const breakResult = detectCageBreak(cageACB, candles, lastThree[2].index + 1);
          if (breakResult.broken) {
            result.cage_ACB.broken_up = breakResult.direction === 'up';
            result.cage_ACB.broken_down = breakResult.direction === 'down';
            result.cage_ACB.break_strength = breakResult.strength;
          }
        }
      }
    }
    
    // Wedge cage
    const wedge = buildDiagonalWedgeCage(pivots.slice(-6));
    if (wedge) {
      result.wedge_cage.exists = true;
      result.wedge_cage.wedge_type = wedge.type;
      const breakResult = detectCageBreak({ upper: wedge.upper, lower: wedge.lower }, candles, pivots[pivots.length - 1].index + 1);
      result.wedge_cage.broken = breakResult.broken;
      result.wedge_cage.break_strength = breakResult.strength;
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
  // Always fetch weekly and daily for macro context
  const weeklyCandles = await fetchOHLCV(symbol, '1wk');
  const dailyCandles = await fetchOHLCV(symbol, '1d');
  
  // Determine meso/micro timeframes based on request
  let mesoInterval: string;
  let microInterval: string;
  
  switch (requestedTimeframe) {
    case '1wk':
      mesoInterval = '1d';
      microInterval = '1h';
      break;
    case '1d':
      mesoInterval = '1h';
      microInterval = '15m';
      break;
    case '4h':
    case '1h':
      mesoInterval = '1h';
      microInterval = '15m';
      break;
    case '15m':
      mesoInterval = '15m';
      microInterval = '5m';
      break;
    default:
      mesoInterval = '1h';
      microInterval = '15m';
  }
  
  // Fetch meso/micro timeframes
  let mesoCandles = await fetchOHLCV(symbol, mesoInterval);
  let microCandles: Candle[] = [];
  
  try {
    microCandles = await fetchOHLCV(symbol, microInterval);
  } catch (e) {
    console.log(`Could not fetch ${microInterval}, using aggregated ${mesoInterval}`);
    microCandles = mesoCandles;
  }
  
  // Handle 4H by aggregating 1H if needed
  if (requestedTimeframe === '4h' && mesoInterval === '1h') {
    mesoCandles = aggregateCandles(mesoCandles, 4);
  }
  
  // Calculate ATR for each timeframe
  const weeklyATR = calculateATR(weeklyCandles);
  const dailyATR = calculateATR(dailyCandles);
  const mesoATR = calculateATR(mesoCandles);
  const microATR = calculateATR(microCandles);
  
  // Compute pivots at each scale
  const weeklyPivots = computeMultiScalePivots(weeklyCandles, weeklyATR, 15, 8, 4);
  const dailyPivots = computeMultiScalePivots(dailyCandles, dailyATR, 10, 5, 2);
  const mesoPivots = computeMultiScalePivots(mesoCandles, mesoATR, 8, 4, 2);
  const microPivots = computeMultiScalePivots(microCandles, microATR, 5, 3, 1.5);
  
  return {
    macro: {
      candles: weeklyCandles,
      pivots: weeklyPivots.macro,
      atr: weeklyATR
    },
    meso: {
      candles: dailyCandles,
      pivots: dailyPivots.meso,
      atr: dailyATR
    },
    micro: {
      candles: mesoCandles,
      pivots: mesoPivots.micro,
      atr: mesoATR
    },
    requested: {
      candles: requestedTimeframe === '1wk' ? weeklyCandles : 
               requestedTimeframe === '1d' ? dailyCandles : mesoCandles,
      pivots: [...mesoPivots.macro, ...mesoPivots.meso, ...mesoPivots.micro],
      atr: mesoATR
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

The backend provides pre-calculated cage features. Use them:

🟦 cage_2_4: Impulse channel (wave 2 end → wave 4 end, parallel from wave 3)
  - If exists && broken downward: Wave 5 likely COMPLETE
  - If exists && NOT broken: Wave 5 NOT confirmed complete

🟩 cage_ACB: Correction channel (A→C line, parallel from B)
  - If broken: Correction likely complete

🟥 wedge_cage: Diagonal/wedge pattern
  - If broken: Pattern complete

## SEGMENT FEATURES (USE THESE NUMBERS)

The backend provides objective measurements per segment:
- pct_move, bars_count, slope: Wave proportionality
- volume analysis: Confirm wave personality (W3 should have highest volume)
- rsi_at_end: Divergence detection (W5 often has RSI divergence)
- max_drawdown: Internal volatility

## 🚫 ANTI-GENERIC RULE (CRITICAL)

You CANNOT conclude "wave 5 in formation" or "completing wave 5" UNLESS at least 3 of these 5 criteria are met:

1. ✅ STRUCTURE: Waves 1-4 are clearly identifiable with proper internal structure
2. ✅ HARD RULES: No violations of the 5 hard rules
3. ✅ FIBONACCI: Wave 5 projection aligns with 0.618, 1.0, or 1.618 of wave 1
4. ✅ MOMENTUM: RSI divergence present OR volume declining vs wave 3
5. ✅ CAGE: cage_2_4 exists AND (not yet broken OR recently broken)

If <3 criteria met → You MUST output:
{
  "status": "inconclusive",
  "primary_count": { "label": "Inconclusive - Multiple scenarios", ... },
  "alternate_counts": [at least 2 alternates with equal weight]
}

## 📊 EVIDENCE SCORE CALCULATION (0-100)

You MUST calculate an evidence_score and provide a detailed checklist.
The score is the sum of the following components:

### 1. HARD_RULES (Pass/Fail → 20 points if pass, 0 if fail)
Check all 5 hard rules. If ANY is violated → 0 points.

### 2. FIBONACCI (0-20 points)
- Wave relationships follow Fibonacci ratios perfectly: 20
- Most waves follow Fibonacci with minor deviations: 15
- Some Fibonacci relationships but inconsistent: 10
- Weak or no Fibonacci relationships: 0-5

### 3. MOMENTUM_VOLUME (0-20 points)
- Wave 3 has highest volume, wave 5 shows divergence: 20
- Volume confirms most waves: 15
- Partial volume confirmation: 10
- No clear volume pattern: 0-5

### 4. CAGES (0-20 points)
- cage_2_4 exists AND broken with strength >1.0 ATR: 20
- cage_2_4 exists AND broken with strength 0.5-1.0 ATR: 15
- cage_2_4 exists but not broken (if bullish continuation expected): 10
- No cage or conflicting cage signals: 0-5
- Also consider cage_ACB and wedge_cage

### 5. MULTI_TF_CONSISTENCY (0-20 points)
- Macro, Meso, Micro counts align perfectly: 20
- Minor discrepancies between timeframes: 15
- Some conflict but resolvable: 10
- Major discrepancies between timeframes: 0-5

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
    "cages": { "score": 0-20, "details": "..." },
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
    "waves": [
      { "wave": "1", "date": "...", "price": ... },
      { "wave": "2", "date": "...", "price": ... },
      ...
    ],
    "current_wave": "5",
    "next_expected": "A or new cycle",
    "confidence": 0-100
  },
  "alternate_counts": [
    {
      "label": "...",
      "probability": 0-100,
      "pattern": "...",
      "justification": "...",
      "key_difference": "What pivot or degree changes the interpretation"
    }
  ],
  "key_levels": {
    "support": [...numbers...],
    "resistance": [...numbers...],
    "fibonacci_targets": [...numbers...],
    "invalidation": number
  },
  "cage_features": {
    "cage_2_4": { "exists": bool, "broken": bool, "break_direction": "up"|"down", "break_strength": number, "bars_since_break": number },
    "cage_ACB": { "exists": bool, "broken_up": bool, "broken_down": bool, "break_strength": number },
    "wedge_cage": { "exists": bool, "broken": bool, "break_strength": number, "wedge_type": "expanding"|"contracting" }
  },
  "forecast": {
    "short_term": { "direction": "bullish"|"bearish"|"neutral", "target": number, "timeframe": "1-2 weeks" },
    "medium_term": { "direction": "bullish"|"bearish"|"neutral", "target": number, "timeframe": "1-3 months" },
    "long_term": { "direction": "bullish"|"bearish"|"neutral", "target": number, "timeframe": "6-12 months" }
  },
  "key_uncertainties": ["What pivots or interpretations are ambiguous"],
  "what_would_confirm": ["What events would confirm the primary count"],
  "summary": "2-3 sentence summary in plain language"

## TRAINING MODE

If user_adjustments are provided:
- Honor the forced wave labels
- Re-analyze from those constraints
- Note adjustments in commentary
- Do NOT permanently learn from adjustments`;
}

function buildUserPrompt(
  symbol: string,
  timeframe: string,
  macroData: TimeframeData,
  mesoData: TimeframeData,
  microData: TimeframeData,
  requestedData: TimeframeData,
  segmentFeatures: SegmentFeatures[],
  cageFeatures: CageFeatures,
  historicalLow: { price: number; date: string },
  userAdjustments?: any
): string {
  const lastCandles = requestedData.candles.slice(-100);
  const candleSummary = lastCandles.map(c => 
    `${c.date}|O:${c.open.toFixed(2)}|H:${c.high.toFixed(2)}|L:${c.low.toFixed(2)}|C:${c.close.toFixed(2)}|V:${c.volume}`
  ).join('\n');

  let prompt = `
## SYMBOL: ${symbol} | TIMEFRAME: ${timeframe}

## HISTORICAL LOW
Date: ${historicalLow.date} | Price: ${historicalLow.price.toFixed(4)}

## MACRO PIVOTS (Weekly - Supercycle)
${macroData.pivots.slice(-15).map(p => `${p.date} ${p.type.toUpperCase()} $${p.price.toFixed(2)} (prominence: ${p.prominence?.toFixed(1)}%)`).join('\n')}
ATR(14): ${macroData.atr.toFixed(4)}

## MESO PIVOTS (Daily - Primary)
${mesoData.pivots.slice(-20).map(p => `${p.date} ${p.type.toUpperCase()} $${p.price.toFixed(2)} (prominence: ${p.prominence?.toFixed(1)}%)`).join('\n')}
ATR(14): ${mesoData.atr.toFixed(4)}

## MICRO PIVOTS (Intraday - Minor)
${microData.pivots.slice(-25).map(p => `${p.date} ${p.type.toUpperCase()} $${p.price.toFixed(2)} (prominence: ${p.prominence?.toFixed(1)}%)`).join('\n')}
ATR(14): ${microData.atr.toFixed(4)}

## SEGMENT FEATURES (Backend-calculated)
${JSON.stringify(segmentFeatures.slice(-10), null, 2)}

## CAGE FEATURES (Backend-calculated - USE THESE)
${JSON.stringify(cageFeatures, null, 2)}

## LAST 100 CANDLES
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
2. Use the provided segment_features and cage_features (do not invent your own)
3. Check the anti-generic rule for wave 5 conclusions
4. Return ONLY valid JSON matching the specified format
5. All text in English
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
      
      // Clean up response
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
    console.log(`=== Analyzing ${symbol} on ${normalizedTimeframe} (top-down) ===`);

    // Step 1: Perform top-down multi-timeframe analysis
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
          details: 'Verify the symbol exists on Yahoo Finance'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { macro, meso, micro, requested } = topDownData;

    // Step 2: Calculate historical low
    let historicalLow = { price: Infinity, date: '' };
    for (const candle of requested.candles) {
      if (candle.low < historicalLow.price) {
        historicalLow = { price: candle.low, date: candle.date };
      }
    }
    console.log(`Historical low: ${historicalLow.price} on ${historicalLow.date}`);

    // Step 3: Calculate RSI for segment features
    const rsiValues = calculateRSI(requested.candles);

    // Step 4: Calculate segment features from requested timeframe pivots
    const allPivots = [...requested.pivots].sort((a, b) => a.index - b.index);
    const segmentFeatures = calculateSegmentFeatures(requested.candles, allPivots, rsiValues);
    console.log(`Calculated ${segmentFeatures.length} segment features`);

    // Step 5: Calculate cage features
    const cageFeatures = computeCageFeatures(requested.candles, allPivots, requested.atr);
    console.log(`Cage features: 2-4=${cageFeatures.cage_2_4.exists}, ACB=${cageFeatures.cage_ACB.exists}, wedge=${cageFeatures.wedge_cage.exists}`);

    // Step 6: Build prompts and call LLM
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

    // Step 7: Return complete response
    return new Response(
      JSON.stringify({ 
        success: true,
        symbol: symbol.toUpperCase(),
        timeframe: normalizedTimeframe,
        analysis: report,
        // Include computed data for transparency
        computed_features: {
          timeframes_used: {
            macro: '1wk',
            meso: '1d',
            micro: normalizedTimeframe === '1d' ? '1h' : normalizedTimeframe
          },
          pivots_by_scale: {
            macro: macro.pivots.length,
            meso: meso.pivots.length,
            micro: micro.pivots.length,
            total: allPivots.length
          },
          segment_features: segmentFeatures,
          cage_features: cageFeatures,
          atr_values: {
            macro: macro.atr,
            meso: meso.atr,
            micro: micro.atr
          }
        },
        pivots: allPivots.slice(-30),
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
        details: 'Failed to analyze Elliott Wave patterns'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
