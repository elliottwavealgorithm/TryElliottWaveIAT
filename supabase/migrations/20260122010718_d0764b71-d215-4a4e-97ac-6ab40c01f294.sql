-- ============================================================================
-- STAGE 3.5 PATCH A: DATABASE HARDENING
-- ============================================================================

-- 1) scans: add DELETE policy (SELECT/INSERT/UPDATE already exist)
CREATE POLICY "Users can delete their own scans"
ON public.scans
FOR DELETE
USING (auth.uid() = user_id);

-- 2) scan_symbols: add UPDATE policy (SELECT/INSERT/DELETE exist via scans ownership)
CREATE POLICY "Users can update symbols in their scans"
ON public.scan_symbols
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM scans
  WHERE scans.id = scan_symbols.scan_id
  AND scans.user_id = auth.uid()
));

-- 3) deep_analyses: add UPDATE policy (SELECT/INSERT/DELETE exist via scans ownership)
CREATE POLICY "Users can update their deep analyses"
ON public.deep_analyses
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM scans
  WHERE scans.id = deep_analyses.scan_id
  AND scans.user_id = auth.uid()
));

-- 4) Uniqueness constraints
ALTER TABLE public.scan_symbols
ADD CONSTRAINT scan_symbols_scan_id_symbol_unique UNIQUE (scan_id, symbol);

ALTER TABLE public.deep_analyses
ADD CONSTRAINT deep_analyses_scan_id_symbol_timeframe_unique UNIQUE (scan_id, symbol, timeframe);