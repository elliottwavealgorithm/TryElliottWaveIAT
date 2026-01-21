-- Create watchlists table
CREATE TABLE public.watchlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create watchlist_symbols table
CREATE TABLE public.watchlist_symbols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(watchlist_id, symbol)
);

-- Create scans table
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  watchlist_id UUID REFERENCES public.watchlists(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  results_summary JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  symbols_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create symbol_analysis table for caching analysis results
CREATE TABLE public.symbol_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  timeframe_set TEXT[] NOT NULL DEFAULT ARRAY['1D'],
  pre_filter_score NUMERIC,
  evidence_score NUMERIC,
  primary_count JSONB,
  alternates JSONB,
  levels JSONB,
  cage_features JSONB,
  fundamentals JSONB,
  raw_analysis JSONB,
  data_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_adjustments table for training mode
CREATE TABLE public.user_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1D',
  adjustment_json JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol, timeframe)
);

-- Enable RLS on all tables
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_adjustments ENABLE ROW LEVEL SECURITY;

-- Watchlists policies
CREATE POLICY "Users can view their own watchlists" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own watchlists" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watchlists" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watchlists" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- Watchlist symbols policies (via watchlist ownership)
CREATE POLICY "Users can view symbols in their watchlists" ON public.watchlist_symbols FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.watchlists WHERE id = watchlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can add symbols to their watchlists" ON public.watchlist_symbols FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists WHERE id = watchlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can remove symbols from their watchlists" ON public.watchlist_symbols FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.watchlists WHERE id = watchlist_id AND user_id = auth.uid()));

-- Scans policies
CREATE POLICY "Users can view their own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scans" ON public.scans FOR UPDATE USING (auth.uid() = user_id);

-- Symbol analysis policies
CREATE POLICY "Users can view their own analyses" ON public.symbol_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own analyses" ON public.symbol_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own analyses" ON public.symbol_analysis FOR UPDATE USING (auth.uid() = user_id);

-- User adjustments policies
CREATE POLICY "Users can view their own adjustments" ON public.user_adjustments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own adjustments" ON public.user_adjustments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own adjustments" ON public.user_adjustments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own adjustments" ON public.user_adjustments FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON public.watchlists 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_symbol_analysis_updated_at BEFORE UPDATE ON public.symbol_analysis 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_adjustments_updated_at BEFORE UPDATE ON public.user_adjustments 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_watchlist_symbols_watchlist ON public.watchlist_symbols(watchlist_id);
CREATE INDEX idx_scans_user ON public.scans(user_id);
CREATE INDEX idx_symbol_analysis_scan ON public.symbol_analysis(scan_id);
CREATE INDEX idx_symbol_analysis_symbol ON public.symbol_analysis(symbol);
CREATE INDEX idx_user_adjustments_user_symbol ON public.user_adjustments(user_id, symbol);