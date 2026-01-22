// ============================================================================
// ELLIOTT WAVE ANALYSIS TYPES (API v0.2)
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

export interface KeyLevels {
  support: number[];
  resistance: number[];
  fibonacci_targets: number[];
  invalidation: number;
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

// Wave label formatting by degree (WaveBasis-like)
export function formatWaveLabelByDegree(waveNum: number | string, degree: WaveDegree): string {
  const num = typeof waveNum === 'string' ? waveNum : String(waveNum);
  const romanNumerals: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V' };
  const lowerRoman: Record<string, string> = { '1': 'i', '2': 'ii', '3': 'iii', '4': 'iv', '5': 'v' };
  
  switch (degree) {
    case 'Supercycle':
    case 'Cycle':
      return romanNumerals[num] || num; // I II III IV V
    case 'Primary':
      return `(${num})`; // (1)(2)(3)(4)(5)
    case 'Intermediate':
      return num; // 1 2 3 4 5
    case 'Minor':
      return lowerRoman[num] || num.toLowerCase(); // i ii iii iv v
    case 'Minute':
      return `(${lowerRoman[num] || num.toLowerCase()})`; // (i)(ii)(iii)(iv)(v)
    default:
      return num;
  }
}
