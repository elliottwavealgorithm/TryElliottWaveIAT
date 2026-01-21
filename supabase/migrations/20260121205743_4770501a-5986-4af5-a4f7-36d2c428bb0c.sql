-- ============================================================================
-- STAGE 3.5: Screener-to-Shortlist Pipeline Tables
-- ============================================================================

-- 1) Update scans table with additional fields
ALTER TABLE public.scans 
  ADD COLUMN IF NOT EXISTS base_timeframe text NOT NULL DEFAULT '1D',
  ADD COLUMN IF NOT EXISTS universe_size integer,
  ADD COLUMN IF NOT EXISTS top_n integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS include_fundamentals boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_structure_score boolean DEFAULT false;

-- 2) Create scan_symbols table for ranked symbol metrics
CREATE TABLE IF NOT EXISTS public.scan_symbols (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  final_score numeric,
  liquidity_score numeric,
  volatility_score numeric,
  regime text,
  pivot_cleanliness numeric,
  atr_pct numeric,
  structure_score numeric,
  fundamentals_score numeric,
  attention_score_13f numeric,
  last_price numeric,
  avg_volume_30d numeric,
  fundamentals jsonb,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scan_symbols_scan_id_symbol ON public.scan_symbols(scan_id, symbol);
CREATE INDEX IF NOT EXISTS idx_scan_symbols_final_score ON public.scan_symbols(scan_id, final_score DESC);

-- Enable RLS
ALTER TABLE public.scan_symbols ENABLE ROW LEVEL SECURITY;

-- RLS policies for scan_symbols (via scan ownership)
CREATE POLICY "Users can view symbols from their scans"
  ON public.scan_symbols
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = scan_symbols.scan_id AND scans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert symbols to their scans"
  ON public.scan_symbols
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = scan_symbols.scan_id AND scans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete symbols from their scans"
  ON public.scan_symbols
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = scan_symbols.scan_id AND scans.user_id = auth.uid()
  ));

-- 3) Create deep_analyses table for storing LLM analysis results
CREATE TABLE IF NOT EXISTS public.deep_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timeframe text NOT NULL DEFAULT '1D',
  analysis_json jsonb NOT NULL,
  evidence_score numeric,
  primary_pattern text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_deep_analyses_scan_symbol ON public.deep_analyses(scan_id, symbol);
CREATE INDEX IF NOT EXISTS idx_deep_analyses_symbol ON public.deep_analyses(symbol, created_at DESC);

-- Enable RLS
ALTER TABLE public.deep_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policies for deep_analyses (via scan ownership)
CREATE POLICY "Users can view their deep analyses"
  ON public.deep_analyses
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = deep_analyses.scan_id AND scans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert deep analyses to their scans"
  ON public.deep_analyses
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = deep_analyses.scan_id AND scans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their deep analyses"
  ON public.deep_analyses
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.scans
    WHERE scans.id = deep_analyses.scan_id AND scans.user_id = auth.uid()
  ));