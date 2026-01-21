// ============================================================================
// ELLIOTT WAVE ANALYSIS TYPES
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

export interface CageFeatures {
  cage_2_4: {
    exists: boolean;
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

export interface EvidenceChecklist {
  hard_rules: { passed: boolean; details: string };
  fibonacci: { score: number; details: string };
  momentum_volume: { score: number; details: string };
  cages: { score: number; details: string };
  multi_tf_consistency: { score: number; details: string };
}

export interface Forecast {
  short_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
  medium_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
  long_term: { direction: 'bullish' | 'bearish' | 'neutral'; target: number; timeframe: string };
}

export interface ElliottAnalysisResult {
  symbol: string;
  timeframe: string;
  status: 'conclusive' | 'inconclusive';
  evidence_score: number;
  evidence_checklist: EvidenceChecklist;
  primary_count: PrimaryCount;
  alternate_counts: AlternateCount[];
  key_levels: KeyLevels;
  cage_features: CageFeatures;
  forecast: Forecast;
  key_uncertainties: string[];
  what_would_confirm: string[];
  summary: string;
  analyzed_at: string;
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

export interface ScanResult {
  scan_id: string;
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
