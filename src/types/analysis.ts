// ============================================================================
// ELLIOTT WAVE ANALYSIS TYPES (API v0.3)
// ============================================================================

export interface WavePoint {
  wave: string;
  date: string;
  price: number;
  degree?: string;
}

export interface PrimaryCount {
  pattern: string;
  waves: WavePoint[];
  current_wave: string;
  next_expected: string;
  confidence: number;
}

export interface AlternateCount {
  label: string;
  probability: number;
  pattern: string;
  justification: string;
  key_difference: string;
  waves?: WavePoint[]; // Optional wave points for chart overlay
}

// Enhanced KeyLevel with source/rule metadata
export interface KeyLevelEntry {
  level: number;
  source: 'llm' | 'structure' | 'pivot-derived' | 'fibonacci';
  label?: string;
}

export interface InvalidationEntry {
  level: number;
  rule: string;
  source: 'llm' | 'structure' | 'hard-rule';
}

export interface KeyLevels {
  support: (number | KeyLevelEntry)[];
  resistance: (number | KeyLevelEntry)[];
  fibonacci_targets: number[];
  invalidation: number | InvalidationEntry;
}

// Helper to normalize KeyLevelEntry
export function normalizeKeyLevelEntry(entry: number | KeyLevelEntry): KeyLevelEntry {
  if (typeof entry === 'number') {
    return { level: entry, source: 'pivot-derived' };
  }
  return entry;
}

// Helper to get invalidation level
export function getInvalidationLevel(inv: number | InvalidationEntry | undefined): number {
  if (inv === undefined || inv === null) return 0;
  if (typeof inv === 'number') return inv;
  return inv.level;
}

// Line equation for cage drawing (y = slope * x + intercept, where x = candle index)
export interface CageLine {
  slope: number;
  intercept: number;
}

// Pre-computed point for cage rendering (date + value)
export interface CagePoint {
  date: string;
  value: number;
}

// Updated cage features with break_strength_atr and line equations
export interface CageBreakInfo {
  broken: boolean;
  break_direction?: 'up' | 'down';
  break_strength_pct: number;
  break_strength_atr: number;
  bars_since_break: number;
  first_break_date?: string;
  break_price?: number | null;
  boundary_value_at_break?: number | null;
}

export interface CageCandidate {
  label: string;
  exists: boolean;
  upper_line?: CageLine;
  lower_line?: CageLine;
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
  break_info: CageBreakInfo;
}

export interface CageFeatures {
  cage_2_4: {
    exists: boolean;
    broken: boolean;
    break_direction?: 'up' | 'down';
    break_strength: number; // Legacy, use break_strength_pct
    break_strength_pct?: number;
    break_strength_atr?: number;
    bars_since_break: number;
    first_break_date?: string;
    selected_candidate?: string;
    // Line equations for drawing
    upper_line?: CageLine;
    lower_line?: CageLine;
    // Pre-computed points for rendering
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
    break_price?: number | null;
    boundary_value_at_break?: number | null;
  };
  cage_2_4_candidates?: CageCandidate[];
  cage_ACB: {
    exists: boolean;
    broken_up: boolean;
    broken_down: boolean;
    break_strength: number;
    break_strength_pct?: number;
    break_strength_atr?: number;
    // Line equations for drawing
    upper_line?: CageLine;
    lower_line?: CageLine;
    // Pre-computed points for rendering
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
    break_price?: number | null;
    boundary_value_at_break?: number | null;
  };
  wedge_cage: {
    exists: boolean;
    broken: boolean;
    break_strength: number;
    break_strength_pct?: number;
    break_strength_atr?: number;
    wedge_type?: 'expanding' | 'contracting';
    // Line equations for drawing
    upper_line?: CageLine;
    lower_line?: CageLine;
    // Pre-computed points for rendering
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
    break_price?: number | null;
    boundary_value_at_break?: number | null;
  };
}

// Updated EvidenceChecklist with score in hard_rules
export interface EvidenceChecklist {
  hard_rules: { 
    passed: boolean; 
    score: number;  // Added: 0 or 20
    details: string 
  };
  fibonacci: { score: number; details: string };
  momentum_volume: { score: number; details: string };
  cages: { 
    score: number; 
    details: string;
    selected_cage?: string;
  };
  multi_tf_consistency: { score: number; details: string };
}

export interface Forecast {
  short_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
  medium_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
  long_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
}

export interface MultiDegreeAnalysis {
  macro: { degree: string; current_wave: string; structure: string };
  meso: { degree: string; current_wave: string; within_macro: string };
  micro: { degree: string; current_wave: string; within_meso: string };
}

export interface ElliottAnalysisResult {
  symbol: string;
  timeframe: string;
  status: 'conclusive' | 'inconclusive';
  evidence_score: number;
  evidence_checklist: EvidenceChecklist;
  multi_degree_analysis?: MultiDegreeAnalysis;
  primary_count: PrimaryCount;
  alternate_counts: AlternateCount[];
  key_levels: KeyLevels;
  cage_features: CageFeatures;
  forecast: Forecast;
  key_uncertainties: string[];
  what_would_confirm: string[];
  summary: string;
  analyzed_at?: string; // Made optional - use response timestamp instead
}

// ============================================================================
// SCREENER TYPES
// ============================================================================

export interface FundamentalsSnapshot {
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

export interface SymbolMetrics {
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
  // Structure scoring fields (v0.3)
  structure_score?: number;
  fundamentals_score?: number;
  attention_score_13f?: number | null;
  final_score?: number;
  // Deep precheck fields (v0.2)
  ew_structural_score?: number;
  ew_ready?: boolean;
  ew_notes?: string;
  fundamentals?: FundamentalsSnapshot;
  error?: string;
}

export interface ScanResult {
  scan_id: string;
  api_version?: string;
  total_symbols: number;
  processed: number;
  failed: number;
  rankings: SymbolMetrics[];
  top_symbols: string[];
  created_at: string;
  persisted?: boolean;
}

// Deep analysis result from run-deep-analysis
export interface DeepAnalysisResult {
  scan_id: string;
  total: number;
  completed: number;
  failed: number;
  results: Array<{
    symbol: string;
    success: boolean;
    evidence_score?: number;
    primary_pattern?: string;
    error?: string;
  }>;
  api_version: string;
}

// ============================================================================
// CANDLE & CHART TYPES
// ============================================================================

export interface Candle {
  date: string;
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Pivot {
  index: number;
  type: 'high' | 'low';
  price: number;
  date: string;
  prominence?: number;
  scale?: 'macro' | 'meso' | 'micro';
  source_timeframe?: string;
  source?: string;
}

// Multi-scale pivot structure from API v0.2
export interface MultiScalePivots {
  macro: Pivot[];
  meso: Pivot[];
  micro: Pivot[];
}

// ============================================================================
// USER ADJUSTMENTS (Training Mode)
// ============================================================================

export interface WaveAdjustment {
  wave_label: string;
  pivot_index: number;
  price: number;
  date: string;
}

export interface UserAdjustments {
  force_wave_labels: WaveAdjustment[];
  notes?: string;
}

// ============================================================================
// API RESPONSE WRAPPER (v0.3 with candles and auto timeframe)
// ============================================================================

export interface MajorDegreeInfo {
  degree: 'Supercycle' | 'Cycle' | 'Primary' | 'Intermediate' | string;
  timeframe_used: string;
  from_historical_low: { date: string; price: number };
  why_this_degree: string;
  years_of_data: number;
}

export interface LLMStatusInfo {
  ok: boolean;
  status_code: number;
  retry_after_seconds?: number;
  error_type?: 'rate_limit' | 'payment_required' | 'server_error' | 'parse_error';
  error_message?: string;
}

export interface AnalysisApiResponse {
  success: boolean;
  api_version: string;
  symbol: string;
  timeframe: string;
  
  // v0.3: Auto timeframe fields
  analysis_timeframe_selected: string;
  degree_focus: string;
  candles_used_count: number;
  mode: 'auto_major_degree' | 'manual';
  major_degree: MajorDegreeInfo;
  
  // v0.3: LLM status and structure-only fallback
  llm_status: LLMStatusInfo;
  structure_only?: boolean;
  
  // Single source of truth: candles aligned with analysis timeframe
  candles: Candle[];
  pivots: Pivot[];
  
  analysis: ElliottAnalysisResult;
  fundamentals?: FundamentalsSnapshot;
  
  computed_features: {
    timeframes_used: {
      macro: string;
      meso: string;
      micro: string;
      requested: string;
    };
    pivots_by_timeframe: {
      macro: { macro: number; meso: number; micro: number };
      meso: { macro: number; meso: number; micro: number };
      requested: { macro: number; meso: number; micro: number };
    };
    segment_features: {
      macro: any[];
      meso: any[];
      micro: any[];
    };
    cage_features: CageFeatures;
    atr_values: {
      macro: number;
      meso: number;
      micro: number;
      requested: number;
    };
  };
  requested_pivots: MultiScalePivots;
  historical_low: { price: number; date: string };
  dataPoints: number;
  lastPrice: number;
  timestamp: string;
  training_mode: boolean;
  error?: string;
  error_type?: string;
  retry_after_seconds?: number;
  suggestions?: string[];
}

// ============================================================================
// WAVE LAYER TYPES (Multi-degree chart layers)
// ============================================================================

export type WaveDegree = 'Supercycle' | 'Cycle' | 'Primary' | 'Intermediate' | 'Minor' | 'Minute';

export interface WaveLayer {
  layer_id: string;               // e.g. "SC-1W", "P-1D", "m-4H"
  degree: WaveDegree;
  timeframe: string;              // "1M" | "1W" | "1D" | "4H" ...
  status: 'conclusive' | 'inconclusive' | 'structure_only';
  waves: WavePoint[];             // must include wave, date, price, degree
  key_levels?: KeyLevels;         // invalidation + supports/resistances
  cage_features?: CageFeatures;   // precomputed points for drawing
  summary?: string;
  analyzed_at: string;
  source: 'llm' | 'structure';
}

export interface MultiLayerAnalysis {
  symbol: string;
  base_layer_id: string;          // highest-degree layer chosen automatically
  layers: WaveLayer[];            // always includes base layer first
  historical_low: { date: string; price: number };
}

// Helper to get degree abbreviation
export const DEGREE_ABBREV_MAP: Record<WaveDegree, string> = {
  'Supercycle': 'SC',
  'Cycle': 'C',
  'Primary': 'P',
  'Intermediate': 'I',
  'Minor': 'm',
  'Minute': 'μ',
};

// Helper to get next lower degree
export const NEXT_LOWER_DEGREE: Record<WaveDegree, WaveDegree | null> = {
  'Supercycle': 'Primary',
  'Cycle': 'Primary',
  'Primary': 'Minor',
  'Intermediate': 'Minor',
  'Minor': 'Minute',
  'Minute': null,
};

// ============================================================================
// ENHANCED WAVE LABEL NORMALIZATION
// ============================================================================

export interface NormalizedWaveLabel {
  raw: string;
  degree: string | null;
  degreeKey: WaveDegree | null;  // Strict type
  waveNum: number | null;
  waveABC: 'A' | 'B' | 'C' | null;
  waveWXY: 'W' | 'X' | 'Y' | null;
  isStart: boolean;              // True for "Start" or "0" wave
  colorKey: string;
  display: string;               // Legacy short display (e.g., "P2")
  displayEw: string;             // Elliott Wave standard display (e.g., "(2)" for Primary)
}

const ROMAN_MAP: Record<string, number> = {
  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
  'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
};

const ARABIC_TO_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
const ARABIC_TO_LOWER_ROMAN: Record<number, string> = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v' };

// Standard Elliott Wave nomenclature by degree
export function formatWaveLabelByDegree(waveNum: number | string, degree: WaveDegree, isCorrection = false): string {
  const num = typeof waveNum === 'string' ? waveNum : String(waveNum);
  
  // Handle ABC/WXY corrections
  if (['A', 'B', 'C', 'W', 'X', 'Y', 'a', 'b', 'c', 'w', 'x', 'y'].includes(num)) {
    const letter = num.toUpperCase();
    switch (degree) {
      case 'Supercycle':
      case 'Cycle':
        return letter; // A B C
      case 'Primary':
        return `(${letter})`; // (A)(B)(C)
      case 'Intermediate':
        return letter; // A B C
      case 'Minor':
        return letter.toLowerCase(); // a b c
      case 'Minute':
        return `(${letter.toLowerCase()})`; // (a)(b)(c)
      default:
        return letter;
    }
  }
  
  // Handle impulse waves 1-5
  const numVal = parseInt(num, 10);
  if (isNaN(numVal) || numVal < 1 || numVal > 5) return num;
  
  switch (degree) {
    case 'Supercycle':
      return `(${ARABIC_TO_ROMAN[numVal]})`; // (I)(II)(III)(IV)(V)
    case 'Cycle':
      return ARABIC_TO_ROMAN[numVal] || num; // I II III IV V
    case 'Primary':
      return num; // 1 2 3 4 5
    case 'Intermediate':
      return `(${num})`; // (1)(2)(3)(4)(5)
    case 'Minor':
      return ARABIC_TO_LOWER_ROMAN[numVal] || num; // i ii iii iv v
    case 'Minute':
      return `(${ARABIC_TO_LOWER_ROMAN[numVal] || num})`; // (i)(ii)(iii)(iv)(v)
    default:
      return num;
  }
}

// Parse raw wave label (e.g., "Primary 2", "Supercycle III") into normalized structure
export function normalizeWaveLabel(raw: string): NormalizedWaveLabel {
  const result: NormalizedWaveLabel = {
    raw,
    degree: null,
    degreeKey: null,
    waveNum: null,
    waveABC: null,
    waveWXY: null,
    isStart: false,
    colorKey: 'X',
    display: raw,
    displayEw: raw,
  };

  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();

  // Check for Start/0 wave
  if (lower.includes('start') || /\b0\b/.test(raw)) {
    result.isStart = true;
    result.colorKey = '0';
  }

  // Detect degree
  const degreeKeywords: Array<{ key: WaveDegree; pattern: string }> = [
    { key: 'Supercycle', pattern: 'supercycle' },
    { key: 'Cycle', pattern: 'cycle' },
    { key: 'Primary', pattern: 'primary' },
    { key: 'Intermediate', pattern: 'intermediate' },
    { key: 'Minor', pattern: 'minor' },
    { key: 'Minute', pattern: 'minute' },
  ];

  for (const { key, pattern } of degreeKeywords) {
    if (lower.includes(pattern)) {
      result.degree = key;
      result.degreeKey = key;
      break;
    }
  }

  // Detect wave number (arabic)
  const arabicMatch = raw.match(/\b([1-5])\b/);
  if (arabicMatch) {
    result.waveNum = parseInt(arabicMatch[1], 10);
    result.colorKey = arabicMatch[1];
  }

  // Detect wave number (roman numerals)
  if (!result.waveNum) {
    const romanMatch = raw.match(/\b(IV|III|II|I|V)\b/i);
    if (romanMatch) {
      const romanVal = ROMAN_MAP[romanMatch[1].toUpperCase()];
      if (romanVal) {
        result.waveNum = romanVal;
        result.colorKey = String(romanVal);
      }
    }
  }

  // Detect ABC correction
  const abcMatch = upper.match(/\b([ABC])\b|\(([ABC])\)/);
  if (abcMatch) {
    const letter = (abcMatch[1] || abcMatch[2]) as 'A' | 'B' | 'C';
    result.waveABC = letter;
    if (!result.waveNum) {
      result.colorKey = letter;
    }
  }

  // Detect WXY correction
  const wxyMatch = upper.match(/\b([WXY])\b/);
  if (wxyMatch && !result.waveNum && !result.waveABC) {
    result.waveWXY = wxyMatch[1] as 'W' | 'X' | 'Y';
    result.colorKey = wxyMatch[1];
  }

  // Build display strings
  const abbrev = result.degreeKey ? DEGREE_ABBREV_MAP[result.degreeKey] : '';
  
  // Legacy display (e.g., "SC1", "P-A")
  if (result.isStart) {
    result.display = abbrev ? `${abbrev}0` : 'Start';
  } else if (result.waveNum) {
    result.display = abbrev ? `${abbrev}${result.waveNum}` : String(result.waveNum);
  } else if (result.waveABC) {
    result.display = abbrev ? `${abbrev}-${result.waveABC}` : result.waveABC;
  } else if (result.waveWXY) {
    result.display = abbrev ? `${abbrev}-${result.waveWXY}` : result.waveWXY;
  }

  // Elliott Wave standard display (using degree nomenclature)
  if (result.degreeKey) {
    if (result.isStart) {
      result.displayEw = formatWaveLabelByDegree('0', result.degreeKey);
    } else if (result.waveNum) {
      result.displayEw = formatWaveLabelByDegree(result.waveNum, result.degreeKey);
    } else if (result.waveABC) {
      result.displayEw = formatWaveLabelByDegree(result.waveABC, result.degreeKey, true);
    } else if (result.waveWXY) {
      result.displayEw = formatWaveLabelByDegree(result.waveWXY, result.degreeKey, true);
    }
  } else {
    // No degree detected, use raw number/letter
    if (result.waveNum) {
      result.displayEw = String(result.waveNum);
    } else if (result.waveABC) {
      result.displayEw = result.waveABC;
    } else if (result.waveWXY) {
      result.displayEw = result.waveWXY;
    }
  }

  return result;
}
