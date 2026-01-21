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
}

export interface KeyLevels {
  support: number[];
  resistance: number[];
  fibonacci_targets: number[];
  invalidation: number;
}

// Updated cage features with break_strength_atr
export interface CageBreakInfo {
  broken: boolean;
  break_direction?: 'up' | 'down';
  break_strength_pct: number;
  break_strength_atr: number;
  bars_since_break: number;
  first_break_date?: string;
}

export interface CageCandidate {
  label: string;
  exists: boolean;
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
  };
  cage_2_4_candidates?: CageCandidate[];
  cage_ACB: {
    exists: boolean;
    broken_up: boolean;
    broken_down: boolean;
    break_strength: number;
    break_strength_pct?: number;
    break_strength_atr?: number;
  };
  wedge_cage: {
    exists: boolean;
    broken: boolean;
    break_strength: number;
    break_strength_pct?: number;
    break_strength_atr?: number;
    wedge_type?: 'expanding' | 'contracting';
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
// API RESPONSE WRAPPER
// ============================================================================

export interface AnalysisApiResponse {
  success: boolean;
  api_version: string;
  symbol: string;
  timeframe: string;
  analysis: ElliottAnalysisResult;
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
    cage_features: any;
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
  suggestions?: string[];
}
